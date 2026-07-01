import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiTool,
  FiUser,
} from "react-icons/fi";
import personalBackground from "../../public/images/area-personal-header.png";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

type AuthMode = "signin" | "signup";
type Profile = {
  email: string | null;
  full_name: string | null;
};

function getFirstName(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0];
}

function getFallbackName(user: User | null) {
  if (!user) {
    return "socio";
  }

  return (
    getFirstName(
    user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0],
    ) ?? "socio"
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const submitLabel = mode === "signin" ? "Iniciar sesión" : "Crear cuenta";
  const welcomeName = getFirstName(profile?.full_name) ?? getFallbackName(user);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    async function loadSession() {
      const client = await getSupabaseClient();

      if (!client) {
        if (isMounted) {
          setIsSessionLoading(false);
        }
        return;
      }

      const { data } = await client.auth.getSession();

      if (isMounted) {
        setUser(data.session?.user ?? null);
        setIsSessionLoading(false);
      }

      const subscription = client.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setMessage("");
      });

      unsubscribe = () => subscription.data.subscription.unsubscribe();
    }

    loadSession();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!user) {
        setProfile(null);
        return;
      }

      const client = await getSupabaseClient();

      if (!client) {
        return;
      }

      const { data } = await client
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .maybeSingle<Profile>();

      if (isMounted) {
        setProfile(data ?? null);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

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

  async function handleSignOut() {
    const client = await getSupabaseClient();
    await client?.auth.signOut();
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

      <div className="auth-sheet" data-view={user ? "private" : "auth"}>
        {isSessionLoading && (
          <div className="personal-loading" role="status">
            Cargando área personal...
          </div>
        )}

        {!isSessionLoading && user && (
          <div className="member-panel">
            <p className="member-kicker">Área Personal</p>
            <h1>Bienvenido {welcomeName}</h1>
            <div className="construction-panel">
              <FiTool aria-hidden="true" />
              <h2>Estamos en construcción</h2>
              <p>
                Estamos preparando tu espacio privado de la Peña Oasis. Muy
                pronto tendrás aquí tus datos y novedades.
              </p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={handleSignOut}
            >
              Cerrar sesión
            </button>
          </div>
        )}

        {!isSessionLoading && !user && (
          <>
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
                      showPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
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

              <button
                className="primary-button"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? "Conectando..." : submitLabel}
              </button>

              {message && (
                <p className="auth-message" role="status">
                  {message}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </section>
  );
}
