import { describe, expect, it } from "vitest";
import {
  extractGeminiText,
  normalizeGeminiMimeType,
  resolveGeminiEndpoints,
  shouldUseGeminiFilesApi
} from "./GeminiVoiceTranscriber.js";

describe("GeminiVoiceTranscriber helpers", () => {
  it("normalizes common audio mime types", () => {
    expect(normalizeGeminiMimeType("audio/mpeg")).toBe("audio/mp3");
    expect(normalizeGeminiMimeType(" audio/webm ")).toBe("audio/webm");
    expect(normalizeGeminiMimeType("")).toBe("audio/webm");
  });

  it("resolves generate and upload endpoints from v1beta base url", () => {
    expect(resolveGeminiEndpoints("https://generativelanguage.googleapis.com/v1beta")).toEqual({
      generateBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      uploadBaseUrl: "https://generativelanguage.googleapis.com/upload/v1beta"
    });
  });

  it("extracts text from gemini candidates", () => {
    expect(
      extractGeminiText({
        candidates: [
          {
            content: {
              parts: [{ text: "Linea 1" }, { text: "Linea 2" }]
            }
          }
        ]
      })
    ).toBe("Linea 1\nLinea 2");
  });

  it("switches to Files API for larger audio clips", () => {
    expect(shouldUseGeminiFilesApi(2 * 1024 * 1024)).toBe(false);
    expect(shouldUseGeminiFilesApi(15 * 1024 * 1024)).toBe(true);
  });
});
