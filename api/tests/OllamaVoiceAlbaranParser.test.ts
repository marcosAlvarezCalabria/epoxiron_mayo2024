import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainException } from "../src/domain/exceptions/DomainException.js";
import { OllamaVoiceAlbaranParser } from "../src/infrastructure/services/OllamaVoiceAlbaranParser.js";

describe("OllamaVoiceAlbaranParser", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses a valid ollama response", async () => {
    const parser = new OllamaVoiceAlbaranParser({
      apiKey: "ollama-key",
      baseUrl: "http://127.0.0.1:11434",
      fetchImpl: fetch,
      model: "llama3.1:8b",
      timeoutMs: 1000
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              customerName: "Cliente Dos",
              date: "2026-06-11",
              notes: null,
              items: [
                {
                  description: "puerta",
                  color: "RAL 9005",
                  texture: "mate",
                  linearMeters: null,
                  squareMeters: 8,
                  thickness: null,
                  primer: false,
                  quantity: 1
                }
              ]
            })
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    await expect(parser.parseTranscript("puerta negra mate")).resolves.toEqual({
      customerName: "CLIENTE DOS",
      date: "2026-06-11",
      notes: null,
      items: [
        {
          description: "PUERTA",
          color: "RAL 9005",
          pricingMode: "DIMENSIONS",
          customUnitPrice: null,
          texture: "MATE",
          linearMeters: null,
          squareMeters: 8,
          thickness: null,
          primer: false,
          quantity: 1
        }
      ]
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/chat",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ollama-key"
        })
      })
    );
  });

  it("returns 422 when ollama sends invalid json", async () => {
    const parser = new OllamaVoiceAlbaranParser({
      apiKey: "ollama-key",
      baseUrl: "http://127.0.0.1:11434",
      fetchImpl: fetch,
      model: "llama3.1:8b",
      timeoutMs: 1000
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            content: "esto no es json"
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    await expect(parser.parseTranscript("texto raro")).rejects.toSatisfy((error) =>
      error instanceof DomainException &&
      error.statusCode === 422 &&
      error.message.startsWith("No se pudo interpretar el texto")
    );
  });

  it("returns 502 when ollama is unavailable", async () => {
    const parser = new OllamaVoiceAlbaranParser({
      apiKey: "ollama-key",
      baseUrl: "http://127.0.0.1:11434",
      fetchImpl: fetch,
      model: "llama3.1:8b",
      timeoutMs: 1000
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response("upstream error", {
        status: 500
      })
    );

    await expect(parser.parseTranscript("cliente x")).rejects.toMatchObject({
      message: "Servicio de voz no disponible (500)",
      statusCode: 502
    });
  });
});
