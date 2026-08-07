import { HiOutlineEnvelope } from "react-icons/hi2";
import scarfImage from "../../public/images/shop/bufanda-oasis-boceto.webp";
import { CONTACT_EMAIL } from "../constants";
import type { MemberIdentity } from "../hooks/useMemberIdentity";
import { AppHeader } from "./AppHeader";
import { ShirtReservationCard } from "./ShirtReservationCard";

const scarfProduct = {
  title: "Bufanda Peña Oasis",
  detail:
    "Boceto a doble cara en azul, blanco y dorado con el escudo y los lemas de la Peña.",
  status: "Diseño en desarrollo",
  availability: "Precio por confirmar",
  image: scarfImage,
  imageAlt: "Boceto de las dos caras de la bufanda Peña Oasis",
};

type ShopScreenProps = {
  identity: MemberIdentity;
  isAccountMenuOpen: boolean;
  onAvatarClick: () => void;
};

export function ShopScreen({
  identity,
  isAccountMenuOpen,
  onAvatarClick,
}: ShopScreenProps) {
  return (
    <section className="screen hub-screen" aria-label="Tienda">
      <div className="hub-backdrop" aria-hidden="true" />
      <div className="hub-sheet shop-sheet">
        <AppHeader
          avatarLabel={
            identity.isAuthenticated
              ? "Abrir menú de cuenta"
              : "Abrir acceso de socios"
          }
          eyebrow="Peña Oasis"
          initials={identity.initials}
          isAvatarMenuOpen={isAccountMenuOpen}
          onAvatarClick={onAvatarClick}
          title="Tienda"
        />

        <div className="shop-heading">
          <h2>Colección Oasis</h2>
          <span>3 productos</span>
        </div>

        <div className="product-grid">
          <ShirtReservationCard identity={identity} />

          <article className="product-card">
            <div className="product-media">
              <img src={scarfProduct.image} alt={scarfProduct.imageAlt} />
            </div>

            <div className="product-copy">
              <span className="product-status">{scarfProduct.status}</span>
              <h3>{scarfProduct.title}</h3>
              <p>{scarfProduct.detail}</p>

              <div className="product-action-row">
                <strong>{scarfProduct.availability}</strong>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                    `Consulta sobre ${scarfProduct.title}`,
                  )}`}
                >
                  <HiOutlineEnvelope aria-hidden="true" />
                  Consultar
                </a>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
