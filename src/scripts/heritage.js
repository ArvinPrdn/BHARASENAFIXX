const symbolLights = new Set(['ksatria', 'perisai', 'bintang', 'matahari', 'obor', 'buku', 'padi', 'kapas', 'tahun', 'pita']);

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
    if (!symbolLights.has(key)) return;
    selected = key;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.symbol === key)));
    panels.forEach((panel) => { panel.hidden = panel.dataset.philosophy !== key; });
    const spotlight = emblem.querySelector('.heritage-spotlight');
    spotlight.style.setProperty('--symbol-mask', `url("assets/batalyon/highlights/${key}.svg")`);
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
