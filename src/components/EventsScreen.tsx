import { useEffect, useState } from "react";
import { EventPollCard } from "./EventPollCard";
import type { EventPoll } from "./EventPollCard";
import {
  EMPTY_EVENT_RESPONSE,
  fetchEventAttendanceCounts,
  fetchEventAttendees,
  fetchUserEventResponses,
  saveUserEventResponse,
} from "../lib/eventAttendance";
import type { EventAttendanceResponse } from "../lib/eventAttendance";
import { fetchPublishedEvents } from "../lib/events";
import { getSupabaseClient } from "../lib/supabase";
import type { MemberIdentity } from "../hooks/useMemberIdentity";
import { AppHeader } from "./AppHeader";

const fallbackEventPolls: EventPoll[] = [
  {
    id: "madrid-trip-2026-08-19",
    kind: "travel",
    category: "On Tour",
    title: "Atlético de Madrid - Málaga",
    day: "19",
    month: "AGO",
    date: "Miércoles, 19 de agosto",
    time: "Horario de salida por confirmar",
    location: "Madrid",
    detail: "Desplazamiento para el partido fuera de casa.",
    startsAt: "2026-08-19T12:00:00+02:00",
    endsAt: "2026-08-19T23:59:59+02:00",
  },
  {
    id: "home-preview-2026-08-24",
    kind: "home",
    category: "Previa en casa",
    title: "Previa del partido en casa",
    day: "24",
    month: "AGO",
    date: "Lunes, 24 de agosto",
    time: "19:30",
    location: "Punto de encuentro por confirmar",
    detail: "Nos vemos dos horas antes. El partido comienza a las 21:30.",
    startsAt: "2026-08-24T19:30:00+02:00",
    endsAt: "2026-08-24T21:30:00+02:00",
  },
];

function createEmptyResponses(eventIds: string[]) {
  return Object.fromEntries(
    eventIds.map((eventId) => [eventId, { ...EMPTY_EVENT_RESPONSE }]),
  ) as Record<string, EventAttendanceResponse>;
}

function createEmptyCounts(eventIds: string[]) {
  return Object.fromEntries(eventIds.map((eventId) => [eventId, null])) as Record<
    string,
    number | null
  >;
}

type EventsScreenProps = {
  identity: MemberIdentity;
  isAccountMenuOpen: boolean;
  onAvatarClick: () => void;
};

