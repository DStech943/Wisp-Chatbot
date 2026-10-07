import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// Vault Helper (Securely fetch third-party API keys)
// This uses a direct Postgres connection injected by the edge runtime
// to read directly from vault.decrypted_secrets. 

function getDbUrl() {
    let dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("SUPABASE_DB_URL is not available in the edge runtime.");
    // Bypass Docker DNS failure by forcing the internal database container name
    return dbUrl.replace("supabasedb.datastraw.in", "db").replace(":6543", ":5432");
}

// [PERF] getSecretFromVault is called from ~60 edge functions, often multiple times
// per request (OPENROUTER_API_KEY, OPENROUTER_EMBEDDING, per-brand SHOPIFY_*_DOMAIN/
// TOKEN, etc.), and every call previously opened a brand-new Postgres connection just
// to read one row. Caching per warm isolate — same TTL pattern as genie_auth.ts's role
// cache and genie_langfuse.ts's credential cache — collapses that to one DB round trip
// per secret per isolate per hour instead of one per request.
const SECRET_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const secretCache = new Map<string, { value: string; expiresAt: number }>();

export async function getSecretFromVault(secretName: string): Promise<string> {
    const envVal = Deno.env.get(secretName);
    if (envVal) return envVal;

    const cached = secretCache.get(secretName);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const sql = postgres(getDbUrl(), { max: 1 });
    try {
        const rows = await sql`
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = ${secretName}
            LIMIT 1
        `;
        if (rows.length === 0) {
            throw new Error(`Secret '${secretName}' not found in vault.decrypted_secrets`);
        }
        const value = rows[0].decrypted_secret;
        secretCache.set(secretName, { value, expiresAt: Date.now() + SECRET_CACHE_TTL_MS });
        return value;
    } finally {
        await sql.end();
    }
}

export async function checkSecretsExist(secretNames: string[]): Promise<Record<string, boolean>> {
    if (secretNames.length === 0) return {};
    
    const sql = postgres(getDbUrl(), { max: 1 });
    try {
        const rows = await sql`
            SELECT name
            FROM vault.decrypted_secrets
            WHERE name IN ${sql(secretNames)}
        `;
        const existingNames = new Set(rows.map((r: { name: string }) => r.name));
        const result: Record<string, boolean> = {};
        for (const name of secretNames) {
            result[name] = existingNames.has(name);
        }
        return result;
    } finally {
        await sql.end();
    }
}

export async function upsertSecretToVault(secretName: string, secretValue: string): Promise<void> {
    const sql = postgres(getDbUrl(), { max: 1 });
    try {
        // Delete existing secret with the same name if it exists to avoid duplicates
        await sql`
            DELETE FROM vault.secrets
            WHERE name = ${secretName}
        `;

        // Create new secret
        await sql`
            SELECT vault.create_secret(${secretValue}, ${secretName})
        `;
        // Drop the cached value so this isolate picks up the new secret on its very
        // next read instead of serving the stale one for up to an hour. Other warm
        // isolates still hold the old value until their own TTL expires — same
        // accepted tradeoff as the role/credential caches elsewhere in this codebase.
        secretCache.delete(secretName);
    } finally {
        await sql.end();
    }
}

export async function getAllGeminiKeysFromVault(): Promise<string[]> {
    const keys: string[] = [];
    const knownEnvNames = [
        "GEMINI_API_KEY",
        "GEMINI_API_KEY_1",
        "GEMINI_API_KEY_2",
        "GEMINI_API_KEY_3",
        "GEMINI_API_KEY_4",
        "GEMINI_API_KEY_5",
        "GEMINI_API_KEY_6",
        "GEMINI_API_KEY_7",
        "GEMINI_API_KEY_8",
        "GEMINI_API_KEY_9",
        "GEMINI_API_KEY_10",
        "Gemini_API_Key_1",
        "Gemini_API_Key_2",
        "Gemini_API_Key_6",
        "Gemini_API_Key_7",
    ];

    for (const name of knownEnvNames) {
        const val = Deno.env.get(name);
        if (val && val.trim().startsWith("AIzaSy") && !keys.includes(val.trim())) {
            keys.push(val.trim());
        }
    }

    try {
        const envObj = Deno.env.toObject();
        for (const [keyName, val] of Object.entries(envObj)) {
            if (!val || typeof val !== 'string') continue;
            const trimmed = val.trim();
            if (trimmed.startsWith("AIzaSy") && !keys.includes(trimmed)) {
                keys.push(trimmed);
            }
        }
    } catch {
        // ignore if Deno.env.toObject() is restricted
    }

    try {
        const sql = postgres(getDbUrl(), { max: 1 });
        try {
            const rows = await sql`
                SELECT name, decrypted_secret
                FROM vault.decrypted_secrets
                WHERE decrypted_secret LIKE 'AIzaSy%'
                   OR (name ILIKE '%gemini%' AND decrypted_secret NOT LIKE 'AQ.Ab8%')
                ORDER BY name ASC
            `;
            for (const row of rows) {
                const s = (row.decrypted_secret || '').trim();
                if (s && s.startsWith("AIzaSy") && !keys.includes(s)) {
                    keys.push(s);
                }
            }
        } finally {
            await sql.end();
        }
    } catch (err) {
        console.error("Error fetching Gemini keys from vault:", err);
    }

    return keys;
}

export async function inspectVaultSecrets(): Promise<{ name: string; len: number; prefix: string }[]> {
    try {
        const sql = postgres(getDbUrl(), { max: 1 });
        try {
            const rows = await sql`
                SELECT name, length(decrypted_secret) as len, substring(decrypted_secret from 1 for 8) as prefix
                FROM vault.decrypted_secrets
                ORDER BY name ASC
            `;
            return rows.map((r: any) => ({ name: r.name, len: Number(r.len), prefix: r.prefix }));
        } finally {
            await sql.end();
        }
    } catch (err) {
        console.error("Error inspecting vault secrets:", err);
        return [];
    }
}
