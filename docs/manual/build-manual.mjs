#!/usr/bin/env node
// Renders docs/manual/manual-usuario.html to a PDF using an installed
// Chromium-based browser (Edge or Chrome) in headless mode. No npm deps.
//
//   npm run manual          # → docs/manual/manual-usuario.pdf
//   BROWSER="C:\path\to\chrome.exe" npm run manual   # override the browser
//
// The HTML is fully self-contained (styles + logo inlined), so the print is
// deterministic and works offline.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, "manual-usuario.html");
const pdfPath = join(here, "manual-usuario.pdf");

if (!existsSync(htmlPath)) {
  console.error(`No se encontró el HTML del manual en:\n  ${htmlPath}`);
  process.exit(1);
}

// Candidate browsers: explicit override first, then the usual Windows install
// locations for Edge and Chrome.
const candidates = [
  process.env.BROWSER,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const browser = candidates.find((p) => existsSync(p));

if (!browser) {
  console.error(
    "No se encontró Microsoft Edge ni Google Chrome.\n" +
      "Instalá uno de los dos, o indicá la ruta con la variable de entorno BROWSER.\n" +
      "Ejemplo (PowerShell):\n" +
      '  $env:BROWSER="C:\\ruta\\a\\chrome.exe"; npm run manual'
  );
  process.exit(1);
}

// Headless Chromium needs a writable, isolated profile dir to print reliably.
const profileDir = mkdtempSync(join(tmpdir(), "medinv-manual-"));
const url = pathToFileURL(htmlPath).href;

console.log(`Navegador : ${browser}`);
console.log(`Fuente    : ${htmlPath}`);
console.log("Generando el PDF…");

const args = [
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer", // newer flag; --print-to-pdf-no-header is the legacy one
  "--print-to-pdf-no-header",
  `--user-data-dir=${profileDir}`,
  `--print-to-pdf=${pdfPath}`,
  url,
];

const res = spawnSync(browser, args, { stdio: "inherit" });

rmSync(profileDir, { recursive: true, force: true });

if (res.status !== 0 || !existsSync(pdfPath)) {
  console.error(
    "\nNo se pudo generar el PDF. Probá con --headless clásico si tu versión es vieja:\n" +
      `  "${browser}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "${url}"`
  );
  process.exit(1);
}

console.log(`\n✔ PDF generado en:\n  ${pdfPath}`);
