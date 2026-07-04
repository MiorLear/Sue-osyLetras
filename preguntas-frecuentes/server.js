const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT) || 3001;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const FAQS_FILE = path.join(ROOT_DIR, "data", "faqs.json");

// ── Archivos estáticos permitidos ────────────────────────────
const staticFiles = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", type: "application/javascript; charset=utf-8" },
};

// ── Helpers de respuesta ─────────────────────────────────────

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { ok: false, message });
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

// ── Cargar FAQs ──────────────────────────────────────────────

async function loadFaqs() {
  const text = await fs.readFile(FAQS_FILE, "utf8");
  return JSON.parse(text);
}

// ─────────────────────────────────────────────────────────────
// Convierte cualquier tipo de respuesta en texto
// ─────────────────────────────────────────────────────────────

function obtenerTextoRespuesta(respuesta) {
  if (typeof respuesta === "string") {
    return respuesta;
  }

  if (
    respuesta &&
    respuesta.tipo === "secciones" &&
    Array.isArray(respuesta.contenido)
  ) {
    return respuesta.contenido
      .map((item) => `${item.titulo}\n${item.texto}`)
      .join("\n\n");
  }

  return "";
}

// ── Motor de búsqueda propio ─────────────────────────────────

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function calcularPuntaje(preguntaUsuario, faq) {
  const palabrasUsuario = normalizarTexto(preguntaUsuario)
    .split(/\s+/)
    .filter((p) => p.length > 2);

  const textoFaq = normalizarTexto(
    `${faq.pregunta} ${obtenerTextoRespuesta(faq.respuesta)}`
  );

  let puntaje = 0;

  for (const palabra of palabrasUsuario) {
    if (textoFaq.includes(palabra)) {
      puntaje++;
    }
  }

  return puntaje;
}

function buscarRespuesta(preguntaUsuario, faqs) {
  const resultados = faqs
    .map((faq) => ({
      faq,
      puntaje: calcularPuntaje(preguntaUsuario, faq),
    }))
    .filter((r) => r.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje);

  if (resultados.length === 0) return null;

  return resultados[0].faq;
}

// ── Respuestas genéricas ─────────────────────────────────────

const respuestasNoEncontrado = [
  "No encontré información sobre eso en ExplorArte. ¿Podés reformular tu pregunta? Puedo ayudarte con temas como módulos, materiales, perfil o el foro.",
  "Esa consulta está fuera de lo que manejo sobre ExplorArte. Intentá preguntar sobre los módulos, tu perfil, el foro o los materiales disponibles.",
  "No tengo información sobre ese tema. Si es una duda técnica específica, podés contactar a tu coordinadora o al equipo de soporte.",
];

function respuestaAleatoria(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Servir archivos estáticos ────────────────────────────────

async function serveStaticFile(request, response) {
  const route = staticFiles[request.url];

  if (!route) return false;

  const content = await fs.readFile(path.join(PUBLIC_DIR, route.file));

  response.writeHead(200, {
    "Content-Type": route.type,
    "Cache-Control": "no-store",
  });

  response.end(content);

  return true;
}

// ── API ──────────────────────────────────────────────────────

async function handleApi(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });

    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/api/faqs") {
    const faqs = await loadFaqs();

    sendJson(response, 200, {
      ok: true,
      faqs,
    });

    return;
  }

  if (request.method === "POST" && request.url === "/api/chat") {
    const body = await readBody(request);

    if (
      !body.pregunta ||
      typeof body.pregunta !== "string" ||
      body.pregunta.trim().length === 0
    ) {
      sendError(response, 422, "Escribí una pregunta antes de enviar.");
      return;
    }

    if (body.pregunta.trim().length > 500) {
      sendError(
        response,
        422,
        "La pregunta es demasiado larga. Máximo 500 caracteres."
      );
      return;
    }

    const faqs = await loadFaqs();
    const resultado = buscarRespuesta(body.pregunta, faqs);

    let respuesta;

    if (resultado) {
      respuesta = obtenerTextoRespuesta(resultado.respuesta);
    } else {
      respuesta = respuestaAleatoria(respuestasNoEncontrado);
    }

    sendJson(response, 200, {
      ok: true,
      respuesta,
    });

    return;
  }

  sendError(response, 404, "Ruta de API no encontrada.");
}

// ── Servidor ─────────────────────────────────────────────────

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/")) {
      await handleApi(request, response);
      return;
    }

    const served = await serveStaticFile(request, response);

    if (!served) {
      sendError(response, 404, "Página no encontrada.");
    }
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Ocurrió un error inesperado en el servidor.");
  }
});

server.listen(PORT, () => {
  console.log(
    `Preguntas Frecuentes — ExplorArte corriendo en http://localhost:${PORT}`
  );
});