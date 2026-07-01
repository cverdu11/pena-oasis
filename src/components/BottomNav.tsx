import { HiOutlineHome, HiOutlineUser } from "react-icons/hi2";
import type { TabId } from "../types";

type BottomNavProps = {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
};

const navItems = [
  { id: "home", label: "Inicio", Icon: HiOutlineHome },
  { id: "personal", label: "Área Personal", Icon: HiOutlineUser },
] as const;

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
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
      <span className="nav-divider" aria-hidden="true" />
    </nav>
  );
}
