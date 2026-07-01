import { FiHelpCircle, FiMail } from "react-icons/fi";
import homeImage from "../../public/images/inicio-construccion.png";
import { CONTACT_EMAIL } from "../constants";

export function HomeScreen() {
  return (
    <section className="screen home-screen" aria-label="Inicio">
      <img
        className="home-art"
        src={homeImage}
        alt="Peña Oasis en construcción"
      />
      <div className="home-contact-panel">
        <div className="home-contact-icon">
          <FiHelpCircle aria-hidden="true" />
        </div>
        <div className="home-contact-copy">
          <p>¿Tienes dudas?</p>
          <span>
            Para altas, consultas o cualquier cosa que necesites, escríbenos y
            te responderemos lo antes posible.
          </span>
        </div>
        <a className="home-email-link" href={`mailto:${CONTACT_EMAIL}`}>
          <FiMail aria-hidden="true" />
          <span>{CONTACT_EMAIL}</span>
        </a>
      </div>
    </section>
  );
}
