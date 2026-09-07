import { useState } from "react";
import type { FormEvent } from "react";
import {
  HiOutlineCheckCircle,
  HiOutlineChevronDown,
  HiOutlinePlus,
} from "react-icons/hi2";
import blueShirtImage from "../../public/images/shop/camiseta-oasis-azul.webp";
import whiteShirtImage from "../../public/images/shop/camiseta-oasis-blanca.jpg";
import offWhiteShirtImage from "../../public/images/shop/camiseta-oasis-off-white.webp";
import { PERSONAL_ROUTE_HASH } from "../constants";
import type { MemberIdentity } from "../hooks/useMemberIdentity";
import { useShirtStockAvailability } from "../hooks/useShirtStockAvailability";
import {
  consolidateReservationItems,
  createShirtReservation,
  getShirtColorLabel,
  getShirtFitLabel,
  getGuestReservationManagementHash,
  getShirtAvailableQuantity,
  getShirtStockShortage,
  getShirtStockShortageMessage,
  getShirtVariantLabel,
  getShirtVariantQuantity,
  MAX_SHIRT_LINE_ITEMS,
  MAX_SHIRT_TOTAL_QUANTITY,
  SHIRT_COLOR_OPTIONS,
  type ShirtColor,
  type ShirtReservationAccess,
} from "../lib/shirtReservations";
import { getSupabaseClient } from "../lib/supabase";
import {
  ShirtReservationItemEditor,
  type ShirtReservationDraftItem,
} from "./ShirtReservationItemEditor";

const shirtPreviewImages: Record<ShirtColor, string> = {
  blue: blueShirtImage,
  off_white: offWhiteShirtImage,
  white: whiteShirtImage,
};

type SubmissionStatus = "idle" | "saving" | "success" | "error";

type ShirtReservationCardProps = {
  identity: MemberIdentity;
};

