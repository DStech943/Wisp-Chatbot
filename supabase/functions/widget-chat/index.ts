import { getSecretFromVault } from "../_shared/vault.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

type Brand = {
  brand_id: string;
  site_id: string;
  brand_name: string;
  website_url: string | null;
  backend_url: string;
  backend_secret_name: string;
  allowed_origins: string[];
  platform: string;
  status: string;
};

type WidgetPayload = {
  site_id?: unknown;
  message?: unknown;
  session_id?: unknown;
  platform?: unknown;
  page_url?: unknown;
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
    return jsonResponse({ reply: "Method not allowed" }, 405);
  }

  if (!origin) {
    return jsonResponse({ reply: "Origin required" }, 403);
  }

  let body: WidgetPayload;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ reply: "Invalid JSON body" }, 400);
  }

  if (typeof body.site_id !== "string" || body.site_id.length === 0 || body.site_id.length > 200) {
    return jsonResponse({ reply: "Invalid site_id" }, 400);
  }

  const brand = await getBrand(body.site_id);
  if (!brand) {
    return jsonResponse({ reply: "Not allowed" }, 403);
  }

  if (!brand.allowed_origins.includes(origin)) {
    return jsonResponse({ reply: "Not allowed" }, 403);
  }

  if (brand.status === "paused") {
    return jsonResponse({ reply: "Not allowed" }, 403, origin);
  }

  const validationError = validateWidgetPayload(body);
  if (validationError) {
    return jsonResponse({ reply: validationError }, 400, origin);
  }

  const backendPayload = {
    message: body.message as string,
    session_id: body.session_id as string,
    platform: (body.platform as string | undefined) || brand.platform || "web",
    page_url: (body.page_url as string | null | undefined) || null,
  };

  try {
    const gatewaySecret = await getSecretFromVault(brand.backend_secret_name);
    const backendResponse = await forwardToBrandBackend(
      brand.backend_url,
      gatewaySecret,
      backendPayload,
    );

    if (backendResponse.status === 200) {
      await storeConversation({
        brand_id: brand.brand_id,
        site_id: brand.site_id,
        session_id: backendPayload.session_id,
        message: backendPayload.message,
        reply: backendResponse.body.reply,
        handoff: backendResponse.body.handoff === true,
        platform: backendPayload.platform,
        page_url: backendPayload.page_url,
        origin,
      });
    }

    return jsonResponse(backendResponse.body, backendResponse.status, origin);
  } catch {
    return jsonResponse(
      { reply: "Sorry, I'm having trouble right now. Please try again." },
      504,
      origin,
    );
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
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, status: number, origin?: string): Response {
  const headers: HeadersInit = origin
    ? {
        ...jsonHeaders,
        ...corsHeaders(origin),
      }
    : jsonHeaders;

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function validateWidgetPayload(body: WidgetPayload): string | null {
  if (typeof body.site_id !== "string" || body.site_id.length === 0 || body.site_id.length > 200) {
    return "Invalid site_id";
  }

  if (typeof body.message !== "string" || body.message.length === 0 || body.message.length > 1000) {
    return "Invalid message";
  }

  if (
    typeof body.session_id !== "string" ||
    body.session_id.length === 0 ||
    body.session_id.length > 100
  ) {
    return "Invalid session_id";
  }

  if (body.platform !== undefined && typeof body.platform !== "string") {
    return "Invalid platform";
  }

  if (body.page_url !== undefined && body.page_url !== null && typeof body.page_url !== "string") {
    return "Invalid page_url";
  }

  return null;
}

async function getBrand(siteId: string): Promise<Brand | null> {
  const sql = postgres(getDbUrl(), { max: 1 });

  try {
    const rows = await sql<Brand[]>`
      select
        brand_id,
        site_id,
        brand_name,
        website_url,
        backend_url,
        backend_secret_name,
        allowed_origins,
        platform,
        status
      from fp3.brands
      where site_id = ${siteId}
      limit 1
    `;

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  } catch (error) {
    console.error("Brand lookup failed", error);
    return null;
  } finally {
    await sql.end();
  }
}

async function forwardToBrandBackend(
  backendUrl: string,
  gatewaySecret: string,
  payload: {
    message: string;
    session_id: string;
    platform: string;
    page_url: string | null;
  },
): Promise<{ status: number; body: { reply: string; handoff?: boolean } }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Gateway-Secret": gatewaySecret,
    });

    const response = await fetch(backendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let responseBody: { reply?: unknown; handoff?: unknown } = {
      reply: "Sorry, I'm having trouble right now. Please try again.",
    };

    try {
      responseBody = await response.json();
    } catch {
      // Keep the generic body when the backend returns non-JSON.
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: 502,
        body: { reply: "Sorry, I'm having trouble right now. Please try again." },
      };
    }

    if (!response.ok) {
      return {
        status: 502,
        body: normalizeBackendBody(responseBody),
      };
    }

    return {
      status: 200,
      body: normalizeBackendBody(responseBody),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBackendBody(body: { reply?: unknown; handoff?: unknown }): {
  reply: string;
  handoff?: boolean;
} {
  return {
    reply: typeof body.reply === "string"
      ? body.reply
      : "Sorry, I'm having trouble right now. Please try again.",
    ...(body.handoff === true ? { handoff: true } : {}),
  };
}

async function storeConversation(row: {
  brand_id: string;
  site_id: string;
  session_id: string;
  message: string;
  reply: string;
  handoff: boolean;
  platform: string;
  page_url: string | null;
  origin: string;
}): Promise<void> {
  const sql = postgres(getDbUrl(), { max: 1 });

  try {
    await sql`
      insert into fp3.conversations (
        brand_id,
        site_id,
        session_id,
        message,
        reply,
        handoff,
        platform,
        page_url,
        origin
      ) values (
        ${row.brand_id},
        ${row.site_id},
        ${row.session_id},
        ${row.message},
        ${row.reply},
        ${row.handoff},
        ${row.platform},
        ${row.page_url},
        ${row.origin}
      )
    `;
  } catch (error) {
    console.error("Conversation insert failed", error);
  } finally {
    await sql.end();
  }
}
