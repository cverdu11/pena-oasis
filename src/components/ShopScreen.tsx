import { HiOutlineEnvelope } from "react-icons/hi2";
import scarfImage from "../../public/images/shop/bufanda-oasis-concepto.webp";
import shirtImage from "../../public/images/shop/camiseta-oasis-boceto.webp";
import { CONTACT_EMAIL } from "../constants";
import type { MemberIdentity } from "../hooks/useMemberIdentity";
import { AppHeader } from "./AppHeader";

const products = [
  {
    title: "Camiseta Casa del Malaguismo",
    detail:
      "Camiseta cruda con escudo de la Peña en el frontal y mapa de La Rosaleda en la espalda.",
    status: "Diseño en desarrollo",
    availability: "Precio por confirmar",
    image: shirtImage,
    imageAlt:
      "Boceto frontal y trasero de la camiseta Casa del Malaguismo",
  },
  {
    title: "Bufanda Peña Oasis",
    detail:
      "Bufanda de punto en azul y blanco para acompañar a la Peña en casa y fuera.",
    status: "Diseño por confirmar",
    availability: "Precio por confirmar",
    image: scarfImage,
    imageAlt: "Propuesta visual de una bufanda azul y blanca de la Peña",
  },
];

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
          <span>2 productos</span>
        </div>

        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.title}>
              <div className="product-media">
                <img src={product.image} alt={product.imageAlt} />
              </div>

              <div className="product-copy">
                <span className="product-status">{product.status}</span>
                <h3>{product.title}</h3>
                <p>{product.detail}</p>

                <div className="product-action-row">
                  <strong>{product.availability}</strong>
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                      `Consulta sobre ${product.title}`,
                    )}`}
                  >
                    <HiOutlineEnvelope aria-hidden="true" />
                    Consultar
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
