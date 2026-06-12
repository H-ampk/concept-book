export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** クイズ選択肢表示用に、本文中の概念名を「（＿＿）」へ置換する */
export function maskConceptNameInText(
  text: string,
  conceptNames: string[],
  replacement = "（＿＿）"
): string {
  let result = text;

  const names = Array.from(
    new Set(conceptNames.map((name) => name.trim()).filter(Boolean))
  ).sort((a, b) => b.length - a.length);

  for (const name of names) {
    const escaped = escapeRegExp(name);
    const pattern = new RegExp(`${escaped}(?:[（(][^）)]*[）)])?`, "g");
    result = result.replace(pattern, replacement);
  }

  return result;
}
