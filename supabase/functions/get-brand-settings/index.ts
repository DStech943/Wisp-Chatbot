import { getSecretFromVault } from "../_shared/vault.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

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

    const settings = await getBrandSettings(siteId);
    return jsonResponse({ ok: true, settings }, 200, origin);
  } catch (error) {
    console.error("Get brand settings failed", error);
    return jsonResponse({ ok: false, error: "Could not load settings" }, 500, origin);
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

async function getBrandSettings(siteId: string): Promise<unknown> {
  const sql = postgres(getDbUrl(), { max: 1 });

  try {
    const rows = await sql<{ nudge_settings: unknown; ui_settings: unknown }[]>`
      select
        coalesce(settings.nudge_settings, '{}'::jsonb) as nudge_settings,
        coalesce(settings.ui_settings, '{}'::jsonb) as ui_settings
      from fp3.brands brands
      left join fp3.brand_settings settings on settings.brand_id = brands.brand_id
      where brands.site_id = ${siteId}
      limit 1
    `;

    if (rows.length === 0) {
      throw new Error("Unknown site_id");
    }

    return {
      nudge_settings: rows[0].nudge_settings || {},
      ui_settings: rows[0].ui_settings || {},
    };
  } finally {
    await sql.end();
  }
}
