// js/offline.js — Gestor de cola offline | ExplorArte Foro
// ─────────────────────────────────────────────────────────────
//  Este módulo se encarga de todo lo relacionado con el modo
//  sin conexión:
//
//  1. Detecta si hay o no internet en tiempo real.
//  2. Cuando no hay conexión, guarda las acciones del usuario
//     (posts, comentarios, reacciones) en localStorage.
//  3. Cuando vuelve la conexión, sincroniza automáticamente
//     todas las acciones pendientes en segundo plano.
//  4. Notifica al usuario del estado con un banner discreto.
//
//  Las acciones nunca se pierden — persisten en localStorage
//  incluso si la usuaria cierra la app o el navegador.
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "explorarte_foro_pendientes";

// ── Estado de conexión ───────────────────────────────────────

let estaOnline = navigator.onLine;

// Referencia al banner de estado que se inyecta en el DOM
let bannerEstado = null;

function crearBanner() {
  if (bannerEstado) return;
  bannerEstado = document.createElement("div");
  bannerEstado.id = "offline-banner";
  bannerEstado.setAttribute("role", "status");
  bannerEstado.setAttribute("aria-live", "polite");
  document.body.prepend(bannerEstado);
}

function mostrarBanner(mensaje, tipo) {
  crearBanner();
  bannerEstado.textContent = mensaje;
  bannerEstado.className = `offline-banner ${tipo}`;
  bannerEstado.style.display = "flex";
}

function ocultarBanner() {
  if (bannerEstado) bannerEstado.style.display = "none";
}

// ── Cola de acciones pendientes ──────────────────────────────

function leerCola() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function guardarCola(cola) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cola));
  } catch {
    console.warn("No se pudo guardar en localStorage.");
  }
}

// Agrega una acción a la cola offline
// tipo: "crear_hilo" | "comentario" | "reaccion_hilo"
function encolarAccion(tipo, payload, usuario) {
  const cola = leerCola();
  cola.push({
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    tipo,
    payload,
    usuario,
    creadoEnOffline: new Date().toISOString(),
  });
  guardarCola(cola);
  console.log(`📦 Acción encolada offline: ${tipo}`);
}

function contarPendientes() {
  return leerCola().length;
}

// ── Sincronización automática ────────────────────────────────

async function sincronizar() {
  const cola = leerCola();
  if (cola.length === 0) return;

  mostrarBanner(`Sincronizando ${cola.length} acción(es) pendiente(s)...`, "sincronizando");

  try {
    const res = await fetch("/api/foro/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acciones: cola }),
    });

    const data = await res.json();

    if (data.ok) {
      // Removemos de la cola solo las que se sincronizaron con éxito
      const fallidasIds = new Set(
        (data.resultados || []).filter((r) => !r.ok).map((r) => r.accionId)
      );
      const colaRestante = cola.filter((a) => fallidasIds.has(a.id));
      guardarCola(colaRestante);

      const exitosas = cola.length - colaRestante.length;
      console.log(`✅ ${exitosas} acción(es) sincronizadas. ${colaRestante.length} pendientes.`);

      mostrarBanner("¡Publicaciones sincronizadas correctamente!", "exito");
      setTimeout(ocultarBanner, 3000);

      // Recargamos el foro para mostrar el contenido actualizado
      if (exitosas > 0 && typeof window.cargarHilos === "function") {
        await window.cargarHilos();
      }
    }
  } catch (err) {
    console.warn("Error sincronizando:", err.message);
    mostrarBanner("No se pudo sincronizar. Se intentará de nuevo cuando haya conexión.", "error");
  }
}

// ── Eventos de conectividad ──────────────────────────────────

window.addEventListener("online", async () => {
  estaOnline = true;
  console.log("🌐 Conexión recuperada");

  const pendientes = contarPendientes();
  if (pendientes > 0) {
    await sincronizar();
  } else {
    mostrarBanner("Conexión recuperada", "exito");
    setTimeout(ocultarBanner, 2000);
  }
});

window.addEventListener("offline", () => {
  estaOnline = false;
  console.log("📴 Sin conexión");
  mostrarBanner("Sin conexión. Tus publicaciones se guardarán y enviarán cuando vuelva el internet.", "offline");
});

// Al cargar la página, verificamos si hay pendientes y sincronizamos
window.addEventListener("DOMContentLoaded", () => {
  const pendientes = contarPendientes();

  if (!navigator.onLine) {
    mostrarBanner("Sin conexión. Tus publicaciones se guardarán automáticamente.", "offline");
  } else if (pendientes > 0) {
    // Hay acciones pendientes de una sesión anterior — sincronizamos
    sincronizar();
  }
});

// ── Solicitar permiso para notificaciones push (móvil/web) ───
// Se llama cuando el usuario hace login por primera vez.

async function solicitarPermisoNotificaciones() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const permiso = await Notification.requestPermission();
  return permiso === "granted";
}

// Muestra una notificación push nativa del sistema operativo
function mostrarNotificacionPush(titulo, cuerpo, hiloId) {
  if (Notification.permission !== "granted") return;

  const notif = new Notification(titulo, {
    body: cuerpo,
    icon: "/assets/icon-192.png",  // ícono de la app
    badge: "/assets/badge-72.png",
    tag: hiloId,  // agrupa notificaciones del mismo hilo
    renotify: true,
  });

  // Al tocar la notificación, abre el hilo específico
  notif.onclick = () => {
    window.focus();
    if (hiloId) {
      const hiloEl = document.getElementById(`hilo-${hiloId}`);
      if (hiloEl) hiloEl.scrollIntoView({ behavior: "smooth" });
    }
  };
}

// ── Exportamos lo que necesita foro.js ───────────────────────
window.offlineManager = {
  estaOnline: () => estaOnline,
  encolarAccion,
  contarPendientes,
  sincronizar,
  solicitarPermisoNotificaciones,
  mostrarNotificacionPush,
};
