# Cómo correr el proyecto en una computadora nueva (desde cero)

Esta guía asume que **nunca has tocado este proyecto** y que estás en una computadora limpia.
Sigue los pasos en orden — no necesitas saber Java ni Docker de antemano.

---

## 0. Qué vas a necesitar instalar

Solo estas tres cosas (todas gratis, para Windows/Mac/Linux):

| Programa | Para qué sirve | Dónde bajarlo |
|---|---|---|
| **Git** | Descargar el código del repositorio | [git-scm.com](https://git-scm.com) |
| **Docker Desktop** | Correr el backend (Java) + la web, sin instalar Java ni Postgres | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Node.js 20** (ver `.nvmrc`) | Correr la PWA y sus tests fuera de Docker | [nodejs.org](https://nodejs.org) |

Instala los tres, reinicia la computadora si el instalador lo pide, y ya puedes seguir.

> Si **solo** vas a trabajar en la web o el backend (no en mobile), puedes saltarte instalar Node —
> Docker se encarga de todo. Node solo es necesario para correr la app mobile con `npm start`.

---

## 1. Descargar el código

Abre una terminal (en Windows: **Git Bash**, que se instaló junto con Git) y corre:

```bash
git clone <URL-del-repositorio>
cd SueñosyLetras
```

(Cambia `<URL-del-repositorio>` por la URL real del repo en GitHub/GitLab que te compartieron.)

---

## 2. Levantar el backend (Java) + la web

Esta es la parte que antes requería instalar Java, Maven y PostgreSQL a mano. Ahora es un
solo paso:

```bash
cp .env.example .env
docker compose up --build
```

- La **primera vez** tarda unos minutos (Docker descarga las imágenes y compila todo). Las
  siguientes veces es mucho más rápido.
- Vas a ver un montón de texto pasando en la terminal — es normal. Espera hasta que se calme
  y deje de aparecer texto nuevo constantemente (eso significa que ya arrancó).
- **Déjalo corriendo** en esa terminal. Abre una terminal nueva para lo que sigue.

### Verifica que funcionó

Abre estas dos direcciones en tu navegador:

- **http://localhost:5173** → debería cargar la app web de Sueños y Letras.
- **http://localhost:8000/swagger-ui.html** → debería cargar la documentación interactiva
  de la API (si esto carga, el backend en Java está funcionando).

Si ambas cargan, ¡ya tienes todo el backend + web corriendo! 🎉

### Cuentas para probar la app

| Correo | Rol |
|---|---|
| `admin@explorarte.org` | administrador |
| `maria@ejemplo.com` | docente |
| `ana@ejemplo.com` | docente |

**La contraseña es la que tú pusiste en `SEED_USER_PASSWORD` dentro de tu `.env`** (mínimo 8
caracteres). No está escrita en este documento a propósito: este repositorio es público, y una
contraseña publicada aquí es una contraseña que sirve en cualquier entorno donde alguien la haya
copiado tal cual.

Si dejas `SEED_USER_PASSWORD` vacía, la API **no crea ninguna cuenta de ejemplo** — es el
comportamiento seguro por defecto (SEC-02), para que ningún entorno desplegado termine con un ADMIN
de contraseña conocida.

### Comandos que vas a usar seguido

```bash
docker compose up --build     # arrancar todo (o npm run dev:stack)
docker compose down           # apagar todo (o npm run dev:stack:down)
docker compose logs -f api    # ver qué está haciendo el backend (o npm run dev:stack:logs)
```

Ver [`api/README.md`](./api/README.md) si quieres más detalle sobre el backend en Java
(cómo se recarga solo al editar código, cómo resetear la base de datos, etc.).

---

## 3. Trabajar en la PWA

Con `docker compose up --build` corriendo ya tienes la PWA en http://localhost:5173, servida por
Vite dentro de Docker y conectada a la API real. Para la mayoría del trabajo eso basta.

Si prefieres correrla fuera de Docker —recarga algo más rápida, y las herramientas de tu editor
funcionando contra `web/`—:

```bash
npm --prefix web run dev      # http://localhost:5173
```

Y para probarla desde tu teléfono, abre esa misma URL cambiando `localhost` por la IP de tu PC en
la Wi-Fi (`ipconfig` en Windows, Preferencias del Sistema → Red en Mac). Las dos máquinas tienen
que estar en la misma red. Si no llega, casi siempre es el firewall de Windows bloqueando el puerto
entrante: doble clic en [`scripts/setup-windows-firewall.cmd`](./scripts/setup-windows-firewall.cmd)
—o `npm run setup:firewall`— lo resuelve, y solo afecta a tu máquina.

### Los tests

```bash
npm --prefix web run test     # vitest
npm --prefix web run e2e      # Playwright, contra el mock determinista
```

### Sobre la carpeta `src/`

Ahí vive la app Expo/React Native original. **Ya no es lo que se publica** — el producto es la PWA.
Sigue en el repositorio y sus tests siguen corriendo en CI, pero si acabas de llegar no necesitas
instalar Expo Go ni Android Studio para trabajar en ExplorArte.

---

## Problemas comunes

**No veo la PWA en http://localhost:5173**
Comprueba que `docker compose up --build` siga corriendo y sin errores en esa terminal. Si el
contenedor `web` arrancó pero la página no carga, mira `npm run dev:stack:logs`.

**"Docker Desktop no abre" / "no reconoce el comando `docker`"**
Abre la aplicación Docker Desktop manualmente y espera a que el ícono de la ballena en la
barra de tareas deje de animarse (significa que ya inició). Luego vuelve a intentar
`docker compose up --build`.

**"Port already in use" / "puerto ya está en uso"**
Algo más en tu computadora está usando el puerto 8000, 5173 o 5432. Cierra ese programa, o
cambia el puerto en tu `.env` (por ejemplo `API_PORT=8001`) y vuelve a correr
`docker compose up --build`.

**Quiero borrar todo y empezar de cero (base de datos limpia)**
```bash
docker compose down -v
docker compose up --build
```
El `-v` borra también los datos guardados, así que la próxima vez que arranque, la API vuelve
a precargar los datos de ejemplo desde cero.

---

## Resumen ultra-corto

```bash
git clone <URL-del-repositorio>
cd SueñosyLetras
cp .env.example .env
docker compose up --build      # API + PWA + base de datos
```

Y abre http://localhost:5173.
