#!/usr/bin/env node
/**
 * Exporta leads com gclid no formato de upload de conversões offline do Google Ads.
 *
 * Uso:
 *   node scripts/exportar-conversoes.mjs                      # todos os leads com gclid
 *   node scripts/exportar-conversoes.mjs --desde 2026-09-01   # a partir de uma data
 *   node scripts/exportar-conversoes.mjs --nome "Cliente Fechado" --valor 1188
 *
 * Requer SUPABASE_URL e SUPABASE_SERVICE_KEY no ambiente.
 * Saída: conversoes-<data>.csv na raiz.
 */

import fs from 'node:fs';

const URL_BASE = process.env.SUPABASE_URL;
const KEY      = process.env.SUPABASE_SERVICE_KEY;

if (!URL_BASE || !KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no ambiente.');
  process.exit(1);
}

// ---- argumentos ----
const args = process.argv.slice(2);
function arg(nome, padrao) {
  const i = args.indexOf('--' + nome);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
}
const NOME_CONVERSAO = arg('nome', 'Lead Site');
const VALOR          = arg('valor', '80');
const MOEDA          = arg('moeda', 'BRL');
const DESDE          = arg('desde', null);

// ---- busca ----
let url = `${URL_BASE}/rest/v1/leads?select=gclid,data_hora,created_at,origem`
        + `&gclid=not.is.null&order=created_at.asc`;
if (DESDE) url += `&created_at=gte.${DESDE}`;

const resp = await fetch(url, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});

if (!resp.ok) {
  console.error('Erro ao consultar o Supabase:', resp.status, await resp.text());
  process.exit(1);
}

const leads = await resp.json();

if (leads.length === 0) {
  console.log('Nenhum lead com gclid encontrado.' + (DESDE ? ` (desde ${DESDE})` : ''));
  console.log('Isso é esperado enquanto não houver tráfego do Google Ads.');
  process.exit(0);
}

/* O Google Ads exige "yyyy-MM-dd HH:mm:ss+|-HH:mm" ou o formato do fuso declarado
   no cabeçalho Parameters. Usamos data_hora quando existe; senão convertemos o
   created_at (UTC) para America/Sao_Paulo. */
function formataData(lead) {
  if (lead.data_hora) return lead.data_hora.replace('T', ' ').replace('-03:00', '').trim();
  const d = new Date(lead.created_at);
  return d.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const linhas = [
  'Parameters:TimeZone=America/Sao_Paulo',
  'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
  ...leads.map(l => [
    csvEscape(l.gclid),
    csvEscape(NOME_CONVERSAO),
    csvEscape(formataData(l)),
    csvEscape(VALOR),
    csvEscape(MOEDA),
  ].join(',')),
];

const nomeArquivo = `conversoes-${new Date().toISOString().slice(0, 10)}.csv`;
fs.writeFileSync(nomeArquivo, linhas.join('\n') + '\n', 'utf8');

console.log(`${leads.length} conversão(ões) exportada(s) para ${nomeArquivo}`);
console.log('Suba em: Google Ads → Ferramentas → Conversões → Uploads.');
