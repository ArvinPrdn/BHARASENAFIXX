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
  const symbolCount = document.createElement('span');
  symbolCount.className = 'heritage-symbol-count';
  symbolCount.setAttribute('aria-hidden', 'true');
  summary.append(symbolCount);
  let selected = 'ksatria';

  function selectSymbol(key) {
    if (!symbolLights.has(key)) return;
    selected = key;
    const position = buttons.findIndex((button) => button.dataset.symbol === key) + 1;
    symbolCount.textContent = `${String(position).padStart(2, '0')} / ${String(buttons.length).padStart(2, '0')}`;
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
  section.querySelector('.heritage-symbols')?.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    selectSymbol(buttons[next].dataset.symbol);
  });
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
