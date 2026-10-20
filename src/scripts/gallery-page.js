import { gallery as staticGallery } from '../data/event.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const state = { items: [], filter: 'all', current: 0 };

const grid = $('[data-gallery-grid]');
const filters = $('[data-gallery-filters]');
const status = $('[data-gallery-status]');
const countNodes = $$('[data-gallery-count]');
const dialog = $('[data-gallery-dialog]');
const dialogImage = $('[data-gallery-dialog-image]');
const dialogCaption = $('[data-gallery-dialog-caption]');
const dialogCounter = $('[data-gallery-dialog-counter]');

function setCount(value) {
  countNodes.forEach((node) => { node.textContent = String(value); });
}

function safeItem(item) {
  return {
    src: typeof item?.src === 'string' ? item.src : '',
    alt: typeof item?.alt === 'string' && item.alt.trim() ? item.alt.trim() : 'Dokumentasi BHARASENA',
    day: typeof item?.day === 'string' && item.day.trim() ? item.day.trim() : 'BHARASENA',
  };
}

function emptyState() {
  grid.innerHTML = '<article class="gallery-empty"><div><div class="gallery-empty__seal" aria-hidden="true">B</div><h3>Ruang ini belum terisi.</h3><p>Foto dokumentasi akan muncul di sini setelah panitia mengunggah dan menerbitkannya dari ruang kendali acara.</p></div></article>';
  status.textContent = 'Foto akan ditambahkan panitia selama acara.';
}

function updateFilters() {
  const days = [...new Set(state.items.map((item) => item.day))];
  filters.innerHTML = '<button type="button" class="gallery-filter is-active" data-gallery-filter="all" aria-pressed="true">Semua foto</button>';
  days.forEach((day) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-filter';
    button.dataset.galleryFilter = day;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = day;
    filters.append(button);
  });
}

function visibleItems() {
  return state.filter === 'all' ? state.items : state.items.filter((item) => item.day === state.filter);
}

function render() {
  const items = visibleItems();
  if (!items.length) {
    if (state.items.length) {
      grid.innerHTML = '<p class="gallery-empty gallery-empty--filtered">Belum ada foto pada bagian ini.</p>';
      status.textContent = 'Belum ada foto pada filter yang dipilih.';
    } else emptyState();
    return;
  }
  status.textContent = `${items.length} ${items.length === 1 ? 'foto' : 'foto'} dalam ruang ini.`;
  grid.replaceChildren(...items.map((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-photo';
    button.style.setProperty('--photo-index', String(index));
    button.dataset.galleryIndex = String(state.items.indexOf(item));
    button.setAttribute('aria-label', `Buka foto ${index + 1}: ${item.alt}`);
    const media = document.createElement('span');
    media.className = 'gallery-photo__media';
    const image = document.createElement('img');
    image.src = item.src;
    image.alt = item.alt;
    image.loading = index < 4 ? 'eager' : 'lazy';
    image.decoding = 'async';
    media.append(image);
    const caption = document.createElement('span');
    caption.className = 'gallery-photo__caption';
    const day = document.createElement('span');
    day.textContent = item.day;
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    caption.append(day, number);
    button.append(media, caption);
    return button;
  }));
}

function selectFilter(filter) {
  state.filter = filter;
  $$('.gallery-filter', filters).forEach((button) => {
    const active = button.dataset.galleryFilter === filter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  render();
}

function showPhoto(index) {
  if (!state.items.length || !dialog) return;
  state.current = (index + state.items.length) % state.items.length;
  const item = state.items[state.current];
  dialogImage.src = item.src;
  dialogImage.alt = item.alt;
  dialogCaption.textContent = item.day;
  dialogCounter.textContent = `${String(state.current + 1).padStart(2, '0')} / ${String(state.items.length).padStart(2, '0')}`;
  if (!dialog.open) dialog.showModal();
}

async function loadGallery() {
  try {
    const response = await fetch('/api/content', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Konten belum tersedia');
    const payload = await response.json();
    state.items = Array.isArray(payload.gallery) ? payload.gallery.map(safeItem).filter((item) => item.src) : [];
  } catch {
    state.items = Array.isArray(staticGallery) ? staticGallery.map(safeItem).filter((item) => item.src) : [];
  }
  if (!state.items.length && Array.isArray(staticGallery)) state.items = staticGallery.map(safeItem).filter((item) => item.src);
  setCount(state.items.length);
  updateFilters();
  render();
}

filters?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-gallery-filter]');
  if (button) selectFilter(button.dataset.galleryFilter || 'all');
});
grid?.addEventListener('click', (event) => {
  const card = event.target.closest('[data-gallery-index]');
  if (card) showPhoto(Number(card.dataset.galleryIndex));
});
dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
dialog?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(state.current - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(state.current + 1); }
});
$('[data-gallery-prev]')?.addEventListener('click', () => showPhoto(state.current - 1));
$('[data-gallery-next]')?.addEventListener('click', () => showPhoto(state.current + 1));
$('[data-gallery-close]')?.addEventListener('click', () => dialog?.close());

let touchX = null;
dialog?.addEventListener('touchstart', (event) => { touchX = event.touches[0]?.clientX ?? null; }, { passive: true });
dialog?.addEventListener('touchend', (event) => {
  if (touchX === null) return;
  const dx = (event.changedTouches[0]?.clientX ?? touchX) - touchX;
  if (Math.abs(dx) > 45) showPhoto(state.current + (dx < 0 ? 1 : -1));
  touchX = null;
}, { passive: true });

if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      reveal.unobserve(entry.target);
    });
  }, { threshold: .08 });
  reveal.observe($('.gallery-room'));
}
reduceMotion.addEventListener?.('change', () => { if (reduceMotion.matches) document.documentElement.classList.add('reduce-motion'); });
loadGallery();
