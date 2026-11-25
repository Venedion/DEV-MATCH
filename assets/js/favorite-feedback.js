(function () {
  'use strict';

  function showToast(toast, message, undoCallback, favoriteLink) {
    if (!toast) return;

    let messageElement = toast.querySelector('.fav-toast-message');
    if (!messageElement) {
      messageElement = document.createElement('span');
      messageElement.className = 'fav-toast-message';
      toast.append(messageElement);
    }

    let undoButton = toast.querySelector('.fav-toast-undo');
    if (!undoButton) {
      undoButton = document.createElement('button');
      undoButton.className = 'fav-toast-undo';
      undoButton.type = 'button';
      undoButton.textContent = 'Undo';
      toast.append(undoButton);
    }

    toast.replaceChildren(messageElement, undoButton);
    messageElement.replaceChildren();

    const isMobile = window.matchMedia('(orientation: portrait)').matches;
    if (isMobile && favoriteLink?.tab && /\badded\b/i.test(message) && /\bfavorites?\b/i.test(message)) {
      const role = document.body.classList.contains('client-shell-page') || new URLSearchParams(location.search).get('role') === 'client'
        ? 'client'
        : 'dev';
      const match = message.match(/\bfavorites?\b/i);
      if (match) {
        const start = match.index;
        const end = start + match[0].length;
        messageElement.append(document.createTextNode(message.slice(0, start)));
        const link = document.createElement('a');
        link.className = 'fav-toast-favorites-link';
        link.href = `devmatch-favorites.html?role=${role}&tab=${encodeURIComponent(favoriteLink.tab)}`;
        link.textContent = match[0];
        messageElement.append(link, document.createTextNode(message.slice(end)));
      } else {
        messageElement.textContent = message;
      }
    } else {
      messageElement.textContent = message;
    }
    undoButton.hidden = !undoCallback;
    undoButton.disabled = false;
    undoButton.onclick = undoCallback ? async () => {
      clearTimeout(toast._timer);
      undoButton.disabled = true;
      try {
        const shouldDismiss = await undoCallback();
        if (shouldDismiss !== false) toast.classList.remove('show');
        else toast._timer = setTimeout(() => toast.classList.remove('show'), 4500);
      } finally {
        undoButton.disabled = false;
      }
    } : null;

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
