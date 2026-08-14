import { createBrowserRouter, Outlet } from "react-router";
import { HomeScreen }           from "./screens/HomeScreen";
import { ModuleScreen }         from "./screens/ModuleScreen";
import { ModulesScreen }        from "./screens/ModulesScreen";
import { RegisterScreen }       from "./screens/RegisterScreen";
import { LoginScreen }          from "./screens/LoginScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";
import { ProfileScreen }        from "./screens/ProfileScreen";
import { FAQScreen }            from "./screens/FAQScreen";
import { ForoScreen }           from "./screens/ForoScreen";
import { CalendarScreen }       from "./screens/CalendarScreen";
import { Toaster }              from "./components/ui/sonner";

function Root() {
  return (
    <div
      className="min-h-screen bg-[#D4F0EE] flex justify-center items-start"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      <div className="w-full max-w-sm min-h-screen flex flex-col bg-[#F5FEFE] relative shadow-2xl overflow-hidden">
        <Outlet />
      </div>
      <Toaster />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-6 min-h-screen">
      <div>
        <p style={{ fontSize: "3rem" }}>🔍</p>
        <p style={{ fontSize: "1rem", fontWeight: 700, color: "#1A3A38", marginTop: "8px" }}>
          Página no encontrada
        </p>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true,                  Component: HomeScreen           },
      { path: "module/:name",         Component: ModuleScreen         },
      { path: "modules",              Component: ModulesScreen        },
      { path: "register",             Component: RegisterScreen       },
      { path: "login",                Component: LoginScreen          },
      { path: "forgot-password",      Component: ForgotPasswordScreen },
      { path: "profile",              Component: ProfileScreen        },
      { path: "faq",                  Component: FAQScreen            },
      { path: "foro",                 Component: ForoScreen           },
      { path: "calendar",             Component: CalendarScreen       },
      { path: "*",                    Component: NotFound             },
    ],
  },
]);
