import type { PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiPenTool,
  FiRefreshCw,
  FiSend,
} from "react-icons/fi";
import {
  bytesToBase64,
  createSignedDataAgreementPdf,
  DATA_AGREEMENT_TEMPLATE_URL,
} from "../lib/dataAgreementPdf";
import type { DataAgreementMember } from "../lib/dataAgreementPdf";
import { uploadDataAgreementToDrive } from "../lib/driveUpload";
import { getSupabaseClient } from "../lib/supabase";

type StoredAgreement = {
  signedAt?: string | null;
  fileName?: string | null;
  driveUrl?: string | null;
};

type StoredAgreementRecord = {
  signedAt: string;
  fileName: string;
  driveFileId: string;
  driveUrl: string | null;
  member: DataAgreementMember;
};

type GeneratedAgreement = {
  url: string;
  fileName: string;
};

type SignaturePoint = {
  x: number;
  y: number;
};

type DataAgreementCardProps = {
  member: DataAgreementMember;
  storedAgreement: StoredAgreement;
  onStored: (record: StoredAgreementRecord) => Promise<void>;
};

function formatStoredDate(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getMemberFullName(member: DataAgreementMember) {
  return [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
}

function splitAgreementName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function configureSignatureCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(Math.floor(rect.width * window.devicePixelRatio), 1);
  const height = Math.max(Math.floor(132 * window.devicePixelRatio), 1);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#102f63";
  context.lineWidth = Math.max(3, width / 180);
}

function clearCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
  configureSignatureCanvas(canvas);
}

