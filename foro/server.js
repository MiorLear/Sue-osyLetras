// server.js — Foro Comunitario | ExplorArte
// ─────────────────────────────────────────────────────────────
//  Backend del módulo Foro. Maneja hilos, comentarios,
//  reacciones, notificaciones y sincronización offline.
//
//  Sin dependencias externas — solo módulos nativos de Node.js.
//
//  Endpoints:
//  GET    /api/foro/hilos                    → listar hilos
//  POST   /api/foro/hilos                    → crear hilo
//  DELETE /api/foro/hilos/:id                → eliminar hilo
//  POST   /api/foro/hilos/:id/comentarios    → agregar comentario
//  DELETE /api/foro/hilos/:hiloId/comentarios/:comId → eliminar comentario
//  POST   /api/foro/hilos/:id/reacciones     → reaccionar a hilo
//  POST   /api/foro/hilos/:hiloId/comentarios/:comId/reacciones → reaccionar a comentario
//  GET    /api/foro/notificaciones/:uid      → notificaciones del usuario
//  POST   /api/foro/notificaciones/:uid/leer → marcar como leídas
//  POST   /api/foro/sync                     → sincronizar acciones offline
// ─────────────────────────────────────────────────────────────

const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3002;
const PUBLIC_DIR = path.join(__dirname, "public");
const FORO_FILE = path.join(__dirname, "data", "foro.json");
const NOTIF_FILE = path.join(__dirname, "data", "notificaciones.json");

// Tipos de reacción válidos — positivos y emocionales
const REACCIONES_VALIDAS = ["me_gusta", "me_encanta", "aplauso", "de_acuerdo", "feliz"];

// Archivos estáticos del frontend
const staticFiles = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/css/foro.css": { file: "css/foro.css", type: "text/css; charset=utf-8" },
  "/js/foro.js": { file: "js/foro.js", type: "application/javascript; charset=utf-8" },
  "/js/offline.js": { file: "js/offline.js", type: "application/javascript; charset=utf-8" },
};

// ── Headers CORS comunes ─────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-User-Uid, X-User-Nombre, X-User-Rol",
};

// ── Helpers de respuesta ─────────────────────────────────────

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders });
  res.end(JSON.stringify(payload, null, 2));
}

function sendError(res, status, message) {
  sendJson(res, status, { ok: false, message });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

// Extrae info del usuario desde los headers del request
// En producción esto vendría del token de auth verificado
function extraerUsuario(req) {
  return {
    uid: req.headers["x-user-uid"] || "anonimo",
    nombre: req.headers["x-user-nombre"] || "Usuario",
    rol: req.headers["x-user-rol"] || "maestra",
  };
}

// ── Persistencia ─────────────────────────────────────────────
// Escritura atómica: temporal → rename para no corromper datos

async function leerForo() {
  const text = await fs.readFile(FORO_FILE, "utf8");
  return JSON.parse(text);
}

async function guardarForo(data) {
  const tmp = `${FORO_FILE}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, FORO_FILE);
}

async function leerNotificaciones() {
  const text = await fs.readFile(NOTIF_FILE, "utf8");
  return JSON.parse(text);
}

async function guardarNotificaciones(data) {
  const tmp = `${NOTIF_FILE}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, NOTIF_FILE);
}

// ── Notificaciones ───────────────────────────────────────────
// Crea una notificación para el dueño del hilo/comentario
// cuando alguien interactúa con su contenido.

async function crearNotificacion({ paraUid, tipo, autorNombre, hiloId, texto }) {
  // No notificamos a uno mismo
  if (!paraUid || paraUid === "anonimo") return;

  const data = await leerNotificaciones();
  data.notificaciones.unshift({
    id: crypto.randomUUID(),
    paraUid,
    tipo,        // "comentario" | "reaccion_hilo" | "reaccion_comentario"
    autorNombre,
    hiloId,
    texto,
    leida: false,
    creadaEn: new Date().toISOString(),
  });

  // Mantenemos máximo 100 notificaciones por privacidad y espacio
  data.notificaciones = data.notificaciones.slice(0, 100);
  await guardarNotificaciones(data);
}

// ── Handlers de la API ───────────────────────────────────────

// GET /api/foro/hilos
async function getHilos(req, res) {
  const data = await leerForo();
  // Más recientes primero
  const hilos = [...data.hilos].sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
  sendJson(res, 200, { ok: true, hilos });
}

