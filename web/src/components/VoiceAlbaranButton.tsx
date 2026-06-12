import {
  ArrowPathIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  StopIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseVoiceAlbaran } from "@/application/use-cases";
import { type ParsedVoiceAlbaranData } from "@/features/voice/voiceAlbaran";
import { ApiError } from "@/infrastructure/api/apiClient";

interface VoiceAlbaranButtonProps {
  onDataExtracted: (data: ParsedVoiceAlbaranData) => void;
  onError?: (message: string) => void;
}

type VoiceStatus = "idle" | "listening" | "processing";

const UnitToken = ({ base, suffix }: { base: string; suffix?: string }) => (
  <span className="inline-flex items-start gap-[1px]">
    <span>{base}</span>
    {suffix ? <span className="text-[0.62em] leading-none opacity-80">{suffix}</span> : null}
  </span>
);

const getRecognitionConstructor = (): SpeechRecognitionConstructorLike | null =>
  window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

const appendTranscript = (current: string, incoming: string): string => {
  const normalizedIncoming = incoming.trim();
  if (!normalizedIncoming) {
    return current;
  }

  if (!current.trim()) {
    return normalizedIncoming;
  }

  return `${current.trim()} ${normalizedIncoming}`.trim();
};

export const VoiceAlbaranButton = ({ onDataExtracted, onError }: VoiceAlbaranButtonProps) => {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const statusRef = useRef<VoiceStatus>("idle");
  const processedResultCountRef = useRef(0);
  const silenceTimeoutRef = useRef<number | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [parsedPreviewState, setParsedPreviewState] = useState<{
    data: ParsedVoiceAlbaranData;
    transcript: string;
  } | null>(null);
  const isSupported = useMemo(() => getRecognitionConstructor() !== null, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearSilenceTimeout = () => {
    if (silenceTimeoutRef.current !== null) {
      window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearSilenceTimeout();
      recognitionRef.current?.stop();
    },
    []
  );

  const handleRecognitionError = (message: string) => {
    clearSilenceTimeout();
    setStatus("idle");
    setInterimTranscript("");
    onError?.(message);
  };

  const stopListening = () => {
    clearSilenceTimeout();
    setStatus("idle");
    recognitionRef.current?.stop();
  };

  const scheduleSilenceStop = () => {
    clearSilenceTimeout();
    silenceTimeoutRef.current = window.setTimeout(() => {
      if (statusRef.current !== "listening") {
        return;
      }

      stopListening();
    }, 1800);
  };

  const startListening = () => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition || status !== "idle") {
      return;
    }

    const recognition = new Recognition();
    processedResultCountRef.current = 0;
    setParsedPreviewState(null);
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let nextInterimTranscript = "";

      for (let index = processedResultCountRef.current; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript?.trim() ?? "";
        if (!transcript) {
          continue;
        }

        if (event.results[index]?.isFinal) {
          setTranscriptDraft((current) => appendTranscript(current, transcript));
          processedResultCountRef.current = index + 1;
          scheduleSilenceStop();
          continue;
        }

        nextInterimTranscript = transcript;
      }

      setInterimTranscript(nextInterimTranscript);
      scheduleSilenceStop();
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      handleRecognitionError("No se pudo capturar la voz.");
    };
    recognition.onspeechend = () => {
      if (statusRef.current !== "listening") {
        return;
      }

      stopListening();
    };
    recognition.onsoundend = () => {
      if (statusRef.current !== "listening") {
        return;
      }

      stopListening();
    };
    recognition.onend = () => {
      clearSilenceTimeout();
      recognitionRef.current = null;
      setInterimTranscript("");

      if (statusRef.current === "listening") {
        setStatus("idle");
      }
    };

    recognitionRef.current = recognition;
    setStatus("listening");
    recognition.start();
  };

  const sendTranscriptToBackend = () => {
    const transcript = appendTranscript(transcriptDraft, interimTranscript);
    if (!transcript) {
      handleRecognitionError("Todavia no hay texto de voz para procesar.");
      return;
    }

    console.log("[voice] transcript sent to backend:", transcript);
    setStatus("processing");
    void parseVoiceAlbaran(transcript)
      .then((data) => {
        setParsedPreviewState({
          data,
          transcript
        });
        onDataExtracted(data);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError) {
          handleRecognitionError(error.message);
          return;
        }

        handleRecognitionError("No se pudo procesar la entrada por voz.");
      })
      .finally(() => {
        recognitionRef.current = null;
        setStatus("idle");
      });
  };

  const isListening = status === "listening";
  const isProcessing = status === "processing";
  const visibleTranscript = appendTranscript(transcriptDraft, interimTranscript);
  const preview = useMemo(
    () => (parsedPreviewState?.transcript === visibleTranscript ? parsedPreviewState.data : null),
    [parsedPreviewState, visibleTranscript]
  );
  const showIdlePulse = !isListening && !isProcessing && !visibleTranscript;

  return (
    <div className="voice-reactive-shell relative left-1/2 w-screen max-w-none -translate-x-1/2 overflow-hidden border-y border-white/10 text-white shadow-[0_22px_80px_rgba(0,0,0,0.32)] sm:left-0 sm:w-full sm:translate-x-0 sm:border sm:border-white/10">
      <div className="voice-reactive-orb voice-reactive-orb--amber" />
      <div className="voice-reactive-orb voice-reactive-orb--blue" />
      <div className="voice-reactive-orb voice-reactive-orb--red" />
      <div className="voice-reactive-orb voice-reactive-orb--green" />

      <div className="voice-reactive-panel flex w-full flex-col gap-4 p-3 sm:p-4 lg:p-5">
        <div className="grid w-full gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <div className="min-w-0 overscroll-contain border border-[var(--epx-accent)]/22 bg-[color:rgb(33_24_18_/_0.62)] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/58">
                Dictado en directo
              </p>
              {preview?.customerName ? (
                <span className="border border-[var(--epx-accent)]/20 bg-[color:rgb(255_149_0_/_0.10)] px-2 py-1 text-[11px] font-semibold text-[#ffe6c7]">
                  Cliente: {preview.customerName}
                </span>
              ) : null}
            </div>

            <div className="mt-3 border border-[var(--epx-accent)]/18 bg-[color:rgb(255_255_255_/_0.05)]">
              <div className="max-h-[6.5rem] overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
                <p className="whitespace-pre-wrap pr-2 text-sm leading-6 text-white/90">
                  {visibleTranscript || ""}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-white/10 px-2 py-2 sm:px-3">
                <div className="flex items-center gap-2">
                  <button
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center border ${
                      !isSupported || isProcessing
                        ? "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
                      : isListening
                          ? "border-[var(--epx-accent)] bg-[var(--epx-accent)] text-[#131313]"
                          : showIdlePulse
                            ? "animate-pulse border-[var(--epx-accent)]/55 bg-[color:rgb(255_149_0_/_0.14)] text-[#fff4e5]"
                            : "border-white/12 bg-white/6 text-white"
                    }`}
                    disabled={!isSupported || isProcessing}
                    onClick={isListening ? stopListening : startListening}
                    title={isListening ? "Detener dictado" : "Iniciar dictado"}
                    type="button"
                  >
                    {isProcessing ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : isListening ? (
                      <StopIcon className="h-4 w-4" />
                    ) : (
                      <MicrophoneIcon className={`h-4 w-4 ${showIdlePulse ? "animate-pulse" : ""}`} />
                    )}
                  </button>

                  <button
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--epx-accent)]/14 bg-white/6 text-white disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={!visibleTranscript || isProcessing}
                    onClick={() => {
                      setTranscriptDraft("");
                      setInterimTranscript("");
                      setParsedPreviewState(null);
                    }}
                    title="Limpiar borrador"
                    type="button"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>

                  <div
                    aria-hidden="true"
                    className={`voice-audio-aura ${
                      isListening
                        ? "voice-audio-aura--active"
                        : showIdlePulse
                          ? "voice-audio-aura--idle"
                          : ""
                    }`}
                  >
                    <span className="voice-audio-aura__glow voice-audio-aura__glow--one" />
                    <span className="voice-audio-aura__glow voice-audio-aura__glow--two" />
                    <span className="voice-audio-aura__wave voice-audio-aura__wave--1" />
                    <span className="voice-audio-aura__wave voice-audio-aura__wave--2" />
                    <span className="voice-audio-aura__wave voice-audio-aura__wave--center" />
                    <span className="voice-audio-aura__wave voice-audio-aura__wave--3" />
                    <span className="voice-audio-aura__wave voice-audio-aura__wave--4" />
                  </div>
                </div>

                <button
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--epx-accent)]/18 bg-white text-neutral-900 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={!visibleTranscript || isProcessing}
                  onClick={sendTranscriptToBackend}
                  title="Aplicar al albaran"
                  type="button"
                >
                  <PaperAirplaneIcon className="h-4 w-4 -rotate-45" />
                </button>
              </div>
            </div>
          </div>

          <div className="min-w-0 overscroll-contain border border-[var(--epx-accent)]/18 bg-[color:rgb(38_29_23_/_0.56)] p-3 sm:p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/58">
              Vista previa estructurada
            </p>

            <div className="mt-3 divide-y divide-[var(--epx-accent)]/10 border border-[var(--epx-accent)]/14 bg-[color:rgb(255_255_255_/_0.05)]">
              {preview?.items.length ? (
                preview.items.map((item, index) => (
                  <div
                    className="px-3 py-3"
                    key={`${item.description ?? "pieza"}-${index}`}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/82">
                      <span className="font-semibold text-white">
                        {item.description ?? `Pieza ${index + 1}`}
                      </span>
                      <span className="text-white/28">|</span>
                      <span className="inline-flex items-center gap-1.5">
                        {item.pricingMode === "UNIT" ? (
                          "Unidad"
                        ) : (
                          <>
                            <UnitToken base="m" suffix="l" />
                            <span className="text-white/28">/</span>
                            <UnitToken base="m" suffix="2" />
                          </>
                        )}
                      </span>
                      {item.color ? (
                        <>
                          <span className="text-white/28">|</span>
                          <span>{item.color}</span>
                        </>
                      ) : null}
                      {item.texture ? (
                        <>
                          <span className="text-white/28">|</span>
                          <span>{item.texture}</span>
                        </>
                      ) : null}
                      {item.quantity != null ? (
                        <>
                          <span className="text-white/28">|</span>
                          <span>x{item.quantity}</span>
                        </>
                      ) : null}
                      {item.linearMeters != null ? (
                        <>
                          <span className="text-white/28">|</span>
                          <span className="inline-flex items-center gap-1">
                            <span>{item.linearMeters}</span>
                            <UnitToken base="m" suffix="l" />
                          </span>
                        </>
                      ) : null}
                      {item.squareMeters != null && item.squareMeters > 0 ? (
                        <>
                          <span className="text-white/28">|</span>
                          <span className="inline-flex items-center gap-1">
                            <span>{item.squareMeters}</span>
                            <UnitToken base="m" suffix="2" />
                          </span>
                        </>
                      ) : null}
                      {item.customUnitPrice != null ? (
                        <>
                          <span className="text-white/28">|</span>
                          <span>{item.customUnitPrice} EUR/u</span>
                        </>
                      ) : null}
                      {item.saveAsSpecialPiece ? (
                        <>
                          <span className="text-white/28">|</span>
                          <span
                            aria-label="Pieza especial"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[color:rgb(255_149_0_/_0.18)] text-[10px] text-[#ffd08a]"
                            title="Pieza especial"
                          >
                            ★
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-sm text-white/58" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
