try {
  const savedTheme = localStorage.getItem('devmatch-landing-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;
} catch (error) {
  console.warn('Unable to restore the landing page theme preference.', error);
}
