// js/foro.js — Foro Comunitario | ExplorArte
// ─────────────────────────────────────────────────────────────
//  Lógica principal del frontend del foro.
//  Se apoya en offline.js para todo lo relacionado con
//  la cola sin conexión y las notificaciones push.
// ─────────────────────────────────────────────────────────────

// ── Usuario simulado ─────────────────────────────────────────
// En producción esto viene del sistema de auth (Firebase, etc.)
// Se reemplaza con el usuario real autenticado.
const USUARIO_ACTUAL = {
  uid: sessionStorage.getItem("uid") || "maestra-demo",
  nombre: sessionStorage.getItem("nombre") || "Maestra Demo",
  rol: sessionStorage.getItem("rol") || "maestra",
};

// Headers que identifican al usuario en cada request
const headersUsuario = () => ({
  "Content-Type": "application/json",
  "X-User-Uid": USUARIO_ACTUAL.uid,
  "X-User-Nombre": USUARIO_ACTUAL.nombre,
  "X-User-Rol": USUARIO_ACTUAL.rol,
});

// ── Emojis de reacciones ─────────────────────────────────────
const REACCIONES = {
  me_gusta: { emoji: "👍", etiqueta: "Me gusta" },
  me_encanta: { emoji: "❤️", etiqueta: "Me encanta" },
  aplauso: { emoji: "👏", etiqueta: "Aplauso" },
  de_acuerdo: { emoji: "✅", etiqueta: "De acuerdo" },
  feliz: { emoji: "😊", etiqueta: "Feliz" },
};

// ── Referencias DOM ──────────────────────────────────────────
const listaHilos = document.getElementById("listaHilos");
const formNuevoHilo = document.getElementById("formNuevoHilo");
const inputNuevoHilo = document.getElementById("inputNuevoHilo");
const btnPublicar = document.getElementById("btnPublicar");
const badgeNotif = document.getElementById("badgeNotif");
const btnNotif = document.getElementById("btnNotif");
const panelNotif = document.getElementById("panelNotif");
const listaNotif = document.getElementById("listaNotif");
const contadorChars = document.getElementById("contadorChars");

// ── Helper fetch ─────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { headers: headersUsuario(), ...options });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

// ── Formatear fechas ─────────────────────────────────────────
function formatearFecha(iso) {
  const fecha = new Date(iso);
  const ahora = new Date();
  const diffMs = ahora - fecha;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffHrs / 24);

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHrs < 24) return `hace ${diffHrs}h`;
  if (diffDias < 7) return `hace ${diffDias} día${diffDias > 1 ? "s" : ""}`;
  return fecha.toLocaleDateString("es-SV", { day: "numeric", month: "short" });
}

