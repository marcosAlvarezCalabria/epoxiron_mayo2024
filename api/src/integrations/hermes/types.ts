export interface HermesSessionResponse {
  sessionId: string;
  createdAt: string;
}

export interface HermesMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt?: string;
}

export interface HermesProposal {
  id: string;
  title: string;
  description: string;
  toolName: string;
  parameters: Record<string, unknown>;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "EXECUTED";
}

export interface HermesTask {
  id: string;
  title: string;
  summary: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  createdAt: string;
}

export interface HermesConversation {
  sessionId: string;
  messages: HermesMessage[];
  proposals: HermesProposal[];
}

