# Peña Oasis

Web app móvil-first para la Peña Oasis. Ahora incluye dos pestañas:

- `Inicio`: pantalla visual "En construcción" con la imagen facilitada.
- `Área Personal`: login/registro interactivo preparado para Supabase Auth.

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

5. En `Authentication > Providers`, activa solo `Email` para mantener el acceso por correo y contraseña.
6. Reinicia `npm.cmd run dev`.

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
