import type { ReactNode } from "react";

type AppHeaderProps = {
  actions?: ReactNode;
  eyebrow: string;
  initials: string;
  position?: "inline" | "fixed";
  title: string;
};

export function AppHeader({
  actions,
  eyebrow,
  initials,
  position = "inline",
  title,
}: AppHeaderProps) {
  return (
    <header
      className={`app-header app-header--${position}`}
      data-has-actions={Boolean(actions)}
    >
      <span className="app-header-avatar" aria-hidden="true">
        {initials}
      </span>
      <div className="app-header-copy">
        <p className="app-header-eyebrow">{eyebrow}</p>
        <h1 className="app-header-title">{title}</h1>
      </div>
      {actions}
    </header>
  );
}
