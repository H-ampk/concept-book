export const CSV_NEWLINE = "\r\n";
export const UTF8_BOM = "\uFEFF";

export type CsvCellValue = string | number | boolean | null | undefined;

export const escapeCsvCell = (value: CsvCellValue): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const text = typeof value === "string" ? value : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const buildCsv = (headers: readonly string[], rows: readonly CsvCellValue[][]): string => {
  const headerLine = headers.map((column) => escapeCsvCell(column)).join(",");
  const body = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(","));
  return `${UTF8_BOM}${[headerLine, ...body].join(CSV_NEWLINE)}${CSV_NEWLINE}`;
};

export const localDateYmd = (now: Date): string => {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
