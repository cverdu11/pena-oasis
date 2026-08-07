import { useEffect, useState } from "react";
import {
  HiOutlinePencilSquare,
  HiOutlineShoppingBag,
} from "react-icons/hi2";
import {
  cancelMyShirtReservation,
  fetchMyShirtReservations,
  getShirtVariantLabel,
  type ManagedShirtReservation,
  type ShirtReservationItem,
  updateMyShirtReservation,
} from "../lib/shirtReservations";
import { getSupabaseClient } from "../lib/supabase";
import { ShirtOrderEditor } from "./ShirtOrderEditor";

const statusLabels: Record<ManagedShirtReservation["status"], string> = {
  cancelled: "Cancelada",
  confirmed: "Confirmada",
  fulfilled: "Entregada",
  pending: "Pendiente",
};

const DEMO_RESERVATION: ManagedShirtReservation = {
  createdAt: "2026-07-29T17:05:00.000Z",
  customerType: "member",
  id: "1fea2f46-8a55-4d74-91c9-0d7d1b8f6a21",
  items: [{ color: "white", quantity: 1, size: "L" }],
  status: "pending",
  totalPriceEur: 15,
  totalQuantity: 1,
  updatedAt: "2026-07-29T17:05:00.000Z",
  version: 1,
};

function formatReservationDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

type MemberShirtReservationsProps = {
  demoMode?: boolean;
};

export function MemberShirtReservations({
  demoMode = false,
}: MemberShirtReservationsProps) {
  const [reservations, setReservations] = useState<
    ManagedShirtReservation[]
  >(() => (demoMode ? [DEMO_RESERVATION] : []));
  const [editingReservationId, setEditingReservationId] = useState<
    string | null
  >(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error"
  >(demoMode ? "ready" : "loading");

  useEffect(() => {
    if (demoMode) {
      return;
    }

    let isActive = true;

    async function loadReservations() {
      try {
        const client = await getSupabaseClient();

        if (!client) {
          throw new Error("Supabase no está configurado.");
        }

        const nextReservations = await fetchMyShirtReservations(client);

        if (isActive) {
          setReservations(nextReservations);
          setStatus("ready");
        }
      } catch {
        if (isActive) {
          setStatus("error");
        }
      }
    }

    void loadReservations();

    return () => {
      isActive = false;
    };
  }, [demoMode]);

  async function saveReservation(
    reservation: ManagedShirtReservation,
    items: ShirtReservationItem[],
  ) {
    let nextVersion = reservation.version + 1;

    if (!demoMode) {
      const client = await getSupabaseClient();

      if (!client) {
        throw new Error("Supabase no está configurado.");
      }

      nextVersion = await updateMyShirtReservation(
        client,
        reservation.id,
        reservation.version,
        items,
      );
    }
    const totalQuantity = items.reduce(
      (total, item) => total + item.quantity,
      0,
    );
    const unitPrice = reservation.customerType === "member" ? 15 : 20;

    setReservations((currentReservations) =>
      currentReservations.map((currentReservation) =>
        currentReservation.id === reservation.id
          ? {
              ...currentReservation,
              items,
              totalPriceEur: totalQuantity * unitPrice,
              totalQuantity,
              updatedAt: new Date().toISOString(),
              version: nextVersion,
            }
          : currentReservation,
      ),
    );
  }

  async function deleteReservation(
    reservation: ManagedShirtReservation,
  ) {
    if (!demoMode) {
      const client = await getSupabaseClient();

      if (!client) {
        throw new Error("Supabase no está configurado.");
      }

      await cancelMyShirtReservation(
        client,
        reservation.id,
        reservation.version,
      );
    }

    setReservations((currentReservations) =>
      currentReservations.filter(
        (currentReservation) =>
          currentReservation.id !== reservation.id,
      ),
    );
  }

  return (
    <section
      className="member-reservations"
      aria-labelledby="member-reservations-title"
    >
      <header className="member-reservations-heading">
        <span>
          <HiOutlineShoppingBag aria-hidden="true" />
        </span>
        <div>
          <h2 id="member-reservations-title">Mis reservas</h2>
          <p>Consulta y modifica tus camisetas mientras estén pendientes.</p>
        </div>
      </header>

      {status === "loading" && (
        <p className="member-reservations-state" role="status">
          Cargando reservas…
        </p>
      )}

      {status === "error" && (
        <p className="member-reservations-state is-error" role="alert">
          No hemos podido cargar tus reservas.
        </p>
      )}

      {status === "ready" && reservations.length === 0 && (
        <div className="member-reservations-empty">
          <strong>Aún no tienes reservas</strong>
          <p>Cuando reserves una camiseta aparecerá aquí.</p>
          <a href="#tienda">Ir a la tienda</a>
        </div>
      )}

      {status === "ready" && reservations.length > 0 && (
        <div className="member-reservation-list">
          {reservations.map((reservation) => {
            const isEditing = editingReservationId === reservation.id;
            const canEdit = reservation.status === "pending";

            return (
              <article
                className="member-reservation-card"
                data-status={reservation.status}
                key={reservation.id}
              >
                <header>
                  <div>
                    <span>Pedido de camisetas</span>
                    <small>
                      {formatReservationDate(reservation.createdAt)} · #
                      {reservation.id.slice(0, 8).toUpperCase()}
                    </small>
                  </div>
                  <strong>{statusLabels[reservation.status]}</strong>
                </header>

                {!isEditing && (
                  <>
                    <ul>
                      {reservation.items.map((item) => (
                        <li key={`${item.color}-${item.size}`}>
                          <span>
                            {getShirtVariantLabel(item.color)} · {item.size}
                          </span>
                          <strong>×{item.quantity}</strong>
                        </li>
                      ))}
                    </ul>

                    <footer>
                      <span>
                        {reservation.totalQuantity}{" "}
                        {reservation.totalQuantity === 1
                          ? "camiseta"
                          : "camisetas"}
                      </span>
                      <strong>{reservation.totalPriceEur} €</strong>
                    </footer>

                    {canEdit && (
                      <button
                        className="member-reservation-edit"
                        onClick={() =>
                          setEditingReservationId(reservation.id)
                        }
                        type="button"
                      >
                        <HiOutlinePencilSquare aria-hidden="true" />
                        Editar pedido
                      </button>
                    )}
                  </>
                )}

                {isEditing && (
                  <ShirtOrderEditor
                    initialItems={reservation.items}
                    onCancel={() => setEditingReservationId(null)}
                    onDelete={() => deleteReservation(reservation)}
                    onDeleted={() => setEditingReservationId(null)}
                    onSave={(items) => saveReservation(reservation, items)}
                    onSaved={() => setEditingReservationId(null)}
                    unitPrice={
                      reservation.customerType === "member" ? 15 : 20
                    }
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
