# Plano de Ação — PageSpeed fantonisoftware.com.br
> Análise feita em: 30/03/2026 | Modo: Celular

---

## 📊 Scores Atuais

| Métrica | Score | Status |
|---|---|---|
| Desempenho | **47** | 🔴 Crítico |
| Acessibilidade | **94** | 🟢 Bom |
| Práticas Recomendadas | **73** | 🟡 Médio |
| SEO | **100** | 🟢 Perfeito |

## ⏱️ Métricas de Tempo

| Métrica | Valor | Meta |
|---|---|---|
| First Contentful Paint (FCP) | **11,1s** 🔴 | < 1,8s |
| Largest Contentful Paint (LCP) | **32,6s** 🔴 | < 2,5s |
| Total Blocking Time (TBT) | **380ms** 🟡 | < 200ms |
| Speed Index | **11,1s** 🔴 | < 3,4s |
| Cumulative Layout Shift (CLS) | **0** 🟢 | < 0,1 |

> **Resumo:** O problema central é o **carregamento extremamente lento** (LCP de 32,6s). O CLS é perfeito, então o layout não treme — o problema é puramente de performance de carregamento.

---

## 🚨 Problemas Críticos (FAIL)

### 1. Imagens não otimizadas
- Imagens sendo servidas em formato não moderno (provavelmente PNG/JPG em vez de WebP/AVIF)
- Sem lazy loading
- Sem dimensões explícitas (width/height)

### 2. Recursos bloqueando renderização
- CSS e JS carregados de forma síncrona no `<head>`, atrasando o primeiro paint

### 3. Cache ineficiente
- Recursos sem headers de cache de longa duração

### 4. JavaScript legado (polyfills desnecessários)
- Bundle JS contém polyfills para browsers antigos que a maioria dos usuários não usa

### 5. JavaScript não usado
- Código JS sendo carregado mas não executado na página inicial

### 6. CSS não usado
- Folhas de estilo carregadas com muito CSS que não se aplica à página

### 7. Tempo de execução de JavaScript alto
- JS travando a thread principal por muito tempo (TBT 380ms)

### 8. Trabalho excessivo na thread principal
- Tarefas longas bloqueando a interatividade

### 9. Reflow forçado
- Código JS lendo e escrevendo no DOM em sequência causando layouts forçados

---

## ⚠️ Problemas Médios (AVG)

- **Fontes sem font-display**: Fontes bloqueando renderização sem `font-display: swap`
- **Payload de rede grande**: Volume total de dados baixado é excessivo

---

## 🗺️ Plano de Ação Priorizado

### Prioridade 1 — Alto impacto, relativamente fácil (fazer primeiro)

| # | Ação | Impacto esperado |
|---|---|---|
| 1 | Converter todas as imagens para **WebP** | -3 a 5s no LCP |
| 2 | Adicionar `loading="lazy"` nas imagens abaixo do fold | -2s no FCP/LCP |
| 3 | Adicionar `width` e `height` explícitos em todas as `<img>` | Elimina CLS potencial |
| 4 | Adicionar `font-display: swap` nas fontes | -1s no FCP |
| 5 | Adicionar headers de cache no servidor (nginx/express) | Melhora visitas recorrentes |

### Prioridade 2 — Alto impacto, médio esforço

| # | Ação | Impacto esperado |
|---|---|---|
| 6 | Mover CSS não crítico para carregar de forma assíncrona | -2s no FCP |
| 7 | Adicionar `defer` ou `async` nos scripts JS | -1 a 2s no FCP |
| 8 | Remover/minificar CSS não usado (PurgeCSS) | -0,5 a 1s |
| 9 | Fazer tree-shaking e remover JS não usado | -0,5 a 1s no TBT |

### Prioridade 3 — Médio esforço, impacto crescente

