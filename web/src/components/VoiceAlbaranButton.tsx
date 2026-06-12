import {
  ArrowPathIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  StopIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseVoiceAlbaran, parseVoiceAlbaranAudio } from "@/application/use-cases";
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silenceFrameRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastSoundAtRef = useRef<number>(0);
  const statusRef = useRef<VoiceStatus>("idle");
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [parsedPreviewState, setParsedPreviewState] = useState<{
    data: ParsedVoiceAlbaranData;
    transcript: string;
  } | null>(null);
  const isSupported = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined",
    []
  );

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearSilenceDetection = () => {
    if (silenceFrameRef.current !== null) {
      window.cancelAnimationFrame(silenceFrameRef.current);
      silenceFrameRef.current = null;
    }
  };

  const stopAudioStream = () => {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
  };

  const cleanupAudioGraph = async () => {
    clearSilenceDetection();
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    analyserRef.current = null;

    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearSilenceDetection();
      mediaRecorderRef.current?.stop();
      stopAudioStream();
      void cleanupAudioGraph();
    },
    []
  );

  const handleRecognitionError = (message: string) => {
    clearSilenceDetection();
    setStatus("idle");
    stopAudioStream();
    void cleanupAudioGraph();
    onError?.(message);
  };

  const stopListening = () => {
    clearSilenceDetection();
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setStatus("idle");
      return;
    }

    recorder.stop();
  };

  const monitorSilence = () => {
    const analyser = analyserRef.current;
    if (!analyser) {
      return;
    }

    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      if (statusRef.current !== "listening" || !analyserRef.current) {
        return;
      }

      analyser.getByteTimeDomainData(data);
      let sum = 0;

      for (const sample of data) {
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
      }

      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();

      if (rms > 0.035) {
        lastSoundAtRef.current = now;
      } else if (now - lastSoundAtRef.current >= 1800) {
        stopListening();
        return;
      }

      silenceFrameRef.current = window.requestAnimationFrame(tick);
    };

    lastSoundAtRef.current = Date.now();
    silenceFrameRef.current = window.requestAnimationFrame(tick);
  };

  const startListening = async () => {
    if (!isSupported || status !== "idle") {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        (typeof MediaRecorder.isTypeSupported === "function" &&
          [
            "audio/webm;codecs=opus",
            "audio/mp4",
            "audio/webm",
            "audio/mpeg"
          ].find((candidate) => MediaRecorder.isTypeSupported(candidate))) ||
        undefined;

      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      setParsedPreviewState(null);

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        sourceNodeRef.current = source;
        analyserRef.current = analyser;
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        handleRecognitionError("No se pudo capturar el audio.");
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });

        mediaRecorderRef.current = null;
        stopAudioStream();
        void cleanupAudioGraph();

        if (audioBlob.size === 0) {
          setStatus("idle");
          onError?.("No se pudo capturar ningun audio.");
          return;
        }

        setStatus("processing");
        void parseVoiceAlbaranAudio(audioBlob)
          .then((result) => {
            setTranscriptDraft(result.transcript);
            setParsedPreviewState({
              data: result.parsed,
              transcript: result.transcript
            });
            onDataExtracted(result.parsed);
          })
          .catch((error: unknown) => {
            if (error instanceof ApiError) {
              handleRecognitionError(error.message);
              return;
            }

            handleRecognitionError("No se pudo procesar el audio.");
          })
          .finally(() => {
            setStatus("idle");
          });
      };

      setStatus("listening");
      recorder.start();
      monitorSilence();
    } catch {
      handleRecognitionError("No se pudo acceder al microfono.");
    }
  };

  const sendTranscriptToBackend = () => {
    const transcript = appendTranscript(transcriptDraft, "");
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
        setStatus("idle");
      });
  };

  const isListening = status === "listening";
  const isProcessing = status === "processing";
  const visibleTranscript = transcriptDraft;
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
                    onClick={isListening ? stopListening : () => void startListening()}
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
