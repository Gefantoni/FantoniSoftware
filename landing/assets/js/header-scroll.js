// ---- Header Scroll ----
// Escrita em rAF e só quando o estado muda — evita invalidar estilo a cada scroll.
(function(){
  const nav = document.querySelector('nav');
  if (!nav) return;
  let ticking = false, ativo = null;

  function aplicar() {
    const deveAtivar = window.scrollY > 50;
    if (deveAtivar !== ativo) {
      ativo = deveAtivar;
      nav.classList.toggle('scrolled', deveAtivar);
    }
    ticking = false;
  }

  window.addEventListener('scroll', function(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(aplicar);
  }, {passive: true});

  aplicar();
})();
