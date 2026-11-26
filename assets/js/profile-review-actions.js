(function () {
  'use strict';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function render(review, canReply) {
    const reply = canReply && !review.reply
      ? `<form class="review-action-form" data-review-form="reply" data-review-id="${escapeHtml(review.id)}" hidden>
          <label>Public response<textarea name="comment" maxlength="500" required></textarea></label>
          <small>0 / 500</small><p role="alert" hidden></p>
          <button type="submit">Post response</button>
        </form>` : '';
    const report = `<button type="button" class="review-report-toggle" data-review-toggle="report">Report</button>
      <form class="review-action-form" data-review-form="report" data-review-id="${escapeHtml(review.id)}" hidden>
        <label>Why are you reporting this review?<textarea name="comment" maxlength="500" required></textarea></label>
        <small>0 / 500</small><p role="alert" hidden></p>
        <button type="submit">Submit report</button>
      </form>`;
    return `<div class="review-actions">${reply}${report}</div>`;
  }

  function connect(root) {
    if (!root || root.dataset.reviewActionsConnected === 'true') return;
    root.dataset.reviewActionsConnected = 'true';
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-review-toggle="report"]');
      if (!button) return;
      const form = button.parentElement.querySelector('[data-review-form="report"]');
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector('textarea').focus();
    });
    root.addEventListener('input', event => {
      if (!event.target.matches('.review-action-form textarea')) return;
      const counter = event.target.form.querySelector('small');
      counter.textContent = `${event.target.value.length} / 500`;
    });
    root.addEventListener('submit', async event => {
      const form = event.target.closest('.review-action-form');
      if (!form) return;
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const failure = form.querySelector('[role="alert"]');
      const comment = form.elements.comment.value.trim();
      const action = form.dataset.reviewForm;
      button.disabled = true;
      failure.hidden = true;
      try {
        if (action === 'reply') {
          await window.devMatchBackend.addAgreementReviewReply(form.dataset.reviewId, comment);
          const response = document.createElement('p');
          response.className = 'review-reply';
          const label = document.createElement('strong');
          label.textContent = 'Response: ';
          response.append(label, document.createTextNode(comment));
          form.parentElement.append(response);
          form.remove();
        } else {
          await window.devMatchBackend.reportAgreementReview(form.dataset.reviewId, comment);
          const notice = document.createElement('small');
          notice.className = 'review-action-notice';
          notice.textContent = 'Report submitted.';
          form.parentElement.append(notice);
          form.remove();
        }
      } catch (error) {
        console.error(`Unable to ${action} this review.`, error);
        failure.textContent = error.message || 'The action could not be completed. Try again.';
        failure.hidden = false;
        button.disabled = false;
      }
    });
  }

  window.DEVMATCH_PROFILE_REVIEW_ACTIONS = {render, connect};
})();
