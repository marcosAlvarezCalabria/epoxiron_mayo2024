import { CalculatorIcon, ClipboardIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  backspace,
  chooseOperator,
  enterDecimal,
  enterDigit,
  evaluate,
  initialCalculatorState,
  percent,
  toggleSign,
  type CalculatorOperator
} from "@/features/calculator/calculatorEngine";

const storageKey = "epoxiron.calculator.position";
const panelWidth = 288;
const panelHeight = 410;
const margin = 12;
const clampPosition = (x: number, y: number, width = panelWidth, height = panelHeight) => ({
  x: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
  y: Math.max(margin, Math.min(y, window.innerHeight - height - margin))
});

export const FloatingCalculator = () => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(initialCalculatorState);
  const [position, setPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "") as { x: number; y: number };
      return clampPosition(saved.x, saved.y);
    } catch {
      return clampPosition(window.innerWidth - panelWidth - 20, 96);
    }
  });
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    const constrain = () =>
      setPosition((current) => clampPosition(current.x, current.y, open ? panelWidth : 56, open ? panelHeight : 56));
    window.addEventListener("resize", constrain);
    return () => window.removeEventListener("resize", constrain);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      else if (/^\d$/.test(event.key)) setState((current) => enterDigit(current, event.key));
      else if (event.key === "." || event.key === ",") setState(enterDecimal);
      else if (event.key === "Enter" || event.key === "=") setState(evaluate);
      else if (event.key === "Backspace") setState(backspace);
      else {
        const operators: Record<string, CalculatorOperator> = {
          "+": "+",
          "-": "−",
          "*": "×",
          "/": "÷"
        };
        const operator = operators[event.key];
        if (operator) setState((current) => chooseOperator(current, operator));
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    moved.current = false;
    drag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    moved.current = true;
    setPosition(clampPosition(event.clientX - drag.current.offsetX, event.clientY - drag.current.offsetY));
  };
  const finishDrag = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    localStorage.setItem(storageKey, JSON.stringify(position));
  };

  if (!open) {
    return (
      <button
        aria-label="Abrir calculadora"
        className="fixed z-40 flex h-14 w-14 touch-none items-center justify-center rounded-full border border-[var(--epx-accent)]/60 bg-[var(--epx-accent)] text-[#131313] shadow-xl"
        onClick={() => {
          if (!moved.current) {
            setPosition((current) => clampPosition(current.x, current.y));
            setOpen(true);
          }
        }}
        onPointerCancel={finishDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        style={{ left: position.x, top: position.y }}
        type="button"
      >
        <CalculatorIcon className="h-7 w-7" />
      </button>
    );
  }

  const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"];
  return (
    <>
    <button
      aria-label="Cerrar calculadora"
      className="fixed inset-0 z-[49] cursor-default bg-transparent"
      onClick={() => setOpen(false)}
      type="button"
    />
    <section
      aria-label="Calculadora"
      className="fixed z-50 w-72 border border-neutral-600 bg-[#202020] p-3 text-white shadow-2xl"
      role="dialog"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="flex cursor-move touch-none items-center justify-between border-b border-neutral-700 pb-2"
        onPointerCancel={finishDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
      >
        <span className="text-sm font-semibold">Calculadora</span>
        <button aria-label="Cerrar calculadora" onClick={() => setOpen(false)} type="button">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      <output
        aria-live="polite"
        className="mt-3 block min-h-14 overflow-hidden border border-neutral-700 bg-[#131313] px-3 py-2 text-right text-3xl"
      >
        {state.display}
      </output>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <button className="min-h-11 border border-neutral-700" onClick={() => setState(initialCalculatorState)} type="button">C</button>
        <button className="min-h-11 border border-neutral-700" onClick={() => setState(toggleSign)} type="button">±</button>
        <button className="min-h-11 border border-neutral-700" onClick={() => setState(percent)} type="button">%</button>
        <button className="min-h-11 border border-neutral-700" onClick={() => setState(backspace)} type="button">⌫</button>
        {keys.map((key) => (
          <button
            className="min-h-11 border border-neutral-700 bg-neutral-800 text-lg hover:border-[var(--epx-accent)]"
            key={key}
            onClick={() => {
              if (/^\d$/.test(key)) setState((current) => enterDigit(current, key));
              else if (key === ".") setState(enterDecimal);
              else if (key === "=") setState(evaluate);
              else setState((current) => chooseOperator(current, key as CalculatorOperator));
            }}
            type="button"
          >
            {key}
          </button>
        ))}
      </div>
      <button
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 border border-neutral-700"
        onClick={() => void navigator.clipboard.writeText(state.display)}
        type="button"
      >
        <ClipboardIcon className="h-4 w-4" /> Copiar resultado
      </button>
    </section>
    </>
  );
};
