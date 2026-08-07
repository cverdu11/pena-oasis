import { useEffect, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineLockClosed,
} from "react-icons/hi2";
import {
  cancelGuestShirtReservation,
  fetchGuestShirtReservation,
  getShirtVariantLabel,
  type ManagedShirtReservation,
  type ShirtReservationItem,
  updateGuestShirtReservation,
} from "../lib/shirtReservations";
import { getSupabaseClient } from "../lib/supabase";
import { ShirtOrderEditor } from "./ShirtOrderEditor";

type GuestReservationAccess = {
  id: string;
  token: string;
};

type GuestReservationScreenProps = {
  onBack: () => void;
};

function readGuestReservationAccess(): GuestReservationAccess | null {
  const query = window.location.hash.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  const id = params.get("id")?.trim() ?? "";
  const token = params.get("token")?.trim() ?? "";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !/^[0-9a-f]{64}$/i.test(token)
  ) {
    return null;
  }

  return { id, token };
}

export function GuestReservationScreen({
  onBack,
}: GuestReservationScreenProps) {
  const [access, setAccess] = useState(readGuestReservationAccess);
  const [reservation, setReservation] =
    useState<ManagedShirtReservation | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "invalid" | "error"
  >(access ? "loading" : "invalid");

  useEffect(() => {
    function refreshAccess() {
      setAccess(readGuestReservationAccess());
    }

    window.addEventListener("hashchange", refreshAccess);

    return () => {
      window.removeEventListener("hashchange", refreshAccess);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadReservation() {
      setReservation(null);

      if (!access) {
        setStatus("invalid");
        return;
      }

      setStatus("loading");

      try {
        const client = await getSupabaseClient();

        if (!client) {
          throw new Error("Supabase no está configurado.");
        }

        const nextReservation = await fetchGuestShirtReservation(
          client,
          access.id,
          access.token,
        );

        if (isActive) {
          setReservation(nextReservation);
          setStatus(nextReservation ? "ready" : "invalid");
        }
      } catch {
        if (isActive) {
          setStatus("error");
        }
      }
    }

    void loadReservation();

    return () => {
      isActive = false;
    };
  }, [access]);

  async function saveReservation(items: ShirtReservationItem[]) {
    if (!access || !reservation) {
      throw new Error("La reserva no está disponible.");
    }

    const client = await getSupabaseClient();

    if (!client) {
      throw new Error("Supabase no está configurado.");
    }

    const nextVersion = await updateGuestShirtReservation(
      client,
      reservation.id,
      access.token,
      reservation.version,
      items,
    );
    const totalQuantity = items.reduce(
      (total, item) => total + item.quantity,
      0,
    );

    setReservation((currentReservation) =>
      currentReservation
        ? {
            ...currentReservation,
            items,
            totalPriceEur: totalQuantity * 20,
            totalQuantity,
            updatedAt: new Date().toISOString(),
            version: nextVersion,
          }
        : currentReservation,
    );
  }

  async function deleteReservation() {
    if (!access || !reservation) {
      throw new Error("La reserva no está disponible.");
    }

    const client = await getSupabaseClient();

    if (!client) {
      throw new Error("Supabase no está configurado.");
    }

    const nextVersion = await cancelGuestShirtReservation(
      client,
      reservation.id,
      access.token,
      reservation.version,
    );

    setReservation((currentReservation) =>
      currentReservation
        ? {
            ...currentReservation,
            status: "cancelled",
            updatedAt: new Date().toISOString(),
            version: nextVersion,
          }
        : currentReservation,
    );
  }

  return (
    <section
      className="screen hub-screen"
      aria-label="Gestionar reserva"
    >
      <div className="hub-backdrop" aria-hidden="true" />
      <article className="hub-sheet guest-reservation-sheet">
        <header className="guest-reservation-header">
          <button
            aria-label="Volver a la tienda"
            onClick={onBack}
            type="button"
          >
            <HiOutlineArrowLeft aria-hidden="true" />
          </button>
          <div>
            <p>Peña Oasis</p>
            <h1>Gestionar reserva</h1>
          </div>
        </header>

        <div className="guest-private-notice">
          <HiOutlineLockClosed aria-hidden="true" />
          <span>
            Enlace privado. No lo compartas con otras personas.
          </span>
        </div>

        {status === "loading" && (
          <p className="guest-reservation-state" role="status">
            Cargando tu reserva…
          </p>
        )}

        {status === "invalid" && (
          <div className="guest-reservation-state is-error" role="alert">
            <strong>Enlace no válido o caducado</strong>
            <p>
              Comprueba que has abierto el enlace completo de tu reserva.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="guest-reservation-state is-error" role="alert">
            <strong>No podemos cargar la reserva</strong>
            <p>Inténtalo de nuevo dentro de unos minutos.</p>
          </div>
        )}

        {status === "ready" && reservation && (
          <div className="guest-reservation-content">
            <header>
              <span>
                Reserva #{reservation.id.slice(0, 8).toUpperCase()}
              </span>
              <strong>
                {reservation.status === "pending"
                  ? "Pendiente"
                  : reservation.status === "cancelled"
                    ? "Cancelada"
                    : "Reserva bloqueada"}
              </strong>
            </header>

            {reservation.status === "pending" ? (
              <>
                <div className="guest-reservation-intro">
                  <h2>Edita tu pedido</h2>
                  <p>
                    Puedes cambiar colores, tallas y cantidades hasta que la
                    Peña confirme la reserva.
                  </p>
                </div>
                <ShirtOrderEditor
                  initialItems={reservation.items}
                  onDelete={deleteReservation}
                  onSave={saveReservation}
                  unitPrice={20}
                />
              </>
            ) : (
              <div className="guest-reservation-locked">
                <p>
                  {reservation.status === "cancelled"
                    ? "Esta reserva se ha eliminado y ya no puede modificarse."
                    : "Esta reserva ya no se puede modificar porque su estado ha cambiado."}
                </p>
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
                <strong>{reservation.totalPriceEur} €</strong>
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
