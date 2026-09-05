import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowPath,
  HiOutlineLockClosed,
} from "react-icons/hi2";
import {
  MAX_SHIRT_LINE_ITEMS,
  MAX_SHIRT_TOTAL_QUANTITY,
  consolidateReservationItems,
  registerExternalShirtSale,
  registerExternalShirtReturn,
  fetchShirtStockDashboard,
  getShirtColorLabel,
  type ShirtColor,
  type ShirtCustomerType,
  type ShirtReservationItem,
  type ShirtSize,
  type ShirtStockDashboard,
  type ShirtStockDashboardReservation,
  type ShirtStockRow,
  type ShirtReservationStatus,
  updateShirtReservationStatus,
} from "../lib/shirtReservations";
import { getSupabaseClient } from "../lib/supabase";

type DashboardState = "loading" | "ready" | "signed-out" | "denied" | "error";

type StockAdminScreenProps = {
  isAuthenticated: boolean;
  onBack: () => void;
  onSignIn: () => void;
};

const stockColors = ["blue", "white", "off_white"] as const;
const stockSizes = ["S", "M", "L", "XL", "2XL"] as const;

type ExternalSaleDraftLine = ShirtReservationItem & {
  id: number;
};

function createExternalSaleLine(id: number): ExternalSaleDraftLine {
  return {
    color: "blue",
    id,
    quantity: 1,
    size: "M",
  };
}

function getAllowedStatusTransitions(status: ShirtReservationStatus) {
  if (status === "pending") {
    return ["confirmed", "cancelled", "fulfilled"] as const;
  }

  if (status === "confirmed") {
    return ["cancelled", "fulfilled"] as const;
  }

  if (status === "fulfilled") {
    return ["confirmed", "cancelled"] as const;
  }

  return [] as const;
}

function getStatusLabel(status: ShirtReservationStatus) {
  const labels: Record<ShirtReservationStatus, string> = {
    cancelled: "Cancelada",
    confirmed: "Confirmada",
    fulfilled: "Entregada",
    pending: "Pendiente",
  };

  return labels[status];
}

function getTransitionLabel(status: ShirtReservationStatus) {
  const labels: Record<ShirtReservationStatus, string> = {
    cancelled: "Cancelar",
    confirmed: "Confirmar",
    fulfilled: "Marcar entregada",
    pending: "Pendiente",
  };

  return labels[status];
}

function isPermissionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  const authStatuses = new Set<unknown>([401, 403, "401", "403"]);

  return (
    candidate.code === "42501" ||
    authStatuses.has(candidate.code) ||
    authStatuses.has(candidate.status) ||
    authStatuses.has(candidate.statusCode)
  );
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getStockCell(
  stock: ShirtStockRow[],
  color: ShirtStockRow["color"],
  size: ShirtStockRow["size"],
) {
  return stock.find((row) => row.color === color && row.size === size);
}