| # | Ação | Impacto esperado |
|---|---|---|
| 10 | Implementar **Critical CSS inline** no `<head>` | FCP < 3s |
| 11 | Corrigir reflows forçados (ler DOM antes de escrever) | Reduz TBT |
| 12 | Configurar **preload** para LCP image e fontes críticas | -2 a 3s no LCP |
| 13 | Remover polyfills desnecessários (transpile target moderno) | Reduz bundle JS |

---

## 🎯 Meta realista após correções

| Métrica | Atual | Meta |
|---|---|---|
| Desempenho | 47 | **75-85** |
| FCP | 11,1s | < 2,5s |
| LCP | 32,6s | < 5s |
| TBT | 380ms | < 200ms |

---

## 💬 Prompt para Claude Code

```
Você vai otimizar o site fantonisoftware.com.br para performance mobile.
O relatório do PageSpeed Insights (mobile) retornou score 47 de desempenho, com:
- FCP: 11,1s | LCP: 32,6s | TBT: 380ms | Speed Index: 11,1s | CLS: 0

Analise todos os arquivos HTML, CSS e JS do projeto e execute as seguintes otimizações:

## FASE 1 — Imagens (maior impacto)
1. Verifique todas as tags <img> no HTML e identifique as que estão sem `width` e `height`. Adicione os atributos com as dimensões corretas de cada imagem.
2. Adicione `loading="lazy"` em todas as imagens que estão abaixo do fold (não na hero section).
3. Se houver imagens em PNG ou JPG, converta para WebP usando sharp ou imagemin. Atualize as referências no HTML para usar <picture> com fallback.
4. Para a imagem LCP (hero/primeira imagem visível), adicione `<link rel="preload" as="image">` no <head>.

## FASE 2 — CSS
5. Identifique o CSS crítico (above-the-fold) e inline-o no <head> dentro de uma tag <style>.
6. Carregue o restante do CSS de forma assíncrona: `<link rel="preload" as="style" onload="this.rel='stylesheet'">`.
7. Adicione `<noscript>` como fallback para o CSS assíncrono.
8. Se estiver usando um framework CSS (Bootstrap, Tailwind etc.), configure PurgeCSS ou tree-shaking para remover classes não utilizadas.

## FASE 3 — JavaScript
9. Adicione `defer` em todos os scripts no <head> que não precisam executar antes da renderização.
10. Mova scripts que podem esperar para o final do <body> ou use `defer`.
11. Se houver bundler (webpack/vite/esbuild), configure o target para browsers modernos (ES2020+) para eliminar polyfills desnecessários.
12. Identifique imports de bibliotecas inteiras onde só parte é usada (ex: lodash, moment) e substitua por imports específicos ou alternativas menores.

## FASE 4 — Fontes
13. Em todas as declarações `@font-face` no CSS, adicione `font-display: swap`.
14. Se estiver carregando fontes do Google Fonts via <link>, adicione `&display=swap` na URL.
15. Considere adicionar `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` antes do link das fontes.

## FASE 5 — Cache e Headers
16. Se o servidor for Express/Node, adicione middleware de cache para assets estáticos:
    - Imagens: max-age=31536000 (1 ano)
    - CSS/JS com hash: max-age=31536000
    - HTML: no-cache
17. Se usar nginx, configure os headers correspondentes.

## FASE 6 — Reflows e DOM
18. Revise o JavaScript e identifique padrões onde leitura e escrita no DOM se alternam dentro de loops (ex: offsetWidth/offsetHeight seguido de mudança de style). Agrupe as leituras antes das escritas.
19. Use `requestAnimationFrame` para animações em vez de setInterval/setTimeout com manipulação de DOM.

## Observações importantes:
- O projeto usa vanilla HTML/CSS/JS (sem framework de frontend como React/Vue)
- Mantenha o visual exatamente igual — apenas otimize a entrega
- Faça as mudanças em um branch separado para revisão antes de subir para produção
- Ao final, liste todas as mudanças feitas em um arquivo CHANGELOG-performance.md
- O servidor é Node.js + Express no VPS Ubuntu

Comece pela Fase 1 (imagens), pois é onde está o maior ganho potencial.
```