// POST /api/foro/hilos
async function crearHilo(req, res) {
  const body = await readBody(req);
  const usuario = extraerUsuario(req);

  if (!body.texto || body.texto.trim().length < 3) {
    return sendError(res, 422, "El mensaje debe tener al menos 3 caracteres.");
  }
  if (body.texto.trim().length > 1000) {
    return sendError(res, 422, "El mensaje no puede superar los 1000 caracteres.");
  }

  const nuevoHilo = {
    id: `hilo-${crypto.randomUUID()}`,
    autorUid: usuario.uid,
    autorNombre: usuario.nombre,
    texto: body.texto.trim(),
    creadoEn: new Date().toISOString(),
    reacciones: { me_gusta: 0, me_encanta: 0, aplauso: 0, de_acuerdo: 0, feliz: 0 },
    comentarios: [],
  };

  const data = await leerForo();
  data.hilos.unshift(nuevoHilo);
  await guardarForo(data);

  sendJson(res, 201, { ok: true, hilo: nuevoHilo });
}

// DELETE /api/foro/hilos/:id
async function eliminarHilo(req, res, hiloId) {
  const usuario = extraerUsuario(req);
  const data = await leerForo();
  const hilo = data.hilos.find((h) => h.id === hiloId);

  if (!hilo) return sendError(res, 404, "Hilo no encontrado.");

  // Solo el autor o el admin pueden eliminar
  if (hilo.autorUid !== usuario.uid && usuario.rol !== "admin") {
    return sendError(res, 403, "No tenés permiso para eliminar este hilo.");
  }

  data.hilos = data.hilos.filter((h) => h.id !== hiloId);
  await guardarForo(data);
  sendJson(res, 200, { ok: true, message: "Hilo eliminado correctamente." });
}

// POST /api/foro/hilos/:id/comentarios
async function agregarComentario(req, res, hiloId) {
  const body = await readBody(req);
  const usuario = extraerUsuario(req);

  if (!body.texto || body.texto.trim().length < 1) {
    return sendError(res, 422, "El comentario no puede estar vacío.");
  }
  if (body.texto.trim().length > 500) {
    return sendError(res, 422, "El comentario no puede superar los 500 caracteres.");
  }

  const data = await leerForo();
  const hilo = data.hilos.find((h) => h.id === hiloId);
  if (!hilo) return sendError(res, 404, "Hilo no encontrado.");

  const nuevoComentario = {
    id: `com-${crypto.randomUUID()}`,
    autorUid: usuario.uid,
    autorNombre: usuario.nombre,
    texto: body.texto.trim(),
    creadoEn: new Date().toISOString(),
    reacciones: { me_gusta: 0, me_encanta: 0, aplauso: 0, de_acuerdo: 0, feliz: 0 },
  };

  hilo.comentarios.push(nuevoComentario);
  await guardarForo(data);

  // Notificamos al autor del hilo si es otra persona
  if (hilo.autorUid !== usuario.uid) {
    await crearNotificacion({
      paraUid: hilo.autorUid,
      tipo: "comentario",
      autorNombre: usuario.nombre,
      hiloId,
      texto: `${usuario.nombre} comentó en tu publicación.`,
    });
  }

  sendJson(res, 201, { ok: true, comentario: nuevoComentario });
}

// DELETE /api/foro/hilos/:hiloId/comentarios/:comId
async function eliminarComentario(req, res, hiloId, comId) {
  const usuario = extraerUsuario(req);
  const data = await leerForo();
  const hilo = data.hilos.find((h) => h.id === hiloId);

  if (!hilo) return sendError(res, 404, "Hilo no encontrado.");

  const comentario = hilo.comentarios.find((c) => c.id === comId);
  if (!comentario) return sendError(res, 404, "Comentario no encontrado.");

  if (comentario.autorUid !== usuario.uid && usuario.rol !== "admin") {
    return sendError(res, 403, "No tenés permiso para eliminar este comentario.");
  }

  hilo.comentarios = hilo.comentarios.filter((c) => c.id !== comId);
  await guardarForo(data);
  sendJson(res, 200, { ok: true, message: "Comentario eliminado." });
}

// POST /api/foro/hilos/:id/reacciones
async function reaccionarHilo(req, res, hiloId) {
  const body = await readBody(req);
  const usuario = extraerUsuario(req);

  if (!REACCIONES_VALIDAS.includes(body.tipo)) {
    return sendError(res, 422, `Reacción inválida. Válidas: ${REACCIONES_VALIDAS.join(", ")}`);
  }

  const data = await leerForo();
  const hilo = data.hilos.find((h) => h.id === hiloId);
  if (!hilo) return sendError(res, 404, "Hilo no encontrado.");

  // Toggle: si ya reaccionó con ese tipo, lo quitamos; si no, lo sumamos
  // Guardamos quién reaccionó para manejar el toggle correctamente
  if (!hilo._reaccionesUid) hilo._reaccionesUid = {};
  const clave = `${usuario.uid}:${body.tipo}`;

  if (hilo._reaccionesUid[clave]) {
    // Ya había reaccionado — quitamos
    hilo.reacciones[body.tipo] = Math.max(0, hilo.reacciones[body.tipo] - 1);
    delete hilo._reaccionesUid[clave];
  } else {
    // Reacción nueva — sumamos
    hilo.reacciones[body.tipo] = (hilo.reacciones[body.tipo] || 0) + 1;
    hilo._reaccionesUid[clave] = true;

    // Notificamos al autor si es otra persona
    if (hilo.autorUid !== usuario.uid) {
      await crearNotificacion({
        paraUid: hilo.autorUid,
        tipo: "reaccion_hilo",
        autorNombre: usuario.nombre,
        hiloId,
        texto: `${usuario.nombre} reaccionó a tu publicación.`,
      });
    }
  }

  await guardarForo(data);
  sendJson(res, 200, { ok: true, reacciones: hilo.reacciones });
}

