// ---- Lazy Video (IntersectionObserver) ----
(function(){
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (!entry.isIntersecting) return;
      const video = entry.target;
      video.querySelectorAll('source[data-src]').forEach(function(source){
        source.src = source.dataset.src;
      });
      video.load();
      video.play().catch(function(){});
      observer.unobserve(video);
    });
  }, { rootMargin: '200px' });
  document.querySelectorAll('video.lazy-video').forEach(function(v){ observer.observe(v); });
})();
