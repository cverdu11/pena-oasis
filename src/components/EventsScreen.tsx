import { useEffect, useState } from "react";
import { EventPollCard } from "./EventPollCard";
import type { EventPoll } from "./EventPollCard";
import {
  EMPTY_EVENT_RESPONSE,
  fetchEventAttendanceCounts,
  fetchUserEventResponses,
  saveUserEventResponse,
} from "../lib/eventAttendance";
import type { EventAttendanceResponse } from "../lib/eventAttendance";
import { getSupabaseClient } from "../lib/supabase";

const eventPolls: EventPoll[] = [
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
  },
];

const eventIds = eventPolls.map((event) => event.id);

function createEmptyResponses() {
  return Object.fromEntries(
    eventIds.map((eventId) => [eventId, { ...EMPTY_EVENT_RESPONSE }]),
  ) as Record<string, EventAttendanceResponse>;
}

function createEmptyCounts() {
  return Object.fromEntries(eventIds.map((eventId) => [eventId, null])) as Record<
    string,
    number | null
  >;
}

export function EventsScreen() {
  const [attendeeCounts, setAttendeeCounts] = useState(createEmptyCounts);
  const [responses, setResponses] = useState(createEmptyResponses);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [systemMessage, setSystemMessage] = useState("");

  useEffect(() => {
    let isActive = true;
    let countRefreshTimer: number | undefined;

    async function refreshCounts() {
      const client = await getSupabaseClient();

      if (!client) {
        if (isActive) {
          setSystemMessage("El recuento no está disponible en este entorno.");
        }
        return;
      }

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
        const [{ data: sessionData, error: sessionError }] = await Promise.all([
          client.auth.getSession(),
          refreshCounts(),
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
          setResponses({ ...createEmptyResponses(), ...userResponses });
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

      if (isActive) {
        countRefreshTimer = window.setInterval(() => {
          void refreshCounts();
        }, 30_000);
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

  return (
    <section className="screen hub-screen" aria-label="Eventos">
      <div className="hub-backdrop" aria-hidden="true" />
      <div className="hub-sheet events-sheet">
        <header className="hub-header">
          <span className="hub-avatar">PO</span>
          <div>
            <p>Peña Oasis</p>
            <h1>Eventos</h1>
          </div>
        </header>

        <div className="event-poll-list">
          {eventPolls.map((event) => (
            <EventPollCard
              attendeeCount={attendeeCounts[event.id] ?? null}
              event={event}
              isAuthenticated={Boolean(userId)}
              isLoading={isLoading}
              isSaving={savingEventId === event.id}
              key={event.id}
              response={responses[event.id] ?? EMPTY_EVENT_RESPONSE}
              systemMessage={systemMessage}
              onSave={(response) => handleSaveResponse(event.id, response)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
