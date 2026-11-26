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
  const headings = document.querySelectorAll('main h1, .chat-conv-pane h1');
  const headingAnimations = gsap.context(() => {});
  const stopHeadings = inView(headings, heading => {
    if (heading.closest('dialog')) return;
    headingAnimations.add(() => {
      gsap.fromTo(heading, {opacity: 0.82, y: 6}, {
        opacity: 1, y: 0, duration: 0.36, ease: 'power2.out', clearProps: 'opacity,transform'
      });
    });
  });

  const panels = [...document.querySelectorAll(
    'main > section, main .stat-card, main article.panel, main .home-section, main .discover-detail-card, .chat-empty-state'
  )].filter(panel => !panel.closest('dialog') && !panel.querySelector('h1')).slice(0, 24);
  const panelAnimations = new Set();
  const stopPanels = inView(panels, panel => {
    const animation = animate(panel, {opacity: [0.9, 1]}, {duration: 0.28, ease: 'easeOut'});
    panelAnimations.add(animation);
    animation.finished.then(() => panelAnimations.delete(animation), () => panelAnimations.delete(animation));
  }, {amount: 'some'});

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
