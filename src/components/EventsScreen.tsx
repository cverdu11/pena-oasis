import { HiOutlineCalendarDays } from "react-icons/hi2";
import { EventPollCard } from "./EventPollCard";
import type { EventPoll } from "./EventPollCard";

const eventPolls: EventPoll[] = [
  {
    id: "madrid-trip-2026-08-19",
    kind: "travel",
    category: "Viaje organizado",
    title: "Atlético de Madrid - Málaga",
    day: "19",
    month: "AGO",
    date: "Miércoles, 19 de agosto",
    time: "Horario de salida por confirmar",
    location: "Madrid",
    detail: "Desplazamiento para el partido fuera de casa.",
    attendeeCount: 16,
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
    attendeeCount: 11,
  },
];

export function EventsScreen() {
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

        <section className="hub-hero-card events-intro">
          <HiOutlineCalendarDays aria-hidden="true" />
          <h2>Próximos encuentros</h2>
          <p>Confirma tu asistencia a las previas y viajes de la Peña.</p>
        </section>

        <div className="event-poll-list">
          {eventPolls.map((event) => (
            <EventPollCard event={event} key={event.id} />
          ))}
        </div>
      </div>
    </section>
  );
}
