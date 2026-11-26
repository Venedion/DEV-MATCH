(function () {
  'use strict';

  const status = document.getElementById('moderationStatus');
  const queue = document.getElementById('moderationQueue');

  function reportCard(report) {
    const article = document.createElement('article');
    article.className = 'moderation-report';
    article.dataset.reviewId = report.review_id;
    const title = document.createElement('h2');
    title.textContent = report.reviewer_name || 'Review by a DEV-MATCH member';
    const reason = document.createElement('p');
    reason.textContent = `Report: ${report.reason}`;
    const review = document.createElement('blockquote');
    review.textContent = report.review_text || '(No comment)';
    const meta = document.createElement('p');
    meta.className = 'moderation-report-meta';
    meta.textContent = `Reported ${new Date(report.created_at).toLocaleString()} · Agreement ${report.agreement_id || 'legacy review'}`;
    const actions = document.createElement('div');
    actions.className = 'moderation-actions';
    for (const [action, label] of [['hide', 'Hide review'], ['remove', 'Remove review'], ['dismiss', 'Dismiss report']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.textContent = label;
      actions.append(button);
    }
    article.append(title, reason, review, meta, actions);
    return article;
  }

  async function loadReports() {
    status.textContent = 'Loading reports…';
    try {
      await window.devMatchBackend.ready;
      const {data, error} = await window.devMatchBackend.client.rpc('get_agreement_review_reports');
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('The review moderation response was invalid.');
      queue.replaceChildren(...data.map(reportCard));
      status.textContent = data.length ? `${data.length} report${data.length === 1 ? '' : 's'} awaiting review.`
        : 'No pending review reports.';
    } catch (error) {
      console.error('Unable to load reported reviews.', error);
      status.textContent = /moderator access/i.test(error.message || '')
        ? 'Access denied. This account is not assigned as a review moderator.'
        : error.message || 'The moderation queue could not be loaded.';
    }
  }

  queue.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    const card = button?.closest('.moderation-report');
    if (!button || !card || button.disabled) return;
    if (button.dataset.action !== 'dismiss' &&
      !window.confirm(`${button.textContent} for this reported review?`)) return;
    button.disabled = true;
    try {
      const {error} = await window.devMatchBackend.client.rpc('moderate_agreement_review', {
        p_review_id: card.dataset.reviewId,
        p_action: button.dataset.action
      });
      if (error) throw error;
      card.remove();
      status.textContent = 'Moderation action saved.';
    } catch (error) {
      console.error('Unable to moderate the reported review.', error);
      status.textContent = error.message || 'The moderation action could not be saved.';
      button.disabled = false;
    }
  });

  void loadReports();
})();
