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
import { PRIVACY_ROUTE_HASH } from "../constants";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

type AuthMode = "signin" | "signup";
type Profile = {
  email: string | null;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  dni?: string | null;
  member_number?: string | null;
  privacy_accepted_at?: string | null;
  terms_accepted_at?: string | null;
};
type MemberForm = {
  firstName: string;
  lastName: string;
  dni: string;
  memberNumber: string;
};

function getFirstName(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0];
}

function splitFullName(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
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

function buildMemberForm(profile: Profile | null, user: User | null): MemberForm {
  const metadataName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0];
  const splitName = splitFullName(profile?.full_name ?? metadataName);

  return {
    firstName: profile?.first_name ?? splitName.firstName,
    lastName: profile?.last_name ?? splitName.lastName,
    dni: profile?.dni ?? "",
    memberNumber: profile?.member_number ?? "",
  };
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isProfileSchemaReady, setIsProfileSchemaReady] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberForm, setMemberForm] = useState<MemberForm>({
    firstName: "",
    lastName: "",
    dni: "",
    memberNumber: "",
  });
  const [profileMessage, setProfileMessage] = useState("");

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
        setMemberForm(buildMemberForm(null, null));
        setProfileMessage("");
        setIsProfileSchemaReady(true);
        return;
      }

      const client = await getSupabaseClient();

      if (!client) {
        return;
      }

      setIsProfileLoading(true);
      setProfileMessage("");

      const extendedProfile = await client
        .from("profiles")
        .select(
          "email, full_name, first_name, last_name, dni, member_number, privacy_accepted_at, terms_accepted_at",
        )
        .eq("id", user.id)
        .maybeSingle<Profile>();

      let profileData = extendedProfile.data ?? null;
      let schemaReady = !extendedProfile.error;

      if (extendedProfile.error) {
        const basicProfile = await client
          .from("profiles")
          .select("email, full_name")
          .eq("id", user.id)
          .maybeSingle<Profile>();

        profileData = basicProfile.data ?? null;
        schemaReady = false;
      }

      if (isMounted) {
        setProfile(profileData);
        setMemberForm(buildMemberForm(profileData, user));
        setIsProfileSchemaReady(schemaReady);
        setIsProfileLoading(false);
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

    if (mode === "signup" && !privacyAccepted) {
      setMessage(
        "Debes aceptar la información de protección de datos y condiciones.",
      );
      return;
    }

    const client = await getSupabaseClient();

    if (!isSupabaseConfigured || !client) {
      setMessage("Conecta Supabase para activar el acceso real.");
      return;
    }

    setIsLoading(true);
    const acceptedAt = new Date().toISOString();
    const result =
      mode === "signin"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                privacy_accepted_at: acceptedAt,
                privacy_notice_version: "lopd-basic-v1",
                terms_accepted_at: acceptedAt,
                terms_version: "terms-v1",
              },
            },
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

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage("");

    if (!user) {
      return;
    }

    const client = await getSupabaseClient();

    if (!client) {
      setProfileMessage("Conecta Supabase para guardar tus datos.");
      return;
    }

    const firstName = memberForm.firstName.trim();
    const lastName = memberForm.lastName.trim();
    const fullNameForProfile = [firstName, lastName].filter(Boolean).join(" ");

    setIsProfileSaving(true);

    const { data, error } = await client
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? profile?.email ?? null,
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: fullNameForProfile || profile?.full_name || null,
          dni: memberForm.dni.trim() || null,
          member_number: memberForm.memberNumber.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select(
        "email, full_name, first_name, last_name, dni, member_number, privacy_accepted_at, terms_accepted_at",
      )
      .single<Profile>();

    setIsProfileSaving(false);

    if (error) {
      setProfileMessage(
        "No se han podido guardar los datos. Revisa que la tabla profiles tenga los nuevos campos.",
      );
      return;
    }

    setProfile(data);
    setMemberForm(buildMemberForm(data, user));
    setIsProfileSchemaReady(true);
    setProfileMessage("Datos guardados correctamente.");
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
  }

  return (
    <section className="screen personal-screen" aria-label="Área Personal">
      <div className="personal-backdrop" aria-hidden="true" />

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
            {isProfileLoading ? (
              <div className="personal-loading" role="status">
                Cargando datos del peñista...
              </div>
            ) : (
              <>
                <form className="member-form" onSubmit={handleProfileSubmit}>
                  <div className="member-form-grid">
                    <label className="form-field">
                      <span>Nombre</span>
                      <span className="input-shell">
                        <FiUser aria-hidden="true" />
                        <input
                          autoComplete="given-name"
                          value={memberForm.firstName}
                          onChange={(event) =>
                            setMemberForm((current) => ({
                              ...current,
                              firstName: event.target.value,
                            }))
                          }
                          placeholder="Carlos"
                          required
                          type="text"
                        />
                      </span>
                    </label>

                    <label className="form-field">
                      <span>Apellidos</span>
                      <span className="input-shell">
                        <FiUser aria-hidden="true" />
                        <input
                          autoComplete="family-name"
                          value={memberForm.lastName}
                          onChange={(event) =>
                            setMemberForm((current) => ({
                              ...current,
                              lastName: event.target.value,
                            }))
                          }
                          placeholder="Verdú"
                          type="text"
                        />
                      </span>
                    </label>

                    <label className="form-field">
                      <span>DNI</span>
                      <span className="input-shell">
                        <FiUser aria-hidden="true" />
                        <input
                          autoComplete="off"
                          value={memberForm.dni}
                          onChange={(event) =>
                            setMemberForm((current) => ({
                              ...current,
                              dni: event.target.value.toUpperCase(),
                            }))
                          }
                          placeholder="00000000A"
                          inputMode="text"
                          type="text"
                        />
                      </span>
                    </label>

                    <label className="form-field">
                      <span>Nº de socio</span>
                      <span className="input-shell">
                        <FiUser aria-hidden="true" />
                        <input
                          autoComplete="off"
                          value={memberForm.memberNumber}
                          onChange={(event) =>
                            setMemberForm((current) => ({
                              ...current,
                              memberNumber: event.target.value,
                            }))
                          }
                          placeholder="Pendiente"
                          inputMode="numeric"
                          type="text"
                        />
                      </span>
                    </label>
                  </div>

                  {!isProfileSchemaReady && (
                    <p className="privacy-note" role="status">
                      Falta actualizar la tabla de Supabase para guardar DNI y
                      nº de socio.
                    </p>
                  )}

                  <button
                    className="primary-button"
                    disabled={isProfileSaving}
                    type="submit"
                  >
                    {isProfileSaving ? "Guardando..." : "Guardar datos"}
                  </button>

                  {profileMessage && (
                    <p className="auth-message" role="status">
                      {profileMessage}
                    </p>
                  )}
                </form>

                <div className="construction-panel">
                  <FiTool aria-hidden="true" />
                  <h2>Estamos en construcción</h2>
                  <p>
                    Estamos preparando tu espacio privado de la Peña Oasis. Muy
                    pronto tendrás aquí tus datos y novedades.
                  </p>
                </div>
              </>
            )}
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

              {mode === "signup" && (
                <div className="privacy-consent">
                  <input
                    aria-required="true"
                    checked={privacyAccepted}
                    id="privacy-consent"
                    type="checkbox"
                    onChange={(event) =>
                      setPrivacyAccepted(event.target.checked)
                    }
                  />
                  <label htmlFor="privacy-consent">
                    He leído y acepto las{" "}
                    <a
                      href={PRIVACY_ROUTE_HASH}
                    >
                      condiciones
                    </a>{" "}
                    y la información básica de{" "}
                    <a href={PRIVACY_ROUTE_HASH}>
                      protección de datos
                    </a>
                    . Responsable: Peña Oasis. Finalidad: gestionar mi alta, la
                    condición de peñista y las comunicaciones internas. Podré
                    ejercer mis derechos a través del correo de contacto de la
                    Peña.
                  </label>
                </div>
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
