import { useState } from "react";
import type { FormEvent } from "react";
import {
  HiOutlineCheckCircle,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineEnvelope,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import whiteShirtImage from "../../public/images/shop/camiseta-oasis-blanca.jpg";
import blueShirtImage from "../../public/images/shop/camiseta-oasis-azul.webp";
import offWhiteShirtImage from "../../public/images/shop/camiseta-oasis-off-white.webp";
import scarfImage from "../../public/images/shop/bufanda-oasis-boceto.webp";
import { CONTACT_EMAIL, PERSONAL_ROUTE_HASH } from "../constants";
import type { MemberIdentity } from "../hooks/useMemberIdentity";
import { getSupabaseClient } from "../lib/supabase";
import { AppHeader } from "./AppHeader";

type ShirtColor = "white" | "off_white" | "blue";
type ShirtSize = "S" | "M" | "L" | "XL" | "2XL";

type ShirtOrderItem = {
  color: ShirtColor;
  id: number;
  quantity: number;
  size: ShirtSize;
};

const shirtColors: Array<{ label: string; value: ShirtColor }> = [
  { label: "Blanca", value: "white" },
  { label: "Off-white", value: "off_white" },
  { label: "Azul", value: "blue" },
];

const shirtImages: Record<ShirtColor, string> = {
  blue: blueShirtImage,
  off_white: offWhiteShirtImage,
  white: whiteShirtImage,
};

const shirtSizes: ShirtSize[] = ["S", "M", "L", "XL", "2XL"];

type ShopScreenProps = {
  identity: MemberIdentity;
  isAccountMenuOpen: boolean;
  onAvatarClick: () => void;
};

function colorLabel(color: ShirtColor) {
  return shirtColors.find((item) => item.value === color)?.label ?? color;
}

export function ShopScreen({
  identity,
  isAccountMenuOpen,
  onAvatarClick,
}: ShopScreenProps) {
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [items, setItems] = useState<ShirtOrderItem[]>([
    { color: "white", id: 1, quantity: 1, size: "M" },
  ]);
  const [activeItemId, setActiveItemId] = useState(1);
  const [nextItemId, setNextItemId] = useState(2);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [reservationState, setReservationState] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  const price = identity.isAuthenticated ? 15 : 20;
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = totalQuantity * price;
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0];

  function updateItem(id: number, update: Partial<ShirtOrderItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
    setReservationState("idle");
  }

  function addItem() {
    if (items.length >= 10 || totalQuantity >= 20) return;
    setItems((current) => [
      ...current,
      { color: "white", id: nextItemId, quantity: 1, size: "M" },
    ]);
    setActiveItemId(nextItemId);
    setNextItemId((current) => current + 1);
    setReservationState("idle");
  }

  function removeItem(id: number) {
    if (items.length === 1) return;
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    if (activeItemId === id) setActiveItemId(nextItems[0].id);
    setReservationState("idle");
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReservationState("saving");

    try {
      const client = await getSupabaseClient();
      if (!client) throw new Error("Supabase no está configurado.");

      const { error } = await client.rpc("create_shirt_reservation", {
        reservation_email: email.trim().toLowerCase(),
        reservation_full_name: fullName.trim(),
        reservation_items: items.map(({ color, quantity, size }) => ({
          color,
          quantity,
          size,
        })),
      });

      if (error) throw error;
      setReservationState("success");
    } catch {
      setReservationState("error");
    }
  }

  function resetReservation() {
    setItems([{ color: "white", id: 1, quantity: 1, size: "M" }]);
    setActiveItemId(1);
    setNextItemId(2);
    setFullName("");
    setEmail("");
    setPrivacyAccepted(false);
    setReservationState("idle");
  }

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
          <article className="product-card product-card--reservation">
            <div className="product-media product-media--shirt">
              <img
                src={shirtImages[activeItem?.color ?? "white"]}
                alt={`Diseño frontal y trasero de la camiseta Casa del Malaguismo en color ${colorLabel(activeItem?.color ?? "white").toLowerCase()}`}
              />
              <div
                aria-label={`Color de la camiseta ${items.findIndex((item) => item.id === activeItem?.id) + 1}`}
                className="product-color-switch"
                role="group"
              >
                {shirtColors.map((color) => (
                  <button
                    aria-pressed={activeItem?.color === color.value}
                    key={color.value}
                    type="button"
                    onClick={() =>
                      activeItem && updateItem(activeItem.id, { color: color.value })
                    }
                  >
                    {color.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="product-copy">
              <span className="product-status">Reservas abiertas</span>
              <h3>Camiseta Casa del Malaguismo</h3>
              <p>
                Escudo de la Peña en el frontal y mapa de La Rosaleda en la espalda. Disponible en blanco, off-white y azul.
              </p>
              <div className="shirt-price-strip" aria-label="Precios">
                <span><strong>15 €</strong>Socios</span>
                <span><strong>20 €</strong>No socios</span>
              </div>
              <button
                aria-controls="shirt-reservation-panel"
                aria-expanded={isReservationOpen}
                className="shirt-reservation-toggle"
                type="button"
                onClick={() => {
                  setIsReservationOpen((open) => !open);
                  setReservationState("idle");
                }}
              >
                <span>{isReservationOpen ? "Cerrar reserva" : "Reservar camiseta"}</span>
                {isReservationOpen ? <HiOutlineChevronUp aria-hidden="true" /> : <HiOutlineChevronDown aria-hidden="true" />}
              </button>
            </div>

            {isReservationOpen && (
              <div className="shirt-reservation-panel" id="shirt-reservation-panel">
                {reservationState === "success" ? (
                  <div className="shirt-reservation-success" role="status">
                    <HiOutlineCheckCircle aria-hidden="true" />
                    <h4>Reserva recibida</h4>
                    <p>La Peña revisará tu reserva antes de confirmarla.</p>
                    <strong>{totalQuantity} {totalQuantity === 1 ? "camiseta" : "camisetas"} · {totalPrice} €</strong>
                    {identity.isAuthenticated && (
                      <a href={PERSONAL_ROUTE_HASH}>Ver en mi área personal</a>
                    )}
                    <button type="button" onClick={resetReservation}>Hacer otro pedido</button>
                  </div>
                ) : (
                  <form className="shirt-reservation-form" onSubmit={submitReservation}>
                    <div className="shirt-form-heading">
                      <span>Tu pedido</span>
                      <p>Combina colores, tallas y cantidades. Sin pago ahora.</p>
                    </div>
                    <div className="shirt-session-price">
                      <span>{identity.isAuthenticated ? "Precio de socio aplicado" : "Precio de no socio aplicado"}</span>
                      <strong>{price} €</strong>
                    </div>
                    <div className="shirt-order-list">
                      {items.map((item, index) => (
                        <section className={`shirt-order-item${item.id === activeItemId ? " is-active" : ""}`} key={item.id}>
                          <div className="shirt-order-item-heading">
                            <strong>Camiseta {index + 1}</strong>
                            {items.length > 1 && (
                              <button aria-label={`Eliminar camiseta ${index + 1}`} type="button" onClick={() => removeItem(item.id)}>
                                <HiOutlineTrash aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <fieldset>
                            <legend>Color</legend>
                            <div className="shirt-option-grid shirt-option-grid--color">
                              {shirtColors.map((color) => (
                                <label key={color.value}>
                                  <input checked={item.color === color.value} name={`color-${item.id}`} type="radio" value={color.value} onChange={() => updateItem(item.id, { color: color.value })} />
                                  <span>{color.label}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          <fieldset>
                            <legend>Talla</legend>
                            <div className="shirt-size-grid">
                              {shirtSizes.map((size) => (
                                <label key={size}>
                                  <input checked={item.size === size} name={`size-${item.id}`} type="radio" value={size} onChange={() => updateItem(item.id, { size })} />
                                  <span>{size}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          <label className="shirt-quantity-row">
                            Cantidad
                            <input min={1} max={20} type="number" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} />
                          </label>
                        </section>
                      ))}
                    </div>
                    <button className="shirt-add-item" disabled={items.length >= 10 || totalQuantity >= 20} type="button" onClick={addItem}>
                      <HiOutlinePlus aria-hidden="true" /> Añadir otra camiseta
                    </button>
                    {!identity.isAuthenticated && (
                      <div className="shirt-contact-fields">
                        <label>Nombre y apellidos<input required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
                        <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                        <label className="shirt-privacy-check"><input checked={privacyAccepted} required type="checkbox" onChange={(event) => setPrivacyAccepted(event.target.checked)} /> Acepto el uso de mis datos para gestionar la reserva.</label>
                      </div>
                    )}
                    {reservationState === "error" && <p className="shirt-form-error" role="alert">No hemos podido guardar la reserva. Inténtalo de nuevo.</p>}
                    <button className="shirt-reservation-submit" disabled={reservationState === "saving"} type="submit">
                      {reservationState === "saving" ? "Guardando reserva…" : `Confirmar reserva · ${totalPrice} €`}
                    </button>
                  </form>
                )}
              </div>
            )}
          </article>

          <article className="product-card">
            <div className="product-media"><img src={scarfImage} alt="Boceto de las dos caras de la bufanda Peña Oasis" /></div>
            <div className="product-copy">
              <span className="product-status">Diseño en desarrollo</span>
              <h3>Bufanda Peña Oasis</h3>
              <p>Boceto a doble cara en azul, blanco y dorado con el escudo y los lemas de la Peña.</p>
              <div className="product-action-row">
                <strong>Precio por confirmar</strong>
                <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Consulta sobre Bufanda Peña Oasis")}`}><HiOutlineEnvelope aria-hidden="true" />Consultar</a>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
