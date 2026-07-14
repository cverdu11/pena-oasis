import type { ReactNode } from "react";

type AppHeaderProps = {
  actions?: ReactNode;
  avatarLabel?: string;
  eyebrow: string;
  initials: string;
  isAvatarMenuOpen?: boolean;
  onAvatarClick?: () => void;
  position?: "inline" | "fixed";
  tone?: "default" | "inverse";
  title: string;
};

export function AppHeader({
  actions,
  avatarLabel = "Abrir menú de cuenta",
  eyebrow,
  initials,
  isAvatarMenuOpen = false,
  onAvatarClick,
  position = "inline",
  tone = "default",
  title,
}: AppHeaderProps) {
  return (
    <header
      className={`app-header app-header--${position}`}
      data-has-actions={Boolean(actions)}
      data-tone={tone}
    >
      {onAvatarClick ? (
        <button
          className="app-header-avatar"
          type="button"
          aria-controls="account-menu"
          aria-expanded={isAvatarMenuOpen}
          aria-haspopup="dialog"
          aria-label={avatarLabel}
          data-menu-active={isAvatarMenuOpen}
          onClick={onAvatarClick}
        >
          {initials}
        </button>
      ) : (
        <span className="app-header-avatar" aria-hidden="true">
          {initials}
        </span>
      )}
      <div className="app-header-copy">
        <p className="app-header-eyebrow">{eyebrow}</p>
        <h1 className="app-header-title">{title}</h1>
      </div>
      {actions}
    </header>
  );
}
