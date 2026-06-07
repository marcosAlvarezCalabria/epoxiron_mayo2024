const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const tokenStorageKey = "epoxiron_token";
const userStorageKey = "epoxiron_user";

interface LoginResponse {
  token: string;
  email: string;
  name: string;
}

interface AuthenticatedUser {
  email: string;
  name: string;
}

export const authService = {
  async loginWithGoogle(credential: string): Promise<LoginResponse> {
    const response = await fetch(`${API_URL}/api/auth/login/google`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ credential })
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ error: "Login fallido" }))) as {
        error?: string;
      };
      throw new Error(body.error ?? "Login fallido");
    }

    return (await response.json()) as LoginResponse;
  },

  getToken(): string | null {
    return sessionStorage.getItem(tokenStorageKey);
  },

  getUser(): AuthenticatedUser | null {
    const rawUser = sessionStorage.getItem(userStorageKey);
    if (!rawUser) {
      return null;
    }

    try {
      return JSON.parse(rawUser) as AuthenticatedUser;
    } catch {
      sessionStorage.removeItem(userStorageKey);
      return null;
    }
  },

  saveSession(session: LoginResponse) {
    sessionStorage.setItem(tokenStorageKey, session.token);
    sessionStorage.setItem(
      userStorageKey,
      JSON.stringify({
        email: session.email,
        name: session.name
      })
    );
  },

  clearSession() {
    sessionStorage.removeItem(tokenStorageKey);
    sessionStorage.removeItem(userStorageKey);
  },

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }
};
