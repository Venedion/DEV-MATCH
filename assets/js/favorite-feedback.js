(function () {
  'use strict';

  function showToast(toast, message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 4500);
  }

  function confirmRemoval(dialog, message, label) {
    if (dialog.open) return Promise.resolve(false);

    message.textContent = `Are you sure you want to remove “${label}” from your favorites?`;
    dialog.returnValue = '';

    if (dialog.dataset.backdropDismissBound !== 'true') {
      dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close('cancel');
      });
      dialog.dataset.backdropDismissBound = 'true';
    }

    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'remove'), {once: true});
      dialog.showModal();
    });
  }

  window.DEVMATCH_FAVORITE_FEEDBACK = {showToast, confirmRemoval};
})();