// POST /api/foro/hilos/:hiloId/comentarios/:comId/reacciones
async function reaccionarComentario(req, res, hiloId, comId) {
  const body = await readBody(req);
  const usuario = extraerUsuario(req);

  if (!REACCIONES_VALIDAS.includes(body.tipo)) {
    return sendError(res, 422, `Reacción inválida. Válidas: ${REACCIONES_VALIDAS.join(", ")}`);
  }

  const data = await leerForo();
  const hilo = data.hilos.find((h) => h.id === hiloId);
  if (!hilo) return sendError(res, 404, "Hilo no encontrado.");

  const comentario = hilo.comentarios.find((c) => c.id === comId);
  if (!comentario) return sendError(res, 404, "Comentario no encontrado.");

  if (!comentario._reaccionesUid) comentario._reaccionesUid = {};
  const clave = `${usuario.uid}:${body.tipo}`;

  if (comentario._reaccionesUid[clave]) {
    comentario.reacciones[body.tipo] = Math.max(0, comentario.reacciones[body.tipo] - 1);
    delete comentario._reaccionesUid[clave];
  } else {
    comentario.reacciones[body.tipo] = (comentario.reacciones[body.tipo] || 0) + 1;
    comentario._reaccionesUid[clave] = true;

    if (comentario.autorUid !== usuario.uid) {
      await crearNotificacion({
        paraUid: comentario.autorUid,
        tipo: "reaccion_comentario",
        autorNombre: usuario.nombre,
        hiloId,
        texto: `${usuario.nombre} reaccionó a tu comentario.`,
      });
    }
  }

  await guardarForo(data);
  sendJson(res, 200, { ok: true, reacciones: comentario.reacciones });
}

// GET /api/foro/notificaciones/:uid
async function getNotificaciones(req, res, uid) {
  const data = await leerNotificaciones();
  const mias = data.notificaciones.filter((n) => n.paraUid === uid);
  const noLeidas = mias.filter((n) => !n.leida).length;
  sendJson(res, 200, { ok: true, notificaciones: mias, noLeidas });
}

// POST /api/foro/notificaciones/:uid/leer
async function marcarLeidas(req, res, uid) {
  const data = await leerNotificaciones();
  data.notificaciones = data.notificaciones.map((n) =>
    n.paraUid === uid ? { ...n, leida: true } : n
  );
  await guardarNotificaciones(data);
  sendJson(res, 200, { ok: true, message: "Notificaciones marcadas como leídas." });
}

