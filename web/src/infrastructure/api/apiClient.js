const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
export class ApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
export const apiClient = async (path, init) => {
    const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            "content-type": "application/json",
            ...(init?.headers ?? {})
        }
    });
    if (!response.ok) {
        const body = (await response.json().catch(() => ({ error: "Error desconocido" })));
        throw new ApiError(body.error ?? "Error de API", response.status);
    }
    if (response.status === 204) {
        return undefined;
    }
    return (await response.json());
};
