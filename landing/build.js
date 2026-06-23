/**
 * Build script: CSS minification (clean-css) + JS minification (terser)
 * Gera dist/index.html com CSS e JS otimizados
 * Uso: node build.js
 */

import CleanCSS from 'clean-css';
import { minify as terserMinify } from 'terser';
import fs from 'fs';
import path from 'path';

const SRC = 'index.html';
const DIST_DIR = 'dist';
const DIST = path.join(DIST_DIR, 'index.html');

function kb(n) { return (n / 1024).toFixed(1) + 'KB'; }

// Coleta todos os matches de um regex com índice
function collectMatches(html, re) {
  const results = [];
  let m;
  const r = new RegExp(re.source, re.flags);
  while ((m = r.exec(html)) !== null) results.push({ ...m, full: m[0] });
  return results;
}

// =====================
// 1. CSS: minificar com clean-css
// =====================
async function minifyStyles(html) {
  console.log('\n--- CSS (clean-css level 1) ---');
  const cleanCSS = new CleanCSS({ level: 1, returnPromise: true });

  const blocks = collectMatches(html, /<style>([\s\S]*?)<\/style>/g)
    .filter(m => m[1].trim().length >= 20);

  let cssIn = 0, cssOut = 0;
  let out = html;

  for (const block of [...blocks].reverse()) {
    const inner = block[1];
    cssIn += inner.length;
    const res = await cleanCSS.minify(inner);
    if (res.errors?.length) console.warn('  clean-css error:', res.errors);
    const minCss = res.styles || inner;
    cssOut += minCss.length;
    out = out.slice(0, block.index) +
          '<style>' + minCss + '</style>' +
          out.slice(block.index + block.full.length);
  }

  const saved = cssIn - cssOut;
  console.log(`Antes : ${kb(cssIn)}`);
  console.log(`Depois: ${kb(cssOut)}`);
  console.log(`Ganho : ${kb(saved)} (-${Math.round((saved / cssIn) * 100)}%)`);
  return out;
}

// =====================
// 2. JS: minificar inline com terser
// =====================
async function minifyScripts(html) {
  console.log('\n--- JS inline (terser) ---');

  const blocks = collectMatches(html, /<script([^>]*)>([\s\S]*?)<\/script>/g)
    .filter(m => !m[1].includes('src='))
    .filter(m => !m[1].includes('application/ld+json'))
    .filter(m => m[2].trim().length >= 50);

  let jsIn = 0, jsOut = 0;
  let out = html;

  for (const block of [...blocks].reverse()) {
    const attrs = block[1], inner = block[2];
    jsIn += inner.length;
    try {
      const res = await terserMinify(inner, {
        ecma: 2022,
        compress: { passes: 2, dead_code: true, unused: true },
        mangle: true,
        format: { comments: false },
      });
      const min = res.code || inner;
      jsOut += min.length;
      out = out.slice(0, block.index) +
            `<script${attrs}>${min}</script>` +
            out.slice(block.index + block.full.length);
    } catch (e) {
      jsOut += inner.length;
      console.warn('  terser aviso:', e.message);
    }
  }

  const saved = jsIn - jsOut;
  console.log(`Antes : ${kb(jsIn)}`);
  console.log(`Depois: ${kb(jsOut)}`);
  console.log(`Ganho : ${kb(saved)} (-${Math.round((saved / jsIn) * 100)}%)`);
  return out;
}

// =====================
// Main
// =====================
async function build() {
  const srcHtml = fs.readFileSync(SRC, 'utf8');
  console.log(`\nInput: ${SRC} (${kb(srcHtml.length)})`);

  let html = srcHtml;
  html = await minifyStyles(html);
  html = await minifyScripts(html);

  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(DIST, html, 'utf8');

  const saved = srcHtml.length - html.length;
  console.log('\n--- Resultado Final ---');
  console.log(`Input : ${kb(srcHtml.length)}`);
  console.log(`Output: ${kb(html.length)}`);
  console.log(`Total : -${kb(saved)} (-${Math.round((saved / srcHtml.length) * 100)}%)`);
  console.log(`\n✓ Gerado: ${DIST}`);
}

build().catch(err => { console.error(err); process.exit(1); });
