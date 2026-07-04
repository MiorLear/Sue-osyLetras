// app.js — Preguntas Frecuentes | ExplorArte
// ─────────────────────────────────────────────────────────────
//  1. Carga las FAQs desde /api/faqs y las renderiza como acordeón.
//  2. Maneja el chat con el asistente de IA de ExplorArte.
// ─────────────────────────────────────────────────────────────

const faqList      = document.querySelector("#faqList");
const faqLoading   = document.querySelector("#faqLoading");
const chatMessages = document.querySelector("#chatMessages");
const chatInput    = document.querySelector("#chatInput");
const chatSendBtn  = document.querySelector("#chatSendBtn");
const chatStatus   = document.querySelector("#chatStatus");

// ── Helper fetch JSON ────────────────────────────────────────
async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) throw payload;
  return payload;
}

// ─────────────────────────────────────────────────────────────
//  SECCIÓN 1: Acordeón de preguntas frecuentes
// ─────────────────────────────────────────────────────────────

function crearItemFaq(faq) {
  const item = document.createElement("div");
  item.className = "faq-item";
  item.setAttribute("role", "listitem");

  const btn = document.createElement("button");
  btn.className = "faq-question";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", `respuesta-${faq.id}`);
  btn.innerHTML = `<span>${faq.pregunta}</span><span class="faq-arrow" aria-hidden="true">▼</span>`;

  const answer = document.createElement("div");
  answer.className = "faq-answer";
  answer.id = `respuesta-${faq.id}`;
  answer.setAttribute("role", "region");
  if (typeof faq.respuesta === "string") {
  answer.textContent = faq.respuesta;
} else if (faq.respuesta.tipo === "secciones") {
  faq.respuesta.contenido.forEach((item) => {
    const titulo = document.createElement("h4");
    titulo.textContent = item.titulo;
    titulo.style.margin = "12px 0 4px";
    titulo.style.fontWeight = "600";

    const texto = document.createElement("p");
    texto.textContent = item.texto;
    texto.style.margin = "0 0 12px";

    answer.appendChild(titulo);
    answer.appendChild(texto);
  });
}

  btn.addEventListener("click", () => {
    const estaAbierto = item.classList.contains("abierto");

    // Cerramos todos los demás primero
    document.querySelectorAll(".faq-item.abierto").forEach((otro) => {
      otro.classList.remove("abierto");
      otro.querySelector(".faq-question").setAttribute("aria-expanded", "false");
    });

    if (!estaAbierto) {
      item.classList.add("abierto");
      btn.setAttribute("aria-expanded", "true");
    }
  });

  item.appendChild(btn);
  item.appendChild(answer);
  return item;
}

async function cargarFaqs() {
  try {
    const payload = await requestJson("/api/faqs");
    if (faqLoading) faqLoading.remove();
    payload.faqs.forEach((faq) => faqList.appendChild(crearItemFaq(faq)));
  } catch (error) {
    if (faqLoading) faqLoading.textContent = "No se pudieron cargar las preguntas. Intentá recargar la página.";
  }
}

// ─────────────────────────────────────────────────────────────
//  SECCIÓN 2: Chat con asistente
// ─────────────────────────────────────────────────────────────

function agregarBurbuja(texto, tipo) {
  const burbuja = document.createElement("div");
  burbuja.className = `chat-bubble ${tipo}`;
  burbuja.textContent = texto;
  chatMessages.appendChild(burbuja);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return burbuja;
}

function limpiarStatus() {
  chatStatus.textContent = "";
}

async function enviarPregunta() {
  const pregunta = chatInput.value.trim();
  if (!pregunta) return;

  limpiarStatus();
  agregarBurbuja(pregunta, "usuario");
  chatInput.value = "";
  chatSendBtn.disabled = true;
  chatInput.disabled = true;

  const burbujaEscribiendo = agregarBurbuja("Escribiendo...", "escribiendo");

  try {
    const payload = await requestJson("/api/chat", {
      method: "POST",
      body: JSON.stringify({ pregunta }),
    });
    burbujaEscribiendo.remove();
    agregarBurbuja(payload.respuesta, "asistente");
  } catch (error) {
    burbujaEscribiendo.remove();
    chatStatus.textContent = error.message || "No se pudo obtener una respuesta. Intentá de nuevo.";
  } finally {
    chatSendBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
}

chatSendBtn.addEventListener("click", enviarPregunta);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    enviarPregunta();
  }
});

cargarFaqs();
