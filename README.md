# 🍽️ Underhuset Reservations App

App de reservas completa para Restaurant Underhuset.

- **Web pública:** `tudominio.com/` → flujo de reserva para clientes (máx. 4 personas)
- **Backoffice:** `tudominio.com/admin-underhuset` → panel de administración

---

## 🚀 Puesta en marcha paso a paso

### 1. Crear base de datos en Supabase (gratis)

1. Ve a **https://supabase.com** → crea una cuenta → nuevo proyecto
2. Nombre del proyecto: `underhuset-reservations`
3. Guarda la contraseña de la base de datos
4. Ve a **SQL Editor** → **New Query** → pega el contenido de `supabase/schema.sql` → Run

### 2. Obtener las credenciales de Supabase

Ve a **Settings → API** y copia:
- `Project URL` → es tu `VITE_SUPABASE_URL`
- `anon public` key → es tu `VITE_SUPABASE_ANON_KEY`

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env y pega tus credenciales de Supabase
```

### 4. Instalar y probar localmente

```bash
npm install
npm run dev
# Abre http://localhost:5173
# Admin: http://localhost:5173/admin-underhuset
```

### 5. Deploy en Vercel (gratis)

1. Sube el proyecto a GitHub (nuevo repositorio privado)
2. Ve a **https://vercel.com** → Import Project → selecciona el repo
3. En **Environment Variables** añade:
   - `VITE_SUPABASE_URL` = tu URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = tu anon key
4. Deploy → en 2 minutos tienes la URL pública

### 6. Dominio personalizado (opcional)

En Vercel → Settings → Domains → añade `reservas.underhusetlofoten.com`
En tu proveedor de dominio (donde compraste underhusetlofoten.com), añade un registro CNAME:
```
reservas → cname.vercel-dns.com
```

### 7. Integrar en WordPress

Opción A — Botón que abre nueva pestaña:
```html
<a href="https://reservas.underhusetlofoten.com" target="_blank" class="tu-clase-boton">
  Reservar mesa
</a>
```

Opción B — iFrame embebido en una página:
```html
<iframe
  src="https://reservas.underhusetlofoten.com"
  width="100%"
  height="750"
  frameborder="0"
  style="border-radius: 16px;">
</iframe>
```

---

## 📧 Emails automáticos (configuración futura)

Los emails se configuran desde el panel admin → Configuración.
Para activarlos en producción necesitas:

1. Crear cuenta en **https://resend.com** (gratis hasta 3.000 emails/mes)
2. Obtener API key
3. Crear Supabase Edge Function (siguiente fase del desarrollo)

---

## 🔐 Acceso al backoffice

URL secreta: `/admin-underhuset`

Para cambiar la URL secreta, edita `src/brand.js` → línea `ADMIN_SECRET`.

---

## 📁 Estructura del proyecto

```
underhuset-app/
├── src/
│   ├── App.jsx              # Routing
│   ├── brand.js             # Colores, constantes, URL admin
│   ├── lib/supabase.js      # Todas las queries a la base de datos
│   └── pages/
│       ├── BookingPage.jsx  # Flujo público de reservas
│       └── AdminPage.jsx    # Panel de administración
├── supabase/
│   └── schema.sql           # Ejecutar en Supabase SQL Editor
├── .env.example             # Variables de entorno
└── package.json
```
# rebuild
