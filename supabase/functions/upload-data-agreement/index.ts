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
    throw new Error(`Falta configurar ${name}.`);
  }

  return value;
}

function base64Url(value: string | ArrayBuffer) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function sanitizeDriveFileName(value: string) {
  const clean = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim();
  return clean.endsWith(".pdf") ? clean : `${clean || "acuerdo-firmado"}.pdf`;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function getGoogleAccessToken() {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_PRIVATE_KEY");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.file",
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(claim),
  )}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Google no ha emitido el token de subida a Drive.");
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token as string;
}

async function uploadPdfToDrive(fileName: string, pdfBytes: Uint8Array) {
  const accessToken = await getGoogleAccessToken();
  const folderId = getRequiredEnv("GOOGLE_DRIVE_FOLDER_ID");
  const boundary = `agreement-${crypto.randomUUID()}`;
  const metadata = {
    mimeType: "application/pdf",
    name: sanitizeDriveFileName(fileName),
    parents: [folderId],
  };
  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata,
    )}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(prefix.length + pdfBytes.length + suffix.length);
  body.set(prefix, 0);
  body.set(pdfBytes, prefix.length);
  body.set(suffix, prefix.length + pdfBytes.length);

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!uploadResponse.ok) {
    throw new Error("Google Drive ha rechazado la subida del PDF.");
  }

  return uploadResponse.json() as Promise<{
    id: string;
    name: string;
    webViewLink?: string;
  }>;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405);
  }

  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Falta la sesión del socio." }, 401);
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
      return jsonResponse({ error: "Sesión no válida." }, 401);
    }

    const payload = (await request.json()) as UploadPayload;

    if (!payload.fileName || !payload.pdfBase64 || !payload.signedAt) {
      return jsonResponse({ error: "Faltan datos del acuerdo." }, 400);
    }

    const pdfBytes = base64ToBytes(payload.pdfBase64);
    const file = await uploadPdfToDrive(payload.fileName, pdfBytes);

    return jsonResponse({
      fileId: file.id,
      fileName: file.name,
      webViewLink: file.webViewLink ?? null,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se ha podido subir el acuerdo a Drive.",
      },
      500,
    );
  }
});
