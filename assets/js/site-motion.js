const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let libraries;
let stopMotion;

function loadGsap() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../vendor/gsap-3.15.1.js', import.meta.url).href;
    script.onload = () => resolve(window.gsap);
    script.onerror = () => reject(new Error('GSAP could not be loaded.'));
    document.head.append(script);
  });
}

function startMotion({animate, inView}, Lenis, gsap) {
  const hero = document.querySelector('main > .hero');
  const headings = document.querySelectorAll('main h1, .chat-conv-pane h1');
  const headingAnimations = gsap.context(() => {});
  const stopHeadings = inView(headings, heading => {
    if (heading.closest('dialog')) return;
    const heroHeading = hero?.contains(heading);
    const targets = heroHeading ? hero.querySelectorAll('.pill, h1, .lead') : heading;
    headingAnimations.add(() => {
      gsap.fromTo(targets, {opacity: 0.16, y: heroHeading ? 32 : 18}, {
        opacity: 1, y: 0, duration: heroHeading ? 0.72 : 0.52,
        stagger: heroHeading ? 0.13 : 0, ease: 'power3.out', clearProps: 'opacity,transform'
      });
    });
  });

  const panelSelectors = hero
    ? '.hero .path, main > section > .wrap > :is(.head, h2, .final), .how .panel, main .grid4, main .why > div, main .bcard'
    : 'main .stat-card, main article.panel, main .home-section, main .discover-detail-card, .chat-empty-state';
  const panels = [...document.querySelectorAll(panelSelectors)]
    .filter(panel => !panel.closest('dialog') && !panel.querySelector('h1')).slice(0, 32);
  const panelAnimations = new Set();
  const stopPanels = inView(panels, panel => {
    const animation = animate(panel, {opacity: [0.18, 1], translate: ['0 28px', '0 0']}, {
      duration: 0.58, ease: [0.22, 1, 0.36, 1]
    });
    panelAnimations.add(animation);
    animation.finished.then(() => panelAnimations.delete(animation), () => panelAnimations.delete(animation));
  }, {amount: 0.15});

  const wrapper = document.querySelector('body.page-scroll-shell > main') || window;
  let lenis;
  function syncScroll() {
    lenis?.destroy();
    lenis = undefined;
    if (!finePointer.matches || window !== window.top || document.body.classList.contains('chat-body')) return;
    lenis = new Lenis({
      wrapper,
      autoRaf: true,
      naiveDimensions: true,
      allowNestedScroll: true,
      prevent: element => element.matches('dialog, [role="dialog"], textarea, select, [contenteditable="true"]'),
      virtualScroll: () => !document.querySelector('dialog[open]')
    });
  }
  syncScroll();
  finePointer.addEventListener('change', syncScroll);

  return () => {
    stopHeadings();
    stopPanels();
    headingAnimations.revert();
    for (const animation of panelAnimations) animation.cancel();
    finePointer.removeEventListener('change', syncScroll);
    lenis?.destroy();
  };
}

async function syncMotion() {
  if (reducedMotion.matches) {
    stopMotion?.();
    stopMotion = undefined;
    return;
  }
  if (stopMotion || !document.querySelector('main, .chat-conv-pane')) return;
  libraries ||= Promise.all([
    import('../vendor/motion-14.14.0.js'),
    import('../vendor/lenis-1.3.29.js'),
    loadGsap()
  ]);
  const [motion, {default: Lenis}, gsap] = await libraries;
  if (!reducedMotion.matches && !stopMotion) stopMotion = startMotion(motion, Lenis, gsap);
}

function updateMotion() {
  void syncMotion().catch(error => console.error('Unable to start site animations.', error));
}

reducedMotion.addEventListener('change', updateMotion);
updateMotion();
