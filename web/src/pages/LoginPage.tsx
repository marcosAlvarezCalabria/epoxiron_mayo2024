import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authService } from "@/services/auth.service";

interface LocationState {
  from?: {
    pathname?: string;
    search?: string;
  };
}

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = `${(location.state as LocationState | null)?.from?.pathname ?? "/"}${
    (location.state as LocationState | null)?.from?.search ?? ""
  }`;

  useEffect(() => {
    const handleCredential = async (credential: string | undefined) => {
      if (!credential) {
        setErrorMessage("Google no devolvio un token valido.");
        return;
      }

      try {
        setIsSubmitting(true);
        setErrorMessage(null);
        const session = await authService.loginWithGoogle(credential);
        authService.saveSession(session);
        navigate(nextPath, { replace: true });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No tienes acceso autorizado."
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    const renderGoogleButton = () => {
      if (!buttonContainerRef.current || !window.google?.accounts.id) {
        return;
      }

      buttonContainerRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: ({ credential }) => {
          void handleCredential(credential);
        }
      });
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        theme: "outline",
        size: "large",
        width: Math.min(buttonContainerRef.current.clientWidth, 320)
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existingScript) {
      if (window.google?.accounts.id) {
        renderGoogleButton();
        return;
      }

      existingScript.addEventListener("load", renderGoogleButton);
      return () => {
        existingScript.removeEventListener("load", renderGoogleButton);
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      renderGoogleButton();
    };
    script.onerror = () => {
      setErrorMessage("No se pudo cargar Google Sign-In.");
    };
    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [navigate, nextPath]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#3a2a11_0%,#151413_40%,#0b0b0b_100%)] px-4 py-8 text-[var(--epx-text)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <section className="w-full rounded-[28px] border border-[var(--epx-surface-raised)] bg-[color:rgb(22_22_22_/_0.94)] p-8 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--epx-text-muted)]">
            Epoxiron
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            Acceso del taller
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--epx-text-muted)]">
            Solo el personal autorizado puede entrar al panel y operar con albaranes,
            clientes y reportes.
          </p>

          <div className="mt-8 flex flex-col gap-4">
            <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-4">
              <div ref={buttonContainerRef} />
            </div>

            <p className="text-xs text-[var(--epx-text-muted)]">
              Usa tu cuenta corporativa o una cuenta incluida en la lista de acceso.
            </p>
            {isSubmitting ? (
              <p className="text-sm font-medium text-[var(--epx-accent)]">
                Validando acceso...
              </p>
            ) : null}
            {errorMessage ? (
              <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
};
