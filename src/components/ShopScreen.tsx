import { HiOutlineShoppingBag, HiOutlineSparkles } from "react-icons/hi2";
import type { MemberIdentity } from "../hooks/useMemberIdentity";
import { AppHeader } from "./AppHeader";

const products = [
  {
    title: "Camiseta Peña Oasis",
    detail: "Reserva para socios y simpatizantes",
    price: "Próximamente",
  },
  {
    title: "Bufanda Peña Oasis",
    detail: "Merchandising oficial de la Peña",
    price: "Próximamente",
  },
];

type ShopScreenProps = {
  identity: MemberIdentity;
};

export function ShopScreen({ identity }: ShopScreenProps) {
  return (
    <section className="screen hub-screen" aria-label="Tienda">
      <div className="hub-backdrop" aria-hidden="true" />
      <div className="hub-sheet">
        <AppHeader
          eyebrow="Peña Oasis"
          initials={identity.initials}
          title="Tienda"
        />

        <section className="hub-hero-card">
          <HiOutlineShoppingBag aria-hidden="true" />
          <h2>Camisetas y bufandas</h2>
          <p>
            Un espacio para comprar productos de la Peña, abierto a socios y no
            socios.
          </p>
        </section>

        <div className="hub-section-heading">
          <h2>Productos de la Peña</h2>
          <span>Muy pronto</span>
        </div>

        <div className="hub-list">
          {products.map((product) => (
            <article className="hub-row" key={product.title}>
              <span className="hub-row-icon">
                <HiOutlineSparkles aria-hidden="true" />
              </span>
              <div>
                <strong>{product.title}</strong>
                <span>{product.detail}</span>
                <small>{product.price}</small>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
