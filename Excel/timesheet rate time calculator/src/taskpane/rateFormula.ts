export const RATE_NOISE: ReadonlyArray<string> = [
  "perhour",
  "/hour",
  "/h",
  "euros",
  "euro",
  "eur",
  "€",
];

export function buildTotalFormula(durationCell: string, rateCell: string): string {
  const compact = `SUBSTITUTE(LOWER(TRIM(rateCell))," ","")`;
  const stripped = RATE_NOISE.reduce((expr, noise) => `SUBSTITUTE(${expr},"${noise}","")`, compact);
  return (
    "=LET(" +
    `rateCell,${rateCell},` +
    `rateNum,IF(ISNUMBER(rateCell),rateCell,NUMBERVALUE(SUBSTITUTE(${stripped},",","."),".",",")),` +
    `${durationCell}*24*rateNum)`
  );
}

export function evaluateRate(cell: number | string): number | "#VALUE!" {
  if (typeof cell === "number") return cell;

  let text = cell.trim().toLowerCase().split(" ").join("");
  for (const noise of RATE_NOISE) {
    text = text.split(noise).join("");
  }
  text = text.split(",").join(".");

  if (text === "") return 0;
  return /^\d*\.?\d+$|^\d+\.$/.test(text) ? Number(text) : "#VALUE!";
}
