/* Banner de consentimento — LGPD + Google Consent Mode v2.
   O estado default (denied) é definido inline no <head>; aqui só tratamos
   a escolha do usuário e a atualização em tempo real. */
(function () {
  'use strict';

  var CHAVE = 'fs_consent';
  var banner = document.getElementById('cookie-banner');
  if (!banner) return;

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

    // O Pixel só carrega com consentimento; a função verifica __fsConsent.
    if (concedido && typeof window.__loadFbPixel === 'function') window.__loadFbPixel();
  }

  function decidir(estado) {
    gravar(estado);
    aplicar(estado);
    banner.hidden = true;
  }

  document.getElementById('cookie-aceitar').addEventListener('click', function () { decidir('granted'); });
  document.getElementById('cookie-recusar').addEventListener('click', function () { decidir('denied'); });

  // Só mostra o banner para quem ainda não escolheu.
  if (!ler()) banner.hidden = false;
})();
