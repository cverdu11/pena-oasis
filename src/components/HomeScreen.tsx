import { FiMail } from "react-icons/fi";
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
      <div className="home-contact-panel" aria-label="Contacto">
        <p className="home-contact-copy">Dudas, altas o consultas</p>
        <a className="home-email-link" href={`mailto:${CONTACT_EMAIL}`}>
          <FiMail aria-hidden="true" />
          <span>{CONTACT_EMAIL}</span>
        </a>
      </div>
    </section>
  );
}
