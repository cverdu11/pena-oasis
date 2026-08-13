import type { SupabaseClient } from "@supabase/supabase-js";

export type ShirtColor = "white" | "off_white" | "blue";
export type ShirtCustomerType = "member" | "non-member";
export type ShirtFit = "regular" | "relaxed";
export type ShirtReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "fulfilled";
export type ShirtSize = "S" | "M" | "L" | "XL" | "2XL";

export type ShirtReservationItem = {
  color: ShirtColor;
  quantity: number;
  size: ShirtSize;
};

export type ShirtReservation = {
  email: string;
  fullName: string;
  items: ShirtReservationItem[];
};

export type ShirtReservationAccess = {
  id: string;
  managementToken: string | null;
};

export type ManagedShirtReservation = {
  createdAt: string;
  customerType: ShirtCustomerType;
  id: string;
  items: ShirtReservationItem[];
  status: ShirtReservationStatus;
  totalPriceEur: number;
  totalQuantity: number;
  updatedAt: string;
  version: number;
};

export type ShirtStockRow = {
  availableQuantity: number;
  color: ShirtColor;
  fulfilledQuantity: number;
  initialQuantity: number;
  size: ShirtSize;
  updatedAt: string;
};

export type ShirtStockDashboardReservation = ManagedShirtReservation & {
  email: string;
  fullName: string;
};

export type ShirtStockDashboard = {
  reservations: ShirtStockDashboardReservation[];
  stock: ShirtStockRow[];
};

type MemberReservationRow = {
  created_at: string;
  customer_type: ShirtCustomerType;
  id: string;
  shirt_reservation_items: Array<{
    color: ShirtColor;
    quantity: number;
    size: ShirtSize;
  }>;
  status: ShirtReservationStatus;
  total_price_eur: number;
  total_quantity: number;
  updated_at: string;
  version: number;
};

export const MAX_SHIRT_LINE_ITEMS = 10;
export const MAX_SHIRT_TOTAL_QUANTITY = 20;
export const SHIRT_COLOR_OPTIONS: ReadonlyArray<{
  fit: ShirtFit;
  fitLabel: string;
  label: string;
  value: ShirtColor;
}> = [
  {
    fit: "relaxed",
    fitLabel: "Relaxed",
    label: "White",
    value: "white",
  },
  {
    fit: "relaxed",
    fitLabel: "Relaxed",
    label: "Egret",
    value: "off_white",
  },
  {
    fit: "regular",
    fitLabel: "Regular",
    label: "Surf the Wet",
    value: "blue",
  },
];

export function getShirtColorLabel(color: ShirtColor) {
  return (
    SHIRT_COLOR_OPTIONS.find((option) => option.value === color)?.label ??
    color
  );
}

export function getShirtFitLabel(color: ShirtColor) {
  return (
    SHIRT_COLOR_OPTIONS.find((option) => option.value === color)?.fitLabel ??
    "Regular"
  );
}

export function getShirtVariantLabel(color: ShirtColor) {
  return `${getShirtColorLabel(color)} · ${getShirtFitLabel(color)}`;
}

export function consolidateReservationItems(
  items: ShirtReservationItem[],
) {
  const variants = new Map<string, ShirtReservationItem>();

  for (const { color, quantity, size } of items) {
    const key = `${color}-${size}`;
    const currentVariant = variants.get(key);

    variants.set(key, {
      color,
      quantity: (currentVariant?.quantity ?? 0) + quantity,
      size,
    });
  }

  return Array.from(variants.values());
}

function mapMemberReservation(
  reservation: MemberReservationRow,
): ManagedShirtReservation {
  return {
    createdAt: reservation.created_at,
    customerType: reservation.customer_type,
    id: reservation.id,
    items: reservation.shirt_reservation_items.map((item) => ({
      color: item.color,
      quantity: item.quantity,
      size: item.size,
    })),
    status: reservation.status,
    totalPriceEur: reservation.total_price_eur,
    totalQuantity: reservation.total_quantity,
    updatedAt: reservation.updated_at,
    version: reservation.version,
  };
}

function assertManagedReservation(
  value: unknown,
): ManagedShirtReservation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const reservation = value as Partial<ManagedShirtReservation>;

  if (
    typeof reservation.id !== "string" ||
    typeof reservation.version !== "number" ||
    !Array.isArray(reservation.items)
  ) {
    return null;
  }

  return reservation as ManagedShirtReservation;
}

