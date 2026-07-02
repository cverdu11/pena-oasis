# Peña Oasis

Web app móvil-first para la Peña Oasis. Ahora incluye dos pestañas:

- `Inicio`: pantalla visual "En construcción" con la imagen facilitada.
- `Área Personal`: login/registro por email con Supabase Auth y formulario privado de datos del peñista.

## Desarrollo local

```bash
npm.cmd install
npm.cmd run dev
```

Abre la URL local que muestre Webpack, normalmente `http://127.0.0.1:5173/`.

## Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard/projects).
2. En `Project Settings > API`, copia `Project URL` y `anon public key`.
3. Crea `.env.local` a partir de `.env.example`:

```bash
copy .env.example .env.local
```

4. Rellena:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

Antes de compartir la app con usuarios reales, configura un SMTP propio en `Authentication > Email > SMTP Settings` con un proveedor como Resend, SendGrid, Postmark, Brevo o AWS SES. El proveedor de email incluido en Supabase es solo para pruebas y puede bloquear el registro con `email rate limit exceeded` cuando entran varias altas seguidas. Después revisa `Authentication > Rate Limits` para ajustar el límite de emails si hace falta.

5. En `Authentication > Providers`, activa solo `Email` para mantener el acceso por correo y contraseña.
6. En `Authentication > URL Configuration`, mantén permitido `https://pena-oasis.vercel.app/**`. El email de confirmación vuelve a `https://pena-oasis.vercel.app/?confirmed=1&email=...` para abrir directamente `Área Personal` con el correo pre-rellenado.
7. Ejecuta en `SQL Editor` la migración:

```text
supabase/migrations/20260701_profiles_member_fields.sql
```

Esta migración añade `first_name`, `last_name`, `dni`, `member_number`, `privacy_accepted_at`, `privacy_notice_version`, `terms_accepted_at`, `terms_version` y los campos del acuerdo firmado a `public.profiles`.

8. Para activar la subida del acuerdo firmado a Google Drive sin Google Cloud Billing, crea un Web App de Google Apps Script con el contenido de:

```text
scripts/google-apps-script/drive-uploader.gs
```

Configura estas Script properties en Apps Script:

```text
DRIVE_FOLDER_ID=ID_DE_LA_CARPETA_DE_DRIVE
UPLOAD_SECRET=clave-larga-inventada
```

9. Despliega o actualiza la Edge Function de Supabase con el contenido de:

```text
supabase/functions/upload-data-agreement/index.ts
```

Si la creaste desde el dashboard con el nombre `swift-worker`, la app ya llama a ese slug por defecto. Si usas otro nombre, define `VITE_DATA_AGREEMENT_FUNCTION_NAME`.

10. Configura estos secretos en Supabase Edge Functions:

```text
GOOGLE_APPS_SCRIPT_URL=URL_DEL_WEB_APP_DE_APPS_SCRIPT
GOOGLE_APPS_SCRIPT_SECRET=la_misma_clave_que_UPLOAD_SECRET
```

La app genera el PDF firmado en el navegador y llama a la Edge Function usando la sesión del socio. El archivo se guarda con el formato `NOMBRE_APELLIDO_Acuerdo de comunicación de datos personales.pdf`.

11. Reinicia `npm.cmd run dev`.

## Protección de Datos

El registro incluye una primera capa básica de privacidad y una casilla obligatoria no premarcada para privacidad y condiciones. Antes de usarlo en producción, revisa el texto legal con la persona o asesoría responsable de la Peña Oasis: debe identificar responsable, finalidad, base jurídica, conservación, destinatarios y derechos.

## GitHub

La CLI `gh` no está instalada en esta máquina, así que el camino más directo es:

1. Crea un repo vacío en GitHub, por ejemplo `pena-oasis`.
2. Copia la URL HTTPS o SSH del repo.
3. Desde esta carpeta:

```bash
git branch -M main
git remote add origin URL_DEL_REPO
git push -u origin main
```

## Vercel

El wrapper local de Vercel está bloqueado por política de empresa en esta máquina. Usa el dashboard:

1. Ve a [Vercel New Project](https://vercel.com/new).
2. Importa el repo de GitHub.
3. Framework preset: `Other` o deja que Vercel use el build de `package.json`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Añade las mismas variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `Settings > Environment Variables`.
7. Deploy.

## Scripts

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd run preview
```
