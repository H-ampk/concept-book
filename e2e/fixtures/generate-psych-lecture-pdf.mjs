import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: "Yu Gothic", "Meiryo", "MS Gothic", sans-serif; font-size: 18px; line-height: 1.7; margin: 0; }
    .page { padding: 48px; }
    h1 { font-size: 24px; }
  </style>
</head>
<body>
  <div class="page">
    <h1>心理学概論 第4回</h1>
    <p>オペラント条件づけ</p>
    <p>強化とは、ある行動の直後に刺激を提示することで、その行動の生起頻度が増加することである。</p>
    <p>シェイピングとは、目標行動に近い行動を段階的に強化して形成する方法である。</p>
    <p>弱化とは、行動の生起頻度を低下させることである。</p>
  </div>
  <div class="page" style="page-break-before: always">
    <h1>2ページ目</h1>
    <p>復習: 強化は行動の生起頻度を増やす。</p>
    <p>このページにも強化という語がある。</p>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
const buf = await page.pdf({ format: "A4", printBackground: true });
const out = join(dirname(fileURLToPath(import.meta.url)), "psych-lecture-4.pdf");
writeFileSync(out, buf);
await browser.close();
console.log("wrote", out, buf.length);
