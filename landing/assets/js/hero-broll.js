// ---- Hero B-Roll: carrega o vídeo só quando vale a pena ----
// Em conexão econômica, celular ou movimento reduzido, fica só o poster.
(function () {
  var v = document.getElementById('hero-broll');
  if (!v) return;

  v.playbackRate = 0.8;

  var conn = navigator.connection || {};
  var economico = conn.saveData === true ||
                  /(^|\b)(2g|slow-2g|3g)($|\b)/.test(conn.effectiveType || '');
  var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (economico || reduzido || window.innerWidth < 768) return;
  if (!('IntersectionObserver' in window)) return;

  var io = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var s = document.createElement('source');
      s.src  = 'assets/hero-broll.mp4';
      s.type = 'video/mp4';
      v.appendChild(s);
      v.load();
      v.play().catch(function () {});
      obs.disconnect();
    });
  }, { rootMargin: '200px' });
  io.observe(v);
})();
