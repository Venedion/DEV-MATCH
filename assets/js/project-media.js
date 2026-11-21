(() => {
  'use strict';
  const allowedOrigin = 'https://yxwktllqbmhustmhdaqi.supabase.co';
  const storagePath = '/storage/v1/object/public/project-media/';

  window.renderProjectMedia = function (container, cover, media) {
    const entries = [];
    const seen = new Set();
    for (const value of [cover, ...(Array.isArray(media) ? media : [])]) {
      if (typeof value !== 'string') continue;
      let url;
      try { url = new URL(value); } catch { continue; }
      if (url.origin !== allowedOrigin || !url.pathname.startsWith(storagePath)
        || seen.has(url.href)) continue;
      const video = /\.(mp4|webm)$/i.test(url.pathname);
      if (!video && !/\.(jpe?g|png|webp|gif)$/i.test(url.pathname)) continue;
      seen.add(url.href);
      entries.push({url: url.href, video});
    }

    container.replaceChildren();
    container.hidden = entries.length === 0;
    let screenshot = 0;
    for (const {url, video} of entries) {
      if (video) {
        const player = document.createElement('video');
        player.src = url;
        player.controls = true;
        player.playsInline = true;
        player.preload = 'metadata';
        player.setAttribute('aria-label', 'Project demo video');
        container.append(player);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const image = document.createElement('img');
        image.src = url;
        image.alt = 'Project screenshot ' + (++screenshot);
        image.loading = 'lazy';
        link.append(image);
        container.append(link);
      }
    }
  };
})();
