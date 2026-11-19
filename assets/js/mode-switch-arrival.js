(() => {
  const storageKey = 'devmatch-mode-switch-navigation';
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return;
    sessionStorage.removeItem(storageKey);
    const [previousMode, timestamp] = stored.split(':');
    const currentMode = location.pathname.endsWith('devmatch-client-dashboard.html')
      ? 'client'
      : 'developer';
    if (Date.now() - Number(timestamp) >= 5000 || previousMode === currentMode) return;
    if (previousMode === 'client' || previousMode === 'developer') {
      document.documentElement.classList.add(`mode-switch-arrive-from-${previousMode}`);
    }
  } catch (error) {
    console.warn('Could not restore the previous workspace mode.', error);
  }
})();
