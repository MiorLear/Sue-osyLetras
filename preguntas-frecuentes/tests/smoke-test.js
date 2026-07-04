const { spawn } = require("child_process");

const TEST_PORT = Number(process.env.TEST_PORT) || 3101;
const BASE_URL = `http://localhost:${TEST_PORT}`;

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("El servidor no inició a tiempo.")), 5000);
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes(BASE_URL)) { clearTimeout(timeout); resolve(); }
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  });
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" }, ...options,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`);
  return payload;
}

async function run() {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(child);

    const faqsResponse = await requestJson("/api/faqs");
    if (!faqsResponse.ok || !Array.isArray(faqsResponse.faqs) || faqsResponse.faqs.length === 0) {
      throw new Error("El endpoint /api/faqs no devolvió preguntas válidas.");
    }
    console.log(`✔ /api/faqs devolvió ${faqsResponse.faqs.length} preguntas correctamente.`);

    const chatResponse = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta: "¿Cómo accedo a los módulos?" }),
    });
    if (chatResponse.status !== 503 && chatResponse.status !== 200) {
      throw new Error(`/api/chat respondió con status inesperado: ${chatResponse.status}`);
    }
    console.log("✔ /api/chat responde correctamente.");

    const emptyResponse = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta: "" }),
    });
    if (emptyResponse.status !== 422) throw new Error("Debería rechazar preguntas vacías con 422.");
    console.log("✔ Validación de pregunta vacía funciona correctamente.");

    console.log("\nSmoke test correcto: todos los endpoints responden bien.");
  } finally {
    child.kill();
  }
}

run().catch((error) => { console.error("Smoke test falló:", error.message); process.exit(1); });
