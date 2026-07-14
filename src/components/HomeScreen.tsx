import {
  HiOutlineArrowRight,
  HiOutlineCalendarDays,
  HiOutlineIdentification,
  HiOutlineShoppingBag,
} from "react-icons/hi2";
import type { MemberIdentity } from "../hooks/useMemberIdentity";
import type { TabId } from "../types";
import { AppHeader } from "./AppHeader";

type HomeScreenProps = {
  identity: MemberIdentity;
  isAccountMenuOpen: boolean;
  onAvatarClick: () => void;
  onNavigate: (tab: TabId) => void;
};

export function HomeScreen({
  identity,
  isAccountMenuOpen,
  onAvatarClick,
  onNavigate,
}: HomeScreenProps) {
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

        <div className="home-welcome">
          <p>Tu casa malaguista</p>
          <h2>Bienvenido a la Peña Malaguista Oasis</h2>
          <span>
            Participa en nuestras previas y viajes, lleva tu carné siempre
            contigo y vive la Peña desde el móvil.
          </span>
        </div>

        <div className="home-feature-list" aria-label="Servicios de la Peña">
          <button type="button" onClick={() => onNavigate("events")}>
            <span className="home-feature-icon">
              <HiOutlineCalendarDays aria-hidden="true" />
            </span>
            <span>
              <strong>Previas y viajes</strong>
              <small>Confirma tu asistencia a los próximos encuentros.</small>
            </span>
            <HiOutlineArrowRight aria-hidden="true" />
          </button>

          <button type="button" onClick={() => onNavigate("membership")}>
            <span className="home-feature-icon">
              <HiOutlineIdentification aria-hidden="true" />
            </span>
            <span>
              <strong>Carné de peñista</strong>
              <small>Consulta tus datos y tu identificación digital.</small>
            </span>
            <HiOutlineArrowRight aria-hidden="true" />
          </button>

          <button type="button" onClick={() => onNavigate("shop")}>
            <span className="home-feature-icon">
              <HiOutlineShoppingBag aria-hidden="true" />
            </span>
            <span>
              <strong>Tienda Oasis</strong>
              <small>Camisetas y bufandas para socios y aficionados.</small>
            </span>
            <HiOutlineArrowRight aria-hidden="true" />
          </button>
        </div>

        <button
          className="home-primary-action"
          type="button"
          onClick={() => onNavigate("membership")}
        >
          <span>
            {identity.isAuthenticated ? "Ir a mi área personal" : "Hazte socio"}
          </span>
          <HiOutlineArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
