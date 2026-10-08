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
        id,
        site_id,
        session_id,
        message,
        reply,
        handoff,
        platform,
        page_url,
        origin,
        created_at
      from fp3.conversations
      where site_id = ${siteId}
      order by created_at desc
      limit 200
    `;
  } finally {
    await sql.end();
  }
}
