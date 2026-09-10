/* =========================================================
   Camada de rastreamento Google (GA4 + Google Ads)
   Não altera nada do Meta Pixel.
   ========================================================= */
(function () {
  'use strict';

  // TODO: preencher após criar as conversões no Google Ads
  var AW = {
    id:        'AW-XXXXXXXXX',
    whatsapp:  'AW-XXXXXXXXX/whatsappLabel',
    lead:      'AW-XXXXXXXXX/leadLabel',
    checkout:  'AW-XXXXXXXXX/checkoutLabel'
  };

  /* Um rótulo real do Google Ads pode conter a letra X, então checamos o
     marcador completo de placeholder em vez de um X solto. */
  function configurado(valor) {
    return typeof valor === 'string' && valor.indexOf('XXXXXXXXX') === -1;
  }

  if (typeof gtag === 'function' && configurado(AW.id)) {
    gtag('config', AW.id, { allow_enhanced_conversions: true });
  }

  /* ---------- 1. gclid e UTMs: guardar por 90 dias ---------- */
  var params = new URLSearchParams(location.search);
  var NOVENTA_DIAS = 7776000;

  function setCookie(nome, valor) {
    document.cookie = nome + '=' + encodeURIComponent(valor) +
      ';max-age=' + NOVENTA_DIAS + ';path=/;SameSite=Lax';
  }
  function getCookie(nome) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + nome + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  var gclid = params.get('gclid') || params.get('wbraid') || params.get('gbraid');
  if (gclid) setCookie('fs_gclid', gclid);

  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term'].forEach(function (k) {
    var v = params.get(k);
    if (v) setCookie('fs_' + k, v);
  });

  function getGclid() { return getCookie('fs_gclid'); }
  function getUtms() {
    return {
      utm_source:   getCookie('fs_utm_source'),
      utm_medium:   getCookie('fs_utm_medium'),
      utm_campaign: getCookie('fs_utm_campaign'),
      utm_term:     getCookie('fs_utm_term')
    };
  }

  /* Injeta gclid e UTMs como campos ocultos em todo formulário */
  function stampForms() {
    var valores = getUtms();
    valores.gclid = getGclid();
    document.querySelectorAll('form').forEach(function (f) {
      Object.keys(valores).forEach(function (nome) {
        var i = f.querySelector('input[name="' + nome + '"]');
        if (!i) {
          i = document.createElement('input');
          i.type = 'hidden';
          i.name = nome;
          f.appendChild(i);
        }
        i.value = valores[nome];
      });
    });
  }
  document.addEventListener('DOMContentLoaded', stampForms);

  /* ---------- 2. Origem da visita ---------- */
  function origem() {
    return getGclid() ? 'google-ads'
         : (getCookie('fs_utm_source') || (document.referrer ? 'referral' : 'direto'));
  }

  /* ---------- 3. Clique em WhatsApp ----------
     O wa.me NÃO repassa o gclid. Carimbamos a origem dentro do próprio
     texto da mensagem para identificar a conversa. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!a) return;

    if (typeof gtag === 'function') {
      gtag('event', 'whatsapp_click', {
        origem: origem(),
        secao:  (a.closest('section') || {}).id || 'indefinida'
      });
      if (configurado(AW.whatsapp)) {
        gtag('event', 'conversion', {
          send_to: AW.whatsapp, value: 40.0, currency: 'BRL'
        });
      }
    }

    try {
      var url  = new URL(a.href);
      var base = url.searchParams.get('text') || 'Olá! Quero saber mais sobre o Fantoni PDV.';
      var tag  = getGclid() ? 'ads' : origem();
      if (base.indexOf('[' + tag + ']') === -1) {
        url.searchParams.set('text', base + ' [' + tag + ']');
        a.href = url.toString();
      }
    } catch (err) { /* link malformado: segue sem carimbo */ }
  }, true);

  /* ---------- 4. API pública para os formulários ---------- */
  window.FSTrack = {
    lead: function (tipo, dados) {
      if (typeof gtag !== 'function') return;
      gtag('event', 'generate_lead', {
        currency: 'BRL', value: 80.0, tipo_lead: tipo, origem: origem()
      });
      if (configurado(AW.lead)) {
        gtag('set', 'user_data', {
          email: ((dados && dados.email) || '').trim().toLowerCase(),
          phone_number: normalizaTelefone(dados && dados.whatsapp)
        });
        gtag('event', 'conversion', {
          send_to: AW.lead, value: 80.0, currency: 'BRL'
        });
      }
    },
    checkout: function (plano, valor) {
      if (typeof gtag !== 'function') return;
      gtag('event', 'begin_checkout', {
        currency: 'BRL', value: valor || 0, items: [{ item_name: plano }]
      });
      if (configurado(AW.checkout)) {
        gtag('event', 'conversion', {
          send_to: AW.checkout, value: valor || 0, currency: 'BRL'
        });
      }
    },
    getGclid: getGclid,
    getUtms:  getUtms
  };

  /* E.164 para conversões otimizadas */
  function normalizaTelefone(t) {
    if (!t) return '';
    var d = String(t).replace(/\D/g, '');
    if (d.length >= 10 && d.length <= 11) d = '55' + d;
    return d ? '+' + d : '';
  }

  /* ---------- 5. Micro-conversões (secundárias no Ads) ---------- */
  var vistos = {};
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var id = en.target.id;
        if (en.isIntersecting && !vistos[id]) {
          vistos[id] = true;
          if (typeof gtag === 'function') gtag('event', 'view_section', { secao: id });
        }
      });
    }, { threshold: 0.4 });
    document.addEventListener('DOMContentLoaded', function () {
      ['preco', 'videos', 'depoimentos'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) io.observe(el);
      });
    });
  }
})();