export function EventsScreen({
  identity,
  isAccountMenuOpen,
  onAvatarClick,
}: EventsScreenProps) {
  const [eventPolls, setEventPolls] = useState(fallbackEventPolls);
  const [attendeeCounts, setAttendeeCounts] = useState(() =>
    createEmptyCounts(fallbackEventPolls.map((event) => event.id)),
  );
  const [responses, setResponses] = useState(() =>
    createEmptyResponses(fallbackEventPolls.map((event) => event.id)),
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [systemMessage, setSystemMessage] = useState("");

  useEffect(() => {
    let isActive = true;
    let countRefreshTimer: number | undefined;

    async function refreshCounts(
      client: NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>,
      eventIds: string[],
    ) {
      try {
        const counts = await fetchEventAttendanceCounts(client, eventIds);

        if (isActive) {
          setAttendeeCounts(counts);
          setSystemMessage("");
        }
      } catch {
        if (isActive) {
          setSystemMessage("No hemos podido actualizar el recuento.");
        }
      }
    }

    async function loadAttendance() {
      const client = await getSupabaseClient();

      if (!client) {
        if (isActive) {
          setSystemMessage("El recuento no está disponible en este entorno.");
          setIsLoading(false);
        }
        return;
      }

      try {
        let loadedEvents = fallbackEventPolls;

        try {
          loadedEvents = await fetchPublishedEvents(client);
        } catch {
          setSystemMessage(
            "Mostramos los eventos disponibles mientras actualizamos la agenda.",
          );
        }

        const eventIds = loadedEvents.map((event) => event.id);

        if (isActive) {
          setEventPolls(loadedEvents);
          setAttendeeCounts(createEmptyCounts(eventIds));
          setResponses(createEmptyResponses(eventIds));
        }

        const [{ data: sessionData, error: sessionError }] = await Promise.all([
          client.auth.getSession(),
          refreshCounts(client, eventIds),
        ]);

        if (sessionError) {
          throw sessionError;
        }

        const activeUserId = sessionData.session?.user.id ?? null;
        const userResponses = activeUserId
          ? await fetchUserEventResponses(client, activeUserId, eventIds)
          : {};

        if (isActive) {
          setUserId(activeUserId);
          setResponses({ ...createEmptyResponses(eventIds), ...userResponses });
        }

        if (isActive) {
          countRefreshTimer = window.setInterval(() => {
            void refreshCounts(client, eventIds);
          }, 30_000);
        }
      } catch {
        if (isActive) {
          setSystemMessage("No hemos podido cargar tus respuestas.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }

    }

    void loadAttendance();

    return () => {
      isActive = false;

      if (countRefreshTimer !== undefined) {
        window.clearInterval(countRefreshTimer);
      }
    };
  }, []);

  async function handleSaveResponse(
    eventId: string,
    nextResponse: EventAttendanceResponse,
  ) {
    if (!nextResponse.answer) {
      return false;
    }

    const client = await getSupabaseClient();

    if (!client) {
      return false;
    }

    setSavingEventId(eventId);

    try {
      const { data, error } = await client.auth.getUser();

      if (error || !data.user) {
        setUserId(null);
        return false;
      }

      await saveUserEventResponse(
        client,
        eventId,
        data.user.id,
        {
          answer: nextResponse.answer,
          isPrivate: nextResponse.isPrivate,
        },
      );

      setUserId(data.user.id);
      setResponses((current) => ({
        ...current,
        [eventId]: nextResponse,
      }));

      try {
        const eventIds = eventPolls.map((event) => event.id);
        const counts = await fetchEventAttendanceCounts(client, eventIds);
        setAttendeeCounts(counts);
        setSystemMessage("");
      } catch {
        setSystemMessage(
          "Respuesta guardada. El recuento se actualizará en unos segundos.",
        );
      }

      return true;
    } catch {
      return false;
    } finally {
      setSavingEventId(null);
    }
  }

  async function handleLoadAttendees(eventId: string) {
    const client = await getSupabaseClient();

    if (!client) {
      throw new Error("Supabase no está disponible.");
    }

    return fetchEventAttendees(client, eventId);
  }

  const now = Date.now();
  const upcomingEvents = eventPolls.filter(
    (event) => new Date(event.endsAt).getTime() >= now,
  );
  const pastEvents = eventPolls
    .filter((event) => new Date(event.endsAt).getTime() < now)
    .reverse();

  return (
    <section className="screen hub-screen" aria-label="Eventos">
      <div className="hub-backdrop" aria-hidden="true" />
      <div className="hub-sheet events-sheet">
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
          title="Eventos"
        />

        <div className="event-poll-list">
          {upcomingEvents.length === 0 && (
            <div className="event-empty-state">
              <strong>No hay próximos eventos publicados</strong>
              <span>La nueva agenda aparecerá aquí.</span>
            </div>
          )}

          {upcomingEvents.map((event) => (
            <EventPollCard
              attendeeCount={attendeeCounts[event.id] ?? null}
              event={event}
              isAuthenticated={Boolean(userId)}
              isLoading={isLoading}
              isPast={false}
              isSaving={savingEventId === event.id}
              key={event.id}
              response={responses[event.id] ?? EMPTY_EVENT_RESPONSE}
              systemMessage={systemMessage}
              onLoadAttendees={() => handleLoadAttendees(event.id)}
              onSave={(response) => handleSaveResponse(event.id, response)}
            />
          ))}

          {pastEvents.length > 0 && (
            <section className="past-events" aria-labelledby="past-events-title">
              <h2 id="past-events-title">Eventos anteriores</h2>
              <div className="past-event-list">
                {pastEvents.map((event) => (
                  <EventPollCard
                    attendeeCount={attendeeCounts[event.id] ?? null}
                    event={event}
                    isAuthenticated={Boolean(userId)}
                    isLoading={isLoading}
                    isPast
                    isSaving={false}
                    key={event.id}
                    response={responses[event.id] ?? EMPTY_EVENT_RESPONSE}
                    systemMessage={systemMessage}
                    onLoadAttendees={() => handleLoadAttendees(event.id)}
                    onSave={(response) =>
                      handleSaveResponse(event.id, response)
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
