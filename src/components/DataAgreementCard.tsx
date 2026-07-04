import type { PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  FiArrowLeft,
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
  blob: Blob;
};

type SignaturePoint = {
  x: number;
  y: number;
};

const AGREEMENT_READER_HISTORY_KEY = "penaDataAgreementReader";

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

function formatReaderDate() {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
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
  const submitLockRef = useRef(false);
  const readerHistoryRef = useRef(false);
  const lastPointRef = useRef<SignaturePoint | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAgreementReaderOpen, setIsAgreementReaderOpen] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCompletedSubmission, setHasCompletedSubmission] = useState(() =>
    Boolean(storedAgreement.signedAt),
  );
  const [message, setMessage] = useState("");
  const [agreementName, setAgreementName] = useState(() =>
    getMemberFullName(member),
  );
  const [agreementDni, setAgreementDni] = useState(member.dni);
  const [generatedAgreement, setGeneratedAgreement] =
    useState<GeneratedAgreement | null>(null);
  const hasStoredAgreement =
    Boolean(storedAgreement.signedAt) || hasCompletedSubmission;
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
  const readerDisplayDate = formatReaderDate();

  useEffect(() => {
    setAgreementName(getMemberFullName(member));
    setAgreementDni(member.dni);
  }, [member.dni, member.firstName, member.lastName]);

  useEffect(() => {
    const alreadyStored = Boolean(storedAgreement.signedAt);
    submitLockRef.current = alreadyStored;
    setHasCompletedSubmission(alreadyStored);
  }, [member.email, member.memberNumber, storedAgreement.signedAt]);

  useEffect(() => {
    if (hasStoredAgreement) {
      setIsOpen(false);
      setIsAgreementReaderOpen(false);
      setHasSignature(false);
    }
  }, [hasStoredAgreement]);

  useEffect(() => {
    if (!isAgreementReaderOpen) {
      return;
    }

    function handlePopState() {
      readerHistoryRef.current = false;
      setIsAgreementReaderOpen(false);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isAgreementReaderOpen]);

  useEffect(() => {
    if (!isAgreementReaderOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAgreementReader();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAgreementReaderOpen]);

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

  function handleReadAgreement() {
    if (isAgreementReaderOpen) {
      return;
    }

    window.history.pushState(
      { ...(window.history.state ?? {}), [AGREEMENT_READER_HISTORY_KEY]: true },
      "",
      window.location.href,
    );
    readerHistoryRef.current = true;
    setMessage("");
    setIsAgreementReaderOpen(true);
  }

  function closeAgreementReader() {
    if (
      readerHistoryRef.current &&
      window.history.state?.[AGREEMENT_READER_HISTORY_KEY]
    ) {
      window.history.back();
      return;
    }

    readerHistoryRef.current = false;
    setIsAgreementReaderOpen(false);
  }

  function handleAgreementReaderBackdropClick() {
    closeAgreementReader();
  }

  async function handleSaveGeneratedAgreement() {
    if (!generatedAgreement) {
      return;
    }

    const file = new File([generatedAgreement.blob], generatedAgreement.fileName, {
      type: "application/pdf",
    });

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({
          files: [file],
          title: "PDF firmado",
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    const downloadUrl = URL.createObjectURL(generatedAgreement.blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = generatedAgreement.fileName;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  async function handleSubmitAgreement() {
    if (submitLockRef.current || isSubmitting) {
      return;
    }

    submitLockRef.current = true;
    let submissionSucceeded = false;

    if (!canvasRef.current) {
      submitLockRef.current = false;
      return;
    }

    if (hasStoredAgreement) {
      setMessage("Este acuerdo ya consta como firmado.");
      submitLockRef.current = true;
      return;
    }

    if (!hasRequiredFields) {
      setMessage("Guarda al menos nombre y DNI antes de firmar el acuerdo.");
      submitLockRef.current = false;
      return;
    }

    if (!hasSignature) {
      setMessage("Falta la firma del socio.");
      submitLockRef.current = false;
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
        blob: signedAgreement.blob,
      };
      replaceGeneratedAgreement(createdPdf);

      const client = await getSupabaseClient();

      if (!client) {
        throw new Error("Conecta Supabase para enviar el acuerdo.");
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

      submissionSucceeded = true;
      setHasCompletedSubmission(true);
      setIsOpen(false);
      setMessage("");
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "No se ha podido enviar el acuerdo firmado.";
      console.warn("Data agreement upload failed", reason);
      setMessage(
        createdPdf
          ? 'PDF firmado listo. No hemos podido confirmar el envío. Pulsa "Reintentar envío" para intentarlo otra vez.'
          : reason,
      );
    } finally {
      if (!submissionSucceeded) {
        submitLockRef.current = false;
      }

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
          <p data-status={hasStoredAgreement ? "signed" : "pending"}>
            {storedDate
              ? `Firmado el ${storedDate}`
              : hasStoredAgreement
                ? "Firmado"
              : "Pendiente de firma"}
          </p>
        </div>
      </div>

      {hasStoredAgreement && (
        <div className="agreement-signed-state" role="status">
          <FiCheckCircle aria-hidden="true" />
          <div>
            <strong>Acuerdo de datos firmado</strong>
            <span>Se ha enviado correctamente a la Peña Oasis.</span>
          </div>
        </div>
      )}

      {hasStoredAgreement && generatedAgreement && (
        <button
          className="agreement-download-link"
          type="button"
          onClick={handleSaveGeneratedAgreement}
        >
          <FiDownload aria-hidden="true" />
          <span>Guardar PDF firmado</span>
        </button>
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

      {isOpen && !hasStoredAgreement && (
        <div className="agreement-flow">
          <div className="agreement-guidance">
            <p>
              El acuerdo se generará con tu nombre, DNI y la fecha de hoy.
            </p>
            <button
              className="agreement-reader-link"
              type="button"
              onClick={handleReadAgreement}
            >
              Leer acuerdo
            </button>
          </div>

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
            aria-busy={isSubmitting}
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
                <span>
                  {generatedAgreement ? "Reintentar envío" : "Firmar y enviar"}
                </span>
              </>
            )}
          </button>

          {generatedAgreement && (
            <button
              className="agreement-download-link"
              type="button"
              onClick={handleSaveGeneratedAgreement}
            >
              <FiDownload aria-hidden="true" />
              <span>Guardar PDF firmado</span>
            </button>
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

      {isAgreementReaderOpen && !hasStoredAgreement && (
        <div
          className="agreement-reader-backdrop"
          role="presentation"
          onClick={handleAgreementReaderBackdropClick}
        >
          <section
            aria-labelledby="agreement-reader-title"
            aria-modal="true"
            className="agreement-reader-sheet"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="agreement-reader-header">
              <button type="button" onClick={closeAgreementReader}>
                <FiArrowLeft aria-hidden="true" />
                <span>Volver a firmar</span>
              </button>
              <div>
                <h3 id="agreement-reader-title">Acuerdo de datos personales</h3>
                <p>Lee el acuerdo sin salir del área de firma.</p>
              </div>
            </div>

            <div className="agreement-reader-content">
              <h4>
                ANEXO I. AUTORIZACIÓN DEL ABONADO PARA LA GESTIÓN DE LA
                RENOVACIÓN A TRAVÉS DE LA PEÑA
              </h4>
              <p>
                D./Dña. <strong>{fullName || "Nombre y apellidos"}</strong>,
                con DNI/NIE{" "}
                <strong>{agreementMember.dni || "DNI/NIE"}</strong>,
                abonado/socio del Málaga Club de Fútbol, S.A.D., y miembro de
                la Peña <strong>Peña Oasis</strong> (la "Peña"), manifiesta que
                desea que la Peña realice en su nombre las gestiones
                relacionadas con la verificación de su condición de abonado y la
                tramitación de la renovación de su abono.
              </p>
              <p>
                A tal efecto, <strong>AUTORIZA</strong> expresamente a la Peña
                a comunicar al Málaga Club de Fútbol, S.A.D. los siguientes
                datos personales, estrictamente necesarios para dichas
                gestiones: nombre y apellidos, DNI/NIE, correo electrónico,
                teléfono y dirección postal.
              </p>
              <p>
                Asimismo, <strong>AUTORIZA</strong> expresamente a que el
                Málaga Club de Fútbol, S.A.D., una vez verificados los datos,
                comunique a la Peña la información necesaria para completar la
                renovación en su nombre: número de abonado o socio, zona o
                reserva, datos de asiento incluido número de asiento y precio de
                la renovación.
              </p>
              <p>
                La presente autorización podrá revocarse en cualquier momento,
                sin efectos retroactivos, comunicándolo a la Peña. En caso de
                revocación, el interesado podrá tramitar la renovación por los
                canales habituales del Club.
              </p>
              <dl>
                <div>
                  <dt>Fecha</dt>
                  <dd>{readerDisplayDate}</dd>
                </div>
                <div>
                  <dt>Firma</dt>
                  <dd>Se añadirá al firmar y enviar.</dd>
                </div>
              </dl>
            </div>

            <div className="agreement-reader-actions">
              <a
                className="agreement-reader-original-link"
                href={DATA_AGREEMENT_TEMPLATE_URL}
                rel="noreferrer"
                target="_blank"
              >
                <FiExternalLink aria-hidden="true" />
                <span>Abrir PDF original</span>
              </a>
              <button
                className="primary-button"
                type="button"
                onClick={closeAgreementReader}
              >
                Volver a firmar
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
