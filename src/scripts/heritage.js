const symbolLights = {
  ksatria: [50, 17, 26, 22],
  perisai: [50, 57, 31, 33],
  bintang: [50, 37, 23, 10],
  matahari: [50, 57, 25, 16],
  obor: [50, 52, 12, 20],
  buku: [50, 70, 22, 11],
  padi: [23, 59, 12, 29],
  kapas: [77, 59, 13, 29],
  tahun: [50, 80, 14, 6],
  pita: [50, 89, 34, 12],
};

export function initHeritage() {
  const section = document.querySelector('#identitas');
  const explorer = section?.querySelector('.heritage-explorer');
  const emblem = section?.querySelector('.heritage-logo');
  if (!section || !explorer || !emblem) return;
  const buttons = [...section.querySelectorAll('[data-symbol]')];
  const panels = [...section.querySelectorAll('[data-philosophy]')];
  const summary = explorer.querySelector('summary');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 'ksatria';

  function selectSymbol(key) {
    if (!Object.hasOwn(symbolLights, key)) return;
    selected = key;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.symbol === key)));
    panels.forEach((panel) => { panel.hidden = panel.dataset.philosophy !== key; });
    const [x, y, width, height] = symbolLights[key];
    section.style.setProperty('--symbol-x', `${x}%`);
    section.style.setProperty('--symbol-y', `${y}%`);
    section.style.setProperty('--symbol-w', `${width}%`);
    section.style.setProperty('--symbol-h', `${height}%`);
    const panel = panels.find((item) => item.dataset.philosophy === key);
    if (panel && !reducedMotion.matches) {
      panel.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
    }
  }

  buttons.forEach((button) => button.addEventListener('click', () => selectSymbol(button.dataset.symbol)));
  emblem.addEventListener('click', () => {
    explorer.open = !explorer.open;
    if (explorer.open) {
      requestAnimationFrame(() => {
        summary.focus({ preventScroll: true });
        if (matchMedia('(max-width: 767px)').matches) summary.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      });
    }
  });
  explorer.addEventListener('toggle', () => {
    emblem.setAttribute('aria-expanded', String(explorer.open));
    section.classList.toggle('is-exploring', explorer.open);
    if (explorer.open) selectSymbol(selected);
  });
  section.querySelector('.heritage-close')?.addEventListener('click', () => {
    explorer.open = false;
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });
  explorer.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !explorer.open) return;
    event.preventDefault();
    explorer.open = false;
    summary.focus();
  });
  section.classList.add('is-ready');
  selectSymbol(selected);
}
