import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/customers", label: "Clientes" },
  { to: "/delivery-notes", label: "Albaranes" }
];

export const Layout = () => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_35%),linear-gradient(180deg,_#111827_0%,_#0f172a_100%)]">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-100">Epoxiron</h1>
            <p className="text-sm text-gray-400">Taller de pintura industrial</p>
          </div>
          <nav className="flex gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                    isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};
