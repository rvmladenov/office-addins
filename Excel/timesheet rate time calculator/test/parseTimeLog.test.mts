import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, parseTimeLog, toMinutes } from "../src/taskpane/parseTimeLog.ts";

const HOURLY_RATE_EUR = 24;

test("parses the example log into three entries totalling 1:45", () => {
  const input = ["- 10.11.2026", "    - 15m - daily", "    - 1h - developing", "    - 30m - FI daily"].join("\n");

  const { entries, skipped } = parseTimeLog(input);

  assert.deepEqual(entries, [
    { time: "15m", minutes: 15, description: "daily", date: "10.11.2026" },
    { time: "1h", minutes: 60, description: "developing", date: "10.11.2026" },
    { time: "30m", minutes: 30, description: "FI daily", date: "10.11.2026" },
  ]);
  assert.deepEqual(skipped, []);

  const total = entries.reduce((sum, e) => sum + e.minutes, 0);
  assert.equal(total, 105);
  assert.equal(formatDuration(total), "1:45");

  const d2 = total / 1440;
  assert.equal((d2 * 24 * HOURLY_RATE_EUR).toFixed(2), "42.00");
});

test("splits only on the first dash, keeping dashes in the description", () => {
  const { entries } = parseTimeLog("- 45m - code review - PR #12 – follow-up");
  assert.deepEqual(entries, [{ time: "45m", minutes: 45, description: "code review - PR #12 – follow-up" }]);
});

test("accepts compound and alternative time formats and converts them to minutes", () => {
  const input = ["1h30m - x", "* 1h 30m – y", "• 1.5h—z", "90min - a", "2HRS - b", "1,25h - c"].join("\r\n");
  const { entries, skipped } = parseTimeLog(input);

  assert.deepEqual(
    entries.map((e) => [e.time, e.minutes, e.description]),
    [
      ["1h30m", 90, "x"],
      ["1h 30m", 90, "y"],
      ["1.5h", 90, "z"],
      ["90min", 90, "a"],
      ["2HRS", 120, "b"],
      ["1,25h", 75, "c"],
    ]
  );
  assert.deepEqual(skipped, []);
});

test("accepts d.m.yyyy dates and reports junk lines with 1-based line numbers", () => {
  const input = ["1.2.2026", "", "just some notes", "15m - daily", "15m -"].join("\n");
  const { entries, skipped } = parseTimeLog(input);

  assert.deepEqual(entries, [{ time: "15m", minutes: 15, description: "daily", date: "1.2.2026" }]);
  assert.deepEqual(skipped, [
    { line: 3, text: "just some notes" },
    { line: 5, text: "15m -" },
  ]);
});

test("toMinutes and formatDuration", () => {
  assert.equal(toMinutes("2 hours 15 minutes"), 135);
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(5), "0:05");
  assert.equal(formatDuration(1500), "25:00");
});
