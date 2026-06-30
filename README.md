# Sueños y Letras 📚

App móvil (React Native + Expo) de alfabetización infantil basada en módulos de emociones.
Construida con **Expo SDK 56**, **Expo Router** (navegación por archivos), **react-native-svg** y **expo-linear-gradient**.

## Cómo levantar el proyecto

```bash
npm install        # solo la primera vez
npm start          # arranca el servidor de desarrollo (Metro)
```

Luego:

- **En tu teléfono (lo más fácil):** instala la app **Expo Go** (Android/iOS) y escanea el código QR que aparece en la terminal. Tu teléfono y la PC deben estar en la misma red Wi-Fi.
- **Emulador Android:** presiona `a` en la terminal (requiere Android Studio configurado).
- **Web (vista rápida):** presiona `w`.

## Demos en Render (sin backend)

El repo incluye un **blueprint** [`render.yaml`](./render.yaml) que publica **dos
demos estáticas** en [Render](https://render.com), ambas contra el cliente **mock
en memoria** (no requieren backend ni variables de entorno):

| Sitio | Origen | Qué es |
|-------|--------|--------|
| `explorarte-web` | `/web` (Vite + React) | Demo **web de escritorio** (sidebar, multi-columna) |
| `explorarte-mobile` | raíz (Expo web export) | Demo **mobile** (vista de móvil en el navegador) |

**Publicar:** en Render → **New → Blueprint** → conecta este repositorio. Render
detecta `render.yaml` y crea ambos sitios automáticamente. Cada push a la rama
re-despliega; los Pull Requests generan previews.

> Login demo: cualquier contraseña sirve. Usa `admin@explorarte.org` (admin),
> `maria@ejemplo.com` (docente aprobada) o `ana@ejemplo.com` (docente pendiente).

## Estructura

```
src/
  app/                    # Rutas (Expo Router)
    _layout.tsx           # Stack raíz
    index.tsx             # Home  (/)
    login.tsx             # /login
    register.tsx          # /register
    forgot-password.tsx   # /forgot-password
    modules.tsx           # /modules
    module/[id].tsx       # /module/felicidad, /module/enojo, ...
    foro.tsx              # /foro  (acepta ?module=felicidad)
    calendar.tsx          # /calendar
    profile.tsx           # /profile
    faq.tsx               # /faq
  components/             # Logo, GradientHeader, BottomNav, Icon (SVG), UI
  constants/theme.ts      # Paleta y datos de los módulos
assets/logo.jpg           # Logo de la app
design-reference/         # Mockups originales (.dc.html) — solo referencia
```

## Navegación

El flujo arranca en **Home** (`/`). Desde el perfil puedes "Cerrar sesión" para ir a **Login**,
y desde Login/Registro se vuelve a Home. Las barras inferiores y botones replican el mapa de
navegación de los diseños originales.

## Notas

- La pantalla de Perfil usa `expo-image-picker` para cambiar la foto (funciona en Expo Go).
- El Calendario usa el **date/time picker nativo** (`@react-native-community/datetimepicker`)
  para elegir fecha y hora de los eventos.
- La pestaña **Video** de cada módulo reproduce el video demo (`assets/video/demo.mp4`)
  con `expo-video` y controles nativos.
- Los íconos están reimplementados como SVG en `src/components/icon.tsx`.
