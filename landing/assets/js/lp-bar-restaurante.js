/* Landing page de campanha — bar e restaurante.
   Formulário curto (3 campos) + facade do vídeo de demonstração. */
(function () {
  'use strict';

  // Mesmo vídeo de bares e restaurantes usado na home.
  // O .mp4 local tem 128 MB e está no .vercelignore — não existe em produção.
  var YT_ID = 'rQRBtZUJ36Y';

  /* ---------- Facade do vídeo: o iframe só entra no clique ---------- */
  var facade = document.getElementById('video-demo');
  if (facade) {
    facade.addEventListener('click', function () {
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube.com/embed/' + YT_ID + '?autoplay=1';
      iframe.title = 'Fantoni PDV — Bares e Restaurantes';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;border:none;display:block');
      facade.innerHTML = '';
      facade.appendChild(iframe);
      facade.style.cursor = 'default';
      if (typeof gtag === 'function') gtag('event', 'video_play', { secao: 'lp-bar-restaurante' });
    }, { once: true });
  }

  /* ---------- Formulário ---------- */
  var form = document.getElementById('lp-form');
  if (!form) return;

  var btn   = document.getElementById('lp-btn');
  var erro  = document.getElementById('lp-erro');
  var ok    = document.getElementById('lp-ok');
  var textoOriginal = btn.textContent;

  function mostrarErro(msgs) {
    erro.textContent = Array.isArray(msgs) ? msgs.join(' ') : msgs;
    erro.hidden = false;
  }

  function metaDados() {
    var id = 'lp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    function cookie(nome) {
      var m = document.cookie.match(new RegExp('(?:^|; )' + nome + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : undefined;
    }
    return {
      event_id:   id,
      page_url:   location.href,
      user_agent: navigator.userAgent,
      fbp:        cookie('_fbp'),
      fbc:        cookie('_fbc')
    };
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    erro.hidden = true;

    var dados = {
      nome:        document.getElementById('lp-nome').value.trim(),
      whatsapp:    document.getElementById('lp-whatsapp').value.trim(),
      tipoNegocio: document.getElementById('lp-tipo').value.trim(),
      lp:          'bar-restaurante'
    };

    if (!dados.nome || !dados.whatsapp || !dados.tipoNegocio) {
      mostrarErro('Preencha os três campos para continuar.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    var meta = metaDados();
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Lead', { content_name: 'LP Bar e Restaurante' }, { eventID: meta.event_id });
    }

    var campanha = window.FSTrack
      ? Object.assign({ gclid: FSTrack.getGclid() }, FSTrack.getUtms())
      : {};

    try {
      var resp = await fetch('/api/lp-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, dados, campanha, { _meta: meta }))
      });
      var json = await resp.json().catch(function () { return {}; });

      if (!resp.ok || json.success === false) {
        mostrarErro(json.errors || 'Não conseguimos enviar agora. Chame a gente no WhatsApp (51) 99603-4862.');
        btn.disabled = false;
        btn.textContent = textoOriginal;
        return;
      }

      // GA4 + Google Ads só após a gravação confirmada
      if (window.FSTrack) FSTrack.lead('lp_bar_restaurante', { whatsapp: dados.whatsapp });

      form.hidden = true;
      ok.hidden = false;
    } catch (err) {
      mostrarErro('Não conseguimos enviar agora. Chame a gente no WhatsApp (51) 99603-4862.');
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
})();
