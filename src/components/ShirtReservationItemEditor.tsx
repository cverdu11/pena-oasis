import {
  HiOutlineMinus,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import type {
  ShirtReservationItem,
  ShirtStockAvailability,
  ShirtSize,
} from "../lib/shirtReservations";
import {
  getShirtAvailableQuantity,
  getShirtStockNotice,
  SHIRT_COLOR_OPTIONS,
} from "../lib/shirtReservations";

const sizes: ShirtSize[] = ["S", "M", "L", "XL", "2XL"];

export type ShirtReservationDraftItem = ShirtReservationItem & {
  id: number;
};

type ShirtReservationItemEditorProps = {
  canIncreaseQuantity: boolean;
  canRemove: boolean;
  index: number;
  isActive: boolean;
  item: ShirtReservationDraftItem;
  onActivate: () => void;
  onChange: (changes: Partial<ShirtReservationItem>) => void;
  onRemove: () => void;
  stockAvailability: readonly ShirtStockAvailability[];
};

export function ShirtReservationItemEditor({
  canIncreaseQuantity,
  canRemove,
  index,
  isActive,
  item,
  onActivate,
  onChange,
  onRemove,
  stockAvailability,
}: ShirtReservationItemEditorProps) {
  const itemLabel = `Camiseta ${index + 1}`;
  const stockNotice = getShirtStockNotice(
    getShirtAvailableQuantity(stockAvailability, item.color, item.size),
  );

  return (
    <section
      className={`shirt-order-item${isActive ? " is-active" : ""}`}
      data-testid={`shirt-order-item-${item.id}`}
    >
      <div className="shirt-order-item-heading">
        <span>
          <strong>{itemLabel}</strong>
        </span>
        {canRemove && (
          <button
            aria-label={`Eliminar ${itemLabel.toLowerCase()}`}
            onClick={onRemove}
            type="button"
          >
            <HiOutlineTrash aria-hidden="true" />
          </button>
        )}
      </div>

      <fieldset>
        <legend>Color</legend>
        <div className="shirt-option-grid shirt-option-grid--color">
          {SHIRT_COLOR_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                checked={item.color === option.value}
                name={`color-${item.id}`}
                onChange={() => {
                  onActivate();
                  onChange({ color: option.value });
                }}
                type="radio"
                value={option.value}
              />
              <span>
                <i
                  aria-hidden="true"
                  className={`shirt-color-swatch shirt-color-swatch--${option.value.replace("_", "-")}`}
                />
                <span className="shirt-color-option-copy">
                  <strong>{option.label}</strong>
                  <small>{option.fitLabel}</small>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Talla</legend>
        <div className="shirt-size-grid">
          {sizes.map((option) => (
            <label key={option}>
              <input
                checked={item.size === option}
                name={`size-${item.id}`}
                onChange={() => {
                  onActivate();
                  onChange({ size: option });
                }}
                type="radio"
                value={option}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="shirt-quantity-row">
        <span>Cantidad</span>
        {stockNotice && (
          <span className="shirt-stock-notice" role="status">
            {stockNotice}
          </span>
        )}
        <div aria-label={`Cantidad de ${itemLabel.toLowerCase()}`}>
          <button
            aria-label={`Reducir cantidad de ${itemLabel.toLowerCase()}`}
            disabled={item.quantity === 1}
            onClick={() => {
              onActivate();
              onChange({ quantity: item.quantity - 1 });
            }}
            type="button"
          >
            <HiOutlineMinus aria-hidden="true" />
          </button>
          <output aria-live="polite">{item.quantity}</output>
          <button
            aria-label={`Aumentar cantidad de ${itemLabel.toLowerCase()}`}
            disabled={!canIncreaseQuantity || item.quantity === 10}
            onClick={() => {
              onActivate();
              onChange({ quantity: item.quantity + 1 });
            }}
            type="button"
          >
            <HiOutlinePlus aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
