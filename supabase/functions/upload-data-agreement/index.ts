import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

type UploadPayload = {
  fileName: string;
  pdfBase64: string;
  signedAt: string;
  member: {
    firstName: string;
    lastName: string;
    dni: string;
    email: string | null;
    memberNumber: string;
  };
};

type AppsScriptResponse = {
  ok?: boolean;
  fileId?: string;
  fileName?: string;
  webViewLink?: string | null;
  error?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

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

async function uploadWithAppsScript(payload: UploadPayload) {
  const scriptUrl = getRequiredEnv("GOOGLE_APPS_SCRIPT_URL");
  const secret = getRequiredEnv("GOOGLE_APPS_SCRIPT_SECRET");
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      ...payload,
      secret,
    }),
  });

  if (!response.ok) {
    throw new Error("Google Apps Script rejected the upload request.");
  }

  const result = (await response.json()) as AppsScriptResponse;

  if (!result.ok || !result.fileId || !result.fileName) {
    throw new Error(result.error || "Google Drive did not return a saved file.");
  }

  return {
    fileId: result.fileId,
    fileName: result.fileName,
    webViewLink: result.webViewLink ?? null,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Missing member session." }, 401);
    }

    const supabase = createClient(
      getRequiredEnv("SUPABASE_URL"),
      getRequiredEnv("SUPABASE_ANON_KEY"),
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonResponse({ error: "Invalid session." }, 401);
    }

    const payload = (await request.json()) as UploadPayload;

    if (!payload.fileName || !payload.pdfBase64 || !payload.signedAt) {
      return jsonResponse({ error: "Missing agreement data." }, 400);
    }

    const file = await uploadWithAppsScript(payload);

    return jsonResponse(file);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not upload the agreement to Drive.",
      },
      500,
    );
  }
});
