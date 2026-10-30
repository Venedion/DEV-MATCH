(function () {
  'use strict';

  const isClientMode = new URLSearchParams(window.location.search).get('role') === 'client';
  document.documentElement.classList.toggle('client-mode-route', isClientMode);
})();
