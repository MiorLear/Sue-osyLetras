# Cómo correr el proyecto en una computadora nueva (desde cero)

Esta guía asume que **nunca has tocado este proyecto** y que estás en una computadora limpia.
Sigue los pasos en orden — no necesitas saber Java, Docker ni Expo de antemano.

---

## 0. Qué vas a necesitar instalar

Solo estas tres cosas (todas gratis, para Windows/Mac/Linux):

| Programa | Para qué sirve | Dónde bajarlo |
|---|---|---|
| **Git** | Descargar el código del repositorio | [git-scm.com](https://git-scm.com) |
| **Docker Desktop** | Correr el backend (Java) + la web, sin instalar Java ni Postgres | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Node.js** (versión 20 o más nueva) | Correr la app mobile (Expo) | [nodejs.org](https://nodejs.org) |

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

Todas usan la misma contraseña: **`explorarte123`**

| Correo | Rol |
|---|---|
| `admin@explorarte.org` | administrador |
| `maria@ejemplo.com` | docente |
| `ana@ejemplo.com` | docente |

### Comandos que vas a usar seguido

```bash
docker compose up --build     # arrancar todo (o npm run dev:stack)
docker compose down           # apagar todo (o npm run dev:stack:down)
docker compose logs -f api    # ver qué está haciendo el backend (o npm run dev:stack:logs)
```

Ver [`api/README.md`](./api/README.md) si quieres más detalle sobre el backend en Java
(cómo se recarga solo al editar código, cómo resetear la base de datos, etc.).

---

## 3. Correr la app mobile (Expo)

La app mobile **no** corre dentro de Docker — corre directo en tu computadora con Node, para
que tu teléfono se pueda conectar por Wi-Fi al servidor de desarrollo.

En una terminal nueva (deja la de Docker corriendo):

```bash
npm install
npm start
```

Esto abre una pantalla en la terminal con un **código QR**. Tienes tres formas de verla:

- **En tu teléfono (lo más fácil):** instala la app **Expo Go** (búscala en App Store / Play
  Store), ábrela y escanea el código QR. **Tu teléfono y tu computadora deben estar conectados
  a la misma red Wi-Fi.**
- **Emulador Android:** presiona `a` en la terminal (necesitas Android Studio ya configurado).
- **En el navegador (vista rápida, no es 100% igual a mobile real):** presiona `w`.

### Por defecto, mobile usa datos de ejemplo (no la API real)

Así puedes empezar a ver la app de inmediato sin depender de que el backend esté corriendo.
Para conectar mobile a la API real de Docker, edita el archivo `.env` que creaste en el paso 2
y agrega tu **IP local**:

```
EXPO_PUBLIC_API_URL=http://TU-IP-LOCAL:8000
```

> ⚠️ **No pongas `localhost`** — el teléfono no sabe qué es "localhost" en tu computadora.
> Necesitas la IP de tu PC en la red Wi-Fi (algo como `192.168.1.23`). Para encontrarla:
> - **Windows:** abre `cmd` y escribe `ipconfig`, busca "Dirección IPv4".
> - **Mac:** Preferencias del Sistema → Red.
>
> Si vas a probar en el navegador o un emulador en la misma máquina, `localhost` sí funciona.

Después de editar `.env`, para que el cambio se aplique detén `npm start` (Ctrl+C) y vuelve a
correrlo.

---

## Problemas comunes

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

**El código QR de Expo no conecta con mi teléfono**
Casi siempre es que el teléfono y la computadora no están en la misma red Wi-Fi, o que el
firewall de Windows está bloqueando la conexión. Prueba conectando el teléfono a la misma red
que la PC y desactivando temporalmente el firewall para confirmar.

---

## Resumen ultra-corto

```bash
git clone <URL-del-repositorio>
cd SueñosyLetras
cp .env.example .env
docker compose up --build      # backend + web — déjalo corriendo

# en otra terminal:
npm install
npm start                      # mobile — escanea el QR con Expo Go
```
