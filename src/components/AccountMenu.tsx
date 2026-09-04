import { useEffect, useRef } from "react";
import {
  FiKey,
  FiPackage,
  FiLogIn,
  FiLogOut,
  FiUserPlus,
  FiX,
} from "react-icons/fi";

export type AccountMenuAction =
  | "signin"
  | "signup"
  | "change-password"
  | "stock-admin"
  | "signout";

type AccountMenuProps = {
  isAuthenticated: boolean;
  isStockAdmin: boolean;
  onAction: (action: AccountMenuAction) => void;
  onClose: () => void;
};

export function AccountMenu({
  isAuthenticated,
  isStockAdmin,
  onAction,
  onClose,
}: AccountMenuProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    firstActionRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement =
        focusableElements[focusableElements.length - 1];

      if (!firstFocusableElement || !lastFocusableElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstFocusableElement) {
        event.preventDefault();
        lastFocusableElement.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === lastFocusableElement
      ) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement?.focus();
    };
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
        ref={dialogRef}
        className="account-menu-popover"
        id="account-menu"
        role="dialog"
        aria-modal="true"
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
                onClick={() => onAction("change-password")}
              >
                <FiKey aria-hidden="true" />
                <span>Cambiar contraseña</span>
              </button>
              {isStockAdmin && (
                <button type="button" onClick={() => onAction("stock-admin")}>
                  <FiPackage aria-hidden="true" />
                  <span>Gestión de stock</span>
                </button>
              )}
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
