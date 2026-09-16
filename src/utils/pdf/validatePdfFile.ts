const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

export const MAX_LEARNING_MATERIAL_PDF_BYTES = 50 * 1024 * 1024;

export const looksLikePdfBytes = (bytes: Uint8Array): boolean => {
  if (bytes.length < PDF_MAGIC.length) {
    return false;
  }
  return PDF_MAGIC.every((value, index) => bytes[index] === value);
};

export const validatePdfFile = async (
  file: File
): Promise<{ ok: true } | { ok: false; message: string }> => {
  if (file.size <= 0) {
    return { ok: false, message: "空のファイルは登録できません。" };
  }
  if (file.size > MAX_LEARNING_MATERIAL_PDF_BYTES) {
    return {
      ok: false,
      message: `PDFのサイズは ${Math.floor(MAX_LEARNING_MATERIAL_PDF_BYTES / (1024 * 1024))}MB 以下にしてください。`
    };
  }
  const mime = (file.type || "").trim().toLowerCase();
  const name = file.name.toLowerCase();
  const mimeLooksPdf = mime === "application/pdf" || mime === "";
  const nameLooksPdf = name.endsWith(".pdf");
  if (!mimeLooksPdf && !nameLooksPdf) {
    return { ok: false, message: "PDFファイルを選択してください。" };
  }
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!looksLikePdfBytes(header)) {
    return { ok: false, message: "PDFファイルとして読み取れませんでした。" };
  }
  return { ok: true };
};
