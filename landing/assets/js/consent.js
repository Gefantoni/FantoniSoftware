/* Banner de consentimento — LGPD + Google Consent Mode v2.

   O estado default (denied) é definido inline no <head> de cada página; aqui
   tratamos a escolha do usuário e a atualização em tempo real.

   O banner injeta o próprio HTML e CSS: basta a página carregar este arquivo.
   Antes o markup era copiado na home, e as outras páginas ficaram sem banner —
   com o consent em denied e nenhuma forma de aceitar. */
(function () {
  'use strict';

  var CHAVE = 'fs_consent';

  function ler() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function gravar(v) {
    try { localStorage.setItem(CHAVE, v); } catch (e) {}
  }

  function aplicar(estado) {
    var concedido = estado === 'granted';
    window.__fsConsent = estado;

    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        ad_storage:         concedido ? 'granted' : 'denied',
        ad_user_data:       concedido ? 'granted' : 'denied',
        ad_personalization: concedido ? 'granted' : 'denied',
        analytics_storage:  concedido ? 'granted' : 'denied'
      });
    }

    // O Pixel só carrega com consentimento; a própria função verifica __fsConsent.
    if (concedido && typeof window.__loadFbPixel === 'function') window.__loadFbPixel();
  }

  // Quem já escolheu não vê o banner — só reaplicamos a decisão.
  var escolhido = ler();
  if (escolhido) { aplicar(escolhido); return; }

  /* ---------- Estilos ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '#fs-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:3000;',
    'max-width:720px;margin:0 auto;background:#0f172a;color:#e2e8f0;',
    'border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px 20px;',
    'display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap;',
    'box-shadow:0 18px 50px rgba(0,0,0,.35);line-height:1.6;',
    "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px}",
    /* precisa vencer o display:flex acima, que é seletor de ID */
    '#fs-consent[hidden]{display:none!important}',
    '#fs-consent p{margin:0;flex:1 1 320px}',
    '#fs-consent a{color:#93c5fd}',
    '#fs-consent .acoes{display:flex;gap:10px;flex-shrink:0}',
    '#fs-consent button{padding:10px 20px;border-radius:100px;font-size:14px;font-weight:700;',
    'cursor:pointer;border:1px solid transparent;font-family:inherit}',
    '#fs-recusar{background:transparent;color:#cbd5e1;border-color:rgba(255,255,255,.2)}',
    '#fs-recusar:hover{background:rgba(255,255,255,.06)}',
    '#fs-aceitar{background:#1d4ed8;color:#fff}',
    '#fs-aceitar:hover{background:#1e40af}',
    '@media(max-width:560px){#fs-consent .acoes{width:100%}#fs-consent .acoes button{flex:1}}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- Markup ---------- */
  var banner = document.createElement('div');
  banner.id = 'fs-consent';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Aviso de cookies');
  banner.innerHTML =
    '<p>Usamos cookies para medir o desempenho do site e das nossas campanhas. ' +
    'Você escolhe. <a href="/politica-de-privacidade">Saber mais</a>.</p>' +
    '<div class="acoes">' +
      '<button type="button" id="fs-recusar">Recusar</button>' +
      '<button type="button" id="fs-aceitar">Aceitar</button>' +
    '</div>';
  document.body.appendChild(banner);

  function decidir(estado) {
    gravar(estado);
    aplicar(estado);
    banner.remove();
  }

  document.getElementById('fs-aceitar').addEventListener('click', function () { decidir('granted'); });
  document.getElementById('fs-recusar').addEventListener('click', function () { decidir('denied'); });
})();
