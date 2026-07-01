import { FiArrowLeft, FiExternalLink, FiMail } from "react-icons/fi";
import {
  CONTACT_EMAIL,
  DATA_PROTECTION_LAW_URL,
  GDPR_URL,
} from "../constants";

export function LegalScreen() {
  return (
    <section className="screen legal-screen" aria-label="Privacidad y condiciones">
      <div className="legal-backdrop" aria-hidden="true" />

      <article className="legal-sheet">
        <a className="legal-back-link" href="#area-personal">
          <FiArrowLeft aria-hidden="true" />
          <span>Volver</span>
        </a>

        <p className="legal-kicker">Peña Oasis</p>
        <h1>Privacidad y condiciones</h1>
        <p className="legal-updated">Última actualización: 1 de julio de 2026</p>

        <section className="legal-section">
          <h2>Responsable y contacto</h2>
          <p>
            El responsable de esta web app es Peña Oasis. Para cualquier duda
            sobre tus datos, altas, bajas o comunicaciones, puedes escribirnos a:
          </p>
          <a className="legal-email-link" href={`mailto:${CONTACT_EMAIL}`}>
            <FiMail aria-hidden="true" />
            <span>{CONTACT_EMAIL}</span>
          </a>
        </section>

        <section className="legal-section">
          <h2>Datos que tratamos</h2>
          <p>
            Podemos tratar los datos que facilitas al registrarte o actualizar
            tu área personal: nombre, apellidos, correo electrónico, DNI, número
            de socio, fecha de aceptación de condiciones y datos técnicos
            necesarios para iniciar sesión.
          </p>
        </section>

        <section className="legal-section">
          <h2>Finalidad</h2>
          <p>
            Usamos tus datos para gestionar tu alta, identificarte como peñista,
            mantener tu área personal, responder consultas y enviarte
            comunicaciones internas relacionadas con la Peña Oasis.
          </p>
        </section>

        <section className="legal-section">
          <h2>Base y conservación</h2>
          <p>
            El tratamiento se basa en tu consentimiento y en la gestión de tu
            relación con la peña. Conservaremos los datos mientras mantengas tu
            alta o mientras sean necesarios para atender obligaciones legales o
            administrativas.
          </p>
        </section>

        <section className="legal-section">
          <h2>Condiciones de uso</h2>
          <p>
            Al crear una cuenta te comprometes a facilitar datos veraces, usar
            el área personal de forma adecuada y avisarnos si necesitas corregir
            o eliminar información. La web app puede evolucionar conforme se
            activen nuevas funcionalidades.
          </p>
        </section>

        <section className="legal-section">
          <h2>Tus derechos</h2>
          <p>
            Puedes solicitar acceso, rectificación, supresión, oposición,
            limitación o portabilidad de tus datos escribiendo al correo de
            contacto. También puedes retirar tu consentimiento cuando
            corresponda.
          </p>
        </section>

        <section className="legal-section">
          <h2>Referencias oficiales</h2>
          <div className="legal-reference-links">
            <a href={DATA_PROTECTION_LAW_URL} rel="noreferrer" target="_blank">
              <span>LOPDGDD, Ley Orgánica 3/2018</span>
              <FiExternalLink aria-hidden="true" />
            </a>
            <a href={GDPR_URL} rel="noreferrer" target="_blank">
              <span>RGPD, Reglamento UE 2016/679</span>
              <FiExternalLink aria-hidden="true" />
            </a>
          </div>
        </section>
      </article>
    </section>
  );
}
