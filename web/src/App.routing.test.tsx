import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  authed: false,
  user: null as { role: string; name: string } | null,
  profileResolved: true,
}));
vi.mock("./context/AuthContext", () => ({ useAuth: () => auth }));

// Cada pantalla es un rótulo: aquí solo importa a cuál se llega. vi.mock se
// eleva por encima de todo, así que el rótulo va en vi.hoisted.
const stub = vi.hoisted(() => (name: string) => async () => {
  const { useLocation } =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    default: function Stub() {
      const from = (useLocation().state as { from?: string } | null)?.from;
      return <p>{`pantalla:${name}${from ? ` desde:${from}` : ""}`}</p>;
    },
  };
});
vi.mock("./routes/Onboarding", stub("onboarding"));
vi.mock("./routes/Login", stub("login"));
vi.mock("./routes/Register", stub("register"));
vi.mock("./routes/ForgotPassword", stub("forgot"));
vi.mock("./routes/PendingApproval", stub("pendiente"));
vi.mock("./routes/Main", stub("main"));
vi.mock("./routes/Emociones", stub("emociones"));
vi.mock("./routes/EmotionDetail", stub("emocion"));
vi.mock("./routes/Herramientas", stub("herramientas"));
vi.mock("./routes/Aprendiendo", stub("aprendiendo"));
vi.mock("./routes/AprendiendoTema", stub("tema"));
vi.mock("./routes/Comunidad", stub("comunidad"));
vi.mock("./routes/Calendar", stub("calendar"));
vi.mock("./routes/Descargas", stub("descargas"));
vi.mock("./routes/Profile", stub("profile"));
vi.mock("./routes/Sobre", stub("sobre"));
vi.mock("./routes/SyncProblemas", stub("sync"));
vi.mock("./routes/admin/AdminDashboard", stub("admin"));
vi.mock("./routes/admin/AdminUsuarios", stub("admin-usuarios"));
vi.mock("./routes/admin/AdminEmociones", stub("admin-emociones"));
vi.mock("./routes/admin/AdminHerramientas", stub("admin-herramientas"));
vi.mock("./routes/admin/AdminAprendiendo", stub("admin-aprendiendo"));
vi.mock("./routes/admin/AdminIntroVideos", stub("admin-videos"));
vi.mock("./components/TabsLayout", () => ({ TabsLayout: () => <Outlet /> }));
vi.mock("./components/OfflineBanner", () => ({ OfflineBanner: () => null }));

import { App } from "./App";

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => {
  auth.authed = false;
  auth.user = null;
});
afterEach(cleanup);

describe("<App /> · a dónde lleva cada ruta", () => {
  it("sin sesión, una pantalla interna lleva a /login recordando a dónde iba", async () => {
    at("/aprendiendo/practicar-autocuidado?fase=cuerpo");
    expect(
      await screen.findByText(
        "pantalla:login desde:/aprendiendo/practicar-autocuidado?fase=cuerpo",
      ),
    ).toBeTruthy();
  });

  it("sin sesión, el CMS también lleva a /login y no a la bienvenida", async () => {
    at("/admin/usuarios");
    expect(
      await screen.findByText("pantalla:login desde:/admin/usuarios"),
    ).toBeTruthy();
  });

  it("sin sesión, la raíz sigue siendo la bienvenida", async () => {
    at("/");
    expect(await screen.findByText("pantalla:onboarding")).toBeTruthy();
  });

  it("con sesión, la raíz entra directo a Inicio", async () => {
    auth.authed = true;
    auth.user = { role: "teacher", name: "Ana" };
    at("/");
    expect(await screen.findByText("pantalla:main")).toBeTruthy();
  });

  it("con sesión de admin, la raíz entra al panel", async () => {
    auth.authed = true;
    auth.user = { role: "admin", name: "Sofía" };
    at("/");
    expect(await screen.findByText("pantalla:admin")).toBeTruthy();
  });

  it("con sesión, una URL mal escrita lleva a Inicio", async () => {
    auth.authed = true;
    auth.user = { role: "teacher", name: "Ana" };
    at("/emocionez");
    expect(await screen.findByText("pantalla:main")).toBeTruthy();
  });

  it("sin sesión, una URL mal escrita lleva a la bienvenida", async () => {
    at("/emocionez");
    expect(await screen.findByText("pantalla:onboarding")).toBeTruthy();
  });
});
