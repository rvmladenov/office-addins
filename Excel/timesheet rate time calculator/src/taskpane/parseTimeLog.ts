export interface TimeLogEntry {
  time: string;
  minutes: number;
  description: string;
  date?: string;
}

export interface SkippedLine {
  line: number;
  text: string;
}

export interface TimeLogParseResult {
  entries: TimeLogEntry[];
  skipped: SkippedLine[];
}

const BULLET = /^[-*•]\s*/;
const DATE_LINE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

const UNIT = "hours?|hrs?|h|minutes?|mins?|m";
const TIME_TOKEN = String.raw`\d+(?:[.,]\d+)?\s*(?:${UNIT})`;
const TIME_TOKEN_PARTS = new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(${UNIT})`, "gi");
const ENTRY_LINE = new RegExp(
  String.raw`^(${TIME_TOKEN}(?:\s*${TIME_TOKEN})*)\s*[-–—]\s*(.*)$`,
  "i"
);

export function parseTimeLog(text: string): TimeLogParseResult {
  const entries: TimeLogEntry[] = [];
  const skipped: SkippedLine[] = [];
  let currentDate: string | undefined;

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim().replace(BULLET, "").trim();
    if (line === "") {
      return;
    }

    const date = DATE_LINE.exec(line);
    if (date && isValidDayMonth(Number(date[1]), Number(date[2]))) {
      currentDate = line;
      return;
    }

    const entry = ENTRY_LINE.exec(line);
    const description = entry?.[2].trim();
    if (entry && description) {
      const time = entry[1].trim();
      entries.push({
        time,
        minutes: toMinutes(time),
        description,
        ...(currentDate ? { date: currentDate } : {}),
      });
      return;
    }

    skipped.push({ line: index + 1, text: rawLine.trim() });
  });

  return { entries, skipped };
}

export function toMinutes(time: string): number {
  let minutes = 0;
  TIME_TOKEN_PARTS.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TIME_TOKEN_PARTS.exec(time)) !== null) {
    const value = Number(match[1].replace(",", "."));
    minutes += match[2].toLowerCase().charAt(0) === "h" ? value * 60 : value;
  }
  return minutes;
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return `${hours}:${rest < 10 ? "0" : ""}${rest}`;
}

function isValidDayMonth(day: number, month: number): boolean {
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}
