import { useEffect, useState } from "react";
import {
  HiOutlineArrowRight,
  HiOutlineChevronRight,
  HiOutlineMapPin,
  HiOutlineUserPlus,
} from "react-icons/hi2";
import type { MemberIdentity } from "../hooks/useMemberIdentity";
import { getSupabaseClient } from "../lib/supabase";
import { fetchPublishedEvents } from "../lib/events";
import { FEATURED_NEWS } from "../lib/news";
import type { EventPoll } from "./EventPollCard";
import type { TabId } from "../types";
import { AppHeader } from "./AppHeader";

type HomeScreenProps = {
  identity: MemberIdentity;
  isAccountMenuOpen: boolean;
  onAvatarClick: () => void;
  onNavigate: (tab: TabId) => void;
  onOpenLatestNews: () => void;
};

const FALLBACK_EVENT = {
  day: "19",
  month: "AGO",
  title: "Atlético de Madrid - Málaga",
  location: "Madrid",
};

export function HomeScreen({
  identity,
  isAccountMenuOpen,
  onAvatarClick,
  onNavigate,
  onOpenLatestNews,
}: HomeScreenProps) {
  const [upcomingEvent, setUpcomingEvent] =
    useState<Pick<EventPoll, "day" | "month" | "title" | "location">>(
      FALLBACK_EVENT,
    );

  useEffect(() => {
    let isActive = true;

    async function loadUpcomingEvent() {
      const client = await getSupabaseClient();
      if (!client) {
        return;
      }

      try {
        const events = await fetchPublishedEvents(client);
        const nextEvent = events.find(
          (event) => new Date(event.endsAt).getTime() >= Date.now(),
        );

        if (isActive && nextEvent) {
          setUpcomingEvent(nextEvent);
        }
      } catch {
        // The stable fallback keeps the HOME useful if the event feed is unavailable.
      }
    }

    void loadUpcomingEvent();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="screen hub-screen" aria-label="Inicio">
      <div className="hub-backdrop" aria-hidden="true" />
      <div className="hub-sheet home-sheet">
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
          title="Inicio"
        />

        <section
          aria-label="Peña Oasis, tu casa malaguista"
          className="home-hero"
          role="img"
        >
          <div className="home-hero-copy">
            <p>Peña Oasis</p>
            <h2>Tu casa malaguista</h2>
          </div>
        </section>

        <button
          className="home-event-preview"
          type="button"
          onClick={() => onNavigate("events")}
        >
          <span className="home-section-label">Próximo evento</span>
          <span className="home-event-date" aria-label={`${upcomingEvent.day} de ${upcomingEvent.month}`}>
            <strong>{upcomingEvent.day}</strong>
            <small>{upcomingEvent.month}</small>
          </span>
          <span className="home-event-copy">
            <strong>{upcomingEvent.title}</strong>
            <small>
              <HiOutlineMapPin aria-hidden="true" />
              {upcomingEvent.location}
            </small>
          </span>
          <HiOutlineChevronRight aria-hidden="true" />
        </button>

        <section className="home-news" aria-labelledby="home-news-title">
          <header>
            <h2 className="home-section-label" id="home-news-title">
              Últimas noticias
            </h2>
            <button type="button" onClick={onOpenLatestNews}>
              Ver todas
              <HiOutlineChevronRight aria-hidden="true" />
            </button>
          </header>

          <button
            className="home-news-preview"
            type="button"
            onClick={onOpenLatestNews}
          >
            <img src={FEATURED_NEWS.imageUrl} alt={FEATURED_NEWS.imageAlt} />
            <span>
              <strong>{FEATURED_NEWS.title}</strong>
              <small>{FEATURED_NEWS.summary}</small>
              <time dateTime="2026-07-06">
                {FEATURED_NEWS.publishedAt} · {FEATURED_NEWS.source}
              </time>
            </span>
            <HiOutlineChevronRight aria-hidden="true" />
          </button>
        </section>

        {!identity.isAuthenticated && (
          <section className="home-membership-cta" aria-label="Hazte socio">
            <div>
              <h2>¿Aún no eres socio?</h2>
              <p>Únete a la Peña Oasis</p>
            </div>
            <button type="button" onClick={() => onNavigate("membership")}>
              <HiOutlineUserPlus aria-hidden="true" />
              <span>Hazte socio</span>
              <HiOutlineArrowRight aria-hidden="true" />
            </button>
          </section>
        )}
      </div>
    </section>
  );
}
