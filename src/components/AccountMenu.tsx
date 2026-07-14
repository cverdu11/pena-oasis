import { useEffect, useRef } from "react";
import {
  FiEdit3,
  FiKey,
  FiLogIn,
  FiLogOut,
  FiUserPlus,
  FiX,
} from "react-icons/fi";

export type AccountMenuAction =
  | "signin"
  | "signup"
  | "edit-profile"
  | "change-password"
  | "signout";

type AccountMenuProps = {
  isAuthenticated: boolean;
  onAction: (action: AccountMenuAction) => void;
  onClose: () => void;
};

export function AccountMenu({
  isAuthenticated,
  onAction,
  onClose,
}: AccountMenuProps) {
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstActionRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="account-menu-layer">
      <button
        className="account-menu-backdrop"
        type="button"
        aria-label="Cerrar menú de cuenta"
        onClick={onClose}
      />
      <section
        className="account-menu-popover"
        id="account-menu"
        role="dialog"
        aria-label={isAuthenticated ? "Área personal" : "Acceso de socios"}
      >
        <header className="account-menu-header">
          <div>
            <span>Cuenta</span>
            <strong>
              {isAuthenticated ? "Área personal" : "Acceso de socios"}
            </strong>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose}>
            <FiX aria-hidden="true" />
          </button>
        </header>

        <div className="account-menu-actions">
          {isAuthenticated ? (
            <>
              <button
                ref={firstActionRef}
                type="button"
                onClick={() => onAction("edit-profile")}
              >
                <FiEdit3 aria-hidden="true" />
                <span>Editar datos personales</span>
              </button>
              <button
                type="button"
                onClick={() => onAction("change-password")}
              >
                <FiKey aria-hidden="true" />
                <span>Cambiar contraseña</span>
              </button>
              <button
                className="account-menu-signout"
                type="button"
                onClick={() => onAction("signout")}
              >
                <FiLogOut aria-hidden="true" />
                <span>Cerrar sesión</span>
              </button>
            </>
          ) : (
            <>
              <button
                ref={firstActionRef}
                type="button"
                onClick={() => onAction("signin")}
              >
                <FiLogIn aria-hidden="true" />
                <span>Iniciar sesión</span>
              </button>
              <button type="button" onClick={() => onAction("signup")}>
                <FiUserPlus aria-hidden="true" />
                <span>Crear cuenta</span>
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
