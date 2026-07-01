import type { PDFFont, PDFPage } from "pdf-lib";
import agreementTemplateUrl from "../../public/documents/acuerdo-comunicacion-datos-personales-mcf.pdf";

export const DATA_AGREEMENT_TEMPLATE_URL = agreementTemplateUrl;
const AGREEMENT_FILE_SUFFIX =
  "Acuerdo de comunicación de datos personales.pdf";

export type DataAgreementMember = {
  firstName: string;
  lastName: string;
  dni: string;
  email: string | null;
  memberNumber: string;
};

type SignedAgreementInput = {
  member: DataAgreementMember;
  signatureDataUrl: string;
  signedAt: string;
};

export type SignedAgreementPdf = {
  bytes: Uint8Array;
  blob: Blob;
  fileName: string;
  signedAt: string;
};

type DrawFittedTextOptions = {
  x: number;
  y: number;
  maxWidth: number;
  size: number;
  minSize?: number;
  color: NonNullable<Parameters<PDFPage["drawText"]>[1]>["color"];
};

function getFullName(member: DataAgreementMember) {
  return [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
}

function sanitizeFilePart(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase() || "SOCIO"
  );
}

function getDateParts(value: string) {
  const signedAt = new Date(value);

  return {
    day: String(signedAt.getDate()).padStart(2, "0"),
    month: String(signedAt.getMonth() + 1).padStart(2, "0"),
    year: String(signedAt.getFullYear()),
  };
}

function dataUrlToBytes(dataUrl: string) {
  const [, base64] = dataUrl.split(",");

  if (!base64) {
    throw new Error("La firma no tiene un formato válido.");
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function drawFittedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  options: DrawFittedTextOptions,
) {
  let size = options.size;
  const minSize = options.minSize ?? 6;

  while (size > minSize && font.widthOfTextAtSize(text, size) > options.maxWidth) {
    size -= 0.25;
  }

  page.drawText(text, {
    x: options.x,
    y: options.y,
    maxWidth: options.maxWidth,
    size,
    font,
    color: options.color,
  });
}

export function getDataAgreementFileName(member: DataAgreementMember) {
  const fullName = getFullName(member);
  return `${sanitizeFilePart(fullName)}_${AGREEMENT_FILE_SUFFIX}`;
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

export async function createSignedDataAgreementPdf({
  member,
  signatureDataUrl,
  signedAt,
}: SignedAgreementInput): Promise<SignedAgreementPdf> {
  const templateResponse = await fetch(DATA_AGREEMENT_TEMPLATE_URL);

  if (!templateResponse.ok) {
    throw new Error("No se ha podido cargar la plantilla del acuerdo.");
  }

  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  const templateBytes = await templateResponse.arrayBuffer();
  const pdf = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const page = pdf.getPage(0);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const dateParts = getDateParts(signedAt);
  const signatureImage = await pdf.embedPng(dataUrlToBytes(signatureDataUrl));
  const signatureSize = signatureImage.scaleToFit(142, 38);
  const textColor = rgb(0.04, 0.08, 0.16);

  drawFittedText(page, font, getFullName(member), {
    x: 135,
    y: 696,
    maxWidth: 138,
    size: 9.2,
    color: textColor,
  });

  drawFittedText(page, font, member.dni.trim().toUpperCase(), {
    x: 369,
    y: 696,
    maxWidth: 135,
    size: 9.2,
    color: textColor,
  });

  drawFittedText(page, font, "Peña Oasis", {
    x: 88,
    y: 667,
    maxWidth: 139,
    size: 9.2,
    color: textColor,
  });

  page.drawText(dateParts.day, {
    x: 119,
    y: 426,
    size: 9.2,
    font,
    color: textColor,
  });
  page.drawText(dateParts.month, {
    x: 153,
    y: 426,
    size: 9.2,
    font,
    color: textColor,
  });
  page.drawText(dateParts.year, {
    x: 187,
    y: 426,
    size: 9.2,
    font,
    color: textColor,
  });

  page.drawImage(signatureImage, {
    x: 220,
    y: 394,
    width: signatureSize.width,
    height: signatureSize.height,
  });

  const bytes = await pdf.save();
  const blobBytes = new Uint8Array(bytes.length);
  blobBytes.set(bytes);
  const blob = new Blob([blobBytes], { type: "application/pdf" });

  return {
    bytes,
    blob,
    fileName: getDataAgreementFileName(member),
    signedAt,
  };
}
