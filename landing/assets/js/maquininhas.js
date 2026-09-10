(function(){
  const MAQUININHAS = [
    { id:'azulzinha', nome:'Azulzinha', logo:'assets/Logos/logo-azulzinha.svg', imagem:'assets/Maquininhas/Navi-POS-Azulzinha.png', cor:'#0057a8', modelos:['A8 Plus','A8 Pro','A920 Pro'] },
    { id:'bin',       nome:'Bin',       logo:'assets/Logos/logo-bin.svg',       imagem:'assets/Maquininhas/Navi-POS-Bin.png',       cor:'#e30613', modelos:['D195','D210','A8'] },
    { id:'cielo',     nome:'Cielo',     logo:'assets/Logos/logo-cielo.svg',     imagem:'assets/Maquininhas/Navi-POS-Cielo.png',     cor:'#00a0df', modelos:['Lio V1','Lio V2','Lio V3 (Lio On)','Ingenico Dx8000'] },
    { id:'getnet',    nome:'Getnet',    logo:'assets/Logos/logo-getnet.svg',    imagem:'assets/Maquininhas/Navi-POS-Getnet.png',    cor:'#ff6900', modelos:['Getnet Smart','PAX A920','S920'] },
    { id:'pagbank',   nome:'PagBank',   logo:'assets/Logos/logo-pagbank.svg',   imagem:'assets/Maquininhas/Navi-POS-PagSeguro.png', cor:'#00c247', modelos:['Smart F10','Smart D195','Smart A8'] },
    { id:'rede',      nome:'Rede',      logo:'assets/Logos/logo-rede.svg',      imagem:'assets/Maquininhas/Navi-POS-Rede.png',      cor:'#003087', modelos:['PAX A920','Verifone VX680','D195'] },
    { id:'safrapay',  nome:'Safrapay',  logo:'assets/Logos/logo-safrapay.svg',  imagem:'assets/Maquininhas/Navi-POS-Safrapay.png',  cor:'#e8352a', modelos:['D195','A8 Pro','S920'] },
    { id:'sicredi',   nome:'Sicredi',   logo:'assets/Logos/logo-sicredi.svg',   imagem:'assets/Maquininhas/Navi-POS-Sicredi.png',   cor:'#00843d', modelos:['Smart POS A8','Smart POS D195'] },
    { id:'stone',     nome:'Stone',     logo:'assets/Logos/logo-stone.svg',     imagem:'assets/Maquininhas/Navi-POS-Stone.png',     cor:'#00a868', modelos:['S920','Gpos700','D195 (Ton)'] },
    { id:'vero',      nome:'Vero',      logo:'assets/Logos/logo-vero.svg',      imagem:'assets/Maquininhas/Navi-POS-Vero.png',      cor:'#6d28d9', modelos:['D195','A8 Pro','Smart S920'] },
  ];

  let current = 0;

  function buildLogos() {
    const strip = document.getElementById('maqLogosStrip');
    MAQUININHAS.forEach((m, i) => {
      const btn = document.createElement('button');
      btn.className = 'maq-logo-btn' + (i === 0 ? ' maq-active' : '');
      btn.setAttribute('aria-label', m.nome);
      btn.dataset.idx = i;
      // Nunca renderizar src="" — o navegador requisitaria a própria página como imagem.
      btn.innerHTML = m.logo
        ? '<img src="' + m.logo + '" alt="' + m.nome + '" loading="lazy" width="88" height="26">'
        : '<span class="maq-nome">' + m.nome + '</span>';
      btn.addEventListener('click', () => goTo(i));
      strip.appendChild(btn);
    });
  }

  function buildDots() {
    const dotsEl = document.getElementById('maqDots');
    MAQUININHAS.forEach((_, i) => {
      const d = document.createElement('button');
      d.style.cssText = 'width:' + (i===0?'24px':'8px') + ';height:8px;border-radius:' + (i===0?'4px':'50%') + ';border:none;background:' + (i===0?'#1d4ed8':'#cbd5e1') + ';cursor:pointer;padding:0;transition:all 0.25s ease;';
      d.setAttribute('aria-label', 'Slide ' + (i+1));
      d.addEventListener('click', () => goTo(i));
      dotsEl.appendChild(d);
    });
  }

  function updateDots() {
    document.querySelectorAll('#maqDots button').forEach((d, i) => {
      d.style.background    = i === current ? '#1d4ed8' : '#cbd5e1';
      d.style.width         = i === current ? '24px'   : '8px';
      d.style.borderRadius  = i === current ? '4px'    : '50%';
    });
  }

  var _maqTimer = null;

  function buildSlideHTML(m) {
    return (
      '<div class="maq-img-col" style="display:flex;align-items:center;justify-content:center;position:relative;">' +
        '<div style="position:absolute;inset:-30%;border-radius:50%;background:radial-gradient(ellipse,rgba(59,130,246,0.1) 0%,transparent 70%);pointer-events:none;"></div>' +
        '<img class="maq-img-float" src="' + m.imagem + '" alt="Maquininha ' + m.nome + '" loading="lazy" width="300" height="608" style="width:100%;max-width:240px;height:auto;aspect-ratio:300/608;object-fit:contain;filter:drop-shadow(0 28px 48px rgba(0,0,0,0.2));position:relative;z-index:1;">' +
      '</div>' +
      '<div>' +
        '<img src="' + m.logo + '" alt="' + m.nome + '" style="height:38px;width:auto;max-width:140px;margin-bottom:24px;display:block;object-fit:contain;">' +
        '<p style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px;">Modelos compatíveis</p>' +
        '<div style="display:flex;flex-direction:column;gap:14px;">' +
          m.modelos.map(function(mod){ return '<div class="maq-modelo-item"><span class="maq-modelo-dot"></span>' + mod + '</div>'; }).join('') +
        '</div>' +
      '</div>'
    );
  }

  function renderSlide(m) {
    var el = document.getElementById('maqSlideContent');
    if (_maqTimer) clearTimeout(_maqTimer); // cancela transição anterior se clicou rápido

    // 1. Fade out
    el.style.opacity = '0';
    el.style.transform = 'translateX(10px)';

    // 2. Depois de sair, troca conteúdo e entra
    _maqTimer = setTimeout(function() {
      el.innerHTML = buildSlideHTML(m);
      // Força reflow para a transição CSS "ver" a mudança de opacity
      void el.offsetWidth;
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    }, 160);
  }

  function updateLogos() {
    document.querySelectorAll('.maq-logo-btn').forEach((btn, i) => {
      btn.classList.toggle('maq-active', i === current);
    });
  }

  function goTo(i) {
    current = ((i % MAQUININHAS.length) + MAQUININHAS.length) % MAQUININHAS.length;
    renderSlide(MAQUININHAS[current]);
    updateLogos();
    updateDots();
  }

  window.maqGo = function(dir) { goTo(current + dir); };

  buildLogos();
  buildDots();
  renderSlide(MAQUININHAS[0]);
})();
