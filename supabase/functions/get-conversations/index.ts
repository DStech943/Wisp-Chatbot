import { getSecretFromVault } from "../_shared/vault.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

type ConversationRow = {
  id: string;
  site_id: string;
  session_id: string;
  message: string;
  reply: string;
  handoff: boolean;
  platform: string | null;
  page_url: string | null;
  origin: string | null;
  created_at: string;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin") || "";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, origin);
  }

  try {
    const dashboardKey = request.headers.get("X-Dashboard-Key") || "";
    const expectedDashboardKey = await getSecretFromVault("WISP_DASHBOARD_KEY");

    if (!expectedDashboardKey || dashboardKey !== expectedDashboardKey) {
      return jsonResponse({ ok: false, error: "Invalid key" }, 401, origin);
    }

    const url = new URL(request.url);
    const siteId = (url.searchParams.get("site_id") || "").trim();

    if (!siteId || siteId.length > 200) {
      return jsonResponse({ ok: false, error: "Invalid site_id" }, 400, origin);
    }

    const rows = await getConversations(siteId);

    return jsonResponse(rows, 200, origin);
  } catch (error) {
    console.error("Get conversations failed", error);
    return jsonResponse({ ok: false, error: "Could not load conversations" }, 500, origin);
  }
});

function getDbUrl(): string {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    throw new Error("SUPABASE_DB_URL is not configured");
  }

  return dbUrl.replace("supabasedb.datastraw.in", "db").replace(":6543", ":5432");
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-dashboard-key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...corsHeaders(origin),
    },
  });
}

async function getConversations(siteId: string): Promise<ConversationRow[]> {
  const sql = postgres(getDbUrl(), { max: 1 });

  try {
    return await sql<ConversationRow[]>`
      select
        customer.id,
        customer.site_id,
        customer.conversation_id as session_id,
        customer.content as message,
        coalesce(assistant.content, '') as reply,
        coalesce((assistant.meta_data ->> 'handoff')::boolean, thread.handoff, false) as handoff,
        customer.platform,
        customer.meta_data ->> 'page_url' as page_url,
        customer.meta_data ->> 'origin' as origin,
        customer.timestamp as created_at
      from cx_copilot.wisp_messages as customer
      inner join cx_copilot.wisp_threads as thread
        on thread.id = customer.thread_id
      left join lateral (
        select
          assistant.content,
          assistant.meta_data
        from cx_copilot.wisp_messages as assistant
        where assistant.thread_id = customer.thread_id
          and assistant.role = 'assistant'
          and assistant.direction = 'outbound'
          and assistant.timestamp > customer.timestamp
        order by assistant.timestamp asc, assistant.created_at asc
        limit 1
      ) as assistant on true
      where customer.site_id = ${siteId}
        and customer.role = 'customer'
        and customer.direction = 'inbound'
      order by customer.timestamp desc
      limit 200
    `;
  } finally {
    await sql.end();
  }
}
