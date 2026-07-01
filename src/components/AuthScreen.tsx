import { FormEvent, useEffect, useState } from "react";
import type { AuthError, User } from "@supabase/supabase-js";
import {
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiTool,
  FiUser,
} from "react-icons/fi";
import {
  PERSONAL_ROUTE_HASH,
  PRIVACY_ROUTE_HASH,
  SIGNUP_ROUTE_HASH,
} from "../constants";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import type { DataAgreementMember } from "../lib/dataAgreementPdf";
import { DataAgreementCard } from "./DataAgreementCard";

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
  data_agreement_signed_at?: string | null;
  data_agreement_file_name?: string | null;
  data_agreement_drive_file_id?: string | null;
  data_agreement_drive_url?: string | null;
  data_agreement_status?: string | null;
};
type MemberForm = {
  firstName: string;
  lastName: string;
  dni: string;
  memberNumber: string;
};
type AgreementStoredRecord = {
  signedAt: string;
  fileName: string;
  driveFileId: string;
  driveUrl: string | null;
  member: DataAgreementMember;
};

const EXTENDED_PROFILE_SELECT =
  "email, full_name, first_name, last_name, dni, member_number, privacy_accepted_at, terms_accepted_at, data_agreement_signed_at, data_agreement_file_name, data_agreement_drive_file_id, data_agreement_drive_url, data_agreement_status";
const BASIC_PROFILE_SELECT = "email, full_name";
const EMAIL_RATE_LIMIT_MESSAGE =
  "Ahora mismo no podemos enviar más correos automáticos. Inténtalo de nuevo en unos minutos.";

type AuthAction = AuthMode | "password-reset" | "password-update";

function getFriendlyAuthErrorMessage(error: AuthError, action: AuthAction) {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message.toLowerCase();
  const isEmailRateLimit =
    code === "over_email_send_rate_limit" ||
    message.includes("email rate limit");
  const isGenericRateLimit =
    error.status === 429 ||
    code === "over_request_rate_limit" ||
    message.includes("rate limit") ||
    message.includes("too many");

  if (isEmailRateLimit) {
    return action === "signup"
      ? "Estamos recibiendo muchas altas a la vez. Inténtalo de nuevo en unos minutos."
      : EMAIL_RATE_LIMIT_MESSAGE;
  }

  if (isGenericRateLimit) {
    return action === "signup"
      ? "Estamos recibiendo muchas altas a la vez. Inténtalo de nuevo en unos minutos."
      : "Demasiados intentos seguidos. Inténtalo de nuevo en unos minutos.";
  }

  if (code === "invalid_credentials" || message.includes("invalid login")) {
    return "Correo o contraseña incorrectos.";
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Revisa tu correo y confirma la cuenta antes de iniciar sesión.";
  }

  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("already exists")
  ) {
    return "Este correo ya está registrado. Prueba a iniciar sesión o recupera la contraseña.";
  }

  if (code === "weak_password" || message.includes("password should")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  if (code === "signup_disabled") {
    return "El registro está cerrado temporalmente.";
  }

  if (code === "email_provider_disabled") {
    return "El envío de correos no está activo en Supabase. Revisa la configuración de Auth.";
  }

  return error.message || "No hemos podido completar la operación. Inténtalo de nuevo.";
}

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

function readInitialAuthMode(): AuthMode {
  return window.location.hash === SIGNUP_ROUTE_HASH ? "signup" : "signin";
}

function isPasswordRecoveryRoute() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    searchParams.get("recovery") === "1" ||
    hashParams.get("type") === "recovery"
  );
}

function getPasswordRecoveryRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}?recovery=1`;
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>(readInitialAuthMode);
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    isPasswordRecoveryRoute,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
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

      const subscription = client.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null);

        if (event === "PASSWORD_RECOVERY") {
          setMode("signin");
          setIsPasswordRecovery(true);
          setMessage("Introduce una nueva contraseña para terminar.");
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${PERSONAL_ROUTE_HASH}`,
          );
          return;
        }

        if (event === "SIGNED_OUT") {
          setIsPasswordRecovery(false);
          return;
        }

        setMessage("");
      });

      const { data } = await client.auth.getSession();

      if (isMounted) {
        setUser(data.session?.user ?? null);
        if (data.session?.user && isPasswordRecoveryRoute()) {
          setMode("signin");
          setIsPasswordRecovery(true);
          setMessage("Introduce una nueva contraseña para terminar.");
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${PERSONAL_ROUTE_HASH}`,
          );
        }
        setIsSessionLoading(false);
      }

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
        .select(EXTENDED_PROFILE_SELECT)
        .eq("id", user.id)
        .maybeSingle<Profile>();

      let profileData = extendedProfile.data ?? null;
      let schemaReady = !extendedProfile.error;

      if (extendedProfile.error) {
        const basicProfile = await client
          .from("profiles")
          .select(BASIC_PROFILE_SELECT)
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
      setMessage(getFriendlyAuthErrorMessage(result.error, mode));
      return;
    }

    setMessage(
      mode === "signin"
        ? "Sesión iniciada correctamente."
        : "Cuenta creada. Revisa tu correo si Supabase pide confirmación.",
    );
  }

  async function handleForgotPassword() {
    setMessage("");
    const emailAddress = email.trim();

    if (!emailAddress) {
      setMessage("Introduce tu correo electrónico para enviarte el enlace.");
      return;
    }

    const client = await getSupabaseClient();

    if (!isSupabaseConfigured || !client) {
      setMessage("Conecta Supabase para activar la recuperación.");
      return;
    }

    setIsResetLoading(true);
    const { error } = await client.auth.resetPasswordForEmail(emailAddress, {
      redirectTo: getPasswordRecoveryRedirectUrl(),
    });
    setIsResetLoading(false);

    if (error) {
      setMessage(getFriendlyAuthErrorMessage(error, "password-reset"));
      return;
    }

    setMessage(
      "Te hemos enviado un correo para crear una nueva contraseña. Revisa tu bandeja de entrada.",
    );
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (newPassword.length < 6) {
      setMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    const client = await getSupabaseClient();

    if (!client) {
      setMessage("Conecta Supabase para guardar la nueva contraseña.");
      return;
    }

    setIsResetLoading(true);
    const { error } = await client.auth.updateUser({ password: newPassword });

    if (error) {
      setIsResetLoading(false);
      setMessage(getFriendlyAuthErrorMessage(error, "password-update"));
      return;
    }

    await client.auth.signOut();
    setIsResetLoading(false);
    setIsPasswordRecovery(false);
    setUser(null);
    setNewPassword("");
    setConfirmPassword("");
    setPassword("");
    setMessage("Contraseña actualizada. Ya puedes iniciar sesión.");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${PERSONAL_ROUTE_HASH}`,
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
        EXTENDED_PROFILE_SELECT,
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

  async function handleAgreementStored(record: AgreementStoredRecord) {
    if (!user) {
      return;
    }

    const client = await getSupabaseClient();

    if (!client) {
      throw new Error("Conecta Supabase para guardar el estado del acuerdo.");
    }

    const firstName = record.member.firstName.trim();
    const lastName = record.member.lastName.trim();
    const fullNameForProfile = [firstName, lastName].filter(Boolean).join(" ");
    const { data, error } = await client
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? profile?.email ?? null,
          first_name: firstName || profile?.first_name || null,
          last_name: lastName || profile?.last_name || null,
          full_name: fullNameForProfile || profile?.full_name || null,
          dni: record.member.dni.trim() || profile?.dni || null,
          member_number:
            record.member.memberNumber.trim() || profile?.member_number || null,
          data_agreement_signed_at: record.signedAt,
          data_agreement_file_name: record.fileName,
          data_agreement_drive_file_id: record.driveFileId,
          data_agreement_drive_url: record.driveUrl,
          data_agreement_status: "stored",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select(EXTENDED_PROFILE_SELECT)
      .single<Profile>();

    if (error) {
      setIsProfileSchemaReady(false);
      throw new Error(
        "El PDF está subido, pero falta ejecutar la migración de Supabase para marcarlo como firmado.",
      );
    }

    setProfile(data);
    setMemberForm(buildMemberForm(data, user));
    setIsProfileSchemaReady(true);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setIsPasswordRecovery(false);
    window.history.replaceState(
      null,
      "",
      nextMode === "signup"
        ? `${window.location.pathname}${SIGNUP_ROUTE_HASH}`
        : `${window.location.pathname}${PERSONAL_ROUTE_HASH}`,
    );
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

        {!isSessionLoading && isPasswordRecovery && (
          <form className="auth-form" onSubmit={handlePasswordUpdate}>
            <div className="recovery-copy">
              <h1>Crea una nueva contraseña</h1>
              <p>
                Escribe una contraseña nueva para recuperar el acceso a tu área
                personal.
              </p>
            </div>

            <label className="form-field">
              <span>Nueva contraseña</span>
              <span className="input-shell">
                <FiLock aria-hidden="true" />
                <input
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Nueva contraseña"
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

            <label className="form-field">
              <span>Repetir contraseña</span>
              <span className="input-shell">
                <FiLock aria-hidden="true" />
                <input
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  minLength={6}
                  type={showPassword ? "text" : "password"}
                />
              </span>
            </label>

            <button
              className="primary-button"
              disabled={isResetLoading}
              type="submit"
            >
              {isResetLoading ? "Guardando..." : "Actualizar contraseña"}
            </button>

            {message && (
              <p className="auth-message" role="status">
                {message}
              </p>
            )}
          </form>
        )}

        {!isSessionLoading && user && !isPasswordRecovery && (
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

                <DataAgreementCard
                  member={{
                    firstName: memberForm.firstName,
                    lastName: memberForm.lastName,
                    dni: memberForm.dni,
                    memberNumber: memberForm.memberNumber,
                    email: user.email ?? profile?.email ?? null,
                  }}
                  storedAgreement={{
                    signedAt: profile?.data_agreement_signed_at,
                    fileName: profile?.data_agreement_file_name,
                    driveUrl: profile?.data_agreement_drive_url,
                  }}
                  onStored={handleAgreementStored}
                />

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

        {!isSessionLoading && !user && !isPasswordRecovery && (
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
                <button
                  className="forgot-button"
                  disabled={isResetLoading}
                  type="button"
                  onClick={handleForgotPassword}
                >
                  {isResetLoading ? "Enviando..." : "¿Olvidaste tu contraseña?"}
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
                    <a href={PRIVACY_ROUTE_HASH}>
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
