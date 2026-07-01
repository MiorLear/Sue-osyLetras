const { spawn } = require("child_process");

const TEST_PORT = Number(process.env.TEST_PORT) || 3102;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const HEADERS = {
  "Content-Type": "application/json",
  "X-User-Uid": "test-uid",
  "X-User-Nombre": "Test Maestra",
  "X-User-Rol": "maestra",
};

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Servidor no inició.")), 5000);
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes(BASE_URL)) { clearTimeout(timeout); resolve(); }
    });
    child.stderr.on("data", (c) => process.stderr.write(c));
  });
}

async function req(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: HEADERS, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return { data, status: res.status };
}

async function run() {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(child);

    // 1. GET hilos
    const { data: hilosData } = await req("/api/foro/hilos");
    if (!hilosData.ok || !Array.isArray(hilosData.hilos)) throw new Error("GET /hilos falló.");
    console.log(`✔ GET /hilos devolvió ${hilosData.hilos.length} hilos.`);

    // 2. POST crear hilo
    const { data: nuevoHilo, status } = await req("/api/foro/hilos", {
      method: "POST",
      body: JSON.stringify({ texto: "Hilo de prueba del smoke test." }),
    });
    if (status !== 201 || !nuevoHilo.hilo?.id) throw new Error("POST /hilos falló.");
    const hiloId = nuevoHilo.hilo.id;
    console.log(`✔ POST /hilos creó hilo con id: ${hiloId}`);

    // 3. POST comentario
    const { data: comData } = await req(`/api/foro/hilos/${hiloId}/comentarios`, {
      method: "POST",
      body: JSON.stringify({ texto: "Comentario de prueba." }),
    });
    if (!comData.comentario?.id) throw new Error("POST /comentarios falló.");
    const comId = comData.comentario.id;
    console.log(`✔ POST /comentarios creó comentario con id: ${comId}`);

    // 4. POST reacción
    const { data: reacData } = await req(`/api/foro/hilos/${hiloId}/reacciones`, {
      method: "POST",
      body: JSON.stringify({ tipo: "me_gusta" }),
    });
    if (!reacData.reacciones) throw new Error("POST /reacciones falló.");
    console.log(`✔ POST /reacciones → me_gusta: ${reacData.reacciones.me_gusta}`);

    // 5. GET notificaciones
    const { data: notifData } = await req("/api/foro/notificaciones/test-uid");
    if (!notifData.ok) throw new Error("GET /notificaciones falló.");
    console.log(`✔ GET /notificaciones → ${notifData.noLeidas} no leídas.`);

    // 6. POST sync offline (vacío)
    const emptySync = await fetch(`${BASE_URL}/api/foro/sync`, {
      method: "POST", headers: HEADERS, body: JSON.stringify({ acciones: [] }),
    });
    if (emptySync.status !== 422) throw new Error("Sync vacío debería dar 422.");
    console.log(`✔ POST /sync rechaza payload vacío correctamente.`);

    // 7. DELETE comentario
    await req(`/api/foro/hilos/${hiloId}/comentarios/${comId}`, { method: "DELETE" });
    console.log(`✔ DELETE /comentarios eliminó correctamente.`);

    // 8. DELETE hilo
    await req(`/api/foro/hilos/${hiloId}`, { method: "DELETE" });
    console.log(`✔ DELETE /hilos eliminó correctamente.`);

    console.log("\n✅ Smoke test completo: todos los endpoints del foro funcionan.");
  } finally {
    child.kill();
  }
}

run().catch((err) => { console.error("❌ Smoke test falló:", err.message); process.exit(1); });
