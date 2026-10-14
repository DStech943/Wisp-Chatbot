import { getSecretFromVault } from "../_shared/vault.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

type UpdateSettingsPayload = {
  site_id?: unknown;
  nudge_settings?: unknown;
  ui_settings?: unknown;
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

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, origin);
  }

  try {
    const dashboardKey = request.headers.get("X-Dashboard-Key") || "";
    const expectedDashboardKey = await getSecretFromVault("WISP_DASHBOARD_KEY");

    if (!expectedDashboardKey || dashboardKey !== expectedDashboardKey) {
      return jsonResponse({ ok: false, error: "Invalid key" }, 401, origin);
    }

    const body = await request.json() as UpdateSettingsPayload;
    const siteId = stringField(body.site_id, "site_id", 200);
    const nudgeSettings = objectField(body.nudge_settings, "nudge_settings");
    const uiSettings = objectField(body.ui_settings, "ui_settings");

    await updateSettings(siteId, nudgeSettings, uiSettings);

    return jsonResponse({ ok: true }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update settings";
    return jsonResponse({ ok: false, error: message }, 400, origin);
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function stringField(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${name} is too long`);
  }

  return trimmed;
}

function objectField(value: unknown, name: string): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }

  const encoded = JSON.stringify(value);
  if (encoded.length > 50000) {
    throw new Error(`${name} is too large`);
  }

  return value as Record<string, unknown>;
}

async function updateSettings(
  siteId: string,
  nudgeSettings: Record<string, unknown>,
  uiSettings: Record<string, unknown>,
): Promise<void> {
  const sql = postgres(getDbUrl(), { max: 1 });

  try {
    const rows = await sql<{ brand_id: string }[]>`
      select brand_id
      from fp3.brands
      where site_id = ${siteId}
      limit 1
    `;

    if (rows.length === 0) {
      throw new Error("Unknown site_id");
    }

    await sql`
      insert into fp3.brand_settings (
        brand_id,
        site_id,
        nudge_settings,
        ui_settings
      ) values (
        ${rows[0].brand_id},
        ${siteId},
        ${sql.json(nudgeSettings)},
        ${sql.json(uiSettings)}
      )
      on conflict (brand_id) do update set
        site_id = excluded.site_id,
        nudge_settings = excluded.nudge_settings,
        ui_settings = excluded.ui_settings
    `;
  } finally {
    await sql.end();
  }
}