// ── Iniciales del nombre ─────────────────────────────────────
function iniciales(nombre) {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

// ── Renderizar barra de reacciones ───────────────────────────
function renderReacciones(reacciones, targetId, tipo) {
  const contenedor = document.createElement("div");
  contenedor.className = "reacciones-barra";

  for (const [clave, info] of Object.entries(REACCIONES)) {
    const count = reacciones[clave] || 0;
    const btn = document.createElement("button");
    btn.className = "btn-reaccion";
    btn.setAttribute("aria-label", `${info.etiqueta}: ${count}`);
    btn.setAttribute("title", info.etiqueta);
    btn.innerHTML = `<span class="emoji">${info.emoji}</span>${count > 0 ? `<span class="count">${count}</span>` : ""}`;

    btn.addEventListener("click", () => manejarReaccion(targetId, clave, tipo, btn, count));
    contenedor.appendChild(btn);
  }

  return contenedor;
}

// ── Manejar reacción ─────────────────────────────────────────
async function manejarReaccion(targetId, tipo, tipoTarget, btn, countActual) {
  const { hiloId, comId } = targetId;
  const url = comId
    ? `/api/foro/hilos/${hiloId}/comentarios/${comId}/reacciones`
    : `/api/foro/hilos/${hiloId}/reacciones`;

  const payload = JSON.stringify({ tipo });

  // Optimistic UI — actualizamos visualmente antes de esperar al server
  const estaActivo = btn.classList.contains("activa");
  const countEl = btn.querySelector(".count");
  const nuevoCount = estaActivo ? Math.max(0, countActual - 1) : countActual + 1;

  btn.classList.toggle("activa");
  if (nuevoCount > 0) {
    if (countEl) countEl.textContent = nuevoCount;
    else btn.insertAdjacentHTML("beforeend", `<span class="count">${nuevoCount}</span>`);
  } else if (countEl) {
    countEl.remove();
  }

  if (window.offlineManager.estaOnline()) {
    try {
      await apiFetch(url, { method: "POST", body: payload });
    } catch {
      // Si falla, revertimos el optimistic update
      btn.classList.toggle("activa");
    }
  } else {
    // Sin conexión — encolamos la reacción
    window.offlineManager.encolarAccion(
      comId ? "reaccion_comentario" : "reaccion_hilo",
      { hiloId, comId, tipo },
      USUARIO_ACTUAL
    );
  }
}

// ── Renderizar un comentario ─────────────────────────────────
function renderComentario(comentario, hiloId) {
  const div = document.createElement("div");
  div.className = "comentario";
  div.id = `com-${comentario.id}`;

  const esMio = comentario.autorUid === USUARIO_ACTUAL.uid;
  const esAdmin = USUARIO_ACTUAL.rol === "admin";

  div.innerHTML = `
    <div class="comentario-header">
      <div class="avatar avatar-sm">${iniciales(comentario.autorNombre)}</div>
      <div class="comentario-meta">
        <span class="autor-nombre">${comentario.autorNombre}</span>
        <span class="tiempo">${formatearFecha(comentario.creadoEn)}</span>
      </div>
      ${(esMio || esAdmin) ? `<button class="btn-eliminar-com" aria-label="Eliminar comentario" data-hilo="${hiloId}" data-com="${comentario.id}">✕</button>` : ""}
    </div>
    <p class="comentario-texto">${comentario.texto}</p>
  `;

  div.appendChild(renderReacciones(
    comentario.reacciones,
    { hiloId, comId: comentario.id },
    "comentario"
  ));

  // Eliminar comentario
  const btnElim = div.querySelector(".btn-eliminar-com");
  if (btnElim) {
    btnElim.addEventListener("click", () => eliminarComentario(hiloId, comentario.id, div));
  }

  return div;
}

// ── Renderizar un hilo ───────────────────────────────────────
function renderHilo(hilo) {
  const article = document.createElement("article");
  article.className = "hilo";
  article.id = `hilo-${hilo.id}`;

  const esMio = hilo.autorUid === USUARIO_ACTUAL.uid;
  const esAdmin = USUARIO_ACTUAL.rol === "admin";
  const totalComentarios = hilo.comentarios.length;

  article.innerHTML = `
    <div class="hilo-header">
      <div class="avatar">${iniciales(hilo.autorNombre)}</div>
      <div class="hilo-meta">
        <span class="autor-nombre">${hilo.autorNombre}</span>
        <span class="tiempo">${formatearFecha(hilo.creadoEn)}</span>
      </div>
      ${(esMio || esAdmin) ? `<button class="btn-eliminar-hilo" aria-label="Eliminar publicación">✕</button>` : ""}
    </div>

    <p class="hilo-texto">${hilo.texto}</p>
  `;

  // Reacciones del hilo
  article.appendChild(renderReacciones(hilo.reacciones, { hiloId: hilo.id }, "hilo"));

  // Sección de comentarios
  const secCom = document.createElement("div");
  secCom.className = "seccion-comentarios";

  if (totalComentarios > 0) {
    const btnVerCom = document.createElement("button");
    btnVerCom.className = "btn-ver-comentarios";
    btnVerCom.textContent = `💬 ${totalComentarios} comentario${totalComentarios > 1 ? "s" : ""}`;
    btnVerCom.setAttribute("aria-expanded", "false");

    const listaCom = document.createElement("div");
    listaCom.className = "lista-comentarios oculto";

    hilo.comentarios.forEach((c) => listaCom.appendChild(renderComentario(c, hilo.id)));

    btnVerCom.addEventListener("click", () => {
      const abierto = listaCom.classList.toggle("oculto");
      btnVerCom.setAttribute("aria-expanded", String(!abierto));
    });

    secCom.appendChild(btnVerCom);
    secCom.appendChild(listaCom);
  }

  // Form para agregar comentario
  const formCom = document.createElement("div");
  formCom.className = "form-comentario";
  formCom.innerHTML = `
    <div class="avatar avatar-sm">${iniciales(USUARIO_ACTUAL.nombre)}</div>
    <input type="text" class="input-comentario" placeholder="Escribí un comentario..." maxlength="500" aria-label="Escribir comentario" />
    <button class="btn-enviar-com" aria-label="Enviar comentario">➤</button>
  `;

  const inputCom = formCom.querySelector(".input-comentario");
  const btnEnviarCom = formCom.querySelector(".btn-enviar-com");

  btnEnviarCom.addEventListener("click", () => enviarComentario(hilo.id, inputCom, secCom, hilo));
  inputCom.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarComentario(hilo.id, inputCom, secCom, hilo); }
  });

  secCom.appendChild(formCom);
  article.appendChild(secCom);

  // Eliminar hilo
  const btnElimHilo = article.querySelector(".btn-eliminar-hilo");
  if (btnElimHilo) {
    btnElimHilo.addEventListener("click", () => eliminarHilo(hilo.id, article));
  }

  return article;
}

