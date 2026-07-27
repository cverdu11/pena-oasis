import { FiInstagram, FiMail } from "react-icons/fi";
import { CONTACT_EMAIL, INSTAGRAM_URL } from "../constants";

export function ContactFooter() {
  return (
    <footer className="contact-footer" aria-label="Contacto">
      <a
        aria-label={`Escribir a ${CONTACT_EMAIL}`}
        href={`mailto:${CONTACT_EMAIL}`}
      >
        <FiMail aria-hidden="true" />
        <span>{CONTACT_EMAIL}</span>
      </a>

      <span className="contact-footer-divider" aria-hidden="true" />

      <a
        aria-label="Abrir Instagram de Peña Oasis"
        href={INSTAGRAM_URL}
        rel="noreferrer"
        target="_blank"
      >
        <FiInstagram aria-hidden="true" />
        <span>Instagram</span>
      </a>
    </footer>
  );
}
