'use strict';
(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set();
  function animate(element, frames, options) {
    if (!element || preference.matches || !element.animate) return null;
    const animation = element.animate(frames, { duration: 600, easing: 'cubic-bezier(.22,.7,.22,1)', ...options });
    active.add(animation);
    animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    return animation;
  }
  window.siteMotion = { animate, get reduced() { return preference.matches; } };
  preference.addEventListener('change', () => {
    if (preference.matches) {
      active.forEach(animation => animation.cancel());
      document.querySelectorAll('.reveal-pending').forEach(node => node.classList.remove('reveal-pending'));
    }
  });

  // Only hide content after observation is available; all content stays visible without JS.
  if ('IntersectionObserver' in window && !preference.matches) {
    const targets = document.querySelectorAll('.hero-meta, .intro-grid > div, .interest-line, .case-heading > div, .case-index, .section-marker, .section-intro, .project-row, .project-feature, .practice-grid article, .contact-section .section-body, .concept-shell, .architecture, .runtime-list li, .case-end');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('reveal-pending');
        animate(entry.target, [{ opacity: 0, transform: 'translateY(17px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 720 });
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.07 });
    targets.forEach(target => { target.classList.add('reveal-pending'); observer.observe(target); });

    const architecture = document.querySelector('.architecture');
    if (architecture) {
      const architectureObserver = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        architecture.querySelectorAll('.arch-row').forEach((row, index) => {
          row.querySelectorAll('.arch-node, .arch-core, .arch-output').forEach((node, column) => animate(node,
            [{ opacity: 0, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 520, delay: 160 + index * 170 + column * 70, fill: 'backwards' }));
        });
        architecture.querySelectorAll('.arch-bridge i').forEach((arrow, index) => animate(arrow,
          [{ opacity: 0.25, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'translateY(4px)' }, { opacity: 0.5, transform: 'translateY(0)' }],
          { duration: 700, delay: 250 + index * 170 }));
        architectureObserver.disconnect();
      }, { threshold: 0.1 });
      architectureObserver.observe(architecture);
    }
  }
  document.querySelectorAll('.work-menu').forEach(menu => menu.addEventListener('toggle', () => {
    if (menu.open) animate(menu.querySelector('.submenu'), [{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220 });
  }));
})();