// ── Cargar hilos ─────────────────────────────────────────────
window.cargarHilos = async function () {
  listaHilos.innerHTML = `<p class="cargando-texto">Cargando publicaciones...</p>`;
  try {
    const data = await apiFetch("/api/foro/hilos");
    listaHilos.innerHTML = "";
    if (data.hilos.length === 0) {
      listaHilos.innerHTML = `<p class="sin-contenido">Aún no hay publicaciones. ¡Sé la primera en compartir algo!</p>`;
      return;
    }
    data.hilos.forEach((h) => listaHilos.appendChild(renderHilo(h)));
  } catch {
    listaHilos.innerHTML = `<p class="error-texto">No se pudieron cargar las publicaciones.</p>`;
  }
};

// ── Crear hilo ───────────────────────────────────────────────
async function publicarHilo() {
  const texto = inputNuevoHilo.value.trim();
  if (!texto) return;

  btnPublicar.disabled = true;

  if (window.offlineManager.estaOnline()) {
    try {
      const data = await apiFetch("/api/foro/hilos", {
        method: "POST",
        body: JSON.stringify({ texto }),
      });
      inputNuevoHilo.value = "";
      contadorChars.textContent = "0/1000";
      listaHilos.prepend(renderHilo(data.hilo));
    } catch (err) {
      alert(err.message || "No se pudo publicar.");
    }
  } else {
    // Sin conexión — encolamos y mostramos vista previa local
    window.offlineManager.encolarAccion("crear_hilo", { texto }, USUARIO_ACTUAL);

    const hiloLocal = {
      id: `local-${Date.now()}`,
      autorUid: USUARIO_ACTUAL.uid,
      autorNombre: USUARIO_ACTUAL.nombre,
      texto,
      creadoEn: new Date().toISOString(),
      reacciones: { me_gusta: 0, me_encanta: 0, aplauso: 0, de_acuerdo: 0, feliz: 0 },
      comentarios: [],
      _pendiente: true,
    };

    const elHilo = renderHilo(hiloLocal);
    elHilo.classList.add("pendiente");
    elHilo.insertAdjacentHTML("afterbegin", `<div class="badge-pendiente">📤 Pendiente de envío</div>`);
    listaHilos.prepend(elHilo);
    inputNuevoHilo.value = "";
    contadorChars.textContent = "0/1000";
  }

  btnPublicar.disabled = false;
  inputNuevoHilo.focus();
}

// ── Enviar comentario ────────────────────────────────────────
async function enviarComentario(hiloId, inputEl, secCom, hilo) {
  const texto = inputEl.value.trim();
  if (!texto) return;

  if (window.offlineManager.estaOnline()) {
    try {
      const data = await apiFetch(`/api/foro/hilos/${hiloId}/comentarios`, {
        method: "POST",
        body: JSON.stringify({ texto }),
      });

      inputEl.value = "";

      // Mostramos el comentario nuevo en la lista
      let listaCom = secCom.querySelector(".lista-comentarios");
      if (!listaCom) {
        listaCom = document.createElement("div");
        listaCom.className = "lista-comentarios";
        secCom.insertBefore(listaCom, secCom.querySelector(".form-comentario"));
      }
      listaCom.classList.remove("oculto");
      listaCom.appendChild(renderComentario(data.comentario, hiloId));

      // Actualizamos el botón de contador
      let btnVer = secCom.querySelector(".btn-ver-comentarios");
      const totalActual = listaCom.querySelectorAll(".comentario").length;
      if (!btnVer) {
        btnVer = document.createElement("button");
        btnVer.className = "btn-ver-comentarios";
        secCom.insertBefore(btnVer, listaCom);
        btnVer.addEventListener("click", () => {
          listaCom.classList.toggle("oculto");
          btnVer.setAttribute("aria-expanded", String(!listaCom.classList.contains("oculto")));
        });
      }
      btnVer.textContent = `💬 ${totalActual} comentario${totalActual > 1 ? "s" : ""}`;
      btnVer.setAttribute("aria-expanded", "true");
    } catch (err) {
      alert(err.message || "No se pudo enviar el comentario.");
    }
  } else {
    // Sin conexión — encolamos
    window.offlineManager.encolarAccion("comentario", { hiloId, texto }, USUARIO_ACTUAL);

    const comLocal = {
      id: `local-com-${Date.now()}`,
      autorUid: USUARIO_ACTUAL.uid,
      autorNombre: USUARIO_ACTUAL.nombre,
      texto,
      creadoEn: new Date().toISOString(),
      reacciones: { me_gusta: 0, me_encanta: 0, aplauso: 0, de_acuerdo: 0, feliz: 0 },
    };

    let listaCom = secCom.querySelector(".lista-comentarios");
    if (!listaCom) {
      listaCom = document.createElement("div");
      listaCom.className = "lista-comentarios";
      secCom.insertBefore(listaCom, secCom.querySelector(".form-comentario"));
    }
    listaCom.classList.remove("oculto");
    const elCom = renderComentario(comLocal, hiloId);
    elCom.classList.add("pendiente");
    elCom.insertAdjacentHTML("afterbegin", `<div class="badge-pendiente">📤 Pendiente</div>`);
    listaCom.appendChild(elCom);
    inputEl.value = "";
  }
}

