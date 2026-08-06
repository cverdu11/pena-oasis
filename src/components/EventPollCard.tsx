import { useEffect, useId, useState } from "react";
import {
  HiOutlineArchiveBox,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineMapPin,
  HiOutlineUser,
  HiOutlineUserGroup,
  HiOutlineXCircle,
} from "react-icons/hi2";
import type {
  EventAttendee,
  EventAttendanceResponse,
} from "../lib/eventAttendance";

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
  startsAt: string;
  endsAt: string;
};

type EventPollCardProps = {
  event: EventPoll;
  attendeeCount: number | null;
  response: EventAttendanceResponse;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSaving: boolean;
  systemMessage: string;
  isPast: boolean;
  onLoadAttendees: () => Promise<EventAttendee[]>;
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
  isPast,
  onLoadAttendees,
  onSave,
}: EventPollCardProps) {
  const attendeeListId = useId();
  const [privacyDraft, setPrivacyDraft] = useState(response.isPrivate);
  const [statusMessage, setStatusMessage] = useState("");
  const [isAttendeeListOpen, setIsAttendeeListOpen] = useState(false);
  const [isAttendeeListLoading, setIsAttendeeListLoading] = useState(false);
  const [attendeeListError, setAttendeeListError] = useState("");
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);

  useEffect(() => {
    setPrivacyDraft(response.isPrivate);
  }, [response.isPrivate]);

  useEffect(() => {
    if (attendeeCount === 0) {
      setIsAttendeeListOpen(false);
      setAttendees([]);
    }
  }, [attendeeCount]);

  async function loadAttendees() {
    setIsAttendeeListLoading(true);
    setAttendeeListError("");

    try {
      setAttendees(await onLoadAttendees());
    } catch {
      setAttendeeListError("No hemos podido cargar la lista de asistentes.");
    } finally {
      setIsAttendeeListLoading(false);
    }
  }

  function handleAttendeeListToggle() {
    if (isAttendeeListOpen) {
      setIsAttendeeListOpen(false);
      return;
    }

    setIsAttendeeListOpen(true);
    void loadAttendees();
  }

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

    if (saved && isAttendeeListOpen) {
      void loadAttendees();
    }
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

    if (saved && isAttendeeListOpen) {
      void loadAttendees();
    }
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

      <div className="event-attendance-panel">
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
                  ? isPast
                    ? "persona asistió a este evento"
                    : "persona asistirá a este evento"
                  : isPast
                    ? "personas asistieron a este evento"
                    : "personas asistirán a este evento"}
              </>
            )}
          </p>
          {isAuthenticated && attendeeCount !== null && attendeeCount > 0 && (
            <button
              aria-controls={attendeeListId}
              aria-expanded={isAttendeeListOpen}
              aria-label={
                isAttendeeListOpen
                  ? "Ocultar lista de asistentes"
                  : "Ver lista de asistentes"
              }
              className="event-attendee-list-button"
              title={
                isAttendeeListOpen
                  ? "Ocultar lista de asistentes"
                  : "Ver lista de asistentes"
              }
              type="button"
              onClick={handleAttendeeListToggle}
            >
              <HiOutlineEye aria-hidden="true" />
            </button>
          )}
        </div>

        {isAttendeeListOpen && (
          <div className="event-attendee-list" id={attendeeListId}>
            {isAttendeeListLoading ? (
              <p role="status">Cargando lista...</p>
            ) : attendeeListError ? (
              <p role="alert">{attendeeListError}</p>
            ) : attendees.length > 0 ? (
              <ul>
                {attendees.map((attendee, index) => (
                  <li key={`${attendee.displayName}-${index}`}>
                    {attendee.isPrivate ? (
                      <HiOutlineEyeSlash aria-hidden="true" />
                    ) : (
                      <HiOutlineUser aria-hidden="true" />
                    )}
                    <span>{attendee.displayName}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No hay asistentes confirmados.</p>
            )}
          </div>
        )}
      </div>

      {isPast ? (
        <div className="event-closed-note">
          <HiOutlineArchiveBox aria-hidden="true" />
          <span>Evento finalizado</span>
        </div>
      ) : (
        <>
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
            {isSaving
              ? "Guardando respuesta..."
              : statusMessage || systemMessage}
          </p>
        </>
      )}
    </article>
  );
}