function ReservationCard({
  isMutationInProgress,
  isUpdating,
  onStatusChange,
  reservation,
}: {
  isMutationInProgress: boolean;
  isUpdating: boolean;
  onStatusChange: (
    reservation: ShirtStockDashboardReservation,
    nextStatus: ShirtReservationStatus,
  ) => void;
  reservation: ShirtStockDashboardReservation;
}) {
  const transitions = getAllowedStatusTransitions(reservation.status);

  return (
    <article className="stock-reservation-card">
      <header>
        <div>
          <span>Reserva #{reservation.id.slice(0, 8).toUpperCase()}</span>
          <h3>{reservation.fullName}</h3>
          <a href={`mailto:${reservation.email}`}>{reservation.email}</a>
        </div>
        <strong
          className={`stock-status stock-status--${reservation.status}`}
          aria-label={`Estado: ${getStatusLabel(reservation.status)}`}
        >
          {getStatusLabel(reservation.status)}
        </strong>
      </header>

      <dl className="stock-reservation-meta">
        <div>
          <dt>Tipo</dt>
          <dd>{reservation.customerType === "member" ? "Socio" : "No socio"}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>
            {reservation.totalQuantity} camisetas · {reservation.totalPriceEur} €
          </dd>
        </div>
        <div>
          <dt>Actualizada</dt>
          <dd>{formatDate(reservation.updatedAt)}</dd>
        </div>
      </dl>

      <ul className="stock-reservation-items" aria-label="Prendas reservadas">
        {reservation.items.map((item) => (
          <li key={`${item.color}-${item.size}`}>
            <span>
              {getShirtColorLabel(item.color)} · {item.size}
            </span>
            <strong>×{item.quantity}</strong>
          </li>
        ))}
      </ul>

      {transitions.length > 0 && (
        <div className="stock-reservation-actions" aria-label="Cambiar estado">
          {transitions.map((nextStatus) => (
            <button
              disabled={isMutationInProgress}
              key={nextStatus}
              onClick={() => onStatusChange(reservation, nextStatus)}
              type="button"
            >
              {isUpdating
                ? "Actualizando…"
                : getTransitionLabel(nextStatus)}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

export function StockAdminScreen({
  isAuthenticated,
  onBack,
  onSignIn,
}: StockAdminScreenProps) {
  const [dashboard, setDashboard] = useState<ShirtStockDashboard | null>(null);
  const [state, setState] = useState<DashboardState>(
    isAuthenticated ? "loading" : "signed-out",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutationInProgress, setIsMutationInProgress] = useState(false);
  const [isExternalSaleInProgress, setIsExternalSaleInProgress] = useState(false);
  const [updatingReservationId, setUpdatingReservationId] = useState<string | null>(
    null,
  );
  const [externalSaleLabel, setExternalSaleLabel] = useState("");
  const [externalSaleCustomerType, setExternalSaleCustomerType] =
    useState<ShirtCustomerType>("non-member");
  const [externalSaleItems, setExternalSaleItems] = useState<
    ExternalSaleDraftLine[]
  >([createExternalSaleLine(1)]);
  const [externalSaleMessage, setExternalSaleMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [externalReturnLabel, setExternalReturnLabel] = useState("");
  const [externalReturnColor, setExternalReturnColor] = useState<ShirtColor>("blue");
  const [externalReturnSize, setExternalReturnSize] = useState<ShirtSize>("M");
  const [externalReturnQuantity, setExternalReturnQuantity] = useState(1);
  const [externalReturnMessage, setExternalReturnMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const loadRequestIdRef = useRef(0);
  const mutationLockRef = useRef(false);
  const mutationOperationIdRef = useRef(0);
  const authGenerationRef = useRef(0);
  const previousAuthStateRef = useRef(isAuthenticated);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const nextExternalSaleLineIdRef = useRef(2);

  if (previousAuthStateRef.current !== isAuthenticated) {
    previousAuthStateRef.current = isAuthenticated;
    authGenerationRef.current += 1;
  }
  isAuthenticatedRef.current = isAuthenticated;

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticatedRef.current) {
      return;
    }

    const requestId = ++loadRequestIdRef.current;
    const authGeneration = authGenerationRef.current;

    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const client = await getSupabaseClient();

      if (!client) {
        throw new Error("Supabase no está configurado.");
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!session) {
        if (
          requestId !== loadRequestIdRef.current ||
          authGeneration !== authGenerationRef.current ||
          !isAuthenticatedRef.current
        ) {
          return;
        }

        setDashboard(null);
        setState("signed-out");
        return;
      }

      const nextDashboard = await fetchShirtStockDashboard(client);

      if (
        requestId !== loadRequestIdRef.current ||
        authGeneration !== authGenerationRef.current ||
        !isAuthenticatedRef.current
      ) {
        return;
      }

      setDashboard(nextDashboard);
      setState("ready");
    } catch (error) {
      if (
        requestId !== loadRequestIdRef.current ||
        authGeneration !== authGenerationRef.current ||
        !isAuthenticatedRef.current
      ) {
        return;
      }

      setDashboard(null);

      if (isPermissionError(error)) {
        setState("denied");
      } else {
        setState("error");
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      if (
        requestId === loadRequestIdRef.current &&
        authGeneration === authGenerationRef.current &&
        isAuthenticatedRef.current
      ) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      loadRequestIdRef.current += 1;
      mutationOperationIdRef.current += 1;
      mutationLockRef.current = false;
      setDashboard(null);
      setErrorMessage(null);
      setExternalSaleMessage(null);
      setIsMutationInProgress(false);
      setIsExternalSaleInProgress(false);
      setIsRefreshing(false);
      setState("signed-out");
      setUpdatingReservationId(null);
      return;
    }

    void loadDashboard();
  }, [isAuthenticated, loadDashboard]);

  const totals = useMemo(
    () =>
      (dashboard?.stock ?? []).reduce(
        (summary, row) => ({
          available: summary.available + row.availableQuantity,
          fulfilled: summary.fulfilled + row.fulfilledQuantity,
          initial: summary.initial + row.initialQuantity,
        }),
        { available: 0, fulfilled: 0, initial: 0 },
      ),
    [dashboard],
  );

  const externalSaleTotalQuantity = useMemo(
    () => externalSaleItems.reduce((total, item) => total + item.quantity, 0),
    [externalSaleItems],
  );
  const externalSaleUnitPrice = externalSaleCustomerType === "member" ? 15 : 20;

  function updateExternalSaleLine(
    lineId: number,
    changes: Partial<ShirtReservationItem>,
  ) {
    setExternalSaleItems((currentItems) =>
      currentItems.map((item) =>
        item.id === lineId ? { ...item, ...changes } : item,
      ),
    );
  }

  function addExternalSaleLine() {
    if (externalSaleItems.length >= MAX_SHIRT_LINE_ITEMS) {
      return;
    }

    const lineId = nextExternalSaleLineIdRef.current;
    nextExternalSaleLineIdRef.current += 1;
    setExternalSaleItems((currentItems) => [
      ...currentItems,
      createExternalSaleLine(lineId),
    ]);
  }

  function removeExternalSaleLine(lineId: number) {
    setExternalSaleItems((currentItems) =>
      currentItems.length > 1
        ? currentItems.filter((item) => item.id !== lineId)
        : currentItems,
    );
  }

  async function handleExternalSaleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mutationLockRef.current || !isAuthenticatedRef.current) {
      return;
    }

    const reservationItems = consolidateReservationItems(
      externalSaleItems.map((item) => ({
        color: item.color,
        quantity: item.quantity,
        size: item.size,
      })),
    );

    if (
      reservationItems.length === 0 ||
      reservationItems.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 10,
      )
    ) {
      setExternalSaleMessage({
        kind: "error",
        text: "Cada variante debe tener entre 1 y 10 unidades.",
      });
      return;
    }

    if (externalSaleTotalQuantity > MAX_SHIRT_TOTAL_QUANTITY) {
      setExternalSaleMessage({
        kind: "error",
        text: "Una venta no puede superar las 20 camisetas.",
      });
      return;
    }

    const mutationOperationId = mutationOperationIdRef.current + 1;
    const authGeneration = authGenerationRef.current;

    mutationOperationIdRef.current = mutationOperationId;
    mutationLockRef.current = true;
    setIsMutationInProgress(true);
    setIsExternalSaleInProgress(true);
    loadRequestIdRef.current += 1;
    setIsRefreshing(false);
    setErrorMessage(null);
    setExternalSaleMessage(null);

    try {
      const client = await getSupabaseClient();

      if (!client) {
        throw new Error("Supabase no está configurado.");
      }

      await registerExternalShirtSale(
        client,
        externalSaleLabel.trim() || "Venta externa",
        externalSaleCustomerType,
        reservationItems,
      );

      if (
        !isAuthenticatedRef.current ||
        authGeneration !== authGenerationRef.current ||
        mutationOperationId !== mutationOperationIdRef.current
      ) {
        return;
      }

      setExternalSaleMessage({
        kind: "success",
        text: "Venta registrada y stock actualizado.",
      });
      setExternalSaleLabel("");
      setExternalSaleItems([createExternalSaleLine(1)]);
      nextExternalSaleLineIdRef.current = 2;
      await loadDashboard();
    } catch (error) {
      if (
        !isAuthenticatedRef.current ||
        authGeneration !== authGenerationRef.current ||
        mutationOperationId !== mutationOperationIdRef.current
      ) {
        return;
      }

      if (isPermissionError(error)) {
        setDashboard(null);
        setState("denied");
      } else {
        setExternalSaleMessage({
          kind: "error",
          text: getErrorMessage(error),
        });
      }
    } finally {
      if (mutationOperationId === mutationOperationIdRef.current) {
        mutationLockRef.current = false;
        setIsMutationInProgress(false);
        setIsExternalSaleInProgress(false);
      }
    }
  }

  async function handleExternalReturnSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mutationLockRef.current || !isAuthenticatedRef.current) {
      return;
    }

    const returnItem = {
      color: externalReturnColor,
      quantity: externalReturnQuantity,
      size: externalReturnSize,
    } satisfies ShirtReservationItem;

    if (
      !Number.isInteger(returnItem.quantity) ||
      returnItem.quantity < 1 ||
      returnItem.quantity > 10
    ) {
      setExternalReturnMessage({
        kind: "error",
        text: "La devolución debe contener entre 1 y 10 unidades.",
      });
      return;
    }

    const mutationOperationId = mutationOperationIdRef.current + 1;
    const authGeneration = authGenerationRef.current;
    mutationOperationIdRef.current = mutationOperationId;
    mutationLockRef.current = true;
    setIsMutationInProgress(true);
    setExternalReturnMessage(null);
    loadRequestIdRef.current += 1;

    try {
      const client = await getSupabaseClient();
      if (!client) {
        throw new Error("Supabase no está configurado.");
      }

      await registerExternalShirtReturn(
        client,
        externalReturnLabel.trim() || "Devolución",
        [returnItem],
      );

      if (
        !isAuthenticatedRef.current ||
        authGeneration !== authGenerationRef.current ||
        mutationOperationId !== mutationOperationIdRef.current
      ) {
        return;
      }

      setExternalReturnMessage({
        kind: "success",
        text: "Devolución registrada y stock repuesto.",
      });
      setExternalReturnLabel("");
      setExternalReturnQuantity(1);
      await loadDashboard();
    } catch (error) {
      if (
        !isAuthenticatedRef.current ||
        authGeneration !== authGenerationRef.current ||
        mutationOperationId !== mutationOperationIdRef.current
      ) {
        return;
      }

      setExternalReturnMessage({
        kind: "error",
        text: getErrorMessage(error),
      });
    } finally {
      if (mutationOperationId === mutationOperationIdRef.current) {
        mutationLockRef.current = false;
        setIsMutationInProgress(false);
      }
    }
  }

  async function handleStatusChange(
    reservation: ShirtStockDashboardReservation,
    nextStatus: ShirtReservationStatus,
  ) {
    if (mutationLockRef.current) {
      return;
    }

    if (!isAuthenticatedRef.current) {
      return;
    }

    const mutationOperationId = mutationOperationIdRef.current + 1;
    const authGeneration = authGenerationRef.current;

    mutationOperationIdRef.current = mutationOperationId;
    mutationLockRef.current = true;
    setIsMutationInProgress(true);
    // Any refresh already in flight predates this mutation and must not be
    // allowed to overwrite the dashboard after the mutation completes.
    loadRequestIdRef.current += 1;
    setIsRefreshing(false);
    setErrorMessage(null);
    setUpdatingReservationId(reservation.id);

    try {
      const client = await getSupabaseClient();

      if (!client) {
        throw new Error("Supabase no está configurado.");
      }

      await updateShirtReservationStatus(
        client,
        reservation.id,
        reservation.version,
        nextStatus,
      );

      if (
        !isAuthenticatedRef.current ||
        authGeneration !== authGenerationRef.current ||
        mutationOperationId !== mutationOperationIdRef.current
      ) {
        return;
      }

      await loadDashboard();
    } catch (error) {
      if (
        !isAuthenticatedRef.current ||
        authGeneration !== authGenerationRef.current ||
        mutationOperationId !== mutationOperationIdRef.current
      ) {
        return;
      }

      if (isPermissionError(error)) {
        setDashboard(null);
        setState("denied");
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      if (mutationOperationId === mutationOperationIdRef.current) {
        mutationLockRef.current = false;
        setIsMutationInProgress(false);
        setUpdatingReservationId(null);
      }
    }
  }

  return (
    <section className="screen stock-admin-screen" aria-label="Gestión de stock">
      <div className="hub-backdrop" aria-hidden="true" />
      <article className="stock-admin-sheet">
        <header className="stock-admin-header">
          <button aria-label="Volver al sitio público" onClick={onBack} type="button">
            <HiOutlineArrowLeft aria-hidden="true" />
          </button>
          <div>
            <p>Peña Oasis · Privado</p>
            <h1>Gestión de stock</h1>
          </div>
          <button
            aria-label="Actualizar datos de stock"
            disabled={!isAuthenticated || isRefreshing || isMutationInProgress}
            onClick={() => void loadDashboard()}
            type="button"
          >
            <HiOutlineArrowPath aria-hidden="true" />
          </button>
        </header>

        {isAuthenticated && state === "loading" && (
          <p className="stock-admin-state" role="status">
            Cargando inventario y reservas…
          </p>
        )}

        {(!isAuthenticated || state === "signed-out") && (
          <div className="stock-admin-state stock-admin-state--notice" role="status">
            <HiOutlineLockClosed aria-hidden="true" />
            <div>
              <strong>Inicia sesión para acceder</strong>
              <p>Este panel solo está disponible para la cuenta propietaria.</p>
              <button onClick={onSignIn} type="button">
                Ir a iniciar sesión
              </button>
            </div>
          </div>
        )}

        {isAuthenticated && state === "denied" && (
          <div className="stock-admin-state stock-admin-state--error" role="alert">
            <HiOutlineLockClosed aria-hidden="true" />
            <div>
              <strong>Acceso denegado</strong>
              <p>
                Tu cuenta no tiene permiso para gestionar stock. Si eres la
                propietaria, actualiza o inicia sesión de nuevo para renovar el JWT.
              </p>
            </div>
          </div>
        )}

        {isAuthenticated && state === "error" && (
          <div className="stock-admin-state stock-admin-state--error" role="alert">
            <strong>No podemos cargar el panel</strong>
            <p>{errorMessage}</p>
            <button onClick={() => void loadDashboard()} type="button">
              Reintentar
            </button>
          </div>
        )}

        {isAuthenticated && state === "ready" && dashboard && (
          <div className="stock-admin-content">
            <section className="stock-section stock-external-sale-section">
              <div className="stock-section-heading">
                <div>
                  <p>Venta manual</p>
                  <h2>Registrar venta externa</h2>
                </div>
              </div>
              <p className="stock-external-sale-help">
                Registra aquí las ventas hechas fuera de la web. Se marcarán como
                entregadas y descontarán el stock de forma atómica.
              </p>
              <form
                className="stock-external-sale-form"
                onSubmit={handleExternalSaleSubmit}
              >
                <div className="stock-external-sale-top-fields">
                  <label>
                    <span>Nombre o nota (opcional)</span>
                    <input
                      maxLength={100}
                      onChange={(event) => setExternalSaleLabel(event.target.value)}
                      placeholder="Venta externa"
                      type="text"
                      value={externalSaleLabel}
                    />
                  </label>
                  <label>
                    <span>Tipo de cliente</span>
                    <select
                      onChange={(event) =>
                        setExternalSaleCustomerType(
                          event.target.value as ShirtCustomerType,
                        )
                      }
                      value={externalSaleCustomerType}
                    >
                      <option value="non-member">No socio · 20 € por camiseta</option>
                      <option value="member">Socio · 15 € por camiseta</option>
                    </select>
                  </label>
                </div>

                <div className="stock-external-sale-lines">
                  {externalSaleItems.map((item, index) => (
                    <div className="stock-external-sale-line" key={item.id}>
                      <label>
                        <span>Color {index + 1}</span>
                        <select
                          onChange={(event) =>
                            updateExternalSaleLine(item.id, {
                              color: event.target.value as ShirtColor,
                            })
                          }
                          value={item.color}
                        >
                          {stockColors.map((color) => (
                            <option key={color} value={color}>
                              {getShirtColorLabel(color)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Talla</span>
                        <select
                          onChange={(event) =>
                            updateExternalSaleLine(item.id, {
                              size: event.target.value as ShirtSize,
                            })
                          }
                          value={item.size}
                        >
                          {stockSizes.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Unidades</span>
                        <input
                          max={10}
                          min={1}
                          onChange={(event) =>
                            updateExternalSaleLine(item.id, {
                              quantity: Number(event.target.value),
                            })
                          }
                          type="number"
                          value={Number.isNaN(item.quantity) ? "" : item.quantity}
                        />
                      </label>
                      <button
                        className="stock-external-sale-remove"
                        disabled={isMutationInProgress || externalSaleItems.length === 1}
                        onClick={() => removeExternalSaleLine(item.id)}
                        type="button"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>

                <div className="stock-external-sale-actions">
                  <button
                    className="stock-external-sale-add"
                    disabled={
                      isMutationInProgress ||
                      externalSaleItems.length >= MAX_SHIRT_LINE_ITEMS
                    }
                    onClick={addExternalSaleLine}
                    type="button"
                  >
                    Añadir variante
                  </button>
                  <span>
                    {externalSaleTotalQuantity} camisetas · {externalSaleTotalQuantity * externalSaleUnitPrice} €
                  </span>
                </div>

                {externalSaleMessage && (
                  <p
                    className={`stock-external-sale-message stock-external-sale-message--${externalSaleMessage.kind}`}
                    role={externalSaleMessage.kind === "error" ? "alert" : "status"}
                  >
                    {externalSaleMessage.text}
                  </p>
                )}

                <button
                  className="stock-external-sale-submit"
                  disabled={
                    isMutationInProgress ||
                    externalSaleTotalQuantity < 1 ||
                    externalSaleTotalQuantity > MAX_SHIRT_TOTAL_QUANTITY
                  }
                  type="submit"
                >
                  {isExternalSaleInProgress
                    ? "Registrando venta…"
                    : "Registrar venta y descontar stock"}
                </button>
              </form>
            </section>

            <section className="stock-section stock-external-sale-section">
              <div className="stock-section-heading">
                <div>
                  <p>Venta manual</p>
                  <h2>Registrar devolución</h2>
                </div>
              </div>
              <p className="stock-external-sale-help">
                Repone en el inventario una camiseta devuelta. La operación no
                permite devolver más unidades de las contabilizadas como entregadas.
              </p>
              <form
                className="stock-external-sale-form"
                onSubmit={handleExternalReturnSubmit}
              >
                <div className="stock-external-sale-top-fields">
                  <label>
                    <span>Nombre o nota (opcional)</span>
                    <input
                      maxLength={100}
                      onChange={(event) => setExternalReturnLabel(event.target.value)}
                      placeholder="Devolución"
                      type="text"
                      value={externalReturnLabel}
                    />
                  </label>
                  <label>
                    <span>Color</span>
                    <select
                      onChange={(event) =>
                        setExternalReturnColor(event.target.value as ShirtColor)
                      }
                      value={externalReturnColor}
                    >
                      {stockColors.map((color) => (
                        <option key={color} value={color}>
                          {getShirtColorLabel(color)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Talla</span>
                    <select
                      onChange={(event) =>
                        setExternalReturnSize(event.target.value as ShirtSize)
                      }
                      value={externalReturnSize}
                    >
                      {stockSizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Unidades</span>
                    <input
                      max={10}
                      min={1}
                      onChange={(event) =>
                        setExternalReturnQuantity(Number(event.target.value))
                      }
                      type="number"
                      value={Number.isNaN(externalReturnQuantity) ? "" : externalReturnQuantity}
                    />
                  </label>
                </div>

                {externalReturnMessage && (
                  <p
                    className={`stock-external-sale-message stock-external-sale-message--${externalReturnMessage.kind}`}
                    role={externalReturnMessage.kind === "error" ? "alert" : "status"}
                  >
                    {externalReturnMessage.text}
                  </p>
                )}

                <button
                  className="stock-external-sale-submit"
                  disabled={isMutationInProgress}
                  type="submit"
                >
                  Registrar devolución y reponer stock
                </button>
              </form>
            </section>

            <p className="stock-admin-note">
              Las reservas descuentan stock al marcarlas como entregadas; las
              ventas externas lo descuentan al registrarlas y las devoluciones lo
              reponen de forma atómica.
            </p>

            {errorMessage && (
              <p className="stock-inline-error" role="alert">
                {errorMessage}
              </p>
            )}

            <section aria-label="Resumen de inventario" className="stock-summary-grid">
              <article>
                <span>Inicial</span>
                <strong>{totals.initial}</strong>
              </article>
              <article>
                <span>Entregadas</span>
                <strong>{totals.fulfilled}</strong>
              </article>
              <article>
                <span>Disponibles</span>
                <strong>{totals.available}</strong>
              </article>
            </section>

            <section className="stock-section">
              <div className="stock-section-heading">
                <div>
                  <p>Inventario por variante</p>
                  <h2>Disponibles / iniciales</h2>
                </div>
                {isRefreshing && <span role="status">Actualizando…</span>}
              </div>
              <div className="stock-matrix-scroll" tabIndex={0}>
                <table className="stock-matrix">
                  <thead>
                    <tr>
                      <th scope="col">Color</th>
                      {stockSizes.map((size) => (
                        <th key={size} scope="col">
                          {size}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stockColors.map((color) => (
                      <tr key={color}>
                        <th scope="row">{getShirtColorLabel(color)}</th>
                        {stockSizes.map((size) => {
                          const row = getStockCell(dashboard.stock, color, size);

                          return (
                            <td key={size}>
                              {row
                                ? `${row.availableQuantity} / ${row.initialQuantity}`
                                : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="stock-section">
              <div className="stock-section-heading">
                <div>
                  <p>Todas las reservas</p>
                  <h2>Reservas</h2>
                </div>
              </div>
              <div className="stock-reservation-list">
                {dashboard.reservations.length === 0 ? (
                  <p className="stock-empty-state">Todavía no hay reservas.</p>
                ) : (
                  dashboard.reservations.map((reservation) => (
                    <ReservationCard
                      isMutationInProgress={isMutationInProgress}
                      isUpdating={updatingReservationId === reservation.id}
                      key={reservation.id}
                      onStatusChange={(currentReservation, nextStatus) =>
                        void handleStatusChange(currentReservation, nextStatus)
                      }
                      reservation={reservation}
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </article>
    </section>
  );
}
