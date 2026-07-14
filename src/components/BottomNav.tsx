import {
  HiOutlineCalendarDays,
  HiOutlineHome,
  HiOutlineShoppingBag,
  HiOutlineUserCircle,
  HiOutlineUserPlus,
} from "react-icons/hi2";
import type { TabId } from "../types";

type BottomNavProps = {
  activeTab: TabId;
  isAuthenticated: boolean;
  onChange: (tab: TabId) => void;
};

export function BottomNav({
  activeTab,
  isAuthenticated,
  onChange,
}: BottomNavProps) {
  const navItems = [
    { id: "home", label: "Inicio", Icon: HiOutlineHome },
    {
      id: "membership",
      label: isAuthenticated ? "Área personal" : "Hazte socio",
      Icon: isAuthenticated ? HiOutlineUserCircle : HiOutlineUserPlus,
    },
    { id: "events", label: "Eventos", Icon: HiOutlineCalendarDays },
    { id: "shop", label: "Tienda", Icon: HiOutlineShoppingBag },
  ] as const;

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {navItems.map(({ id, label, Icon }) => (
        <button
          className="nav-button"
          data-active={activeTab === id}
          key={id}
          type="button"
          aria-current={activeTab === id ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          <Icon aria-hidden="true" className="nav-icon" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
