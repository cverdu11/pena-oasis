import { FormEvent, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { FiEye, FiEyeOff, FiLock, FiMail, FiUser } from "react-icons/fi";
import personalBackground from "../../public/images/area-personal-header.png";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

type AuthMode = "signin" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const submitLabel = mode === "signin" ? "Iniciar sesión" : "Crear cuenta";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const client = await getSupabaseClient();

    if (!isSupabaseConfigured || !client) {
      setMessage("Conecta Supabase para activar el acceso real.");
      return;
    }

    setIsLoading(true);
    const result =
      mode === "signin"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          });

    setIsLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage(
      mode === "signin"
        ? "Sesión iniciada correctamente."
        : "Cuenta creada. Revisa tu correo si Supabase pide confirmación.",
    );
  }

  async function handleGoogleOAuth() {
    setMessage("");

    const client = await getSupabaseClient();

    if (!isSupabaseConfigured || !client) {
      setMessage("Conecta Supabase para activar el acceso real.");
      return;
    }

    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/#area-personal` },
    });

    if (error) {
      setMessage(error.message);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
  }

  return (
    <section className="screen personal-screen" aria-label="Área Personal">
      <div
        className="personal-backdrop"
        style={{ backgroundImage: `url(${personalBackground})` }}
        aria-hidden="true"
      />

      <div className="auth-sheet">
        <div className="auth-tabs" role="tablist" aria-label="Acceso">
          <button
            className="auth-tab"
            data-active={mode === "signin"}
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            onClick={() => switchMode("signin")}
          >
            Iniciar sesión
          </button>
          <button
            className="auth-tab"
            data-active={mode === "signup"}
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => switchMode("signup")}
          >
            Registrarse
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="form-field">
              <span>Nombre</span>
              <span className="input-shell">
                <FiUser aria-hidden="true" />
                <input
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Tu nombre"
                  required
                  type="text"
                />
              </span>
            </label>
          )}

          <label className="form-field">
              <span>Correo electrónico</span>
            <span className="input-shell">
              <FiMail aria-hidden="true" />
              <input
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                required
                type="email"
              />
            </span>
          </label>

          <label className="form-field">
            <span>Contraseña</span>
            <span className="input-shell">
              <FiLock aria-hidden="true" />
              <input
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
                required
                minLength={6}
                type={showPassword ? "text" : "password"}
              />
              <button
                className="icon-button"
                type="button"
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <FiEye /> : <FiEyeOff />}
              </button>
            </span>
          </label>

          {mode === "signin" && (
            <button className="forgot-button" type="button">
              ¿Olvidaste tu contraseña?
            </button>
          )}

          <button className="primary-button" disabled={isLoading} type="submit">
            {isLoading ? "Conectando..." : submitLabel}
          </button>

          {message && (
            <p className="auth-message" role="status">
              {message}
            </p>
          )}
        </form>

        <div className="oauth-divider" aria-hidden="true">
          <span />
          <p>o continúa con</p>
          <span />
        </div>

        <div className="oauth-actions" aria-label="Acceso social">
          <button
            className="oauth-button"
            type="button"
            onClick={handleGoogleOAuth}
          >
            <FcGoogle aria-hidden="true" />
            <span>Continuar con Google</span>
          </button>
        </div>
      </div>
    </section>
  );
}
