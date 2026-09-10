#!/usr/bin/env node
/**
 * Gera sitemap.xml a partir das páginas públicas, com lastmod real (mtime do arquivo).
 * Uso: node scripts/gerar-sitemap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://fantonisoftware.com.br';

// Páginas públicas e indexáveis. Arquivos de cliente (S3Capital, ecoparque)
// e sobras (tmp_navi) ficam de fora de propósito.
const PAGINAS = [
  { arquivo: 'index.html',        url: '/',             priority: '1.0', changefreq: 'weekly'  },
  { arquivo: 'pdv-offline.html',  url: '/pdv-offline',  priority: '0.8', changefreq: 'monthly' },
  { arquivo: 'certificados.html', url: '/certificados', priority: '0.8', changefreq: 'monthly' },
  { arquivo: 'downloads.html',    url: '/downloads',    priority: '0.5', changefreq: 'monthly' },
  { arquivo: 'politica-de-privacidade.html', url: '/politica-de-privacidade', priority: '0.3', changefreq: 'yearly' },
];

const raiz = path.resolve(import.meta.dirname, '..');

const entradas = PAGINAS.filter(p => {
  const existe = fs.existsSync(path.join(raiz, p.arquivo));
  if (!existe) console.warn(`  aviso: ${p.arquivo} não encontrado, fora do sitemap`);
  return existe;
}).map(p => {
  const lastmod = fs.statSync(path.join(raiz, p.arquivo)).mtime.toISOString().slice(0, 10);
  return `  <url>
    <loc>${BASE}${p.url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entradas.join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(raiz, 'sitemap.xml'), xml, 'utf8');
console.log(`sitemap.xml gerado com ${entradas.length} URLs`);