function isShirtColor(value: unknown): value is ShirtColor {
  return value === "white" || value === "off_white" || value === "blue";
}

function isShirtSize(value: unknown): value is ShirtSize {
  return (
    value === "S" ||
    value === "M" ||
    value === "L" ||
    value === "XL" ||
    value === "2XL"
  );
}

function isShirtReservationStatus(
  value: unknown,
): value is ShirtReservationStatus {
  return (
    value === "pending" ||
    value === "confirmed" ||
    value === "cancelled" ||
    value === "fulfilled"
  );
}

function isShirtCustomerType(value: unknown): value is ShirtCustomerType {
  return value === "member" || value === "non-member";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parseDashboardItem(value: unknown): ShirtReservationItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<ShirtReservationItem>;
  const { color, quantity, size } = item;

  if (
    !isShirtColor(color) ||
    !isShirtSize(size) ||
    !isPositiveInteger(quantity)
  ) {
    return null;
  }

  return {
    color,
    quantity,
    size,
  };
}

function parseShirtStockRow(value: unknown): ShirtStockRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Partial<ShirtStockRow>;
  const {
    availableQuantity,
    color,
    fulfilledQuantity,
    initialQuantity,
    size,
    updatedAt,
  } = row;

  if (
    !isShirtColor(color) ||
    !isShirtSize(size) ||
    !isNonNegativeInteger(initialQuantity) ||
    !isNonNegativeInteger(fulfilledQuantity) ||
    !isNonNegativeInteger(availableQuantity) ||
    availableQuantity !== initialQuantity - fulfilledQuantity ||
    typeof updatedAt !== "string"
  ) {
    return null;
  }

  return {
    availableQuantity,
    color,
    fulfilledQuantity,
    initialQuantity,
    size,
    updatedAt,
  };
}

function parseDashboardReservation(
  value: unknown,
): ShirtStockDashboardReservation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const reservation = value as Partial<ShirtStockDashboardReservation>;
  const {
    createdAt,
    customerType,
    email,
    fullName,
    id,
    status,
    totalPriceEur,
    totalQuantity,
    updatedAt,
    version,
  } = reservation;
  const items = Array.isArray(reservation.items)
    ? reservation.items.map(parseDashboardItem)
    : null;

  if (
    typeof id !== "string" ||
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    !isShirtCustomerType(customerType) ||
    !isShirtReservationStatus(status) ||
    !isPositiveInteger(totalQuantity) ||
    !isNonNegativeInteger(totalPriceEur) ||
    typeof createdAt !== "string" ||
    typeof updatedAt !== "string" ||
    !isPositiveInteger(version) ||
    !items ||
    items.some((item) => !item)
  ) {
    return null;
  }

  return {
    createdAt,
    customerType,
    email,
    fullName,
    id,
    items: items as ShirtReservationItem[],
    status,
    totalPriceEur,
    totalQuantity,
    updatedAt,
    version,
  };
}

function parseShirtStockDashboard(value: unknown): ShirtStockDashboard | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const dashboard = value as Partial<ShirtStockDashboard>;
  const stock = Array.isArray(dashboard.stock)
    ? dashboard.stock.map(parseShirtStockRow)
    : null;
  const reservations = Array.isArray(dashboard.reservations)
    ? dashboard.reservations.map(parseDashboardReservation)
    : null;

  if (
    !stock ||
    !reservations ||
    stock.some((row) => !row) ||
    reservations.some((reservation) => !reservation)
  ) {
    return null;
  }

  return {
    reservations: reservations as ShirtStockDashboardReservation[],
    stock: stock as ShirtStockRow[],
  };
}

export async function createShirtReservation(
  client: SupabaseClient,
  reservation: ShirtReservation,
): Promise<ShirtReservationAccess> {
  const { data, error } = await client.rpc("create_shirt_reservation", {
    reservation_email: reservation.email.trim().toLowerCase(),
    reservation_full_name: reservation.fullName.trim(),
    reservation_items: reservation.items,
  });

  if (error) {
    throw error;
  }

  if (typeof data === "string") {
    return { id: data, managementToken: null };
  }

  const result = data as {
    id?: unknown;
    managementToken?: unknown;
  };

  if (typeof result?.id !== "string") {
    throw new Error("La reserva guardada no tiene un identificador válido.");
  }

  return {
    id: result.id,
    managementToken:
      typeof result.managementToken === "string"
        ? result.managementToken
        : null,
  };
}

