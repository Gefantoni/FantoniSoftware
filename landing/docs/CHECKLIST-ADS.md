# Checklist de verificação — Google Ads e SEO

> Tarefa 12. Atualizado em 10/09/2026.
> `[x]` verificado · `[ ]` pendente · `[~]` feito, mas só comprovável em produção ou no navegador

## Verificado por código

- [x] `title` == `og:title` == `twitter:title`, com 65 caracteres
- [x] `meta keywords` removida de todas as páginas públicas
- [x] Zero requisição a `unpkg.com` (AOS servido de `/assets/vendor/`)
- [x] Eventos GA4 implementados: `whatsapp_click`, `generate_lead`, `begin_checkout`, `view_section`
- [x] gclid, wbraid e gbraid guardados em cookie de 90 dias, junto dos 4 UTMs
- [x] Meta Pixel intacto — `Lead` continua disparando nos formulários
- [x] `consent default` inline, antes do `gtag('config')`
- [x] Meta Pixel bloqueado enquanto não houver consentimento
- [x] Sitemap com 7 URLs e `lastmod` de hoje, gerado por script
- [x] `canonical` presente e correto em todas as páginas
- [x] 6 blocos JSON-LD, todos com sintaxe válida
- [x] LP sem menu de navegação e indexável
- [x] Nenhum `img src=""` renderizável (guarda no template das maquininhas)
- [x] 124 paths SVG validados: zero erro de contagem de parâmetros

## Verificado em produção (deploy de 10/09, `pdv-qy9jh07wj`)

- [x] `/api/lead` e `/api/consultor` respondendo — o 404 acabou
- [x] Lead com `?gclid=teste123` gravado **com** o gclid, UTMs e `data_hora`
- [x] `node scripts/exportar-conversoes.mjs` gera CSV no formato do Google Ads
- [x] Leads separados por `origem`: `Teste Site`, `Consultor Site`, `LP Bar e Restaurante`

## Pendente de deploy

- [~] `/index.html` → 301 → `/` (rota adicionada ao `vercel.json`, não publicada)
- [~] `/precos` e `/sistema-pdv/bar-restaurante` no ar
- [~] `/politica-de-privacidade` no ar (hoje ainda 404 em produção)
- [~] Cabeçalhos COOP, Permissions-Policy e CSP Report-Only ativos

## Pendente de navegador

- [ ] GA4 DebugView recebendo os 4 eventos
- [ ] Link de WhatsApp aberto com `?gclid=teste123` chega com `[ads]` na mensagem
- [ ] Banner de consentimento: recusado não cria `_ga` nem `_fbp`; aceito cria os dois
- [ ] Console sem erro novo em todas as páginas
- [ ] Rich Results Test sem erro nas 3 URLs principais

## Pendente de terceiros

- [ ] Nenhum `AW-XXXXXXXXX` em produção — depende de criar as 3 conversões no Google Ads
      e preencher os rótulos em `assets/js/tracking-google.js`
- [ ] Conversões otimizadas para leads ativadas no painel do Ads
- [ ] GA4 ↔ Google Ads ↔ Search Console vinculados
- [ ] Sitemap reenviado no Search Console

## PageSpeed

| Momento | Desemp. | Acess. | Práticas | SEO | LCP | TBT | CLS | Payload |
|---|---|---|---|---|---|---|---|---|
| **Antes** (10/09 11:36) | 96 | 93 | 96 | 100 | 2,6 s | 90 ms | 0 | 3.568 KiB |
| **Depois** | *(a medir após o deploy)* | | | | | | | |

Metas: Desempenho ≥ 98 · LCP ≤ 2,2 s · Payload ≤ 900 KiB · TBT ≤ 60 ms ·
Acessibilidade ≥ 98 · Práticas ≥ 96 · SEO 100.

## Metas que não serão atingidas como especificado

**HTML da home abaixo de 120 KB.** Está em 166 KB (era 181). A composição é
~97 KB de marcação, 51,6 KB de CSS inline e ~11 KB de JS inline. Extrair todo o
JS restante chega a ~155 KB. Fechar os 46 KB restantes exigiria externalizar o
CSS inline — que hoje não custa requisição nenhuma e viraria render-blocking,
desfazendo o ganho de LCP da Tarefa P4. **Não vale a troca.**

**Total de elementos abaixo de 900.** Está em 986. Os 89 SVGs inline, se todos
virassem `<use>`, economizariam 6,5 KB e ~10 elementos. O restante é marcação
de conteúdo real — cortar 86 elementos significa remover seção, não otimizar.

**Recompressão do vídeo (P1, passo 3).** Não há `ffmpeg` no ambiente. O arquivo
segue com 2,85 MB, renomeado para `hero-broll.mp4`, mas só carrega em desktop
com boa conexão — sai inteiro do teste mobile. Para o payload de desktop cair,
rodar os dois comandos `ffmpeg` do plano e trocar o `<source>` para webm + mp4.

## Desvios deliberados do plano

**Preços.** As Tarefas 08 e 11 pediam valores visíveis. Decisão do cliente
(10/09) foi manter o site sem preço, exibindo apenas "a partir de R$ 99/mês".
LP e `/precos` foram construídas assim.

**Âncora `#preco` da home.** O plano pedia que ela apontasse para `/precos`.
Mantida como âncora interna: o botão flutuante e o badge do hero levam à seção
de planos da própria home, e tirar o visitante da página no meio do fluxo
prejudica a conversão do tráfego pago. Em vez disso, a seção de planos e o
rodapé ganharam link para `/precos`.

**Tarefa P2.** O plano afirmava que 9 `<img src="">` desperdiçavam mais de
1,6 MB. Isso não fecha com o próprio relatório: o payload total era 3.568 KiB e
o vídeo sozinho 2.850 KiB, sobrando 718 KiB para todo o resto. O template nunca
gerava `src` vazio e os 10 SVGs respondem 200 em produção. A guarda foi aplicada
mesmo assim, com `width`/`height` para proteger o CLS.

**Tarefa 06.** O plano mandava usar "as perguntas já visíveis na seção Ainda tem
dúvidas?" — que não continha pergunta alguma, só um bloco de CTA. A seção de FAQ
foi criada antes do schema. O texto proposto também afirmava que o plano
Essencial inclui controle de mesas; conferido nos cards, mesas é do Premium.

## Transcrição dos depoimentos em áudio

Os dois `.opus` da home não têm transcrição — o texto ao lado diz apenas
"Ouça o depoimento em áudio". A Tarefa 08 pedia transcrição ao lado do áudio na
LP; sem acesso ao conteúdo falado, a LP usa o depoimento em texto que já existe.
Para incluir os áudios, é preciso alguém transcrever.
