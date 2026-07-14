import { useState } from "react";
import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineEyeSlash,
  HiOutlineMapPin,
  HiOutlineUserGroup,
  HiOutlineXCircle,
} from "react-icons/hi2";

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
  attendeeCount: number;
};

type AttendanceAnswer = "attending" | "not-attending" | null;

type SavedEventResponse = {
  answer: AttendanceAnswer;
  isPrivate: boolean;
};

type EventPollCardProps = {
  event: EventPoll;
};

const EVENT_RESPONSE_STORAGE_PREFIX = "pena-oasis-event-response-v1";

function getStorageKey(eventId: string) {
  return `${EVENT_RESPONSE_STORAGE_PREFIX}:${eventId}`;
}

function readSavedResponse(eventId: string): SavedEventResponse {
  try {
    const storedValue = window.localStorage.getItem(getStorageKey(eventId));

    if (!storedValue) {
      return { answer: null, isPrivate: false };
    }

    const parsed = JSON.parse(storedValue) as Partial<SavedEventResponse>;
    const answer =
      parsed.answer === "attending" || parsed.answer === "not-attending"
        ? parsed.answer
        : null;

    return {
      answer,
      isPrivate: Boolean(parsed.isPrivate),
    };
  } catch {
    return { answer: null, isPrivate: false };
  }
}

function saveResponse(eventId: string, response: SavedEventResponse) {
  try {
    window.localStorage.setItem(getStorageKey(eventId), JSON.stringify(response));
  } catch {
    // The response still works for the current visit if storage is unavailable.
  }
}

export function EventPollCard({ event }: EventPollCardProps) {
  const [response, setResponse] = useState<SavedEventResponse>(() =>
    readSavedResponse(event.id),
  );
  const [hasInteracted, setHasInteracted] = useState(false);
  const attendeeCount =
    event.attendeeCount + (response.answer === "attending" ? 1 : 0);

  function updateResponse(nextResponse: SavedEventResponse) {
    setResponse(nextResponse);
    saveResponse(event.id, nextResponse);
    setHasInteracted(true);
  }

  function handleAnswer(answer: Exclude<AttendanceAnswer, null>) {
    updateResponse({ ...response, answer });
  }

  function handlePrivacyChange(isPrivate: boolean) {
    updateResponse({ ...response, isPrivate });
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
          <strong>{attendeeCount}</strong> personas asistirán a este evento
        </p>
      </div>

      <fieldset className="event-vote-fieldset">
        <legend>¿Vas a asistir?</legend>
        <div className="event-vote-options">
          <button
            aria-pressed={response.answer === "attending"}
            data-selected={response.answer === "attending"}
            type="button"
            onClick={() => handleAnswer("attending")}
          >
            <HiOutlineCheckCircle aria-hidden="true" />
            <span>Asistiré</span>
          </button>
          <button
            aria-pressed={response.answer === "not-attending"}
            data-selected={response.answer === "not-attending"}
            type="button"
            onClick={() => handleAnswer("not-attending")}
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
            checked={response.isPrivate}
            role="switch"
            type="checkbox"
            onChange={(event) => handlePrivacyChange(event.target.checked)}
          />
          <span aria-hidden="true" />
        </span>
      </label>

      <p className="event-response-status" aria-live="polite">
        {hasInteracted
          ? response.answer === "attending"
            ? response.isPrivate
              ? "Asistencia confirmada de forma privada."
              : "Asistencia confirmada."
            : response.answer === "not-attending"
              ? "Respuesta guardada."
              : "Preferencia de privacidad guardada."
          : ""}
      </p>
    </article>
  );
}