export async function fetchMyShirtReservations(
  client: SupabaseClient,
) {
  const { data, error } = await client
    .from("shirt_reservations")
    .select(
      "id, customer_type, status, total_quantity, total_price_eur, created_at, updated_at, version, shirt_reservation_items(color, size, quantity)",
    )
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .returns<MemberReservationRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapMemberReservation);
}

export async function updateMyShirtReservation(
  client: SupabaseClient,
  reservationId: string,
  expectedVersion: number,
  items: ShirtReservationItem[],
) {
  const { data, error } = await client.rpc("update_my_shirt_reservation", {
    expected_version_arg: expectedVersion,
    reservation_id_arg: reservationId,
    reservation_items_arg: consolidateReservationItems(items),
  });

  if (error) {
    throw error;
  }

  return Number(data);
}

export async function cancelMyShirtReservation(
  client: SupabaseClient,
  reservationId: string,
  expectedVersion: number,
) {
  const { data, error } = await client.rpc(
    "cancel_my_shirt_reservation",
    {
      expected_version_arg: expectedVersion,
      reservation_id_arg: reservationId,
    },
  );

  if (error) {
    throw error;
  }

  return Number(data);
}

export async function fetchGuestShirtReservation(
  client: SupabaseClient,
  reservationId: string,
  managementToken: string,
) {
  const { data, error } = await client.rpc(
    "get_guest_shirt_reservation",
    {
      management_token_arg: managementToken,
      reservation_id_arg: reservationId,
    },
  );

  if (error) {
    throw error;
  }

  return assertManagedReservation(data);
}

export async function updateGuestShirtReservation(
  client: SupabaseClient,
  reservationId: string,
  managementToken: string,
  expectedVersion: number,
  items: ShirtReservationItem[],
) {
  const { data, error } = await client.rpc(
    "update_guest_shirt_reservation",
    {
      expected_version_arg: expectedVersion,
      management_token_arg: managementToken,
      reservation_id_arg: reservationId,
      reservation_items_arg: consolidateReservationItems(items),
    },
  );

  if (error) {
    throw error;
  }

  return Number(data);
}

export async function cancelGuestShirtReservation(
  client: SupabaseClient,
  reservationId: string,
  managementToken: string,
  expectedVersion: number,
) {
  const { data, error } = await client.rpc(
    "cancel_guest_shirt_reservation",
    {
      expected_version_arg: expectedVersion,
      management_token_arg: managementToken,
      reservation_id_arg: reservationId,
    },
  );

  if (error) {
    throw error;
  }

  return Number(data);
}

export async function fetchShirtStockDashboard(
  client: SupabaseClient,
): Promise<ShirtStockDashboard> {
  const { data, error } = await client.rpc("get_shirt_stock_dashboard");

  if (error) {
    throw error;
  }

  const dashboard = parseShirtStockDashboard(data);

  if (!dashboard) {
    throw new Error("El panel de stock devolvió datos no válidos.");
  }

  return dashboard;
}

export async function updateShirtReservationStatus(
  client: SupabaseClient,
  reservationId: string,
  expectedVersion: number,
  nextStatus: ShirtReservationStatus,
) {
  const { data, error } = await client.rpc(
    "update_shirt_reservation_status",
    {
      expected_version_arg: expectedVersion,
      next_status_arg: nextStatus,
      reservation_id_arg: reservationId,
    },
  );

  if (error) {
    throw error;
  }

  const nextVersion = Number(data);

  if (!Number.isInteger(nextVersion) || nextVersion < expectedVersion) {
    throw new Error(
      "La actualización de la reserva devolvió una versión no válida.",
    );
  }

  return nextVersion;
}

export async function registerExternalShirtSale(
  client: SupabaseClient,
  label: string,
  customerType: ShirtCustomerType,
  items: ShirtReservationItem[],
): Promise<string> {
  const { data, error } = await client.rpc("register_external_shirt_sale", {
    reservation_customer_type_arg: customerType,
    reservation_items_arg: items,
    reservation_label_arg: label,
  });

  if (error) {
    throw error;
  }

  if (typeof data !== "string" || !data.trim()) {
    throw new Error("La venta externa no devolvió un identificador válido.");
  }

  return data;
}

export function getGuestReservationManagementHash(
  reservationId: string,
  managementToken: string,
) {
  const params = new URLSearchParams({
    id: reservationId,
    token: managementToken,
  });

  return `#reserva?${params.toString()}`;
}
