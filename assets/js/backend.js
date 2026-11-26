/* Supabase JS 2.119.0; publishable key is safe for browser use with RLS. */
(() => {
  const recovery = location.hash.includes('type=recovery');
  if(recovery)sessionStorage.setItem('devmatch-recovery','1');
  const callbackError=new URLSearchParams(location.hash.slice(1)).get('error');
  if(callbackError){
    sessionStorage.removeItem('devmatch-recovery');
    sessionStorage.setItem('devmatch-recovery-error','This email link is invalid or expired. Request a new reset link.');
  }
  const client = window.supabase.createClient(
    'https://yxwktllqbmhustmhdaqi.supabase.co',
    'sb_publishable_9JeJarcXaZgNRiawz81gjw_PTaXtKli'
  );
  const page = location.pathname.split('/').pop();
  const protectedPage = /^devmatch-(dashboard|client-dashboard|profile|complete|verify-phone|my-profile|my-projects|settings|favorites|chat|notifications|developer-notifications)\.html$/.test(page);
  const roleSpecificPages = {
    'devmatch-client-dashboard.html': 'client',
    'devmatch-notifications.html': 'client',
    'devmatch-discover-projects.html': 'client',
    'devmatch-discover-project-detail.html': 'client',
    'devmatch-find-developers.html': 'client',
    'devmatch-dashboard.html': 'dev',
    'devmatch-developer-notifications.html': 'dev',
    'devmatch-my-projects.html': 'dev',
    'devmatch-find-projects.html': 'dev',
    'devmatch-find-project-detail.html': 'dev',
    'devmatch-find-clients.html': 'dev'
  };
  const privateProfileFields = ['bankName', 'accountNumber', 'accountHolder', 'npwp', 'birthday'];
  let activeAccountRole = null;
  const skeletonStyle = document.createElement('style');
  skeletonStyle.id = 'devmatch-skeleton-styles';
  skeletonStyle.textContent = `
    @keyframes devmatch-fluent-shimmer {
      from { background-position: 100% 0; }
      to { background-position: -100% 0; }
    }
    .devmatch-shimmer {
      background-color: #ececef;
      background-image: linear-gradient(90deg, #ececef 0%, #f7f7f8 42%, #e4e4e8 50%, #f7f7f8 58%, #ececef 100%);
      background-size: 220% 100%;
      background-repeat: no-repeat;
      animation: devmatch-fluent-shimmer 1.35s cubic-bezier(.4, 0, .2, 1) infinite;
    }
    .devmatch-skeleton-status { display: grid; width: min(100%, 340px); gap: 9px; }
    .devmatch-skeleton-line { display: block; width: 82%; height: 10px; border-radius: 999px; }
    .devmatch-skeleton-line:nth-child(2) { width: 58%; }
    .devmatch-skeleton-card { display: grid; min-height: 210px; align-content: end; gap: 10px; padding: 14px; border: 1px solid #ececef; border-radius: 12px; background: #fff; pointer-events: none; }
    .devmatch-skeleton-media { display: block; height: 96px; margin-bottom: 12px; border-radius: 8px; }
    .devmatch-skeleton-card .devmatch-skeleton-line { height: 9px; }
    .devmatch-skeleton-card--client, .devmatch-skeleton-card--developer { min-height: 0; align-content: stretch; gap: 0; padding: 20px; border-radius: 14px; display: flex; flex-direction: column; }
    .devmatch-skeleton-card--client .client-avatar-badge, .devmatch-skeleton-card--developer .dev-avatar-badge { flex: 0 0 44px; }
    .devmatch-skeleton-card--client .client-name-business, .devmatch-skeleton-card--developer .dev-name-location { display: grid; gap: 7px; }
    .devmatch-skeleton-card--client .client-card-meta { display: grid; gap: 12px; }
    .devmatch-skeleton-card--client .meta-row { justify-content: space-between; gap: 12px; }
    .devmatch-skeleton-card--favorite-project { display: flex; flex-direction: column; border-radius: var(--fav-card-radius); }
    .devmatch-skeleton-card--favorite-project .fav-card-art { height: 166px; }
    .devmatch-skeleton-card--favorite-project .fav-card-body { display: flex; flex-direction: column; gap: 9px; }
    .devmatch-skeleton-card--developer .dev-badges-row, .devmatch-skeleton-card--developer .dev-skills-row { min-height: 25px; }
    .devmatch-skeleton-card--developer .dev-bio { display: grid; gap: 8px; min-height: 48px; margin: 4px 0 12px; }
    .devmatch-skeleton-card--developer .dev-stats-grid { min-height: 52px; }
    .devmatch-skeleton-card--mobile-project { min-height: 0; padding: 12px; border-radius: 12px; }
    .devmatch-skeleton-card--mobile-project .mobile-project-main { min-height: 0; }
    .devmatch-skeleton-card--mobile-project .mobile-project-visual { display: grid; align-content: start; gap: 8px; }
    .devmatch-skeleton-card--mobile-project .project-thumb { display: block; height: 64px; border-radius: 8px; }
    .devmatch-skeleton-card--mobile-project .mobile-project-details { display: grid; align-content: start; gap: 8px; }
    .devmatch-skeleton-card--mobile-project .mobile-project-footer { min-height: 34px; }
    .devmatch-skeleton-card--request { min-height: 0 !important; border-radius: 14px; }
    .devmatch-skeleton-card--request .request-card-body { display: grid; gap: 12px; }
    .devmatch-skeleton-card--request .request-card-header { min-height: 44px; }
    .devmatch-skeleton-card--request .request-card-author { min-width: 0; }
    .devmatch-skeleton-card--request .request-card-author-copy { display: grid; gap: 7px; }
    .devmatch-skeleton-card--request .project-description { display: grid; gap: 8px; min-height: 43px; }
    .devmatch-skeleton-card--request .request-budget-box { min-height: 62px; }
    .devmatch-skeleton-card--request .request-required { min-height: 42px; }
    .devmatch-skeleton-card--request .request-card-footer { min-height: 32px; }
    .devmatch-skeleton-card--showcase { min-height: 0; padding: 0; gap: 0; align-content: start; overflow: hidden; border-radius: 11px; }
    .devmatch-skeleton-card--showcase .project-art { height: 155px; margin: 0; }
    .devmatch-skeleton-card--showcase .project-copy { display: grid; gap: 9px; }
    .devmatch-skeleton-card--showcase .project-copy > .devmatch-skeleton-line { height: 9px; }
    .devmatch-skeleton-card--landing-project { min-height: 0; padding: 0; gap: 0; align-content: start; overflow: hidden; border-radius: 22px; }
    .devmatch-skeleton-card--landing-project .thumb { height: 170px; margin: 0; }
    .devmatch-skeleton-card--landing-project .pbody { display: grid; gap: 10px; }
    .devmatch-skeleton-card--landing-developer { min-height: 0; align-content: start; border-radius: 22px; }
    .devmatch-skeleton-card--landing-developer .dh { align-items: center; }
    .devmatch-skeleton-card--landing-developer .av { flex: 0 0 42px; }
    .devmatch-skeleton-card--landing-developer .tags { min-height: 25px; }
    .devmatch-skeleton-card--landing-developer > p { display: grid; gap: 8px; min-height: 48px; }
    .devmatch-skeleton-card--dashboard-project { min-height: 0; padding: 0; gap: 0; align-content: start; overflow: hidden; border-radius: 15px; display: flex; flex-direction: column; }
    .devmatch-skeleton-card--dashboard-project .project-art { height: 165px; margin: 0; }
    .devmatch-skeleton-card--dashboard-project .project-body { display: grid; gap: 10px; }
    .devmatch-skeleton-card--marketplace-project { min-height: 0; padding: 0; gap: 0; align-content: start; overflow: hidden; border-radius: 14px; display: flex; flex-direction: column; }
    .devmatch-skeleton-card--marketplace-project .project-art { height: 166px; margin: 0; }
    .devmatch-skeleton-card--marketplace-project .project-body { min-height: 210px; display: flex; flex: 1; flex-direction: column; gap: 0; padding: 13px 14px 12px; }
    .devmatch-skeleton-card--marketplace-project .project-meta { margin-bottom: 7px; }
    .devmatch-skeleton-card--marketplace-project .project-title { height: 44px; display: flex; align-items: flex-start; }
    .devmatch-skeleton-card--marketplace-project .project-description { height: 42px; min-height: 42px; display: grid; gap: 7px; margin-top: 5px; }
    .devmatch-skeleton-card--marketplace-project .catalog-price { height: 34px; margin-top: 13px; padding-bottom: 10px; border-bottom: 1px solid #efeff1; }
    .devmatch-skeleton-card--marketplace-project .catalog-project-by { height: 48px; display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; margin-top: auto; padding-top: 10px; }
    .devmatch-skeleton-card--favorite-project { min-height: 0; padding: 0; gap: 0; align-content: start; overflow: hidden; }
    .devmatch-skeleton-card--favorite-project .fav-card-footer { min-height: 42px; }
    @media (orientation: portrait) {
      .devmatch-skeleton-card--client { padding: 16px; }
    }
    .devmatch-skeleton-row { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 10px; min-height: 55px; padding: 9px 0; border-top: 1px solid #efeff1; }
    .devmatch-skeleton-avatar { width: 32px; height: 32px; border-radius: 50%; }
    .devmatch-skeleton-row-lines { display: grid; gap: 8px; }
    .devmatch-skeleton-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    html[data-theme="dark"] .devmatch-shimmer { background-color: #303137; background-image: linear-gradient(90deg, #303137 0%, #3c3d44 42%, #28292e 50%, #3c3d44 58%, #303137 100%); }
    html.devmatch-auth-pending-root body .user-avatar,
    html.devmatch-auth-pending-root body .client-avatar {
      color: transparent !important;
      background-color: #ececef !important;
      background-image: linear-gradient(90deg, #ececef 0%, #f7f7f8 42%, #e4e4e8 50%, #f7f7f8 58%, #ececef 100%) !important;
      background-size: 220% 100% !important;
      background-repeat: no-repeat !important;
      animation: devmatch-fluent-shimmer 1.35s cubic-bezier(.4, 0, .2, 1) infinite;
    }
    html.devmatch-auth-pending-root body .user-avatar > *,
    html.devmatch-auth-pending-root body .client-avatar > * { visibility: hidden !important; }
    html.devmatch-auth-pending-root body .user-copy b,
    html.devmatch-auth-pending-root body .user-copy small,
    html.devmatch-auth-pending-root body .client-user-copy b,
    html.devmatch-auth-pending-root body .client-user-copy small {
      background-color: #ececef !important;
      background-image: linear-gradient(90deg, #ececef 0%, #f7f7f8 42%, #e4e4e8 50%, #f7f7f8 58%, #ececef 100%) !important;
      background-size: 220% 100% !important;
      background-repeat: no-repeat !important;
      animation: devmatch-fluent-shimmer 1.35s cubic-bezier(.4, 0, .2, 1) infinite;
      border-radius: 999px;
      color: transparent !important;
    }
    html[data-theme="dark"].devmatch-auth-pending-root body .user-avatar,
    html[data-theme="dark"].devmatch-auth-pending-root body .client-avatar,
    html[data-theme="dark"].devmatch-auth-pending-root body .user-copy b,
    html[data-theme="dark"].devmatch-auth-pending-root body .user-copy small,
    html[data-theme="dark"].devmatch-auth-pending-root body .client-user-copy b,
    html[data-theme="dark"].devmatch-auth-pending-root body .client-user-copy small {
      background-color: #303137 !important;
      background-image: linear-gradient(90deg, #303137 0%, #3c3d44 42%, #28292e 50%, #3c3d44 58%, #303137 100%) !important;
    }
    @media (prefers-reduced-motion: reduce) {
      html.devmatch-auth-pending-root body .user-avatar,
      html.devmatch-auth-pending-root body .client-avatar,
      html.devmatch-auth-pending-root body .user-copy b,
      html.devmatch-auth-pending-root body .user-copy small,
      html.devmatch-auth-pending-root body .client-user-copy b,
      html.devmatch-auth-pending-root body .client-user-copy small { animation: none !important; background-image: none !important; }
    }
    html.devmatch-auth-pending-root body a,
    html.devmatch-auth-pending-root body button,
    html.devmatch-auth-pending-root body input,
    html.devmatch-auth-pending-root body select,
    html.devmatch-auth-pending-root body textarea { pointer-events: none !important; }
    html.devmatch-auth-pending-root body > main,
    html.devmatch-auth-pending-root body > .sidebar,
    html.devmatch-auth-pending-root body > .client-sidebar,
    html.devmatch-auth-pending-root body > .chat-viewport,
    html.devmatch-auth-pending-root body > .mobile-bottom-nav,
    html.devmatch-auth-pending-root body > .floating-chat { pointer-events: none !important; }
    body.devmatch-auth-pending-content > main,
    body.devmatch-auth-pending-content > .sidebar,
    body.devmatch-auth-pending-content > .client-sidebar,
    body.devmatch-auth-pending-content > .chat-viewport,
    body.devmatch-auth-pending-content > .mobile-bottom-nav,
    body.devmatch-auth-pending-content > .floating-chat { pointer-events: none !important; }
    html.devmatch-auth-pending-root body dialog,
    body.devmatch-auth-pending-content dialog { visibility: hidden !important; }
    body.devmatch-auth-pending-content [data-devmatch-auth-mask="field"],
    body.devmatch-settings-loading [data-devmatch-auth-mask="field"] {
      background-color: #ececef !important;
      background-image: linear-gradient(90deg, #ececef 0%, #f7f7f8 42%, #e4e4e8 50%, #f7f7f8 58%, #ececef 100%) !important;
      background-size: 220% 100% !important;
      background-repeat: no-repeat !important;
      animation: devmatch-fluent-shimmer 1.35s cubic-bezier(.4, 0, .2, 1) infinite;
      color: transparent !important;
      caret-color: transparent !important;
      text-shadow: none !important;
    }
    body.devmatch-auth-pending-content [data-devmatch-auth-mask="field"]::placeholder,
    body.devmatch-settings-loading [data-devmatch-auth-mask="field"]::placeholder { color: transparent !important; }
    body.devmatch-auth-pending-content [data-devmatch-auth-mask="text"],
    body.devmatch-settings-loading [data-devmatch-auth-mask="text"] {
      background-color: #ececef !important;
      background-image: linear-gradient(90deg, #ececef 0%, #f7f7f8 42%, #e4e4e8 50%, #f7f7f8 58%, #ececef 100%) !important;
      background-size: 220% 100% !important;
      background-repeat: no-repeat !important;
      animation: devmatch-fluent-shimmer 1.35s cubic-bezier(.4, 0, .2, 1) infinite;
      border-radius: 4px;
      color: transparent !important;
      text-shadow: none !important;
    }
    body.devmatch-auth-pending-content [data-devmatch-auth-mask="text"] > *,
    body.devmatch-settings-loading [data-devmatch-auth-mask="text"] > * { visibility: hidden !important; }
    body.devmatch-auth-pending-content [data-devmatch-auth-mask="surface"],
    body.devmatch-settings-loading [data-devmatch-auth-mask="surface"] {
      position: relative;
      isolation: isolate;
    }
    body.devmatch-auth-pending-content [data-devmatch-auth-mask="surface"]::before,
    body.devmatch-settings-loading [data-devmatch-auth-mask="surface"]::before {
      position: absolute;
      z-index: 1;
      inset: 0;
      border-radius: inherit;
      background-color: #ececef;
      background-image: linear-gradient(90deg, #ececef 0%, #f7f7f8 42%, #e4e4e8 50%, #f7f7f8 58%, #ececef 100%);
      background-size: 220% 100%;
      background-repeat: no-repeat;
      animation: devmatch-fluent-shimmer 1.35s cubic-bezier(.4, 0, .2, 1) infinite;
      content: "";
      pointer-events: none;
    }
    body.devmatch-auth-pending-content [data-devmatch-auth-mask="surface"] > *,
    body.devmatch-settings-loading [data-devmatch-auth-mask="surface"] > * { visibility: hidden !important; }
    html[data-theme="dark"] body.devmatch-auth-pending-content [data-devmatch-auth-mask="field"],
    html[data-theme="dark"] body.devmatch-settings-loading [data-devmatch-auth-mask="field"],
    html[data-theme="dark"] body.devmatch-auth-pending-content [data-devmatch-auth-mask="text"],
    html[data-theme="dark"] body.devmatch-settings-loading [data-devmatch-auth-mask="text"],
    html[data-theme="dark"] body.devmatch-auth-pending-content [data-devmatch-auth-mask="surface"]::before,
    html[data-theme="dark"] body.devmatch-settings-loading [data-devmatch-auth-mask="surface"]::before {
      background-color: #303137 !important;
      background-image: linear-gradient(90deg, #303137 0%, #3c3d44 42%, #28292e 50%, #3c3d44 58%, #303137 100%) !important;
    }
    @media (prefers-reduced-motion: reduce) {
      .devmatch-shimmer,
      body.devmatch-auth-pending-content [data-devmatch-auth-mask],
      body.devmatch-settings-loading [data-devmatch-auth-mask],
      body.devmatch-auth-pending-content [data-devmatch-auth-mask="surface"]::before,
      body.devmatch-settings-loading [data-devmatch-auth-mask="surface"]::before { animation: none; background-image: none; opacity: .62; }
    }
  `;
  document.head.append(skeletonStyle);
  function skeletonBlock(className, width) {
    const block = document.createElement('span');
    block.className = `devmatch-shimmer ${className}`;
    if (width) block.style.width = width;
    block.setAttribute('aria-hidden', 'true');
    return block;
  }
  const skeletons = {
    status(element, label, lines = 2) {
      if (!element) return;
      const group = document.createElement('span');
      group.className = 'devmatch-skeleton-status';
      group.setAttribute('aria-hidden', 'true');
      for (let index = 0; index < lines; index++) {
        group.append(skeletonBlock('devmatch-skeleton-line', index === 0 ? '82%' : '58%'));
      }
      const accessibleLabel = document.createElement('span');
      accessibleLabel.className = 'devmatch-skeleton-sr';
      accessibleLabel.textContent = label;
      element.replaceChildren(group, accessibleLabel);
      if (!element.hasAttribute('role')) element.setAttribute('role', 'status');
    },
    text(element, label, width = '54%') {
      if (!element) return;
      const block = skeletonBlock('devmatch-skeleton-line', width);
      const accessibleLabel = document.createElement('span');
      accessibleLabel.className = 'devmatch-skeleton-sr';
      accessibleLabel.textContent = label;
      element.replaceChildren(block, accessibleLabel);
    },
    cards(element, count = 3, variant = 'project') {
      if (!element) return;
      element.replaceChildren(...Array.from({length: count}, () => {
        const componentClasses = {
          client: 'client-card',
          developer: 'dev-card',
          'mobile-project': 'mobile-project-card',
          request: 'project-card request-project-card',
          showcase: 'showcase-project',
          'landing-project': 'card',
          'landing-developer': 'card dcard',
          'dashboard-project': 'client-project-card',
          'marketplace-project': 'project-card catalog-card',
          'favorite-project': 'fav-card'
        };
        const layout = componentClasses[variant] ? variant : 'project';
        const card = document.createElement(layout === 'project' ? 'div' : 'article');
        card.className = `devmatch-skeleton-card devmatch-skeleton-card--${layout}${componentClasses[layout] ? ` ${componentClasses[layout]}` : ''}`;
        card.setAttribute('aria-hidden', 'true');
        const line = (width, height) => {
          const block = skeletonBlock('devmatch-skeleton-line', width);
          if (height) block.style.height = height;
          return block;
        };
        const group = (className, ...children) => {
          const element = document.createElement('div');
          element.className = className;
          element.append(...children);
          return element;
        };
        const avatar = (className, size = '44px') => {
          const block = skeletonBlock(className);
          block.style.width = size;
          block.style.height = size;
          return block;
        };
        const pill = width => {
          const block = line(width, '22px');
          block.style.borderRadius = '999px';
          return block;
        };
        if (layout === 'client') {
          const heading = group('client-profile-group', avatar('client-avatar-badge'),
            group('client-name-business', line('136px', '13px'), line('96px', '10px')));
          const top = group('client-card-top', heading, avatar('btn-card-favorite', '34px'));
          const meta = group('client-card-meta',
            group('meta-row', line('66px', '10px'), line('92px', '18px')),
            group('meta-row', line('105px', '10px'), line('78px', '10px')));
          const actions = group('client-card-actions', line('50%', '38px'), line('50%', '38px'));
          card.append(top, meta, actions);
        } else if (layout === 'developer') {
          const heading = group('dev-profile-group', avatar('dev-avatar-badge'),
            group('dev-name-location', line('132px', '13px'), line('92px', '10px')));
          const top = group('dev-card-top', heading, avatar('btn-dev-favorite', '34px'));
          const badges = group('dev-badges-row', pill('74px'), pill('118px'));
          const bio = group('dev-bio', line('100%'), line('88%'), line('66%'));
          const skills = group('dev-skills-row', pill('52px'), pill('68px'), pill('58px'));
          const stats = group('dev-stats-grid',
            group('dev-stat-col', line('28px', '14px'), line('46px', '9px')),
            group('dev-stat-col', line('28px', '14px'), line('34px', '9px')),
            group('dev-stat-col', line('28px', '14px'), line('52px', '9px')));
          const actions = group('dev-actions-row', line('50%', '38px'), line('50%', '38px'));
          card.append(top, badges, bio, skills, stats, actions);
        } else if (layout === 'mobile-project') {
          const visual = group('mobile-project-visual',
            skeletonBlock('project-thumb'),
            group('mobile-project-price', line('56px', '8px'), line('76px', '12px')));
          const details = group('mobile-project-details', pill('64px'), line('94%', '14px'), line('78%', '10px'));
          const main = group('mobile-project-main', visual, details);
          const metrics = group('mobile-project-metrics', pill('32px'), pill('32px'), pill('32px'));
          const footer = group('mobile-project-footer', metrics, group('row-actions', pill('32px'), pill('32px')));
          card.append(main, footer);
        } else if (layout === 'request') {
          const author = group('request-card-author', avatar('request-card-avatar', '44px'),
            group('request-card-author-copy', line('128px', '12px'), line('106px', '10px')));
          const header = group('request-card-header', author, group('request-card-header-actions', pill('80px'), avatar('request-card-favorite', '40px')));
          const body = group('project-body', header, line('82%', '20px'),
            group('project-description', line('100%'), line('90%'), line('73%')),
            group('request-budget-box', line('58px', '9px'), line('108px', '16px')),
            group('request-required', line('66px', '10px'), group('request-card-tags', pill('62px'), pill('82px'))),
            group('request-card-footer', group('request-card-metrics', pill('36px'), pill('36px'))));
          body.className += ' request-card-body';
          card.append(body);
        } else if (layout === 'showcase') {
          card.append(skeletonBlock('project-art'), group('project-copy',
            line('68px', '8px'), line('76%', '13px'),
            group('project-description', line('100%'), line('78%')),
            group('project-footer', line('84px', '12px'), line('56px', '9px'))));
        } else if (layout === 'landing-project') {
          card.append(skeletonBlock('thumb'), group('pbody',
            group('meta', line('64px', '9px'), line('48px', '9px')),
            line('78%', '15px'), line('100%'), line('82%'),
            group('price', line('72px', '9px'), line('92px', '12px'))));
        } else if (layout === 'landing-developer') {
          const heading = group('dh', avatar('av', '42px'), group('devmatch-skeleton-landing-copy', line('126px', '12px'), line('88px', '9px')));
          const badges = group('tags', pill('74px'), pill('102px'));
          const bio = group('devmatch-skeleton-landing-bio', line('100%'), line('87%'), line('67%'));
          const skills = group('tags', pill('48px'), pill('62px'), pill('56px'));
          const stats = group('dstats', group('', line('30px', '13px'), line('110px', '9px')));
          const actions = group('acts', line('50%', '36px'), line('50%', '36px'));
          card.append(heading, badges, bio, skills, stats, actions);
        } else if (layout === 'marketplace-project') {
          const category = line('92px', '9px');
          category.className += ' catalog-category';
          const title = group('project-title', line('82%', '15px'));
          const description = group('project-description', line('100%'), line('76%'));
          const developer = group('developer-info', line('94px', '10px'), line('66px', '9px'));
          const rating = line('38px', '10px');
          rating.className += ' rating';
          const price = line('84px', '15px');
          price.className += ' catalog-price';
          const footer = group('project-by catalog-project-by', avatar('developer-avatar', '38px'), developer, rating);
          card.append(
            skeletonBlock('project-art'),
            group('project-body',
              group('project-meta', category, line('52px', '9px')),
              title,
              description,
              price,
              footer)
          );
        } else if (layout === 'dashboard-project') {
          const body = group('project-body', group('project-meta', pill('72px'), pill('56px')),
            line('83%', '14px'), line('100%'), line('78%'),
            group('project-by', avatar('developer-avatar', '32px'), group('developer-info', line('90px', '10px'), line('64px', '8px'))));
          card.append(skeletonBlock('project-art'), body);
        } else if (layout === 'favorite-project') {
          const art = group('fav-card-art devmatch-shimmer', line('60px', '20px'), avatar('fav-remove-btn', '28px'));
          const meta = group('fav-card-meta',
            group('fav-dev-pill', avatar('fav-dev-avatar', '38px'), group('fav-dev-name-wrap', line('72px', '10px'), line('48px', '8px'))),
            line('58px', '12px'), line('34px', '10px'));
          const body = group('fav-card-body',
            line('72px', '9px'),
            group('fav-card-title', line('88%', '14px')),
            group('fav-card-desc', line('100%'), line('77%')),
            meta);
          const footer = group('fav-card-footer', line('100%', '34px'));
          card.append(art, body, footer);
        } else {
          card.append(
            skeletonBlock('devmatch-skeleton-media'),
            line('76%'),
            line('52%')
          );
        }
        return card;
      }));
    },
    rows(element, count = 3) {
      if (!element) return;
      element.replaceChildren(...Array.from({length: count}, () => {
        const row = document.createElement('div');
        row.className = 'devmatch-skeleton-row';
        row.setAttribute('aria-hidden', 'true');
        const lines = document.createElement('span');
        lines.className = 'devmatch-skeleton-row-lines';
        lines.append(skeletonBlock('devmatch-skeleton-line', '78%'), skeletonBlock('devmatch-skeleton-line', '54%'));
        row.append(skeletonBlock('devmatch-skeleton-avatar'), lines);
        return row;
      }));
    }
  };
  window.DEVMATCH_SKELETON = Object.freeze(skeletons);
  const authPending = protectedPage || Object.hasOwn(roleSpecificPages, page);
  let authPendingResolved = false;
  if (authPending) document.documentElement.classList.add('devmatch-auth-pending-root');
  const authPageMasks = {
    'devmatch-profile.html': {
      field: ['#profileForm input:not([type="hidden"])', '#profileForm select', '#profileForm textarea'],
      text: ['#previewAvatar', '#previewName', '#previewHandle'],
      surface: ['.gender-options', '.specialty-grid', '.status-grid', '.experience-list', '#previewTags', '.preview-lines']
    },
    'devmatch-settings.html': {
      field: [
        '#accountForm input:not([type="hidden"]):not([type="file"])',
        '#accountForm select',
        '#accountForm textarea',
        '#profileDetailsForm input:not([type="hidden"]):not([type="file"])',
        '#profileDetailsForm select',
        '#profileDetailsForm textarea',
        '#roleSpecificForm input:not([type="hidden"]):not([type="file"])',
        '#roleSpecificForm select',
        '#roleSpecificForm textarea',
        '#notificationsForm select',
        '#privacyForm select',
        '#preferencesForm select'
      ],
      text: ['#settingsAvatarPreview', '#panel-integrations [data-app-detail]', '#panel-integrations [data-app-toggle]'],
      surface: [
        '#settingsSpecialtyGrid', '#settingsSkillTags', '#settingsExperienceEntries',
        '#notificationsForm .settings-switch'
      ]
    },
    'devmatch-verify-phone.html': {
      field: ['#settingsPhone']
    },
    'devmatch-my-profile.html': {
      text: [
        '#profileAvatar', '#profileName', '#identityBio', '#identityHandle', '#identityLocation',
        '#identitySpecialty', '#identityJoined', '#aboutCopy', '#statProjects', '#statSaves',
        '#statRating', '#statReviews', '#statViews', '#availabilityBadge'
      ],
      surface: [
        '#roleInfoCard .role-info-grid', '#roleInfoCard .contract-list', '#roleInfoCard > .empty-state',
        '#specializationList', '#skillList', '#experienceList', '#connectedList', '#projectGrid',
        '#activityList'
      ]
    }
  };
  const shimmerGradient = 'linear-gradient(90deg, #ececef 0%, #f7f7f8 42%, #e4e4e8 50%, #f7f7f8 58%, #ececef 100%)';
  const maskRules = {
    field: `background-color:#ececef!important;background-image:${shimmerGradient}!important;background-size:220% 100%!important;background-repeat:no-repeat!important;animation:devmatch-fluent-shimmer 1.35s cubic-bezier(.4, 0, .2, 1) infinite;color:transparent!important;caret-color:transparent!important;text-shadow:none!important;`,
    text: `background-color:#ececef!important;background-image:${shimmerGradient}!important;background-size:220% 100%!important;background-repeat:no-repeat!important;animation:devmatch-fluent-shimmer 1.35s cubic-bezier(.4, 0, .2, 1) infinite;border-radius:4px;color:transparent!important;text-shadow:none!important;`,
    surface: `position:relative;isolation:isolate;`
  };
  function authMaskStyles() {
    const masks = authPageMasks[page];
    if (!masks) return '';
    const rules = [];
    Object.entries(masks).forEach(([type, selectors]) => {
      const scoped = selectors.map(selector => `html.devmatch-auth-pending-root ${selector}`);
      if (type === 'surface') {
        rules.push(`${scoped.join(',')}{${maskRules.surface}}`);
        rules.push(`${scoped.map(selector => `${selector}::before`).join(',')}{position:absolute;z-index:1;inset:0;border-radius:inherit;background-color:#ececef;background-image:${shimmerGradient};background-size:220% 100%;background-repeat:no-repeat;animation:devmatch-fluent-shimmer 1.35s cubic-bezier(.4, 0, .2, 1) infinite;content:"";pointer-events:none;}`);
        rules.push(`${scoped.map(selector => `${selector} > *`).join(',')}{visibility:hidden!important;}`);
      } else {
        rules.push(`${scoped.join(',')}{${maskRules[type]}}`);
        if (type === 'field') rules.push(`${scoped.map(selector => `${selector}::placeholder`).join(',')}{color:transparent!important;}`);
        if (type === 'text') rules.push(`${scoped.map(selector => `${selector} > *`).join(',')}{visibility:hidden!important;}`);
      }
    });
    const maskedSelectors = Object.entries(masks).flatMap(([type, selectors]) =>
      selectors.flatMap(selector => type === 'surface' ? [selector, `${selector}::before`] : [selector]));
    const darkSelectors = maskedSelectors.map(selector => `html[data-theme="dark"].devmatch-auth-pending-root ${selector}`);
    rules.push(`${darkSelectors.join(',')}{background-color:#303137!important;background-image:linear-gradient(90deg,#303137 0%,#3c3d44 42%,#28292e 50%,#3c3d44 58%,#303137 100%)!important;}`);
    const reducedMotionSelectors = maskedSelectors.map(selector => `html.devmatch-auth-pending-root ${selector}`);
    rules.push(`@media(prefers-reduced-motion:reduce){${reducedMotionSelectors.join(',')}{animation:none!important;background-image:none!important;}}`);
    return rules.join('\n');
  }
  if (authPending) {
    const maskStyle = document.createElement('style');
    maskStyle.id = 'devmatch-auth-pending-mask-styles';
    maskStyle.textContent = authMaskStyles();
    document.head.append(maskStyle);
  }
  function applyAuthPageMasks() {
    const masks = authPageMasks[page];
    if (masks) {
      Object.entries(masks).forEach(([type, selectors]) => {
        selectors.forEach(selector => document.querySelectorAll(selector).forEach(element => {
          element.setAttribute('data-devmatch-auth-mask', type);
          if (!element.hasAttribute('aria-hidden')) {
            element.setAttribute('aria-hidden', 'true');
            element.setAttribute('data-devmatch-auth-aria-hidden', '');
          }
        }));
      });
    }
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(link => {
      link.dataset.devmatchAuthHref = link.href;
      link.removeAttribute('href');
    });
  }
  function disablePendingInteractions() {
    document.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach(element => {
      if (element.hasAttribute('inert')) return;
      element.setAttribute('inert', '');
      element.setAttribute('data-devmatch-auth-inert', '');
    });
  }
  if (authPending) {
    document.addEventListener('DOMContentLoaded', () => {
      if (!document.body || authPendingResolved) return;
      document.body.classList.add('devmatch-auth-pending-content');
      applyAuthPageMasks();
      disablePendingInteractions();
      const status = document.createElement('span');
      status.id = 'devmatch-auth-pending-status';
      status.className = 'devmatch-skeleton-sr';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.textContent = 'Verifying your account…';
      document.body.append(status);
    }, {once: true});
  }
  function hideAuthSkeleton() {
    authPendingResolved = true;
    document.documentElement.classList.remove('devmatch-auth-pending-root');
    document.body?.classList.remove('devmatch-auth-pending-content');
    document.getElementById('devmatch-auth-pending-mask-styles')?.remove();
    document.querySelectorAll('[data-devmatch-auth-aria-hidden]').forEach(element => {
      element.removeAttribute('aria-hidden');
      element.removeAttribute('data-devmatch-auth-aria-hidden');
    });
    document.querySelectorAll('[data-devmatch-auth-inert]').forEach(element => {
      element.removeAttribute('inert');
      element.removeAttribute('data-devmatch-auth-inert');
    });
    document.getElementById('devmatch-auth-pending-status')?.remove();
    document.querySelectorAll('[data-devmatch-auth-href]').forEach(link => {
      link.href = link.dataset.devmatchAuthHref;
      delete link.dataset.devmatchAuthHref;
    });
  }
  function clearCache() {
    for (const key of Object.keys(localStorage)) {
      if (/^devmatch[-_]/.test(key)
        && key !== 'devmatch-language'
        && !key.startsWith('devmatch-user-data-migration-')) localStorage.removeItem(key);
    }
    sessionStorage.removeItem('devmatch-profile-draft');
  }
  function profileDataForCache(profileData) {
    const cachedData = {...profileData};
    privateProfileFields.forEach(field => delete cachedData[field]);
    return cachedData;
  }
  function sanitizeStoredProfile(storage, key, {preserveBirthday = false} = {}) {
    const stored = storage.getItem(key);
    if (!stored) return;
    try {
      const profile = JSON.parse(stored);
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        storage.removeItem(key);
        return;
      }
      const fieldsToRemove = preserveBirthday
        ? privateProfileFields.filter(field => field !== 'birthday')
        : privateProfileFields;
      if (fieldsToRemove.some(field => Object.hasOwn(profile, field))) {
        fieldsToRemove.forEach(field => delete profile[field]);
        storage.setItem(key, JSON.stringify(profile));
      }
    } catch {
      storage.removeItem(key);
    }
  }
  Object.keys(localStorage).filter(key => key.startsWith('devmatch-profile-'))
    .forEach(key => sanitizeStoredProfile(localStorage, key));
  sanitizeStoredProfile(sessionStorage, 'devmatch-profile-draft', {preserveBirthday: true});
  function cache(row, user) {
    const profile = {...profileDataForCache(row.profile_data), username: row.username || '', displayName: row.display_name,
      usernameChangedAt: row.username_changed_at || '', phone: row.phone || '', email: user.email,
      role: row.account_role, googleConnected: false};
    const key = 'devmatch-profile-' + row.account_role;
    const value = JSON.stringify(profile);
    const changed = localStorage.getItem(key) !== value;
    localStorage.setItem(key, value);
    sessionStorage.setItem('devmatch-active-role', row.account_role);
    return changed;
  }
  const workspaceKey = user => 'devmatch-workspace-' + user.id;
  async function loadProfile(user) {
    const {data, error} = await client.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    const role = sessionStorage.getItem(workspaceKey(user));
    if (!['client', 'dev'].includes(role) || role === data.account_role) return data;
    const workspace = await client.from('account_workspaces').select('*')
      .eq('user_id', user.id).eq('role', role).maybeSingle();
    if (workspace.error) throw workspace.error;
    if (!workspace.data) { sessionStorage.removeItem(workspaceKey(user)); return data; }
    const {display_name, profile_data, onboarding_complete} = workspace.data;
    return {...data, account_role: role, display_name, profile_data, onboarding_complete};
  }
  async function hasWorkspace(role) {
    await currentAccount();
    const {data, error} = await client.rpc('has_account_workspace', {p_role: role});
    if (error) throw error;
    return data === true;
  }
  async function switchWorkspace(role, create = false) {
    const user = await currentAccount();
    const {data, error} = await client.rpc('switch_account_workspace', {p_role: role, p_create: create});
    if (error) throw error;
    // Selection is per user and per tab, never written to the shared profile.
    sessionStorage.setItem(workspaceKey(user), data.account_role);
    sessionStorage.removeItem('devmatch-profile-draft');
    activeAccountRole = data.account_role;
    cache(data, user);
    return data;
  }
  async function updateWorkspaceProfile(changes) {
    const user = await currentAccount();
    const current = await loadProfile(user);
    const primary = await client.from('profiles').select('account_role').eq('id', user.id).single();
    if (primary.error) throw primary.error;
    const payload = {};
    for (const field of ['display_name', 'profile_data', 'onboarding_complete']) {
      if (Object.hasOwn(changes, field)) payload[field] = changes[field];
    }
    const query = current.account_role === primary.data.account_role
      ? client.from('profiles').update(payload).eq('id', user.id)
      : client.from('account_workspaces').update(payload).eq('user_id', user.id).eq('role', current.account_role);
    const {data, error} = await query.select().single();
    if (error) throw error;
    const updated = {...current, ...payload};
    cache(updated, user);
    return updated;
  }
  async function loadPrivateProfileFields() {
    const user = await currentAccount();
    const data = await loadProfile(user);
    return Object.fromEntries(privateProfileFields
      .filter(field => Object.hasOwn(data.profile_data || {}, field))
      .map(field => [field, data.profile_data[field]]));
  }
  function destination(row,user) {
    if(!user?.email_confirmed_at)return 'devmatch-verify-email.html';
    if (!row.onboarding_complete && /^\+[1-9]\d{7,14}$/.test(row.phone || '')
      && !(row.phone_verified_at && row.verified_phone === row.phone)) {
      return 'devmatch-verify-phone.html';
    }
    return row.onboarding_complete
      ? (row.account_role === 'client' ? 'devmatch-client-dashboard.html' : 'devmatch-dashboard.html')
      : 'devmatch-profile.html?role=' + row.account_role;
  }
  const ready = (async () => {
    const {data: {user}, error} = await client.auth.getUser();
    if (!user || error) {
      if(sessionStorage.getItem('devmatch-recovery')==='1' && page!=='devmatch-reset-password.html'){
        location.replace('devmatch-reset-password.html');return null;
      }
      if (protectedPage) {
        clearCache();
        location.replace('devmatch-auth.html?mode=login');
      }
      hideAuthSkeleton();
      return null;
    }
    if(sessionStorage.getItem('devmatch-recovery')==='1' && page!=='devmatch-reset-password.html') {
      location.replace('devmatch-reset-password.html');return null;
    }
    if (!protectedPage && (!user || !Object.hasOwn(roleSpecificPages, page))) {
      hideAuthSkeleton();
      return user;
    }
    const row = await loadProfile(user);
    activeAccountRole = row.account_role;
    if (protectedPage && !user.email_confirmed_at) {
      location.replace('devmatch-verify-email.html');
      return null;
    }
    if (roleSpecificPages[page] && row.account_role !== roleSpecificPages[page]) {
      location.replace(destination(row, user));
      return null;
    }
    if (!protectedPage) {
      hideAuthSkeleton();
      return user;
    }
    if(['devmatch-settings.html','devmatch-my-profile.html','devmatch-favorites.html','devmatch-chat.html'].includes(page)){
      const query=new URLSearchParams(location.search);
      if(query.get('role')!==row.account_role){query.set('role',row.account_role);location.replace(page+'?'+query+location.hash);return null;}
    }
    const changed = cache(row, user);
    if (page === 'devmatch-profile.html' && new URLSearchParams(location.search).get('role') !== row.account_role) {
      const url = new URL(location.href);
      url.searchParams.set('role', row.account_role);
      location.replace(url.href);
      return null;
    }
    if (changed) { location.reload(); return null; }
    hideAuthSkeleton();
    return user;
  })().catch(error => {
    if (protectedPage || Object.hasOwn(roleSpecificPages, page)) {
      console.error('Unable to verify the account role for this page.', error);
      location.replace('devmatch-auth.html?mode=login&error=connection');
    }
    return null;
  });
  let onlinePresenceChannel = null;
  let onlinePresenceUserId = null;
  let onlinePresenceGeneration = 0;
  function stopOnlinePresence() {
    onlinePresenceGeneration += 1;
    const channel = onlinePresenceChannel;
    onlinePresenceChannel = null;
    onlinePresenceUserId = null;
    if (channel) {
      void client.removeChannel(channel).then(result => {
        if (result !== 'ok') console.error('Unable to stop online presence.', result);
      }).catch(error => {
        console.error('Unable to stop online presence.', error);
      });
    }
  }
  function syncOnlinePresence(session) {
    const user = session?.user;
    if (!user?.id || !user.email_confirmed_at || !session.access_token) {
      stopOnlinePresence();
      return;
    }
    if (onlinePresenceUserId === user.id && onlinePresenceChannel) {
      void client.realtime.setAuth(session.access_token).catch(error => {
        console.error('Unable to refresh the online presence session token.', error);
      });
      return;
    }

    const generation = ++onlinePresenceGeneration;
    void client.realtime.setAuth(session.access_token).then(() => {
      if (generation !== onlinePresenceGeneration) return;
      stopOnlinePresence();
      const channel = client.channel(`devmatch-user-presence:${user.id}`, {
        config: {private: true, presence: {key: user.id}}
      });
      onlinePresenceChannel = channel;
      onlinePresenceUserId = user.id;
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          void channel.track({userId: user.id}).then(result => {
            if (result !== 'ok') console.error('Unable to publish online presence.', result);
          }).catch(error => {
            console.error('Unable to publish online presence.', error);
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Unable to subscribe to online presence.', status);
        }
      });
    }).catch(error => {
      console.error('Unable to authenticate online presence.', error);
    });
  }
  if (!window.__devmatchOnlinePresenceInitialized) {
    window.__devmatchOnlinePresenceInitialized = true;
    client.auth.onAuthStateChange((_event, session) => {
      syncOnlinePresence(session);
    });
    void ready.then(async user => {
      if (!user?.email_confirmed_at) return;
      const {data, error} = await client.auth.getSession();
      if (error) throw error;
      if (data.session?.user.id === user.id) syncOnlinePresence(data.session);
    }).catch(error => {
      console.error('Unable to initialize online presence.', error);
    });
    window.addEventListener('pagehide', () => {
      stopOnlinePresence();
    });
    window.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      void client.auth.getSession().then(({data, error}) => {
        if (error) throw error;
        syncOnlinePresence(data.session);
      }).catch(error => {
        console.error('Unable to restore online presence.', error);
      });
    });
  }
  document.addEventListener('click', async event => {
    if (!event.target.closest?.('.header-account-logout')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const {error} = await client.auth.signOut();
    if (error) { alert('Unable to log out. Please try again.'); return; }
    clearCache();
    location.assign('devmatch-auth.html?mode=login');
  }, true);
  async function currentAccount(){
    const initial=await ready;
    const {data:{user},error}=await client.auth.getUser();
    if(error||!initial||!user){
      clearCache();
      throw new Error('Your login session has expired. Log in again.');
    }
    if(initial.id!==user.id){
      clearCache();
      throw new Error('Your login session changed. Reload the page and log in again.');
    }
    return user;
  }

  async function getWorkspaceRole() {
    const user = await currentAccount();
    if (!activeAccountRole) activeAccountRole = (await loadProfile(user)).account_role;
    return activeAccountRole;
  }

  function chatReadStorageKey(userId, role, conversationId) {
    if (typeof userId !== 'string' || !userId
      || !['client', 'dev'].includes(role)
      || typeof conversationId !== 'string' || !conversationId) {
      throw new TypeError('A user, workspace, and conversation are required for chat read status.');
    }
    return `devmatch-chat-read:${userId}:${role}:${conversationId}`;
  }

  function getChatReadAt(userId, role, conversationId) {
    const key = chatReadStorageKey(userId, role, conversationId);
    const stored = localStorage.getItem(key);
    const timestamp = stored === null ? 0 : Number(stored);
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;

    const legacyKey = `devmatch-chat-read:${userId}:${conversationId}`;
    const legacyStored = localStorage.getItem(legacyKey);
    const legacyTimestamp = legacyStored === null ? 0 : Number(legacyStored);
    if (!Number.isFinite(legacyTimestamp) || legacyTimestamp <= 0) return 0;

    localStorage.setItem(key, String(legacyTimestamp));
    localStorage.removeItem(legacyKey);
    return legacyTimestamp;
  }

  function setChatReadAt(userId, role, conversationId, timestamp = Date.now()) {
    const key = chatReadStorageKey(userId, role, conversationId);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      throw new TypeError('A valid chat read timestamp is required.');
    }
    localStorage.setItem(key, String(timestamp));
  }

  function isChatConversationUnread(conversation, userId, role) {
    const lastMessage = conversation?.last_message;
    if (!lastMessage || lastMessage.sender_id === userId) return false;

    const createdAt = Date.parse(lastMessage.created_at);
    const readAt = Date.parse(lastMessage.read_at || '');
    if (Number.isFinite(createdAt) && Number.isFinite(readAt) && readAt >= createdAt) {
      return false;
    }
    return !(createdAt <= getChatReadAt(userId, role, conversation.id));
  }

  async function loadFavorites() {
    const user = await currentAccount();
    const role = await getWorkspaceRole();
    const {data, error} = await client.from('favorites').select('item_type,item_id')
      .eq('user_id',user.id).eq('workspace_role',role);
    if (error) throw error;
    // Anonymous device caches cannot establish ownership or workspace membership.
    return (data || []).map(({item_type,item_id}) => ({type:item_type,id:item_id}));
  }

  async function setFavorite(type,id,saved) {
    if (!['project','developer','client'].includes(type) || typeof id !== 'string' || !id) {
      throw new TypeError('A supported favorite type and item ID are required.');
    }
    const user=await currentAccount(); const role=await getWorkspaceRole();
    const query=client.from('favorites');
    const result=saved ? await query.upsert({user_id:user.id,workspace_role:role,item_type:type,item_id:id},
      {onConflict:'user_id,workspace_role,item_type,item_id',ignoreDuplicates:true})
      : await query.delete().eq('user_id',user.id).eq('workspace_role',role).eq('item_type',type).eq('item_id',id);
    if(result.error)throw result.error;
  }

  async function clearFavorites(type) {
    if (!['project','developer','client'].includes(type)) throw new TypeError('A supported favorite type is required.');
    const user=await currentAccount(); const role=await getWorkspaceRole();
    const {error}=await client.from('favorites').delete().eq('user_id',user.id).eq('workspace_role',role).eq('item_type',type);
    if(error)throw error;
  }

  async function loadNotificationReads() {
    const user=await currentAccount(); const role=await getWorkspaceRole();
    const {data,error}=await client.from('notification_reads').select('notification_id')
      .eq('user_id',user.id).eq('workspace_role',role);
    if(error)throw error;
    return (data||[]).map(row=>row.notification_id);
  }

  async function loadUnreadNotificationCount() {
    const user=await currentAccount(); const role=await getWorkspaceRole();
    const [readIds,{data,error}]=await Promise.all([loadNotificationReads(),
      client.from('notifications').select('id').eq('recipient_id',user.id).eq('recipient_role',role)]);
    if(error)throw error;
    const readSet=new Set(readIds);
    return (data||[]).filter(n=>!readSet.has(n.id)).length;
  }

  async function markNotificationsRead(notificationIds) {
    const ids=[...new Set(notificationIds.filter(id=>typeof id==='string'&&id.length>0))];
    if(!ids.length)return;
    const user=await currentAccount(); const role=await getWorkspaceRole();
    const {error}=await client.from('notification_reads').upsert(
      ids.map(notification_id=>({user_id:user.id,workspace_role:role,notification_id,read_at:new Date().toISOString()})),
      {onConflict:'user_id,workspace_role,notification_id'});
    if(error)throw error;
  }

  async function loadNotificationPreferences() {
    const user=await currentAccount(); const row=await loadProfile(user);
    return row.profile_data?.notificationPreferences || {};
  }

  async function saveNotificationPreferences(preferences) {
    const role=await getWorkspaceRole();
    const {data,error}=await client.rpc('save_notification_preferences',{p_preferences:preferences,p_role:role});
    if(error)throw error;
    const user=await currentAccount(); cache(await loadProfile(user),user);
    return data;
  }

  function projectRowToRecord(row) {
    const data = {...(row.data || {})};
    delete data.views;
    delete data.favorites;
    delete data.comments;
    return {
      ...data,
      id: row.id,
      status: row.status,
      created: row.created_at ? new Date(row.created_at).getTime() : Number(data.created) || 0,
      updated: new Date(row.updated_at).getTime(),
      ...(row.cover_image ? {coverImage: row.cover_image} : {})
    };
  }

  async function loadOwnedProjects(kind, legacyRecords = []) {
    if (!['portfolio', 'request'].includes(kind)) {
      throw new TypeError('A supported project kind is required.');
    }
    const user = await currentAccount();
    const {data, error} = await client.from('projects')
      .select('id,legacy_id,title,project_type,category,cover_image,status,data,created_at,updated_at')
      .eq('owner_id', user.id)
      .eq('project_kind', kind)
      .order('updated_at', {ascending: false});
    if (error) throw error;

    const migrationKey = `devmatch-user-data-migration-${user.id}-${kind}-v1`;
    let rows = data || [];
    if (rows.length === 0 && localStorage.getItem(migrationKey) !== 'complete') {
      const imported = legacyRecords
        .filter(record => record && typeof record === 'object' && typeof record.id === 'string')
        .map(record => {
          const recordData = {...record};
          delete recordData.coverImage;
          delete recordData.views;
          delete recordData.favorites;
          delete recordData.comments;
          return {
            owner_id: user.id,
            project_kind: kind,
            legacy_id: record.id,
            title: String(record.title || ''),
            project_type: String(record.projectType || record.type || ''),
            category: String(record.category || ''),
            price: String(record.price || record.budgetLabel || record.budget || ''),
            price_type: String(record.priceType || ''),
            cover_image: String(record.coverImage || ''),
            status: kind === 'portfolio'
              ? (record.status === 'published' ? 'published' : 'draft')
              : (['open', 'closed'].includes(record.status) ? record.status : 'draft'),
            data: recordData
          };
        });
      if (imported.length) {
        const {error: insertError} = await client.from('projects').upsert(imported, {
          onConflict: 'owner_id,project_kind,legacy_id',
          ignoreDuplicates: true
        });
        if (insertError) throw insertError;
        const {data: refreshed, error: refreshError} = await client.from('projects')
          .select('id,legacy_id,title,project_type,category,cover_image,status,data,created_at,updated_at')
          .eq('owner_id', user.id)
          .eq('project_kind', kind)
          .order('updated_at', {ascending: false});
        if (refreshError) throw refreshError;
        rows = refreshed || [];
      }
      localStorage.setItem(migrationKey, 'complete');
    }

    return rows.map(projectRowToRecord);
  }

  async function loadOwnedProjectMetrics() {
    await currentAccount();
    const {data, error} = await client.rpc('get_owned_project_metrics');
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Supabase returned invalid project metrics.');
    return data.map(row => {
      const metric = {
        id: row.project_id,
        views: Number(row.views),
        favorites: Number(row.favorites),
        comments: Number(row.comments)
      };
      if (typeof metric.id !== 'string' || !metric.id
        || ![metric.views, metric.favorites, metric.comments].every(value => Number.isSafeInteger(value) && value >= 0)) {
        throw new Error('Supabase returned invalid project metrics.');
      }
      return metric;
    });
  }

  async function saveOwnedProject(kind, record) {
    if (!['portfolio', 'request'].includes(kind) || !record || typeof record !== 'object') {
      throw new TypeError('A supported project kind and project record are required.');
    }
    const user = await currentAccount();
    const recordData = {...record};
    delete recordData.coverImage;
    delete recordData.views;
    delete recordData.favorites;
    delete recordData.comments;
    const isDatabaseId = typeof record.id === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.id);
    const payload = {
      owner_id: user.id,
      project_kind: kind,
      title: String(record.title || ''),
      project_type: String(record.projectType || record.type || ''),
      category: String(record.category || ''),
      price: String(record.price || record.budgetLabel || record.budget || ''),
      price_type: String(record.priceType || ''),
      cover_image: String(record.coverImage || ''),
      status: kind === 'portfolio'
        ? (record.status === 'published' ? 'published' : 'draft')
        : (['open', 'closed'].includes(record.status) ? record.status : 'draft'),
      data: recordData,
      updated_at: new Date().toISOString()
    };
    const query = isDatabaseId
      ? client.from('projects').update(payload).eq('id', record.id).eq('owner_id', user.id)
      : client.from('projects').insert(payload);
    const {data, error} = await query.select('id').single();
    if (error) throw error;
    return data.id;
  }

  async function deleteOwnedProject(kind, id) {
    if (!['portfolio', 'request'].includes(kind) || typeof id !== 'string' || !id) {
      throw new TypeError('A supported project kind and ID are required.');
    }
    const user = await currentAccount();
    const {error} = await client.from('projects').delete()
      .eq('id', id)
      .eq('owner_id', user.id)
      .eq('project_kind', kind);
    if (error) throw error;
  }

  async function loadProjectComments(projectId) {
    if (typeof projectId !== 'string' || !projectId) {
      throw new TypeError('A project ID is required.');
    }
    let columns = ['id', 'project_id', 'parent_comment_id', 'user_id', 'workspace_role', 'text', 'author_name', 'author_initials', 'created_at'];
    const loadComments = () => client.from('comments')
      .select(columns.join(','))
      .eq('project_id', projectId)
      .order('created_at', {ascending: true});
    let result = await loadComments();
    let repliesSupported = true;
    let workspaceRolesSupported = true;
    for (let attempt = 0; result.error && attempt < 2; attempt++) {
      const error = result.error;
      const message = error.message || '';
      if (error.code !== '42703' && error.code !== 'PGRST204'
        && !/parent_comment_id.*(does not exist|not found|schema cache)/i.test(message)
        && !/workspace_role.*(does not exist|not found|schema cache)/i.test(message)) break;
      const identifiesMissingColumn = /parent_comment_id|workspace_role/i.test(message);
      const parentColumnMissing = /parent_comment_id/i.test(message) || !identifiesMissingColumn;
      const workspaceRoleColumnMissing = /workspace_role/i.test(message) || !identifiesMissingColumn;
      if (parentColumnMissing && repliesSupported) {
        repliesSupported = false;
        columns = columns.filter(column => column !== 'parent_comment_id');
      }
      if (workspaceRoleColumnMissing && workspaceRolesSupported) {
        workspaceRolesSupported = false;
        columns = columns.filter(column => column !== 'workspace_role');
      }
      if (!parentColumnMissing && !workspaceRoleColumnMissing) {
        repliesSupported = false;
        workspaceRolesSupported = false;
        columns = columns.filter(column => column !== 'parent_comment_id' && column !== 'workspace_role');
      }
      result = await loadComments();
    }
    if (result.error) throw result.error;
    return {
      repliesSupported,
      comments: (result.data || []).map(comment => ({
        id: comment.id,
        projectId: comment.project_id,
        parentCommentId: comment.parent_comment_id || null,
        userId: comment.user_id,
        workspaceRole: comment.workspace_role || null,
        text: comment.text,
        name: comment.author_name,
        initials: comment.author_initials,
        time: comment.created_at
      }))
    };
  }

  async function loadCommentAuthorRoles(comments) {
    const authors = (Array.isArray(comments) ? comments : [])
      .map(comment => ({
        userId: comment?.userId || comment?.user_id,
        name: comment?.name || comment?.author_name
      }))
      .filter(comment => typeof comment.userId === 'string' && comment.userId);
    const userIds = [...new Set(authors.map(comment => comment.userId))];
    if (!userIds.length) return new Map();

    const {data, error} = await client.from('directory_people')
      .select('id,display_name,account_role')
      .in('id', userIds);
    if (error) throw error;

    const profilesByUser = new Map();
    (data || []).forEach(profile => {
      if (!profilesByUser.has(profile.id)) profilesByUser.set(profile.id, []);
      profilesByUser.get(profile.id).push(profile);
    });

    const roles = new Map();
    authors.forEach(author => {
      const profiles = profilesByUser.get(author.userId) || [];
      const profile = profiles.find(item => item.display_name === author.name) || profiles[0];
      if (profile && (profile.account_role === 'dev' || profile.account_role === 'client')) {
        roles.set(author.userId, profile.account_role);
      }
    });
    return roles;
  }

  function publicProfileUrl(userId, role) {
    if (typeof userId !== 'string' || !userId) return null;
    if (role === 'dev') return `devmatch-developer-profile.html?developer=${encodeURIComponent(userId)}`;
    if (role === 'client') return `devmatch-client-profile.html?client=${encodeURIComponent(userId)}`;
    return null;
  }

  async function recordProjectView(projectId) {
    if (typeof projectId !== 'string' || !projectId) {
      throw new TypeError('A project ID is required.');
    }
    await currentAccount();
    const {data, error} = await client.rpc('record_project_view', {p_project_id: projectId});
    if (error) throw error;
    return data;
  }

  async function addProjectComment(projectId, text) {
    if (typeof projectId !== 'string' || !projectId
      || typeof text !== 'string' || !text.trim() || text.trim().length > 5000) {
      throw new TypeError('A project ID and comment between 1 and 5000 characters are required.');
    }
    const user = await currentAccount();
    const {data, error} = await client.from('comments')
      .insert({project_id: projectId, user_id: user.id, workspace_role: await getWorkspaceRole(), text: text.trim()})
      .select('id,project_id,user_id,workspace_role,text,author_name,author_initials,created_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      projectId: data.project_id,
      userId: data.user_id,
      workspaceRole: data.workspace_role || null,
      text: data.text,
      name: data.author_name,
      initials: data.author_initials,
      time: data.created_at
    };
  }

  async function addProjectCommentReply(projectId, parentCommentId, text) {
    if (typeof projectId !== 'string' || !projectId
      || typeof parentCommentId !== 'string' || !parentCommentId
      || typeof text !== 'string' || !text.trim() || text.trim().length > 5000) {
      throw new TypeError('A project ID, comment ID, and reply between 1 and 5000 characters are required.');
    }
    const user = await currentAccount();
    const {data, error} = await client.from('comments')
      .insert({project_id: projectId, parent_comment_id: parentCommentId, user_id: user.id, workspace_role: await getWorkspaceRole(), text: text.trim()})
      .select('id,project_id,parent_comment_id,user_id,workspace_role,text,author_name,author_initials,created_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      projectId: data.project_id,
      parentCommentId: data.parent_comment_id,
      userId: data.user_id,
      workspaceRole: data.workspace_role || null,
      text: data.text,
      name: data.author_name,
      initials: data.author_initials,
      time: data.created_at
    };
  }

  function projectReviewRecord(row) {
    const rating = Number(row?.rating);
    if (!row || typeof row.id !== 'string' || !row.id
      || !Number.isInteger(rating) || rating < 1 || rating > 5
      || typeof row.reviewer_name !== 'string'
      || typeof row.reviewer_initials !== 'string'
      || typeof row.project_title !== 'string'
      || typeof row.text !== 'string') {
      throw new Error('Supabase returned an invalid project review.');
    }
    return {
      id: row.id,
      reviewerName: row.reviewer_name,
      reviewerInitials: row.reviewer_initials,
      projectTitle: row.project_title,
      rating,
      text: row.text,
      createdAt: row.created_at
    };
  }

  async function loadProfileReviews(profileId) {
    if (typeof profileId !== 'string' || !profileId) {
      throw new TypeError('A profile ID is required.');
    }
    const {data, error} = await client.rpc('get_profile_reviews', {p_profile_id: profileId});
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Supabase returned an invalid project review list.');
    return data.map(projectReviewRecord);
  }

  async function loadProjectEngagement(conversationId) {
    if (typeof conversationId !== 'string' || !conversationId) {
      throw new TypeError('A conversation ID is required.');
    }
    await currentAccount();
    const {data, error} = await client.from('project_engagements')
      .select('id,conversation_id,project_id,client_id,developer_id,client_completed_at,developer_completed_at')
      .eq('conversation_id', conversationId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function confirmProjectCompletion(conversationId) {
    if (typeof conversationId !== 'string' || !conversationId) {
      throw new TypeError('A conversation ID is required.');
    }
    await currentAccount();
    const {data: engagementId, error: startError} = await client.rpc(
      'start_project_engagement',
      {p_conversation_id: conversationId}
    );
    if (startError) throw startError;
    if (typeof engagementId !== 'string' || !engagementId) {
      throw new Error('Supabase returned an invalid project engagement.');
    }
    const {data, error} = await client.rpc(
      'confirm_project_engagement',
      {p_engagement_id: engagementId}
    );
    if (error) throw error;
    if (!data || data.id !== engagementId) {
      throw new Error('Supabase returned an invalid project completion confirmation.');
    }
    return data;
  }

  async function loadMyProjectReview(engagementId) {
    if (typeof engagementId !== 'string' || !engagementId) {
      throw new TypeError('An engagement ID is required.');
    }
    await currentAccount();
    const {data, error} = await client.rpc('get_my_project_review', {p_engagement_id: engagementId});
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Supabase returned an invalid project review.');
    return data.length ? projectReviewRecord(data[0]) : null;
  }

  async function submitProjectReview(engagementId, rating, text = '') {
    if (typeof engagementId !== 'string' || !engagementId
      || !Number.isInteger(rating) || rating < 1 || rating > 5
      || typeof text !== 'string' || text.length > 2000) {
      throw new TypeError('An engagement ID, a rating from 1 to 5, and a comment up to 2000 characters are required.');
    }
    await currentAccount();
    const {data, error} = await client.rpc('submit_project_review', {
      p_engagement_id: engagementId,
      p_rating: rating,
      p_text: text.trim()
    });
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1) {
      throw new Error('Supabase returned an invalid submitted project review.');
    }
    return projectReviewRecord(data[0]);
  }

  function safeFileName(value) {
    const name = String(value || 'upload')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(-100);
    return name || 'upload';
  }

  function validateUpload(file, allowedTypes, maximumBytes) {
    if (!(file instanceof Blob) || !allowedTypes.includes(file.type)) {
      throw new TypeError('Choose a supported file type.');
    }
    if (file.size <= 0 || file.size > maximumBytes) {
      throw new RangeError('The selected file is empty or exceeds the upload size limit.');
    }
  }

  async function uploadProfileAvatar(file) {
    validateUpload(file, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], 10 * 1024 * 1024);
    const user = await currentAccount();
    const path = `${user.id}/avatars/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const {error} = await client.storage.from('project-media').upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    const {data} = client.storage.from('project-media').getPublicUrl(path);
    return {path, url: data.publicUrl};
  }

  async function removeProfileAvatar(url) {
    if (typeof url !== 'string') return;
    const prefix = 'https://yxwktllqbmhustmhdaqi.supabase.co/storage/v1/object/public/project-media/';
    if (!url.startsWith(prefix)) return;
    const user = await currentAccount();
    const path = url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
    if (path.split('/')[0] !== user.id) {
      throw new Error('You can only remove your own profile photo.');
    }
    await removeUploadedFiles('project-media', [path]);
  }

  async function uploadPortfolioMedia(projectId, file) {
    if (typeof projectId !== 'string' || !projectId) {
      throw new TypeError('A saved project ID is required before uploading project media.');
    }
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const videoTypes = ['video/mp4', 'video/webm'];
    const allowedTypes = file?.type?.startsWith('video/') ? videoTypes : imageTypes;
    validateUpload(file, allowedTypes, file?.type?.startsWith('video/')
      ? 50 * 1024 * 1024
      : 10 * 1024 * 1024);
    const user = await currentAccount();
    const path = `${user.id}/${projectId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const {error} = await client.storage.from('project-media').upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    const {data} = client.storage.from('project-media').getPublicUrl(path);
    return {path, url: data.publicUrl};
  }

  async function removePortfolioMedia(urls) {
    if (!Array.isArray(urls) || urls.some(url => typeof url !== 'string')) {
      throw new TypeError('Project media URLs must be provided as a list.');
    }
    const user = await currentAccount();
    const prefix = 'https://yxwktllqbmhustmhdaqi.supabase.co/storage/v1/object/public/project-media/';
    const paths = urls.filter(url => url.startsWith(prefix)).map(url =>
      url.slice(prefix.length).split('/').map(decodeURIComponent).join('/')
    );
    if (paths.some(path => path.split('/')[0] !== user.id)) {
      throw new Error('You can only remove your own project media.');
    }
    await removeUploadedFiles('project-media', paths);
  }

  async function uploadPrivateFile(kind, entityId, file) {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];
    const maximumBytes = kind === 'experience'
      ? 5 * 1024 * 1024
      : 10 * 1024 * 1024;
    validateUpload(file, allowedTypes, maximumBytes);
    const user = await currentAccount();
    let path;
    if (kind === 'experience') {
      path = `experience/${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    } else if (kind === 'request' && typeof entityId === 'string' && entityId) {
      path = `request/${user.id}/${entityId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    } else {
      throw new TypeError('A supported private upload type is required.');
    }
    const {error} = await client.storage.from('private-uploads').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    return {path, name: file.name, size: file.size, type: file.type};
  }

  async function createPrivateFileUrl(path, downloadName) {
    if (typeof path !== 'string'
      || !/^(experience|request)\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)*\/[^/]+$/.test(path)) {
      throw new TypeError('A valid private upload path is required.');
    }
    const user = await currentAccount();
    if (!user) throw new Error('Authentication is required to access this file.');
    const options = downloadName ? {download: safeFileName(downloadName)} : {download: true};
    const {data, error} = await client.storage.from('private-uploads')
      .createSignedUrl(path, 300, options);
    if (error) throw error;
    return data.signedUrl;
  }

  async function removeUploadedFiles(bucket, paths) {
    if (!['project-media', 'private-uploads'].includes(bucket)
      || !Array.isArray(paths)
      || paths.some(path => typeof path !== 'string' || path.startsWith('/') || path.includes('..'))) {
      throw new TypeError('A supported bucket and valid file paths are required.');
    }
    if (!paths.length) return;
    await currentAccount();
    const {error} = await client.storage.from(bucket).remove(paths);
    if (error) throw error;
  }

  async function saveProfile(value, {includePrivateFields = false} = {}){
    const user=await currentAccount();
    const {email,phone,username,usernameChangedAt,role,...details}=value;
    const suppliedPrivateFields = {};
    privateProfileFields.forEach(field => {
      if (Object.hasOwn(details, field)) {
        suppliedPrivateFields[field] = details[field];
        delete details[field];
      }
    });
    const currentProfile = await loadProfile(user);
    privateProfileFields.forEach(field => {
      if (Object.hasOwn(currentProfile.profile_data || {}, field)) {
        details[field] = currentProfile.profile_data[field];
      }
    });
    if (includePrivateFields) Object.assign(details, suppliedPrivateFields);
    if (Object.hasOwn(currentProfile.profile_data, 'notificationPreferences')) {
      details.notificationPreferences = currentProfile.profile_data.notificationPreferences;
    }
    const data=await updateWorkspaceProfile({display_name:String(details.displayName||''),profile_data:details});
    cache(data,user);return data;
  }
  async function checkUsernameAvailability(username) {
    if (typeof username !== 'string') throw new TypeError('A username is required.');
    return client.rpc('is_username_available', {p_username: username.toLowerCase()});
  }
  async function changeUsername(username) {
    if (typeof username !== 'string') throw new TypeError('A username is required.');
    const user = await currentAccount();
    const normalized = username.toLowerCase();
    const {data, error} = await client.rpc('change_username', {p_username: normalized});
    if (error) throw error;
    if (typeof data !== 'string' || data !== normalized) {
      throw new Error('Supabase returned an invalid username update result.');
    }
    const updated = await loadProfile(user);
    cache(updated, user);
    return {username: updated.username, usernameChangedAt: updated.username_changed_at || ''};
  }
  async function changePassword(currentPassword,password){
    const user=await currentAccount();
    const {data,error}=await client.auth.signInWithPassword({email:user.email,password:currentPassword});
    if(error)throw error;
    if(data.user?.id!==user.id)throw new Error('Your session changed. Please log in again.');
    const changed=await client.auth.updateUser({password});
    if(changed.error)throw changed.error;
  }
  window.devMatchBackend = {
    client,
    ready,
    clearCache,
    profileDataForCache,
    cache,
    checkUsernameAvailability,
    changeUsername,
    loadProfile,
    getWorkspaceRole,
    getChatReadAt,
    setChatReadAt,
    isChatConversationUnread,
    hasWorkspace,
    switchWorkspace,
    updateWorkspaceProfile,
    loadPrivateProfileFields,
    destination,
    saveProfile,
    changePassword,
    uploadProfileAvatar,
    removeProfileAvatar,
    uploadPortfolioMedia,
    removePortfolioMedia,
    uploadPrivateFile,
    createPrivateFileUrl,
    removeUploadedFiles,
    loadFavorites,
    setFavorite,
    clearFavorites,
    loadNotificationReads,
    loadUnreadNotificationCount,
    markNotificationsRead,
    loadNotificationPreferences,
    saveNotificationPreferences,
    loadOwnedProjects,
    loadOwnedProjectMetrics,
    saveOwnedProject,
    deleteOwnedProject,
    loadProjectComments,
    loadCommentAuthorRoles,
    publicProfileUrl,
    recordProjectView,
    addProjectComment,
    addProjectCommentReply,
    loadProfileReviews,
    loadProjectEngagement,
    confirmProjectCompletion,
    loadMyProjectReview,
    submitProjectReview
  };
})();
