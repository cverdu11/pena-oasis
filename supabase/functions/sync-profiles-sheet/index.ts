// Syncs profiles to SOCIOS via the dedicated Google Sheets Apps Script web app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

type ProfileRow = {
  full_name: string | null;
  dni: string | null;
  member_number: string | null;
};

type AppsScriptSyncResponse = {
  ok?: boolean;
  spreadsheetId?: string;
  sheetName?: string;
  rowCount?: number;
  insertedRows?: number;
  updatedRows?: number;
  updatedAt?: string;
  error?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const pageSize = 1000;
const profileSelect = "full_name,dni,member_number";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function getAdminApiKey() {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (serviceRoleKey) {
    return serviceRoleKey;
  }

  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY")?.trim();

  if (secretKey) {
    return secretKey;
  }

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();

  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      const defaultSecret = parsed.default?.trim();

      if (defaultSecret) {
        return defaultSecret;
      }
    } catch {
      throw new Error("SUPABASE_SECRET_KEYS is not valid JSON.");
    }
  }

  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY.");
}

function getProvidedSyncSecret(request: Request) {
  const headerSecret = request.headers.get("x-sync-secret")?.trim();

  if (headerSecret) {
    return headerSecret;
  }

  const authorization = request.headers.get("Authorization")?.trim() ?? "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() ?? "";
}

function assertAuthorized(request: Request) {
  const expectedSecret = getRequiredEnv("PROFILES_SYNC_SECRET");
  const providedSecret = getProvidedSyncSecret(request);

  if (!providedSecret || providedSecret !== expectedSecret) {
    return false;
  }

  return true;
}

function cleanCell(value: string | null) {
  return value?.trim() ?? "";
}

function hasExportableData(row: ProfileRow) {
  return Boolean(
    cleanCell(row.full_name) || cleanCell(row.dni) || cleanCell(row.member_number),
  );
}

function toSheetRows(profiles: ProfileRow[]) {
  return profiles.filter(hasExportableData).map((profile) => ({
    full_name: cleanCell(profile.full_name),
    dni: cleanCell(profile.dni),
    member_number: cleanCell(profile.member_number),
  }));
}

async function fetchProfiles() {
  const supabase = createClient(
    getRequiredEnv("SUPABASE_URL"),
    getAdminApiKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const profiles: ProfileRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select(profileSelect)
      .order("member_number", { ascending: true })
      .order("full_name", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Could not read profiles: ${error.message}`);
    }

    const page = (data ?? []) as ProfileRow[];
    profiles.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return profiles;
}

async function readAppsScriptResponse(response: Response) {
  const body = await response.text();

  try {
    return JSON.parse(body) as AppsScriptSyncResponse;
  } catch {
    throw new Error(body || "Google Apps Script returned an invalid response.");
  }
}

async function syncWithAppsScript(rows: ReturnType<typeof toSheetRows>) {
  const scriptUrl = getRequiredEnv("GOOGLE_SHEETS_APPS_SCRIPT_URL");
  const secret = getRequiredEnv("GOOGLE_SHEETS_APPS_SCRIPT_SECRET");
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "syncProfilesSheet",
      secret,
      columns: ["full_name", "dni", "member_number"],
      rows,
    }),
  });

  if (!response.ok) {
    throw new Error("Google Apps Script rejected the profiles sync request.");
  }

  const result = await readAppsScriptResponse(response);

  if (!result.ok) {
    throw new Error(result.error || "Google Sheets did not confirm the sync.");
  }

  return result;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    if (!assertAuthorized(request)) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const profiles = await fetchProfiles();
    const rows = toSheetRows(profiles);
    const sheet = await syncWithAppsScript(rows);

    return jsonResponse({
      ok: true,
      exportedRows: rows.length,
      spreadsheetId: sheet.spreadsheetId ?? null,
      sheetName: sheet.sheetName ?? null,
      insertedRows: sheet.insertedRows ?? null,
      updatedRows: sheet.updatedRows ?? null,
      updatedAt: sheet.updatedAt ?? null,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not sync profiles to Google Sheets.",
      },
      500,
    );
  }
});
