import { useState } from "react";
import {
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import {
  consolidateReservationItems,
  MAX_SHIRT_LINE_ITEMS,
  MAX_SHIRT_TOTAL_QUANTITY,
  type ShirtReservationItem,
} from "../lib/shirtReservations";
import {
  ShirtReservationItemEditor,
  type ShirtReservationDraftItem,
} from "./ShirtReservationItemEditor";

type ShirtOrderEditorProps = {
  initialItems: ShirtReservationItem[];
  onCancel?: () => void;
  onDelete?: () => Promise<void>;
  onDeleted?: () => void;
  onSave: (items: ShirtReservationItem[]) => Promise<void>;
  onSaved?: () => void;
  unitPrice: number;
};

export function ShirtOrderEditor({
  initialItems,
  onCancel,
  onDelete,
  onDeleted,
  onSave,
  onSaved,
  unitPrice,
}: ShirtOrderEditorProps) {
  const [items, setItems] = useState<ShirtReservationDraftItem[]>(() =>
    initialItems.map((item, index) => ({ ...item, id: index + 1 })),
  );
  const [activeItemId, setActiveItemId] = useState(1);
  const [nextItemId, setNextItemId] = useState(initialItems.length + 1);
  const [pendingAction, setPendingAction] = useState<
    "saving" | "deleting" | null
  >(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [message, setMessage] = useState("");

  const totalQuantity = items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const totalPrice = totalQuantity * unitPrice;
  const activeItem =
    items.find((item) => item.id === activeItemId) ?? items[0];

  function updateItem(
    itemId: number,
    changes: Partial<ShirtReservationItem>,
  ) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...changes } : item,
      ),
    );
    setMessage("");
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
    setMessage("");
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

    setMessage("");
  }

  async function handleSave() {
    setPendingAction("saving");
    setMessage("");

    try {
      await onSave(consolidateReservationItems(items));

      if (onSaved) {
        onSaved();
      } else {
        setMessage("Cambios guardados.");
      }
    } catch {
      setMessage(
        "No hemos podido guardar los cambios. Recarga la reserva e inténtalo de nuevo.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    if (!onDelete) {
      return;
    }

    setPendingAction("deleting");
    setMessage("");

    try {
      await onDelete();
      onDeleted?.();
    } catch {
      setMessage(
        "No hemos podido eliminar el pedido. Recarga la reserva e inténtalo de nuevo.",
      );
      setIsDeleteConfirmOpen(false);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="managed-shirt-editor">
      <div className="shirt-order-list">
        {items.map((item, index) => (
          <ShirtReservationItemEditor
            canIncreaseQuantity={
              totalQuantity < MAX_SHIRT_TOTAL_QUANTITY
            }
            canRemove={items.length > 1}
            index={index}
            isActive={item.id === activeItem?.id}
            item={item}
            key={item.id}
            onActivate={() => setActiveItemId(item.id)}
            onChange={(changes) => updateItem(item.id, changes)}
            onRemove={() => removeItem(item.id)}
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

      {message && (
        <p
          className={
            message === "Cambios guardados."
              ? "managed-shirt-message is-success"
              : "managed-shirt-message"
          }
          role="status"
        >
          {message}
        </p>
      )}

      <div className="managed-shirt-actions">
        {onCancel && (
          <button
            className="managed-shirt-cancel"
            disabled={pendingAction !== null}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
        )}
        <button
          className="managed-shirt-save"
          disabled={pendingAction !== null}
          onClick={() => void handleSave()}
          type="button"
        >
          {pendingAction === "saving" ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      {onDelete && (
        <div className="managed-shirt-danger">
          {isDeleteConfirmOpen ? (
            <div
              className="managed-shirt-delete-confirm"
              role="group"
              aria-label="Confirmar eliminación del pedido"
            >
              <p>
                ¿Eliminar este pedido? Esta acción no se puede deshacer.
              </p>
              <div>
                <button
                  className="managed-shirt-delete-back"
                  disabled={pendingAction !== null}
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  type="button"
                >
                  No, volver
                </button>
                <button
                  className="managed-shirt-delete-confirm-button"
                  disabled={pendingAction !== null}
                  onClick={() => void handleDelete()}
                  type="button"
                >
                  {pendingAction === "deleting"
                    ? "Eliminando…"
                    : "Sí, eliminar"}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="managed-shirt-delete-toggle"
              disabled={pendingAction !== null}
              onClick={() => setIsDeleteConfirmOpen(true)}
              type="button"
            >
              <HiOutlineTrash aria-hidden="true" />
              Eliminar pedido
            </button>
          )}
        </div>
      )}
    </div>
  );
}
