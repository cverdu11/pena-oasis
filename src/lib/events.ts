import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventPoll } from "../components/EventPollCard";

type EventRow = {
  id: string;
  kind: "travel" | "home";
  category: string;
  title: string;
  starts_at: string;
  ends_at: string;
  time_label: string;
  location: string;
  detail: string;
};

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  timeZone: "Europe/Madrid",
});

const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  timeZone: "Europe/Madrid",
});

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Madrid",
  weekday: "long",
});

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function mapEventRow(row: EventRow): EventPoll {
  const startDate = new Date(row.starts_at);

  return {
    id: row.id,
    kind: row.kind,
    category: row.category,
    title: row.title,
    day: dayFormatter.format(startDate),
    month: monthFormatter.format(startDate).replace(".", "").toUpperCase(),
    date: capitalize(dateFormatter.format(startDate)),
    time: row.time_label,
    location: row.location,
    detail: row.detail,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

export async function fetchPublishedEvents(client: SupabaseClient) {
  const { data, error } = await client
    .from("events")
    .select(
      "id, kind, category, title, starts_at, ends_at, time_label, location, detail",
    )
    .eq("is_published", true)
    .order("starts_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as EventRow[]).map(mapEventRow);
}
