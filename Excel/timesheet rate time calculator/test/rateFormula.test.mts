import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTotalFormula, evaluateRate } from "../src/taskpane/rateFormula.ts";

const CASES: Array<[number | string, number]> = [
  [24, 24],
  [30.5, 30.5],
  ["24", 24],
  ["24 euro", 24],
  ["24 euros", 24],
  ["24 EUR", 24],
  ["€30", 30],
  ["€ 30", 30],
  ["30 €/h", 30],
  ["30,5", 30.5],
  ["30.5", 30.5],
  ["24 euro / h", 24],
  ["24 euro per hour", 24],
  ["€24.00 / h", 24],
  ["  25 ", 25],
];

for (const [input, rate] of CASES) {
  test(`rate ${JSON.stringify(input)} -> ${rate}`, () => {
    assert.equal(evaluateRate(input), rate);
  });
}

test("non-numeric rates give #VALUE! so Total visibly breaks", () => {
  assert.equal(evaluateRate("abc"), "#VALUE!");
  assert.equal(evaluateRate("24 usd"), "#VALUE!");
  assert.equal(evaluateRate("1.000,50"), "#VALUE!");
});

test("example: 1:45 at 24/h is 42.00", () => {
  const e2 = 105 / 1440;
  const rate = evaluateRate("24 euro");
  assert.equal(typeof rate, "number");
  assert.equal((e2 * 24 * (rate as number)).toFixed(2), "42.00");
});

test("Total formula text", () => {
  const formula = buildTotalFormula("E2", "F2");
  assert.ok(formula.startsWith("=LET(rateCell,F2,rateNum,IF(ISNUMBER(rateCell),rateCell,NUMBERVALUE("));
  assert.ok(formula.endsWith(',".",",")),E2*24*rateNum)'));
  assert.ok(!/;/.test(formula), "uses comma argument separators only");
  assert.ok(!/\b[rc],/i.test(formula), "no LET names r or c");
  assert.equal(formula.split("(").length, formula.split(")").length);
});
