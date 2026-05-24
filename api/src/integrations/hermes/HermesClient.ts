import { env } from "../../config/env.js";
import type {
  HermesConversation,
  HermesSessionResponse,
  HermesTask
} from "./types.js";

type HttpMethod = "GET" | "POST";

export class HermesClient {
  private async request<T>(
    path: string,
    method: HttpMethod,
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(new URL(path, env.HERMES_BASE_URL), {
      method,
      headers: {
        "content-type": "application/json",
        "x-epoxiron-hermes-secret": env.HERMES_SHARED_SECRET
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(env.HERMES_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error("Hermes no está disponible");
    }

    return (await response.json()) as T;
  }

  public async createSession() {
    return this.request<HermesSessionResponse>("/sessions", "POST");
  }

  public async getSession(sessionId: string) {
    return this.request<HermesConversation>(`/sessions/${sessionId}`, "GET");
  }

  public async sendMessage(sessionId: string, content: string) {
    return this.request<HermesConversation>(`/sessions/${sessionId}/messages`, "POST", { content });
  }

  public async confirmProposal(proposalId: string) {
    return this.request<{ status: string; result?: unknown }>(`/proposals/${proposalId}/confirm`, "POST");
  }

  public async rejectProposal(proposalId: string) {
    return this.request<{ status: string }>(`/proposals/${proposalId}/reject`, "POST");
  }

  public async listTasks() {
    return this.request<{ tasks: HermesTask[] }>("/tasks", "GET");
  }
}
