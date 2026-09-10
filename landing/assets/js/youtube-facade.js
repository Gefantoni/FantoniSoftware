// ---- YouTube Facade ----
(function(){
  document.querySelectorAll('.yt-facade').forEach(function(facade){
    facade.addEventListener('click', function(){
      const id = facade.dataset.videoid;
      const title = facade.dataset.title || '';
      const iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1';
      iframe.title = title;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;display:block;';
      facade.innerHTML = '';
      facade.appendChild(iframe);
      facade.style.cursor = 'default';
    });
  });
})();
