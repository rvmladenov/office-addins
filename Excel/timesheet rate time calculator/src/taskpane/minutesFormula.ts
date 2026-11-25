export const UNIT_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["hours", "h"],
  ["hour", "h"],
  ["hrs", "h"],
  ["hr", "h"],
  ["minutes", "m"],
  ["minute", "m"],
  ["mins", "m"],
  ["min", "m"],
];

export function buildMinutesFormula(sourceColumn: string): string {
  const cleaned = `LOWER(SUBSTITUTE(TRIM([@[${sourceColumn}]])," ",""))`;
  const normalised = UNIT_REPLACEMENTS.reduce(
    (expr, [from, to]) => `SUBSTITUTE(${expr},"${from}","${to}")`,
    cleaned
  );
  const num = (text: string) => `NUMBERVALUE(SUBSTITUTE(${text},",","."),".",",")`;

  return (
    "=LET(" +
    `txt,${normalised},` +
    `hPos,IFERROR(FIND("h",txt),0),` +
    `hrs,IF(hPos>0,${num("LEFT(txt,hPos-1)")},0),` +
    `rest,IF(hPos>0,MID(txt,hPos+1,99),txt),` +
    `mPos,IFERROR(FIND("m",rest),0),` +
    `mins,IF(mPos>0,${num("LEFT(rest,mPos-1)")},0),` +
    `IF(txt="","",IF(AND(hPos=0,mPos=0),NA(),hrs*60+mins)))`
  );
}

export type FormulaResult = number | "" | "#N/A" | "#VALUE!";

export function evaluateMinutesFormula(cell: string): FormulaResult {
  let txt = cell.trim().split(" ").join("").toLowerCase();
  for (const [from, to] of UNIT_REPLACEMENTS) {
    txt = txt.split(from).join(to);
  }

  const numberValue = (text: string): number | "#VALUE!" => {
    const normalised = text.split(",").join(".");
    if (normalised === "") return 0;
    return /^\d*\.?\d+$|^\d+\.$/.test(normalised) ? Number(normalised) : "#VALUE!";
  };

  const hPos = txt.indexOf("h") + 1;
  const hrs = hPos > 0 ? numberValue(txt.slice(0, hPos - 1)) : 0;
  const rest = hPos > 0 ? txt.slice(hPos) : txt;
  const mPos = rest.indexOf("m") + 1;
  const mins = mPos > 0 ? numberValue(rest.slice(0, mPos - 1)) : 0;

  if (txt === "") return "";
  if (hPos === 0 && mPos === 0) return "#N/A";
  if (hrs === "#VALUE!" || mins === "#VALUE!") return "#VALUE!";
  return hrs * 60 + mins;
}