// ── Eliminar hilo ────────────────────────────────────────────
async function eliminarHilo(hiloId, elemento) {
  if (!confirm("¿Eliminás esta publicación? Esta acción no se puede deshacer.")) return;
  try {
    await apiFetch(`/api/foro/hilos/${hiloId}`, { method: "DELETE" });
    elemento.classList.add("eliminando");
    setTimeout(() => elemento.remove(), 300);
  } catch (err) {
    alert(err.message || "No se pudo eliminar.");
  }
}

// ── Eliminar comentario ───────────────────────────────────────
async function eliminarComentario(hiloId, comId, elemento) {
  if (!confirm("¿Eliminás este comentario?")) return;
  try {
    await apiFetch(`/api/foro/hilos/${hiloId}/comentarios/${comId}`, { method: "DELETE" });
    elemento.classList.add("eliminando");
    setTimeout(() => elemento.remove(), 300);
  } catch (err) {
    alert(err.message || "No se pudo eliminar.");
  }
}

// ── Notificaciones ───────────────────────────────────────────
async function cargarNotificaciones() {
  try {
    const data = await apiFetch(`/api/foro/notificaciones/${USUARIO_ACTUAL.uid}`);

    if (data.noLeidas > 0) {
      badgeNotif.textContent = data.noLeidas;
      badgeNotif.style.display = "flex";

      // Notificación push para la más reciente no leída
      const primeraNueva = data.notificaciones.find((n) => !n.leida);
      if (primeraNueva) {
        window.offlineManager.mostrarNotificacionPush(
          "ExplorArte — Foro",
          primeraNueva.texto,
          primeraNueva.hiloId
        );
      }
    } else {
      badgeNotif.style.display = "none";
    }

    listaNotif.innerHTML = "";
    if (data.notificaciones.length === 0) {
      listaNotif.innerHTML = `<p class="sin-notif">No tenés notificaciones aún.</p>`;
      return;
    }

    data.notificaciones.slice(0, 20).forEach((n) => {
      const item = document.createElement("div");
      item.className = `notif-item ${n.leida ? "leida" : "no-leida"}`;
      item.innerHTML = `
        <p class="notif-texto">${n.texto}</p>
        <span class="notif-tiempo">${formatearFecha(n.creadaEn)}</span>
      `;
      listaNotif.appendChild(item);
    });
  } catch {
    listaNotif.innerHTML = `<p class="sin-notif">No se pudieron cargar las notificaciones.</p>`;
  }
}

async function toggleNotificaciones() {
  const estaAbierto = panelNotif.classList.toggle("abierto");
  if (estaAbierto) {
    await cargarNotificaciones();
    // Marcamos como leídas
    try {
      await apiFetch(`/api/foro/notificaciones/${USUARIO_ACTUAL.uid}/leer`, { method: "POST" });
      badgeNotif.style.display = "none";
    } catch { /* silencioso */ }
  }
}

// ── Eventos ──────────────────────────────────────────────────

btnPublicar.addEventListener("click", publicarHilo);
inputNuevoHilo.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); publicarHilo(); }
});
inputNuevoHilo.addEventListener("input", () => {
  contadorChars.textContent = `${inputNuevoHilo.value.length}/1000`;
});
btnNotif.addEventListener("click", toggleNotificaciones);

// Cerrar panel de notificaciones al hacer click fuera
document.addEventListener("click", (e) => {
  if (!e.target.closest(".notif-wrapper")) {
    panelNotif.classList.remove("abierto");
  }
});

// ── Inicializar ──────────────────────────────────────────────
(async () => {
  await window.cargarHilos();
  await window.offlineManager.solicitarPermisoNotificaciones();
  // Polleamos notificaciones cada 30 segundos
  setInterval(cargarNotificaciones, 30000);
  cargarNotificaciones();
})();
