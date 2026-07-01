import homeImage from "../../public/images/inicio-construccion.png";

export function HomeScreen() {
  return (
    <section className="screen home-screen" aria-label="Inicio">
      <img
        className="home-art"
        src={homeImage}
        alt="Peña Oasis en construcción"
      />
    </section>
  );
}