// POST /api/foro/sync
// Recibe un array de acciones realizadas offline y las ejecuta en orden.
// El cliente las guarda localmente y las manda cuando recupera conexión.
async function syncOffline(req, res) {
  const body = await readBody(req);
  const acciones = body.acciones || [];

  if (!Array.isArray(acciones) || acciones.length === 0) {
    return sendError(res, 422, "No se recibieron acciones para sincronizar.");
  }

  const resultados = [];

  for (const accion of acciones) {
    try {
      // Simulamos el request para reutilizar los handlers existentes
      // cada acción tiene: tipo, payload, usuario
      switch (accion.tipo) {
        case "crear_hilo": {
          const data = await leerForo();
          const hilo = {
            id: `hilo-${crypto.randomUUID()}`,
            autorUid: accion.usuario.uid,
            autorNombre: accion.usuario.nombre,
            texto: accion.payload.texto.trim(),
            // Usamos el timestamp offline para respetar el orden real
            creadoEn: accion.creadoEnOffline || new Date().toISOString(),
            reacciones: { me_gusta: 0, me_encanta: 0, aplauso: 0, de_acuerdo: 0, feliz: 0 },
            comentarios: [],
          };
          data.hilos.unshift(hilo);
          await guardarForo(data);
          resultados.push({ accionId: accion.id, ok: true, tipo: "crear_hilo" });
          break;
        }

        case "comentario": {
          const data = await leerForo();
          const hilo = data.hilos.find((h) => h.id === accion.payload.hiloId);
          if (!hilo) { resultados.push({ accionId: accion.id, ok: false, error: "Hilo no encontrado." }); break; }

          const comentario = {
            id: `com-${crypto.randomUUID()}`,
            autorUid: accion.usuario.uid,
            autorNombre: accion.usuario.nombre,
            texto: accion.payload.texto.trim(),
            creadoEn: accion.creadoEnOffline || new Date().toISOString(),
            reacciones: { me_gusta: 0, me_encanta: 0, aplauso: 0, de_acuerdo: 0, feliz: 0 },
          };
          hilo.comentarios.push(comentario);
          await guardarForo(data);

          if (hilo.autorUid !== accion.usuario.uid) {
            await crearNotificacion({ paraUid: hilo.autorUid, tipo: "comentario", autorNombre: accion.usuario.nombre, hiloId: hilo.id, texto: `${accion.usuario.nombre} comentó en tu publicación.` });
          }
          resultados.push({ accionId: accion.id, ok: true, tipo: "comentario" });
          break;
        }

        case "reaccion_hilo": {
          const data = await leerForo();
          const hilo = data.hilos.find((h) => h.id === accion.payload.hiloId);
          if (!hilo) { resultados.push({ accionId: accion.id, ok: false, error: "Hilo no encontrado." }); break; }

          if (!hilo._reaccionesUid) hilo._reaccionesUid = {};
          const clave = `${accion.usuario.uid}:${accion.payload.tipo}`;
          if (!hilo._reaccionesUid[clave]) {
            hilo.reacciones[accion.payload.tipo] = (hilo.reacciones[accion.payload.tipo] || 0) + 1;
            hilo._reaccionesUid[clave] = true;
          }
          await guardarForo(data);
          resultados.push({ accionId: accion.id, ok: true, tipo: "reaccion_hilo" });
          break;
        }

        default:
          resultados.push({ accionId: accion.id, ok: false, error: `Tipo de acción desconocido: ${accion.tipo}` });
      }
    } catch (err) {
      resultados.push({ accionId: accion.id, ok: false, error: err.message });
    }
  }

  sendJson(res, 200, { ok: true, resultados });
}

// ── Router principal ─────────────────────────────────────────

async function handleApi(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = req.url;

  if (req.method === "GET" && url === "/api/foro/hilos") return getHilos(req, res);
  if (req.method === "POST" && url === "/api/foro/hilos") return crearHilo(req, res);
  if (req.method === "POST" && url === "/api/foro/sync") return syncOffline(req, res);

  // Rutas con parámetros — extraemos IDs de la URL manualmente
  const matchEliminarHilo = url.match(/^\/api\/foro\/hilos\/([^/]+)$/);
  if (req.method === "DELETE" && matchEliminarHilo) return eliminarHilo(req, res, matchEliminarHilo[1]);

  const matchComentarios = url.match(/^\/api\/foro\/hilos\/([^/]+)\/comentarios$/);
  if (req.method === "POST" && matchComentarios) return agregarComentario(req, res, matchComentarios[1]);

  const matchEliminarCom = url.match(/^\/api\/foro\/hilos\/([^/]+)\/comentarios\/([^/]+)$/);
  if (req.method === "DELETE" && matchEliminarCom) return eliminarComentario(req, res, matchEliminarCom[1], matchEliminarCom[2]);

  const matchReaccionHilo = url.match(/^\/api\/foro\/hilos\/([^/]+)\/reacciones$/);
  if (req.method === "POST" && matchReaccionHilo) return reaccionarHilo(req, res, matchReaccionHilo[1]);

  const matchReaccionCom = url.match(/^\/api\/foro\/hilos\/([^/]+)\/comentarios\/([^/]+)\/reacciones$/);
  if (req.method === "POST" && matchReaccionCom) return reaccionarComentario(req, res, matchReaccionCom[1], matchReaccionCom[2]);

  const matchNotif = url.match(/^\/api\/foro\/notificaciones\/([^/]+)$/);
  if (req.method === "GET" && matchNotif) return getNotificaciones(req, res, matchNotif[1]);

  const matchLeerNotif = url.match(/^\/api\/foro\/notificaciones\/([^/]+)\/leer$/);
  if (req.method === "POST" && matchLeerNotif) return marcarLeidas(req, res, matchLeerNotif[1]);

  sendError(res, 404, "Ruta de API no encontrada.");
}

// ── Servidor ─────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }

    const route = staticFiles[req.url];
    if (!route) { sendError(res, 404, "Página no encontrada."); return; }

    const content = await fs.readFile(path.join(PUBLIC_DIR, route.file));
    res.writeHead(200, { "Content-Type": route.type, "Cache-Control": "no-store" });
    res.end(content);
  } catch (error) {
    console.error("Error en el servidor:", error);
    sendError(res, 500, "Error inesperado en el servidor.");
  }
});

server.listen(PORT, () => {
  console.log(`Foro ExplorArte corriendo en http://localhost:${PORT}`);
});