export function ShirtReservationCard({
  identity,
}: ShirtReservationCardProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [items, setItems] = useState<ShirtReservationDraftItem[]>([
    { color: "white", id: 1, quantity: 1, size: "M" },
  ]);
  const [activeItemId, setActiveItemId] = useState(1);
  const [nextItemId, setNextItemId] = useState(2);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [reservationAccess, setReservationAccess] =
    useState<ShirtReservationAccess | null>(null);
  const [submissionStatus, setSubmissionStatus] =
    useState<SubmissionStatus>("idle");
  const stockAvailability = useShirtStockAvailability();

  const customerType = identity.isAuthenticated ? "member" : "non-member";
  const unitPrice = customerType === "member" ? 15 : 20;
  const totalQuantity = items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const totalPrice = totalQuantity * unitPrice;
  const stockShortage = getShirtStockShortage(stockAvailability, items);
  const submitQuantityLabel =
    totalQuantity === 1 ? "reserva" : `${totalQuantity} camisetas`;
  const consolidatedItems = consolidateReservationItems(items);
  const activeItem =
    items.find((item) => item.id === activeItemId) ?? items[0];
  const previewColor: ShirtColor = activeItem?.color ?? "white";
  const selectedColorLabel = getShirtColorLabel(previewColor);
  const selectedFitLabel = getShirtFitLabel(previewColor);
  const activeItemIndex = items.findIndex(
    (item) => item.id === activeItem?.id,
  );

  function resetSubmissionStatus() {
    setSubmissionError("");

    if (submissionStatus === "error") {
      setSubmissionStatus("idle");
    }
  }

  function canIncreaseItemQuantity(item: ShirtReservationDraftItem) {
    const availableQuantity = getShirtAvailableQuantity(
      stockAvailability,
      item.color,
      item.size,
    );
    const currentVariantQuantity = getShirtVariantQuantity(
      items,
      item.color,
      item.size,
    );

    return (
      totalQuantity < MAX_SHIRT_TOTAL_QUANTITY &&
      (availableQuantity === undefined ||
        currentVariantQuantity < availableQuantity)
    );
  }

  function resetForm() {
    setItems([{ color: "white", id: 1, quantity: 1, size: "M" }]);
    setActiveItemId(1);
    setNextItemId(2);
    setFullName("");
    setEmail("");
    setPrivacyAccepted(false);
    setReservationAccess(null);
    setSubmissionError("");
    setSubmissionStatus("idle");
  }

  function updateItem(
    itemId: number,
    changes: Partial<ShirtReservationDraftItem>,
  ) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...changes } : item,
      ),
    );
    resetSubmissionStatus();
  }

  function addItem() {
    if (
      items.length >= MAX_SHIRT_LINE_ITEMS ||
      totalQuantity >= MAX_SHIRT_TOTAL_QUANTITY
    ) {
      return;
    }

    const itemId = nextItemId;
    setItems((currentItems) => [
      ...currentItems,
      { color: "white", id: itemId, quantity: 1, size: "M" },
    ]);
    setActiveItemId(itemId);
    setNextItemId((currentId) => currentId + 1);
    resetSubmissionStatus();
  }

  function removeItem(itemId: number) {
    if (items.length === 1) {
      return;
    }

    const remainingItems = items.filter((item) => item.id !== itemId);
    setItems(remainingItems);

    if (activeItemId === itemId) {
      setActiveItemId(remainingItems[0].id);
    }

    resetSubmissionStatus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (stockShortage) {
      setSubmissionError(getShirtStockShortageMessage(stockShortage));
      setSubmissionStatus("error");
      return;
    }

    setSubmissionStatus("saving");
    setSubmissionError("");

    try {
      const client = await getSupabaseClient();

      if (!client) {
        throw new Error("Supabase no está configurado.");
      }

      const savedReservationAccess = await createShirtReservation(client, {
        email,
        fullName,
        items: consolidatedItems,
      });
      setReservationAccess(savedReservationAccess);
      setSubmissionStatus("success");
    } catch (error) {
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message.toLowerCase()
          : "";

      setSubmissionError(
        errorMessage.includes("stock") || errorMessage.includes("inventory")
          ? "El stock ha cambiado. Reduce la cantidad o elige otra talla/color."
          : "No hemos podido guardar la reserva. Inténtalo de nuevo.",
      );
      setSubmissionStatus("error");
    }
  }

  return (
    <article className="product-card product-card--reservation">
      <div
        className={`product-media product-media--shirt${
          previewColor === "blue" ? " product-media--blue" : ""
        }`}
      >
        <img
          src={shirtPreviewImages[previewColor]}
          alt={`Diseño frontal y trasero de la camiseta Casa del Malaguismo en color ${selectedColorLabel.toLowerCase()} y corte ${selectedFitLabel.toLowerCase()}`}
        />
        <div
          aria-label={`Color de la camiseta ${
            activeItemIndex >= 0 ? activeItemIndex + 1 : 1
          }`}
          className="product-color-switch"
          role="group"
        >
          {SHIRT_COLOR_OPTIONS.map((option) => (
            <button
              aria-label={`${option.label}, corte ${option.fitLabel.toLowerCase()}`}
              aria-pressed={previewColor === option.value}
              key={option.value}
              onClick={() => {
                if (activeItem) {
                  updateItem(activeItem.id, { color: option.value });
                }
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="product-fit-badge" aria-live="polite">
          Corte · <strong>{selectedFitLabel}</strong>
        </span>
      </div>

      <div className="product-copy">
        <span className="product-status">Reservas abiertas</span>
        <h3>Camiseta Casa del Malaguismo</h3>
        <p>
          Escudo de la Peña en el frontal y mapa de La Rosaleda en la espalda.
          Blanca y beige con corte relaxed; azul con corte regular.
        </p>

        <div className="shirt-price-strip" aria-label="Precios">
          <span>
            <strong>15 €</strong>
            Socios
          </span>
          <span>
            <strong>20 €</strong>
            No socios
          </span>
        </div>

        <button
          aria-controls="shirt-reservation-panel"
          aria-expanded={isFormOpen}
          className="shirt-reservation-toggle"
          data-testid="shirt-reservation-toggle"
          onClick={() => {
            setIsFormOpen((current) => !current);
            setSubmissionStatus("idle");
          }}
          type="button"
        >
          <span>
            {isFormOpen ? "Cerrar reserva" : "Reservar camiseta"}
          </span>
          <HiOutlineChevronDown
            aria-hidden="true"
            className={isFormOpen ? "is-open" : undefined}
          />
        </button>
      </div>

      {isFormOpen && (
        <div
          className="shirt-reservation-panel"
          data-testid="shirt-reservation-panel"
          id="shirt-reservation-panel"
        >
          {submissionStatus === "success" ? (
            <div
              aria-live="polite"
              className="shirt-reservation-success"
              role="status"
            >
              <HiOutlineCheckCircle aria-hidden="true" />
              <h4>Reserva recibida</h4>
              <p>
                {identity.isAuthenticated ? (
                  <>
                    La reserva se ha vinculado a tu cuenta de socio. La Peña la
                    revisará antes de confirmarla.
                  </>
                ) : (
                  <>
                    Hemos guardado tu reserva para <strong>{email}</strong>. La
                    Peña la revisará antes de confirmarla.
                  </>
                )}
              </p>
              {reservationAccess && (
                <span>
                  Reserva #
                  {reservationAccess.id.slice(0, 8).toUpperCase()}
                </span>
              )}
              <ul className="shirt-reservation-success-items">
                {consolidatedItems.map((item) => (
                  <li key={`${item.color}-${item.size}`}>
                    <span>
                      {getShirtVariantLabel(item.color)} · {item.size}
                    </span>
                    <strong>×{item.quantity}</strong>
                  </li>
                ))}
              </ul>
              <strong className="shirt-reservation-success-total">
                {totalQuantity}{" "}
                {totalQuantity === 1 ? "camiseta" : "camisetas"} ·{" "}
                {totalPrice} €
              </strong>
              {identity.isAuthenticated ? (
                <a
                  className="shirt-manage-reservation-link"
                  href={PERSONAL_ROUTE_HASH}
                >
                  Ver en mi área personal
                </a>
              ) : (
                reservationAccess?.managementToken && (
                  <>
                    <a
                      className="shirt-manage-reservation-link"
                      href={getGuestReservationManagementHash(
                        reservationAccess.id,
                        reservationAccess.managementToken,
                      )}
                    >
                      Gestionar mi reserva
                    </a>
                    <small className="shirt-private-link-note">
                      Este enlace es privado. Guárdalo para modificar tu pedido.
                    </small>
                  </>
                )
              )}
              <button onClick={resetForm} type="button">
                Hacer otro pedido
              </button>
            </div>
          ) : (
            <form
              className="shirt-reservation-form"
              data-testid="shirt-reservation-form"
              onSubmit={(event) => void handleSubmit(event)}
            >
              <div className="shirt-form-heading">
                <span>Tu pedido</span>
                <p>
                  Combina colores, tallas y cantidades. Sin pago ahora.
                </p>
              </div>

              <div
                className="shirt-session-price"
                data-member-price={identity.isAuthenticated}
              >
                <span>
                  {identity.isAuthenticated
                    ? "Precio de socio aplicado"
                    : "Precio de no socio aplicado"}
                  <small>
                    {identity.isAuthenticated
                      ? "Según tu sesión iniciada"
                      : "Inicia sesión para aplicar el precio de socio"}
                  </small>
                </span>
                <strong>{unitPrice} €</strong>
              </div>

              <div className="shirt-order-list">
                {items.map((item, index) => (
                  <ShirtReservationItemEditor
                    canIncreaseQuantity={
                      canIncreaseItemQuantity(item)
                    }
                    canRemove={items.length > 1}
                    index={index}
                    isActive={item.id === activeItem?.id}
                    item={item}
                    key={item.id}
                    onActivate={() => setActiveItemId(item.id)}
                    onChange={(changes) => updateItem(item.id, changes)}
                    onRemove={() => removeItem(item.id)}
                    stockAvailability={stockAvailability}
                  />
                ))}
              </div>

              <button
                className="shirt-add-item"
                disabled={
                  items.length >= MAX_SHIRT_LINE_ITEMS ||
                  totalQuantity >= MAX_SHIRT_TOTAL_QUANTITY
                }
                onClick={addItem}
                type="button"
              >
                <HiOutlinePlus aria-hidden="true" />
                Añadir otra camiseta
              </button>

              <div className="shirt-order-summary" aria-live="polite">
                <span>
                  <strong>
                    {totalQuantity}{" "}
                    {totalQuantity === 1 ? "camiseta" : "camisetas"}
                  </strong>
                  <small>{unitPrice} € por unidad</small>
                </span>
                <strong>{totalPrice} €</strong>
              </div>

              {!identity.isAuthenticated && (
                <>
                  <div className="shirt-contact-fields">
                    <label htmlFor="shirt-reservation-name">
                      Nombre y apellidos
                      <input
                        autoComplete="name"
                        id="shirt-reservation-name"
                        maxLength={100}
                        minLength={2}
                        name="fullName"
                        onChange={(event) => {
                          setFullName(event.target.value);
                          resetSubmissionStatus();
                        }}
                        placeholder="Tu nombre"
                        required
                        type="text"
                        value={fullName}
                      />
                    </label>

                    <label htmlFor="shirt-reservation-email">
                      Email
                      <input
                        autoComplete="email"
                        id="shirt-reservation-email"
                        maxLength={254}
                        name="email"
                        onChange={(event) => {
                          setEmail(event.target.value);
                          resetSubmissionStatus();
                        }}
                        placeholder="tu@email.com"
                        required
                        type="email"
                        value={email}
                      />
                    </label>
                  </div>

                  <label className="shirt-privacy-check">
                    <input
                      checked={privacyAccepted}
                      onChange={(event) => {
                        setPrivacyAccepted(event.target.checked);
                        resetSubmissionStatus();
                      }}
                      required
                      type="checkbox"
                    />
                    <span>
                      Acepto el uso de mis datos para gestionar la reserva.{" "}
                      <a href="#privacidad">Ver privacidad</a>
                    </span>
                  </label>
                </>
              )}

              {submissionStatus === "error" && (
                <p className="shirt-form-error" role="alert">
                  {submissionError ||
                    "No hemos podido guardar la reserva. Inténtalo de nuevo."}
                </p>
              )}

              <button
                className="shirt-reservation-submit"
                disabled={
                  submissionStatus === "saving" || stockShortage !== null
                }
                type="submit"
              >
                {submissionStatus === "saving"
                  ? "Guardando reserva…"
                  : `Confirmar ${submitQuantityLabel} · ${totalPrice} €`}
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
