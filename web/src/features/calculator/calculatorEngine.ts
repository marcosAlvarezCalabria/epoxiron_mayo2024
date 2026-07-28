export type CalculatorOperator = "+" | "−" | "×" | "÷";

export interface CalculatorState {
  display: string;
  accumulator: number | null;
  operator: CalculatorOperator | null;
  replaceDisplay: boolean;
}

export const initialCalculatorState: CalculatorState = {
  display: "0",
  accumulator: null,
  operator: null,
  replaceDisplay: false
};

const calculate = (left: number, right: number, operator: CalculatorOperator): number => {
  if (operator === "+") return left + right;
  if (operator === "−") return left - right;
  if (operator === "×") return left * right;
  if (right === 0) throw new Error("No se puede dividir entre cero");
  return left / right;
};

const formatResult = (value: number): string => {
  if (!Number.isFinite(value)) return "Error";
  return Number.parseFloat(value.toFixed(10)).toString();
};

export const enterDigit = (state: CalculatorState, digit: string): CalculatorState => {
  if (!/^\d$/.test(digit)) return state;
  return {
    ...state,
    display: state.replaceDisplay || state.display === "0" ? digit : `${state.display}${digit}`,
    replaceDisplay: false
  };
};

export const enterDecimal = (state: CalculatorState): CalculatorState => {
  if (state.replaceDisplay) return { ...state, display: "0.", replaceDisplay: false };
  if (state.display.includes(".")) return state;
  return { ...state, display: `${state.display}.` };
};

export const chooseOperator = (
  state: CalculatorState,
  operator: CalculatorOperator
): CalculatorState => {
  const current = Number(state.display);
  if (!Number.isFinite(current)) return { ...initialCalculatorState };

  if (state.accumulator !== null && state.operator && !state.replaceDisplay) {
    try {
      const result = calculate(state.accumulator, current, state.operator);
      return {
        display: formatResult(result),
        accumulator: result,
        operator,
        replaceDisplay: true
      };
    } catch {
      return { ...initialCalculatorState, display: "Error", replaceDisplay: true };
    }
  }

  return { ...state, accumulator: current, operator, replaceDisplay: true };
};

export const evaluate = (state: CalculatorState): CalculatorState => {
  if (state.accumulator === null || !state.operator) return state;
  try {
    const result = calculate(state.accumulator, Number(state.display), state.operator);
    return {
      display: formatResult(result),
      accumulator: null,
      operator: null,
      replaceDisplay: true
    };
  } catch {
    return { ...initialCalculatorState, display: "Error", replaceDisplay: true };
  }
};

export const toggleSign = (state: CalculatorState): CalculatorState => ({
  ...state,
  display: state.display === "0" ? "0" : formatResult(-Number(state.display))
});

export const percent = (state: CalculatorState): CalculatorState => ({
  ...state,
  display: formatResult(Number(state.display) / 100),
  replaceDisplay: true
});

export const backspace = (state: CalculatorState): CalculatorState => {
  if (state.replaceDisplay || state.display.length <= 1) return { ...state, display: "0" };
  return { ...state, display: state.display.slice(0, -1) };
};
