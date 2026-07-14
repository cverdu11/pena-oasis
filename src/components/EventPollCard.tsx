import { useEffect, useState } from "react";
import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineEyeSlash,
  HiOutlineMapPin,
  HiOutlineUserGroup,
  HiOutlineXCircle,
} from "react-icons/hi2";
import type { EventAttendanceResponse } from "../lib/eventAttendance";

export type EventPoll = {
  id: string;
  kind: "travel" | "home";
  category: string;
  title: string;
  day: string;
  month: string;
  date: string;
  time: string;
  location: string;
  detail: string;
};

type EventPollCardProps = {
  event: EventPoll;
  attendeeCount: number | null;
  response: EventAttendanceResponse;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSaving: boolean;
  systemMessage: string;
  onSave: (response: EventAttendanceResponse) => Promise<boolean>;
};

export function EventPollCard({
  event,
  attendeeCount,
  response,
  isAuthenticated,
  isLoading,
  isSaving,
  systemMessage,
  onSave,
}: EventPollCardProps) {
  const [privacyDraft, setPrivacyDraft] = useState(response.isPrivate);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setPrivacyDraft(response.isPrivate);
  }, [response.isPrivate]);

  function requireAuthenticatedUser() {
    if (isAuthenticated) {
      return true;
    }

    setStatusMessage("Inicia sesión en Hazte socio para responder.");
    return false;
  }

  async function handleAnswer(
    answer: Exclude<EventAttendanceResponse["answer"], null>,
  ) {
    if (!requireAuthenticatedUser()) {
      return;
    }

    setStatusMessage("");
    const saved = await onSave({ answer, isPrivate: privacyDraft });

    setStatusMessage(
      saved
        ? answer === "attending"
          ? privacyDraft
            ? "Asistencia confirmada de forma privada."
            : "Asistencia confirmada."
          : "Respuesta guardada."
        : "No hemos podido guardar la respuesta. Inténtalo de nuevo.",
    );
  }

  async function handlePrivacyChange(isPrivate: boolean) {
    if (!requireAuthenticatedUser()) {
      return;
    }

    setPrivacyDraft(isPrivate);

    if (!response.answer) {
      setStatusMessage(
        isPrivate
          ? "Tu respuesta será privada cuando elijas una opción."
          : "Elige una opción para guardar tu respuesta.",
      );
      return;
    }

    setStatusMessage("");
    const saved = await onSave({ ...response, isPrivate });

    if (!saved) {
      setPrivacyDraft(response.isPrivate);
    }

    setStatusMessage(
      saved
        ? isPrivate
          ? "Participación privada activada."
          : "Participación visible activada."
        : "No hemos podido guardar la privacidad. Inténtalo de nuevo.",
    );
  }

  return (
    <article className="event-poll-card" data-kind={event.kind}>
      <header className="event-poll-header">
        <span className="event-date-tile" aria-hidden="true">
          <strong>{event.day}</strong>
          <span>{event.month}</span>
        </span>
        <div>
          <p>{event.category}</p>
          <h2>{event.title}</h2>
        </div>
      </header>

      <div className="event-poll-details">
        <span>
          <HiOutlineClock aria-hidden="true" />
          {event.date} · {event.time}
        </span>
        <span>
          <HiOutlineMapPin aria-hidden="true" />
          {event.location}
        </span>
        <p>{event.detail}</p>
      </div>

      <div className="event-attendee-count" aria-live="polite">
        <span>
          <HiOutlineUserGroup aria-hidden="true" />
        </span>
        <p>
          {attendeeCount === null ? (
            "Cargando asistentes..."
          ) : (
            <>
              <strong>{attendeeCount}</strong>{" "}
              {attendeeCount === 1
                ? "persona asistirá a este evento"
                : "personas asistirán a este evento"}
            </>
          )}
        </p>
      </div>

      <fieldset className="event-vote-fieldset">
        <legend>¿Vas a asistir?</legend>
        <div className="event-vote-options">
          <button
            aria-pressed={response.answer === "attending"}
            data-selected={response.answer === "attending"}
            disabled={isLoading || isSaving}
            type="button"
            onClick={() => void handleAnswer("attending")}
          >
            <HiOutlineCheckCircle aria-hidden="true" />
            <span>Asistiré</span>
          </button>
          <button
            aria-pressed={response.answer === "not-attending"}
            data-selected={response.answer === "not-attending"}
            disabled={isLoading || isSaving}
            type="button"
            onClick={() => void handleAnswer("not-attending")}
          >
            <HiOutlineXCircle aria-hidden="true" />
            <span>No asistiré</span>
          </button>
        </div>
      </fieldset>

      <label className="event-private-option">
        <span className="event-private-icon">
          <HiOutlineEyeSlash aria-hidden="true" />
        </span>
        <span className="event-private-copy">
          <strong>Participación privada</strong>
          <small>Tu nombre no aparecerá en la lista de asistentes.</small>
        </span>
        <span className="event-switch">
          <input
            checked={privacyDraft}
            disabled={isLoading || isSaving}
            role="switch"
            type="checkbox"
            onChange={(event) =>
              void handlePrivacyChange(event.target.checked)
            }
          />
          <span aria-hidden="true" />
        </span>
      </label>

      <p className="event-response-status" aria-live="polite">
        {isSaving ? "Guardando respuesta..." : statusMessage || systemMessage}
      </p>
    </article>
  );
}
