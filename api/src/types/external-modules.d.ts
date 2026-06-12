declare module "multer" {
  import type { RequestHandler } from "express";

  interface MulterFile {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
  }

  interface MulterMiddleware extends RequestHandler {
    single(fieldName: string): RequestHandler;
  }

  interface MulterFactory {
    (options?: unknown): MulterMiddleware;
    memoryStorage(): unknown;
  }

  const multer: MulterFactory;
  export default multer;
}

declare module "ollama" {
  export interface OllamaChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
  }

  export interface OllamaChatRequest {
    model: string;
    stream: boolean;
    format?: "json" | string;
    think?: boolean;
    options?: {
      temperature?: number;
    };
    messages: OllamaChatMessage[];
  }

  export interface OllamaChatResponse {
    message?: {
      content?: string;
    };
  }

  export interface OllamaClientOptions {
    host: string;
    headers?: Record<string, string>;
    fetch?: typeof fetch;
  }

  export class Ollama {
    public constructor(options: OllamaClientOptions);
    public chat(request: OllamaChatRequest): Promise<OllamaChatResponse>;
  }
}
