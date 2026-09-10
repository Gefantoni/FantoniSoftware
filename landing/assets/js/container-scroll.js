// ---- ContainerScroll ----
// Lê geometria só no load/resize. Durante o scroll é só cálculo e escrita
// dentro de rAF — ler getBoundingClientRect no handler causava reflow forçado.
(function(){
  const card = document.getElementById('cs-card');
  const wrap = document.getElementById('cs-perspective');
  if (!card || !wrap) return;

  let topDoc = 0, vh = 0, isMobile = false, ticking = false;

  function medir(){
    // offsetTop acumulado: posição do elemento em relação ao documento
    let el = wrap, t = 0;
    while (el) { t += el.offsetTop; el = el.offsetParent; }
    topDoc   = t;
    vh       = window.innerHeight;
    isMobile = window.innerWidth <= 768;
    escrever();
  }

  function escrever(){
    // rect.top equivale a topDoc - scrollY, sem forçar layout
    const top = topDoc - window.scrollY;
    const progress = Math.max(0, Math.min(1, (vh - top) / (vh * 0.9)));
    const scaleFrom = isMobile ? 0.75 : 1.04;
    const scaleTo   = isMobile ? 0.92 : 1.0;
    const rotate = 20 * (1 - progress);
    const scale  = scaleFrom + (scaleTo - scaleFrom) * progress;
    card.style.transform = `rotateX(${rotate}deg) scale(${scale})`;
  }

  window.addEventListener('scroll', function(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function(){ escrever(); ticking = false; });
  }, {passive:true});

  window.addEventListener('resize', medir, {passive:true});
  medir();
})();
