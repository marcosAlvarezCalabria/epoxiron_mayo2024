import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleVoiceAlbaranParser } from "../src/infrastructure/services/OpenAiCompatibleVoiceAlbaranParser.js";

const parser = new OpenAiCompatibleVoiceAlbaranParser({
  apiKey: "openai-key",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  timeoutMs: 1000
});

describe("OpenAiCompatibleVoiceAlbaranParser", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses a valid openai-compatible response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  customerName: "Cliente Tres",
                  date: "2026-06-11",
                  notes: null,
                  items: [
                    {
                      description: "marco",
                      color: "RAL 9010",
                      texture: "normal",
                      linearMeters: 4,
                      squareMeters: null,
                      thickness: null,
                      primer: false,
                      quantity: 3
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    await expect(parser.parseTranscript("tres marcos blancos")).resolves.toEqual({
      customerName: "CLIENTE TRES",
      date: "2026-06-11",
      notes: null,
      items: [
        {
          description: "MARCO",
          color: "RAL 9010",
          pricingMode: "DIMENSIONS",
          customUnitPrice: null,
          texture: "NORMAL",
          linearMeters: 4,
          squareMeters: null,
          hasThickness: false,
          hasPrimer: false,
          saveAsSpecialPiece: false,
          quantity: 3
        }
      ]
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer openai-key"
        })
      })
    );
  });
});
