import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataAgreementMember } from "./dataAgreementPdf";

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
  const { data, error } =
    await client.functions.invoke<DataAgreementUploadResult>(
      "upload-data-agreement",
      {
        body: payload,
      },
    );

  if (error) {
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
