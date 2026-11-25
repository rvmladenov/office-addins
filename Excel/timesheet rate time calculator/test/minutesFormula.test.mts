import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMinutesFormula, evaluateMinutesFormula } from "../src/taskpane/minutesFormula.ts";
import { toMinutes } from "../src/taskpane/parseTimeLog.ts";

const CASES: Array<[string, number]> = [
  ["15m", 15],
  ["1h", 60],
  ["1h30m", 90],
  ["1h 30m", 90],
  ["1.5h", 90],
  ["1,5h", 90],
  ["90min", 90],
  ["2HRS", 120],
  ["2 hours 15 minutes", 135],
  ["1 hour 1 minute", 61],
  ["45 mins", 45],
  ["  30m  ", 30],
];

for (const [input, minutes] of CASES) {
  test(`formula and parser agree: "${input}" = ${minutes}`, () => {
    assert.equal(evaluateMinutesFormula(input), minutes);
    assert.equal(toMinutes(input), minutes);
  });
}

test("blank cell gives an empty string (ignored by SUM)", () => {
  assert.equal(evaluateMinutesFormula(""), "");
  assert.equal(evaluateMinutesFormula("   "), "");
});

test("unparseable values give a visible error instead of 0", () => {
  assert.equal(evaluateMinutesFormula("soon"), "#N/A");
  assert.equal(evaluateMinutesFormula("90"), "#N/A");
  assert.equal(evaluateMinutesFormula("abch"), "#VALUE!");
});

test("formula text is en-US LET syntax referencing the time spent column", () => {
  const formula = buildMinutesFormula("time spent");
  assert.ok(formula.startsWith("=LET(txt,"));
  assert.ok(formula.includes("[@[time spent]]"));
  assert.ok(formula.includes('NUMBERVALUE(SUBSTITUTE(LEFT(txt,hPos-1),",","."),".",",")'));
  assert.ok(!/;/.test(formula), "uses comma argument separators only");
  assert.equal(count(formula, "("), count(formula, ")"));
});

function count(text: string, ch: string): number {
  return text.split(ch).length - 1;
}
