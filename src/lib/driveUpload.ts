import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataAgreementMember } from "./dataAgreementPdf";

const configuredDataAgreementFunctionName =
  process.env.VITE_DATA_AGREEMENT_FUNCTION_NAME?.trim();
const defaultDataAgreementFunctionNames = ["upload-data-agreement", "swift-worker"];
const dataAgreementFunctionNames = configuredDataAgreementFunctionName
  ? [
      configuredDataAgreementFunctionName,
      ...defaultDataAgreementFunctionNames.filter(
        (functionName) => functionName !== configuredDataAgreementFunctionName,
      ),
    ]
  : defaultDataAgreementFunctionNames;

export type DataAgreementUploadPayload = {
  fileName: string;
  pdfBase64: string;
  signedAt: string;
  member: DataAgreementMember;
};

export type DataAgreementUploadResult = {
  fileId: string;
  fileName: string;
  webViewLink: string | null;
};

export async function uploadDataAgreementToDrive(
  client: SupabaseClient,
  payload: DataAgreementUploadPayload,
) {
  let lastError: unknown = null;

  for (const functionName of dataAgreementFunctionNames) {
    const { data, error } =
      await client.functions.invoke<DataAgreementUploadResult>(functionName, {
        body: payload,
      });

    if (error) {
      lastError = error;

      if (
        dataAgreementFunctionNames.length > 1 &&
        error.message.toLowerCase().includes("failed to send")
      ) {
        continue;
      }

      throw new Error(
        error.message ||
          "No se ha podido subir el acuerdo firmado a Google Drive.",
      );
    }

    if (!data?.fileId) {
      throw new Error("Google Drive no ha devuelto el archivo guardado.");
    }

    return data;
  }

  throw new Error(
    lastError instanceof Error
      ? `${lastError.message}. Revisa el nombre de la Edge Function.`
      : "No se ha podido contactar con la Edge Function.",
  );
}
