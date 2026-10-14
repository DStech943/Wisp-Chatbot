import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

type Brand = {
  brand_id: string;
  site_id: string;
  allowed_origins: string[];
  status: string;
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
    if (!origin) {
      return jsonResponse({ ok: false, error: "Origin required" }, 403, origin);
    }

    const url = new URL(request.url);
    const siteId = (url.searchParams.get("site_id") || "").trim();

    if (!siteId || siteId.length > 200) {
      return jsonResponse({ ok: false, error: "Invalid site_id" }, 400, origin);
    }

    const brand = await getBrand(siteId);
    if (!brand || brand.status !== "active" || !brand.allowed_origins.includes(origin)) {
      return jsonResponse({ ok: false, error: "Not allowed" }, 403, origin);
    }

    const settings = await getSettings(brand.brand_id);
    return jsonResponse({ ok: true, settings }, 200, origin);
  } catch (error) {
    console.error("Widget config failed", error);
    return jsonResponse({ ok: false, error: "Could not load config" }, 500, origin);
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
    "Access-Control-Allow-Headers": "content-type",
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

async function getBrand(siteId: string): Promise<Brand | null> {
  const sql = postgres(getDbUrl(), { max: 1 });

  try {
    const rows = await sql<Brand[]>`
      select
        brand_id,
        site_id,
        allowed_origins,
        status
      from fp3.brands
      where site_id = ${siteId}
      limit 1
    `;

    return rows[0] || null;
  } finally {
    await sql.end();
  }
}

async function getSettings(brandId: string): Promise<unknown> {
  const sql = postgres(getDbUrl(), { max: 1 });

  try {
    const rows = await sql<{ nudge_settings: unknown; ui_settings: unknown }[]>`
      select
        nudge_settings,
        ui_settings
      from fp3.brand_settings
      where brand_id = ${brandId}
      limit 1
    `;

    return {
      nudge_settings: rows[0]?.nudge_settings || {},
      ui_settings: rows[0]?.ui_settings || {},
    };
  } finally {
    await sql.end();
  }
}
