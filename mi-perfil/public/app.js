const form = document.querySelector("#profileForm");
const statusMessage = document.querySelector("#statusMessage");
const avatarPreview = document.querySelector("#avatarPreview");
const avatarInitials = document.querySelector("#avatarInitials");
const avatarInput = document.querySelector("#avatarInput");
const lastUpdated = document.querySelector("#lastUpdated");
const logoutButton = document.querySelector("#logoutButton");

// Mapa de campos para no repetir querySelector cada vez que leemos o pintamos datos.
const fields = {
  fullName: document.querySelector("#fullName"),
  email: document.querySelector("#email"),
  phone: document.querySelector("#phone"),
  role: document.querySelector("#role"),
  location: document.querySelector("#location"),
  bio: document.querySelector("#bio")
};

const emptyProfile = {
  fullName: "",
  email: "",
  phone: "",
  role: "",
  location: "",
  bio: "",
  avatar: "",
  updatedAt: null
};

function showStatus(message, type = "success") {
  // Un solo punto para mostrar mensajes de exito o error en la pantalla.
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function clearStatus() {
  statusMessage.textContent = "";
  statusMessage.className = "status-message";
}

function getInitials(fullName) {
  // Convierte "Rosa Valdez" en "RV" para usarlo cuando no hay foto.
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function formatDate(value) {
  if (!value) {
    return "Sin cambios guardados";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin cambios guardados";
  }

  return new Intl.DateTimeFormat("es-SV", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function renderProfile(profile) {
  // Esta funcion mantiene sincronizada la respuesta del backend con la UI.
  fields.fullName.value = profile.fullName;
  fields.email.value = profile.email;
  fields.phone.value = profile.phone;
  fields.role.value = profile.role;
  fields.location.value = profile.location;
  fields.bio.value = profile.bio || "";

  avatarInitials.textContent = getInitials(profile.fullName) || "MP";
  lastUpdated.textContent = `Ultima actualizacion: ${formatDate(profile.updatedAt)}`;

  if (profile.avatar) {
    avatarPreview.src = profile.avatar;
    avatarPreview.classList.add("has-image");
  } else {
    avatarPreview.removeAttribute("src");
    avatarPreview.classList.remove("has-image");
  }
}

async function requestJson(url, options = {}) {
  // Wrapper pequeno sobre fetch para manejar JSON y errores de forma consistente.
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json();

  if (!response.ok) {
    throw payload;
  }

  return payload;
}

function buildProfilePayload() {
  // Solo enviamos los campos que el usuario puede editar desde esta pantalla.
  return {
    fullName: fields.fullName.value,
    email: fields.email.value,
    phone: fields.phone.value,
    role: fields.role.value,
    location: fields.location.value,
    bio: fields.bio.value
  };
}

function readFileAsDataUrl(file) {
  // El ejemplo guarda la imagen como Data URL para evitar dependencias de subida de archivos.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

async function loadProfile() {
  // Carga inicial al abrir la pantalla.
  clearStatus();

  if (window.location.protocol === "file:") {
    renderProfile(emptyProfile);
    showStatus("Vista cargada sin backend. Para guardar cambios, abre la app con npm start.", "error");
    return;
  }

  try {
    const payload = await requestJson("/api/profile");
    renderProfile(payload.profile);
  } catch (error) {
    showStatus("No se pudo cargar la informacion del perfil.", "error");
  }
}

async function saveProfile(event) {
  // Guardado principal: valida en backend y actualiza lo que se ve si todo sale bien.
  event.preventDefault();
  clearStatus();

  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    const payload = await requestJson("/api/profile", {
      method: "PUT",
      body: JSON.stringify(buildProfilePayload())
    });

    renderProfile(payload.profile);
    showStatus("Cambios guardados correctamente.");
  } catch (error) {
    const message = error.message || "No se pudieron guardar los cambios.";
    showStatus(message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function updateAvatar() {
  // Cambio independiente de imagen para que no obligue a guardar todo el formulario.
  clearStatus();

  const file = avatarInput.files[0];
  if (!file) {
    return;
  }

  try {
    const avatar = await readFileAsDataUrl(file);
    const payload = await requestJson("/api/profile/avatar", {
      method: "PATCH",
      body: JSON.stringify({ avatar })
    });

    renderProfile(payload.profile);
    showStatus("Imagen de perfil actualizada.");
  } catch (error) {
    const message = error.message || "No se pudo actualizar la imagen.";
    showStatus(message, "error");
  } finally {
    avatarInput.value = "";
  }
}

async function logout() {
  // Endpoint listo para sustituirse por invalidacion real de token/cookie mas adelante.
  clearStatus();

  try {
    const payload = await requestJson("/api/logout", { method: "POST" });
    showStatus(payload.message);
  } catch (error) {
    showStatus("No se pudo cerrar sesion.", "error");
  }
}

form.addEventListener("submit", saveProfile);
avatarInput.addEventListener("change", updateAvatar);
logoutButton.addEventListener("click", logout);

loadProfile();
