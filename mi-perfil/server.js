const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_FILE = path.join(ROOT_DIR, "data", "profile.json");

// Rutas permitidas para servir archivos estaticos del frontend.
// Mantener esta lista evita que alguien pida archivos fuera de /public.
const staticFiles = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", type: "application/javascript; charset=utf-8" }
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendError(response, statusCode, message, details = null) {
  sendJson(response, statusCode, {
    ok: false,
    message,
    details
  });
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

async function loadProfile() {
  const profileText = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(profileText);
}

async function saveProfile(profile) {
  const nextProfile = {
    ...profile,
    updatedAt: new Date().toISOString()
  };

  // Escribimos primero a un temporal y despues reemplazamos el archivo real.
  // Asi evitamos dejar datos incompletos si algo falla a mitad de guardado.
  const tempFile = `${DATA_FILE}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(nextProfile, null, 2), "utf8");
  await fs.rename(tempFile, DATA_FILE);

  return nextProfile;
}

function validateProfileInput(input) {
  const errors = {};

  if (!input.fullName || input.fullName.trim().length < 3) {
    errors.fullName = "El nombre debe tener al menos 3 caracteres.";
  }

  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = "Ingresa un correo valido.";
  }

  if (!input.phone || input.phone.trim().length < 8) {
    errors.phone = "Ingresa un telefono valido.";
  }

  if (!input.role || input.role.trim().length < 2) {
    errors.role = "Ingresa un tipo de usuario o rol.";
  }

  if (!input.location || input.location.trim().length < 2) {
    errors.location = "Ingresa una ubicacion.";
  }

  if (input.bio && input.bio.length > 240) {
    errors.bio = "La descripcion no debe pasar de 240 caracteres.";
  }

  return errors;
}

function cleanProfileInput(input, currentProfile) {
  return {
    id: currentProfile.id,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    role: input.role.trim(),
    location: input.location.trim(),
    bio: (input.bio || "").trim(),
    avatar: currentProfile.avatar,
    updatedAt: currentProfile.updatedAt
  };
}

function validateAvatar(input) {
  if (!input.avatar || typeof input.avatar !== "string") {
    return "Selecciona una imagen para actualizar el perfil.";
  }

  if (!input.avatar.startsWith("data:image/")) {
    return "La imagen debe enviarse como Data URL de tipo imagen.";
  }

  // Este limite mantiene el ejemplo simple y evita guardar imagenes enormes en JSON.
  if (input.avatar.length > 600000) {
    return "La imagen es demasiado grande. Prueba con una menor a 450 KB.";
  }

  return null;
}

async function serveStaticFile(request, response) {
  const route = staticFiles[request.url];

  if (!route) {
    return false;
  }

  const filePath = path.join(PUBLIC_DIR, route.file);
  const content = await fs.readFile(filePath);

  response.writeHead(200, {
    "Content-Type": route.type,
    "Cache-Control": "no-store"
  });
  response.end(content);
  return true;
}

async function handleApi(request, response) {
  if (request.method === "GET" && request.url === "/api/profile") {
    const profile = await loadProfile();
    sendJson(response, 200, { ok: true, profile });
    return;
  }

  if (request.method === "PUT" && request.url === "/api/profile") {
    const body = await readBody(request);
    const currentProfile = await loadProfile();
    const errors = validateProfileInput(body);

    if (Object.keys(errors).length > 0) {
      sendError(response, 422, "Revisa los campos marcados.", errors);
      return;
    }

    const profileToSave = cleanProfileInput(body, currentProfile);
    const savedProfile = await saveProfile(profileToSave);
    sendJson(response, 200, { ok: true, profile: savedProfile });
    return;
  }

  if (request.method === "PATCH" && request.url === "/api/profile/avatar") {
    const body = await readBody(request);
    const avatarError = validateAvatar(body);

    if (avatarError) {
      sendError(response, 422, avatarError);
      return;
    }

    const profile = await loadProfile();
    const savedProfile = await saveProfile({ ...profile, avatar: body.avatar });
    sendJson(response, 200, { ok: true, profile: savedProfile });
    return;
  }

  if (request.method === "POST" && request.url === "/api/logout") {
    // En una app real aqui se invalidaria el token o la cookie de sesion.
    // Para este modulo dejamos la respuesta lista para conectarla despues.
    sendJson(response, 200, {
      ok: true,
      message: "Sesion cerrada correctamente."
    });
    return;
  }

  sendError(response, 404, "Ruta de API no encontrada.");
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/")) {
      await handleApi(request, response);
      return;
    }

    const served = await serveStaticFile(request, response);
    if (!served) {
      sendError(response, 404, "Pagina no encontrada.");
    }
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Ocurrio un error inesperado en el servidor.");
  }
});

server.listen(PORT, () => {
  console.log(`Mi Perfil app corriendo en http://localhost:${PORT}`);
});
