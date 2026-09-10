# Estrutura do projeto — fantonisoftware.com.br

> Levantado em 10/09/2026. Atualizar quando a stack mudar.

## Stack

| Camada | Tecnologia |
|---|---|
| Front | HTML estático + CSS e JS **inline**, sem framework, sem bundler |
| Animações | AOS 2.3.4 — hoje carregado do `unpkg.com` (dependência externa) |
| Rotas `/api/*` | **Vercel Serverless Functions**, Node ESM (`"type": "module"`) |
| Banco | **Supabase** (PostgREST via `fetch`, sem SDK) |
| Pagamentos | **Asaas** (`/api/checkout`, `/api/checkout-certificado`) |
| Rastreamento | GA4 `G-LJ8G03VLL6` + Meta Pixel `2035088657416576` (+ CAPI no servidor) |
| Deploy | Vercel, projeto `pdv`, **integração com Git** — push na `main` publica em produção |

## Comandos

```bash
npm run build     # gera dist/index.html minificado (clean-css + terser)
vercel dev        # servidor local com as rotas /api/*
vercel deploy     # preview
git push origin main   # dispara deploy de PRODUÇÃO automaticamente
```

> ⚠️ **O build não roda em produção.** `landing/vercel.json` tem `buildCommand: ""` e
> `outputDirectory: "."`. O `index.html` servido é o não minificado (~181 KB).
> O `dist/` existe mas não é usado.

## Onde ficam as coisas

- **`<head>` da home:** `index.html`, linhas 1–140. Contém meta tags, 2 blocos JSON-LD,
  gtag.js, `window.__fbPixelId`, preconnects e o CSS inline (`<style>` gigante).
- **HTML único.** Não há partials nem includes — cada página é um arquivo completo e
  duplica o próprio CSS. Páginas: `index.html`, `pdv-offline.html`, `certificados.html`,
  `downloads.html`, `ecoparque/index.html`, `S3Capital.html`.
- **Scripts inline:** 11 blocos `<script>` dentro de `index.html`, concentrados no final
  do arquivo (a partir da linha ~2600). Não existe `assets/js/`.
- **Roteamento:** `/vercel.json` na **raiz do repositório** (não em `landing/`) governa
  produção — `builds` legacy + `routes`. `landing/vercel.json` só define cache headers.

## Formulários e destino dos leads

| Formulário | Rota | Grava em | `origem` |
|---|---|---|---|
| `#lead-form` (teste 7 dias) | `POST /api/lead` | Supabase, tabela **`leads`** | `Teste Site` |
| `#consultor-form` | `POST /api/consultor` | Supabase, tabela **`leads`** | `Consultor Site` |
| `#checkout-form` | `POST /api/checkout` | Supabase, tabela **`checkouts`** + cobrança no Asaas | `Assinatura Mensal` / `Plano Único` |

**Destino final do lead:** tabela `leads` do projeto Supabase `dqhkudvdaxvwodcijczb`,
acessada com `SUPABASE_SERVICE_KEY` (formato `sb_secret_`). O acompanhamento é feito
direto no **Table Editor** do Supabase, filtrando pela coluna `origem`.

Existe também um `LEAD_WEBHOOK_URL` opcional em todas as rotas — se preenchido, cada lead
é reenviado para esse endpoint. **Hoje não está configurado.**

### ⚠️ Falha conhecida: perda silenciosa de lead

As três rotas gravam dentro de `Promise.allSettled([...])`. Se o insert no Supabase
falhar, o erro é engolido e a rota responde **`200 {"success": true}`** mesmo assim —
o lead é perdido sem nenhum sinal para o usuário nem para o cliente. Ver Tarefa 02.

## Variáveis de ambiente (Vercel → projeto `pdv`)

`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ASAAS_API_KEY`, `META_CAPI_TOKEN`
(opcionais: `LEAD_WEBHOOK_URL`, `DOWNLOAD_WINDOWS`, `DOWNLOAD_ANDROID`, `DOWNLOAD_IOS`)

## PageSpeed (mobile)

Medido em Moto G Power emulado, Lighthouse 13.4.1, 4G lento.

| Momento | Desemp. | Acess. | Práticas | SEO | LCP | TBT | CLS | Payload |
|---|---|---|---|---|---|---|---|---|
| **Antes** (10/09/2026 11:36) | 96 | 93 | 96 | 100 | 2,6 s | 90 ms | 0 | 3.568 KiB |
| **Depois** | *(a medir)* | | | | | | | |

Metas: Desempenho ≥ 98 · LCP ≤ 2,2 s · Payload ≤ 900 KiB · TBT ≤ 60 ms ·
Acessibilidade ≥ 98 · Práticas ≥ 96 · SEO 100 · zero erro no console.

> O painel de campo (CrUX) veio **sem dados** — não há tráfego real suficiente.
> Depois da campanha no ar, ele passa a valer mais que o laboratório.
