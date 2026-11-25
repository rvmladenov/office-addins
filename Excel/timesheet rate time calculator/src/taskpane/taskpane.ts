/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Excel, HTMLButtonElement, HTMLTextAreaElement, Office */

import { buildMinutesFormula } from "./minutesFormula";
import { buildTotalFormula } from "./rateFormula";
import { formatDuration, parseTimeLog } from "./parseTimeLog";
import type { SkippedLine, TimeLogEntry } from "./parseTimeLog";

const BASE_SHEET_NAME = "Time log";
const BASE_TABLE_NAME = "TimeLog";
const HEADERS = ["time spent", "description"];
const MINUTES_HEADER = "minutes";

const DEFAULT_HOURLY_RATE_EUR = 24;

const SUMMARY_HEADERS = ["Total time spent", "Rate", "Total"];
const FORMAT_DURATION = "[h]:mm";
const FORMAT_RATE = '€#,##0.00" / h"';
const FORMAT_EURO = "€#,##0.00";
const SUMMARY_HEADER_FILL = "#DDEBF7";
const SUMMARY_BORDER_COLOR = "#9BC2E6";

Office.onReady((info) => {
  if (info.host === Office.HostType.Excel) {
    document.getElementById("sideload-msg")!.style.display = "none";
    document.getElementById("app-body")!.style.display = "flex";
    document.getElementById("generate-sheet")!.onclick = onGenerateSheet;
  }
});

async function onGenerateSheet() {
  const button = document.getElementById("generate-sheet") as HTMLButtonElement;
  const input = document.getElementById("time-log-input") as HTMLTextAreaElement;

  const { entries, skipped } = parseTimeLog(input.value);
  if (entries.length === 0) {
    setStatus('No time entries found. Expected lines like "15m - daily".', "error");
    renderSkipped(skipped);
    return;
  }

  button.disabled = true;
  setStatus("Working…");
  try {
    const sheetName = await writeTimeLogSheet(entries);
    const noun = entries.length === 1 ? "entry" : "entries";
    const totalMinutes = sumMinutes(entries);
    const amount = ((totalMinutes / 60) * DEFAULT_HOURLY_RATE_EUR).toFixed(2);
    setStatus(
      `Wrote ${entries.length} ${noun} to sheet '${sheetName}'. ` +
        `Total: ${formatDuration(totalMinutes)} → € ${amount}`,
      "success"
    );
    renderSkipped(skipped);
  } catch (error) {
    setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`, "error");
  } finally {
    button.disabled = false;
  }
}

export async function writeTimeLogSheet(entries: TimeLogEntry[]): Promise<string> {
  return Excel.run(async (context) => {
    const worksheets = context.workbook.worksheets;
    const tables = context.workbook.tables;
    worksheets.load("items/name");
    tables.load("items/name");
    await context.sync();

    const { sheetName, tableName } = uniqueNames(
      worksheets.items.map((sheet) => sheet.name),
      tables.items.map((table) => table.name)
    );
    const sheet = worksheets.add(sheetName);
    sheet.activate();

    const last = entries.length + 1;
    const rows = [
      [...HEADERS, MINUTES_HEADER],
      ...entries.map((entry) => [entry.time, entry.description, ""]),
    ];

    sheet.getRange(`A1:A${last}`).numberFormat = rows.map(() => ["@"]);
    sheet.getRange(`C2:C${last}`).numberFormat = entries.map(() => ["General"]);
    sheet.getRange(`A1:C${last}`).values = rows;

    const table = sheet.tables.add(`A1:C${last}`, true);
    table.name = tableName;
    table.getHeaderRowRange().format.font.bold = true;

    const minutesFormula = buildMinutesFormula(HEADERS[0]);
    table.columns.getItem(MINUTES_HEADER).getDataBodyRange().formulas = entries.map(() => [
      minutesFormula,
    ]);

    sheet.getRange("A:B").format.autofitColumns();
    sheet.getRange("C:C").columnHidden = true;

    writeSummary(sheet, tableName);

    await context.sync();

    await addRatePrompt(context, sheet);
    return sheetName;
  });
}

async function addRatePrompt(context: Excel.RequestContext, sheet: Excel.Worksheet) {
  try {
    sheet.getRange("F2").dataValidation.prompt = {
      showPrompt: true,
      title: "Rate",
      message: "Hourly rate in euro, e.g. 24 or 30,5",
    };
    await context.sync();
  } catch {
    return;
  }
}

function writeSummary(sheet: Excel.Worksheet, tableName: string) {
  const header = sheet.getRange("E1:G1");
  header.values = [SUMMARY_HEADERS];
  header.format.font.bold = true;
  header.format.fill.color = SUMMARY_HEADER_FILL;

  const values = sheet.getRange("E2:G2");
  values.numberFormat = [[FORMAT_DURATION, FORMAT_RATE, FORMAT_EURO]];
  values.formulas = [
    [
      `=SUM(${tableName}[${MINUTES_HEADER}])/1440`,
      DEFAULT_HOURLY_RATE_EUR,
      buildTotalFormula("E2", "F2"),
    ],
  ];

  const section = sheet.getRange("E1:G2");
  const edges = [
    Excel.BorderIndex.edgeTop,
    Excel.BorderIndex.edgeBottom,
    Excel.BorderIndex.edgeLeft,
    Excel.BorderIndex.edgeRight,
    Excel.BorderIndex.insideHorizontal,
    Excel.BorderIndex.insideVertical,
  ];
  edges.forEach((edge) => {
    const border = section.format.borders.getItem(edge);
    border.style = Excel.BorderLineStyle.continuous;
    border.color = SUMMARY_BORDER_COLOR;
  });
  section.format.autofitColumns();
}

function sumMinutes(entries: TimeLogEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.minutes, 0);
}

function uniqueNames(
  sheetNames: string[],
  tableNames: string[]
): { sheetName: string; tableName: string } {
  const lower = (names: string[]) => new Set(names.map((name) => name.toLowerCase()));
  const takenSheets = lower(sheetNames);
  const takenTables = lower(tableNames);
  for (let n = 1; ; n++) {
    const sheetName = n === 1 ? BASE_SHEET_NAME : `${BASE_SHEET_NAME} ${n}`;
    const tableName = n === 1 ? BASE_TABLE_NAME : `${BASE_TABLE_NAME}${n}`;
    if (!takenSheets.has(sheetName.toLowerCase()) && !takenTables.has(tableName.toLowerCase())) {
      return { sheetName, tableName };
    }
  }
}

function setStatus(message: string, kind?: "success" | "error") {
  const status = document.getElementById("status")!;
  status.textContent = message;
  status.className = "app-status" + (kind ? ` is-${kind}` : "");
}

function renderSkipped(skipped: SkippedLine[]) {
  const output = document.getElementById("output")!;
  output.replaceChildren();
  if (skipped.length === 0) {
    return;
  }

  const heading = document.createElement("p");
  heading.className = "ms-font-s";
  heading.textContent = `Skipped ${skipped.length} line${skipped.length === 1 ? "" : "s"}:`;

  const list = document.createElement("ul");
  list.className = "app-skipped";
  skipped.forEach(({ line, text }) => {
    const item = document.createElement("li");
    item.textContent = `Line ${line}: ${text}`;
    list.appendChild(item);
  });

  output.append(heading, list);
}