function getCanvasPoint(
  canvas: HTMLCanvasElement,
  event: PointerEvent<HTMLCanvasElement>,
): SignaturePoint {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

export function DataAgreementCard({
  member,
  storedAgreement,
  onStored,
}: DataAgreementCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<SignaturePoint | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [agreementName, setAgreementName] = useState(() =>
    getMemberFullName(member),
  );
  const [agreementDni, setAgreementDni] = useState(member.dni);
  const [generatedAgreement, setGeneratedAgreement] =
    useState<GeneratedAgreement | null>(null);
  const hasStoredAgreement = Boolean(storedAgreement.signedAt);
  const storedDate = formatStoredDate(storedAgreement.signedAt);
  const fullName = agreementName.trim();
  const agreementMemberName = splitAgreementName(agreementName);
  const agreementMember: DataAgreementMember = {
    ...member,
    firstName: agreementMemberName.firstName,
    lastName: agreementMemberName.lastName,
    dni: agreementDni.trim().toUpperCase(),
  };
  const hasRequiredFields = Boolean(fullName && agreementMember.dni);

  useEffect(() => {
    setAgreementName(getMemberFullName(member));
    setAgreementDni(member.dni);
  }, [member.dni, member.firstName, member.lastName]);

  useEffect(() => {
    if (hasStoredAgreement) {
      setIsOpen(false);
      setHasSignature(false);
      setMessage("");
    }
  }, [hasStoredAgreement]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    configureSignatureCanvas(canvas);

    const observer = new ResizeObserver(() => {
      configureSignatureCanvas(canvas);
    });
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (generatedAgreement?.url) {
        URL.revokeObjectURL(generatedAgreement.url);
      }
    };
  }, [generatedAgreement]);

  function replaceGeneratedAgreement(next: GeneratedAgreement | null) {
    setGeneratedAgreement((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }

      return next;
    });
  }

  function handleSignatureStart(event: PointerEvent<HTMLCanvasElement>) {
    if (isSubmitting || !canvasRef.current) {
      return;
    }

    event.preventDefault();
    canvasRef.current.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = getCanvasPoint(canvasRef.current, event);
  }

  function handleSignatureMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !canvasRef.current || !lastPointRef.current) {
      return;
    }

    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const nextPoint = getCanvasPoint(canvas, event);
    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(nextPoint.x, nextPoint.y);
    context.stroke();
    lastPointRef.current = nextPoint;
    setHasSignature(true);
  }

  function handleSignatureEnd(event: PointerEvent<HTMLCanvasElement>) {
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;
  }

  function handleClearSignature() {
    if (canvasRef.current) {
      clearCanvas(canvasRef.current);
    }

    setHasSignature(false);
    setMessage("");
  }

  async function handleSubmitAgreement() {
    if (!canvasRef.current) {
      return;
    }

    if (hasStoredAgreement) {
      setMessage("Este acuerdo ya consta como firmado.");
      return;
    }

    if (!hasRequiredFields) {
      setMessage("Guarda al menos nombre y DNI antes de firmar el acuerdo.");
      return;
    }

    if (!hasSignature) {
      setMessage("Falta la firma del socio.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    let createdPdf: GeneratedAgreement | null = null;

    try {
      const signedAt = new Date().toISOString();
      const signedAgreement = await createSignedDataAgreementPdf({
        member: agreementMember,
        signatureDataUrl: canvasRef.current.toDataURL("image/png"),
        signedAt,
      });
      const signedPdfUrl = URL.createObjectURL(signedAgreement.blob);
      createdPdf = {
        url: signedPdfUrl,
        fileName: signedAgreement.fileName,
      };
      replaceGeneratedAgreement(createdPdf);

      const client = await getSupabaseClient();

      if (!client) {
        throw new Error("Conecta Supabase para enviar el acuerdo a Drive.");
      }

      const uploadResult = await uploadDataAgreementToDrive(client, {
        fileName: signedAgreement.fileName,
        pdfBase64: bytesToBase64(signedAgreement.bytes),
        signedAt,
        member: agreementMember,
      });

      await onStored({
        signedAt,
        fileName: uploadResult.fileName,
        driveFileId: uploadResult.fileId,
        driveUrl: uploadResult.webViewLink,
        member: agreementMember,
      });

      setMessage("Acuerdo firmado y guardado en Google Drive.");
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "No se ha podido enviar el acuerdo firmado.";
      setMessage(
        createdPdf
          ? `PDF firmado generado. Falta completar la subida a Drive: ${reason}`
          : reason,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="agreement-panel" aria-label="Acuerdo de datos personales">
      <div className="agreement-panel-header">
        <span className="agreement-panel-icon">
          <FiFileText aria-hidden="true" />
        </span>
        <div>
          <h2>Acuerdo de datos personales</h2>
          <p data-status={storedDate ? "signed" : "pending"}>
            {storedDate
              ? `Firmado el ${storedDate}`
              : "Pendiente de firma"}
          </p>
        </div>
      </div>

      {storedAgreement.driveUrl && (
        <a
          className="agreement-drive-link"
          href={storedAgreement.driveUrl}
          rel="noreferrer"
          target="_blank"
        >
          <FiExternalLink aria-hidden="true" />
          <span>Abrir PDF firmado</span>
        </a>
      )}

      {!hasStoredAgreement && (
        <button
          className="secondary-button icon-text-button"
          type="button"
          onClick={() => setIsOpen((current) => !current)}
        >
          <FiPenTool aria-hidden="true" />
          <span>{isOpen ? "Cerrar acuerdo" : "Abrir y firmar"}</span>
        </button>
      )}

      {hasStoredAgreement && !storedAgreement.driveUrl && (
        <p className="agreement-message" role="status">
          <FiCheckCircle aria-hidden="true" />
          <span>Acuerdo firmado y guardado.</span>
        </p>
      )}

      {isOpen && !hasStoredAgreement && (
        <div className="agreement-flow">
          <object
            className="agreement-preview"
            data={DATA_AGREEMENT_TEMPLATE_URL}
            type="application/pdf"
          >
            <a
              href={DATA_AGREEMENT_TEMPLATE_URL}
              rel="noreferrer"
              target="_blank"
            >
              Abrir plantilla PDF
            </a>
          </object>

          <div className="agreement-field-summary">
            <label>
              <span>Nombre y apellidos</span>
              <input
                autoComplete="name"
                disabled={isSubmitting}
                value={agreementName}
                onChange={(event) => setAgreementName(event.target.value)}
                placeholder="Nombre y apellidos"
                type="text"
              />
            </label>
            <label>
              <span>DNI/NIE</span>
              <input
                autoComplete="off"
                disabled={isSubmitting}
                inputMode="text"
                value={agreementDni}
                onChange={(event) =>
                  setAgreementDni(event.target.value.toUpperCase())
                }
                placeholder="00000000A"
                type="text"
              />
            </label>
          </div>

          <div className="signature-box">
            <div className="signature-box-header">
              <span>Firma del socio</span>
              <button type="button" onClick={handleClearSignature}>
                <FiRefreshCw aria-hidden="true" />
                <span>Limpiar</span>
              </button>
            </div>
            <canvas
              ref={canvasRef}
              className="signature-canvas"
              aria-label="Firma del socio"
              onPointerDown={handleSignatureStart}
              onPointerMove={handleSignatureMove}
              onPointerUp={handleSignatureEnd}
              onPointerCancel={handleSignatureEnd}
              onPointerLeave={handleSignatureEnd}
            />
          </div>

          <button
            className="primary-button icon-text-button"
            disabled={isSubmitting}
            type="button"
            onClick={handleSubmitAgreement}
          >
            {isSubmitting ? (
              <>
                <FiRefreshCw aria-hidden="true" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <FiSend aria-hidden="true" />
                <span>Firmar y enviar</span>
              </>
            )}
          </button>

          {generatedAgreement && (
            <a
              className="agreement-download-link"
              download={generatedAgreement.fileName}
              href={generatedAgreement.url}
            >
              <FiDownload aria-hidden="true" />
              <span>Descargar PDF firmado</span>
            </a>
          )}

          {message && (
            <p className="agreement-message" role="status">
              {message.includes("guardado") && (
                <FiCheckCircle aria-hidden="true" />
              )}
              <span>{message}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
