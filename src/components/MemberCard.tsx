import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { FiCheckCircle } from "react-icons/fi";
import { HiOutlineQrCode } from "react-icons/hi2";

type MemberCardProps = {
  firstName: string;
  lastName: string;
  memberNumber: number | null;
};

export function formatPenaMemberNumber(value: number | null | undefined) {
  return value ? String(value).padStart(4, "0") : null;
}

export function MemberCard({
  firstName,
  lastName,
  memberNumber,
}: MemberCardProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const formattedMemberNumber = formatPenaMemberNumber(memberNumber);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  useEffect(() => {
    let isActive = true;

    if (!formattedMemberNumber) {
      setQrCodeUrl("");
      return () => {
        isActive = false;
      };
    }

    const qrPayload = `PENA-OASIS|SOCIO:${formattedMemberNumber}`;

    void QRCode.toDataURL(qrPayload, {
      color: {
        dark: "#08234c",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 176,
    })
      .then((dataUrl) => {
        if (isActive) {
          setQrCodeUrl(dataUrl);
        }
      })
      .catch(() => {
        if (isActive) {
          setQrCodeUrl("");
        }
      });

    return () => {
      isActive = false;
    };
  }, [formattedMemberNumber]);

  return (
    <section className="member-card" aria-label="Carné de peñista">
      <header className="member-card-header">
        <div className="member-card-brand">
          <span>PO</span>
          <div>
            <strong>Peña Oasis</strong>
            <small>Peña malaguista</small>
          </div>
        </div>
        <span className="member-card-active">
          <FiCheckCircle aria-hidden="true" />
          Activo
        </span>
      </header>

      <div className="member-card-body">
        <div className="member-card-person">
          <span>Peñista</span>
          <h2>{fullName}</h2>
          <p>Nº {formattedMemberNumber ?? "Pendiente"}</p>
        </div>
        <div className="member-card-qr">
          {qrCodeUrl && formattedMemberNumber ? (
            <img
              src={qrCodeUrl}
              alt={`Código QR del socio ${formattedMemberNumber}`}
            />
          ) : (
            <>
              <HiOutlineQrCode aria-hidden="true" />
              {!formattedMemberNumber && <small>Pendiente</small>}
            </>
          )}
        </div>
      </div>

      <footer className="member-card-footer">
        <span>Identificación personal</span>
        <small>Temporada 2026/27</small>
      </footer>
    </section>
  );
}
