import { getSecretFromVault } from "../_shared/vault.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

type RegisterBrandPayload = {
  site_id?: unknown;
  brand_name?: unknown;
  website_url?: unknown;
  backend_url?: unknown;
  allowed_origins?: unknown;
  platform?: unknown;
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
    const adminKey = request.headers.get("X-Admin-Key") || "";
    const expectedAdminKey = await getSecretFromVault("WISP_ADMIN_KEY");

    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return jsonResponse({ ok: false, error: "Invalid admin key" }, 401, origin);
    }

    const body = await request.json() as RegisterBrandPayload;
    const normalized = normalizePayload(body);

    await upsertBrand(normalized);

    return jsonResponse({
      ok: true,
      site_id: normalized.site_id,
      allowed_origins: normalized.allowed_origins,
      status: "active",
    }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not register brand";
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
    "Access-Control-Allow-Headers": "content-type, x-admin-key",
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

function normalizePayload(body: RegisterBrandPayload): {
  site_id: string;
  brand_name: string;
  website_url: string;
  backend_url: string;
  allowed_origins: string[];
  platform: "web";
} {
  const siteId = stringField(body.site_id, "site_id");
  const brandName = stringField(body.brand_name, "brand_name");
  const websiteUrl = normalizeUrl(stringField(body.website_url, "website_url"), "website_url");
  const backendUrl = normalizeUrl(stringField(body.backend_url, "backend_url"), "backend_url");
  const platform = body.platform === "web" || body.platform === undefined ? "web" : null;

  if (!platform) {
    throw new Error("platform must be web");
  }

  if (!backendUrl.startsWith("https://")) {
    throw new Error("backend_url must use https");
  }

  const origins = normalizeOrigins(body.allowed_origins);
  if (!origins.includes(new URL(websiteUrl).origin)) {
    origins.unshift(new URL(websiteUrl).origin);
  }

  return {
    site_id: siteId,
    brand_name: brandName,
    website_url: websiteUrl,
    backend_url: backendUrl,
    allowed_origins: origins,
    platform,
  };
}

function stringField(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  const trimmed = value.trim();
  if (trimmed.length > 500) {
    throw new Error(`${name} is too long`);
  }

  return trimmed;
}

function normalizeUrl(value: string, name: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(`${name} must be an http or https URL`);
    }
    return url.href.replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function normalizeOrigins(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("allowed_origins must be an array");
  }

  const origins = value.map((item) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error("allowed_origins must contain only URLs");
    }

    try {
      return new URL(item.trim()).origin;
    } catch {
      throw new Error("allowed_origins must contain only valid URLs");
    }
  });

  return Array.from(new Set(origins));
}

async function upsertBrand(brand: {
  site_id: string;
  brand_name: string;
  website_url: string;
  backend_url: string;
  allowed_origins: string[];
  platform: "web";
}): Promise<void> {
  const sql = postgres(getDbUrl(), { max: 1 });

  try {
    await sql`
      insert into fp3.brands (
        site_id,
        brand_name,
        website_url,
        backend_url,
        allowed_origins,
        platform,
        status
      ) values (
        ${brand.site_id},
        ${brand.brand_name},
        ${brand.website_url},
        ${brand.backend_url},
        ${brand.allowed_origins},
        ${brand.platform},
        'active'
      )
      on conflict (site_id) do update set
        brand_name = excluded.brand_name,
        website_url = excluded.website_url,
        backend_url = excluded.backend_url,
        allowed_origins = excluded.allowed_origins,
        platform = excluded.platform,
        status = 'active'
    `;
  } finally {
    await sql.end();
  }
}
