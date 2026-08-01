import { describe, expect, it } from "vitest";
import {
  backspace,
  chooseOperator,
  enterDecimal,
  enterDigit,
  evaluate,
  initialCalculatorState,
  percent,
  toggleSign
} from "./calculatorEngine";

describe("calculatorEngine", () => {
  it("calculates chained arithmetic without eval", () => {
    let state = enterDigit(initialCalculatorState, "8");
    state = chooseOperator(state, "×");
    state = enterDigit(state, "4");
    expect(evaluate(state).display).toBe("32");
  });

  it("supports decimal, percentage, sign and backspace", () => {
    let state = enterDigit(initialCalculatorState, "5");
    state = enterDecimal(state);
    state = enterDigit(state, "2");
    expect(percent(state).display).toBe("0.052");
    expect(toggleSign(state).display).toBe("-5.2");
    expect(backspace(state).display).toBe("5.");
  });

  it("reports division by zero safely", () => {
    let state = enterDigit(initialCalculatorState, "9");
    state = chooseOperator(state, "÷");
    state = enterDigit(state, "0");
    expect(evaluate(state).display).toBe("Error");
  });
});
