import clsx from "clsx";
import {
  ArchiveBoxIcon,
  BuildingOffice2Icon,
  HomeIcon
} from "@heroicons/react/24/outline";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authService } from "@/services/auth.service";

const navItems = [
  { to: "/", label: "Hoy", icon: HomeIcon },
  { to: "/delivery-notes", label: "Albaranes", icon: ArchiveBoxIcon },
  { to: "/customers", label: "Clientes", icon: BuildingOffice2Icon }
];

export const Layout = () => {
  const navigate = useNavigate();
  const user = authService.getUser();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--epx-bg)] text-[var(--epx-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--epx-surface-raised)] bg-[color:rgb(28_27_27_/_0.96)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--epx-text-muted)]">
              Epoxiron
            </p>
            <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
              Gestion del taller
            </h1>
            {user ? (
              <p className="mt-2 truncate text-xs text-[var(--epx-text-muted)]">
                {user.name} · {user.email}
              </p>
            ) : null}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <nav className="flex items-center gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "border border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.16)] text-white"
                        : "text-[var(--epx-text-muted)] hover:bg-[var(--epx-surface)] hover:text-white"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button
              className="rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-[var(--epx-accent)]/40 hover:text-[var(--epx-accent)]"
              onClick={() => {
                authService.clearSession();
                navigate("/login", { replace: true });
              }}
              type="button"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl overflow-x-hidden px-4 pb-24 pt-6 sm:px-6 md:pb-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--epx-surface-raised)] bg-[color:rgb(28_27_27_/_0.98)] px-3 py-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-3 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    "flex flex-col items-center justify-center rounded-xl px-2 py-3 text-[11px] font-medium transition-colors",
                    isActive
                      ? "bg-[color:rgb(255_149_0_/_0.16)] text-white"
                      : "text-[var(--epx-text-muted)] hover:bg-[var(--epx-surface)] hover:text-white"
                  )
                }
              >
                <Icon className="mb-1 h-5 w-5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
