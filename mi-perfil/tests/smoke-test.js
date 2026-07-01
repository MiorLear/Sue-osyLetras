const { spawn } = require("child_process");

const TEST_PORT = Number(process.env.TEST_PORT) || 3100;
const BASE_URL = `http://localhost:${TEST_PORT}`;

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("El servidor no inicio a tiempo."));
    }, 5000);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();

      if (text.includes(BASE_URL)) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
  });
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || `Fallo HTTP ${response.status}`);
  }

  return payload;
}

async function run() {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORT)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child);

    const profileResponse = await requestJson("/api/profile");

    if (!profileResponse.ok || !profileResponse.profile || !("fullName" in profileResponse.profile)) {
      throw new Error("La API de perfil no devolvio un perfil valido.");
    }

    const logoutResponse = await requestJson("/api/logout", { method: "POST" });

    if (!logoutResponse.ok) {
      throw new Error("La API de logout no respondio correctamente.");
    }

    console.log("Smoke test correcto: perfil y logout responden bien.");
  } finally {
    child.kill();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
