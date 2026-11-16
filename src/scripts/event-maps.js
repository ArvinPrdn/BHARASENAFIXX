const mapDialog = document.querySelector('#event-maps');
const mapTrigger = document.querySelector('.event-map-trigger');
const mapContent = mapDialog.querySelector('.event-map-content');
const tabList = mapDialog.querySelector('[role="tablist"]');
const tabs = [...tabList.querySelectorAll('[role="tab"]')];
const eventDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
});

function selectDay(activeTab) {
  for (const tab of tabs) {
    const selected = tab === activeTab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
  }
  mapContent.scrollTop = 0;
}

mapTrigger.addEventListener('click', () => {
  const today = eventDate.format();
  selectDay(tabs.find((tab) => tab.dataset.date === today) ?? tabs[0]);
  mapDialog.showModal();
  document.body.classList.add('busana-open');
});
mapDialog.addEventListener('close', () => {
  document.body.classList.remove('busana-open');
  mapTrigger.focus({ preventScroll: true });
});
for (const tab of tabs) {
  tab.addEventListener('click', () => selectDay(tab));
}
tabList.addEventListener('keydown', (event) => {
  const index = tabs.indexOf(event.target);
  const target = {
    ArrowLeft: (index + tabs.length - 1) % tabs.length,
    ArrowRight: (index + 1) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  }[event.key];
  if (target === undefined || index < 0) return;
  event.preventDefault();
  selectDay(tabs[target]);
  tabs[target].focus();
});

const viewer = document.querySelector('#event-map-viewer');
const viewerTitle = viewer.querySelector('h2');
const viewport = viewer.querySelector('.event-map-viewport');
const viewerImage = viewport.querySelector('img');
const zoomIn = viewer.querySelector('[data-map-zoom="in"]');
const zoomOut = viewer.querySelector('[data-map-zoom="out"]');
const zoomReset = viewer.querySelector('[data-map-zoom="reset"]');
const maxScale = 8;
let scale = 1;
let aspectRatio = 1.5;
let opener;
let drag;
let pinch;

function setZoom(requestedScale, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
  const left = viewerImage.offsetLeft - viewport.offsetLeft;
  const top = viewerImage.offsetTop - viewport.offsetTop;
  const anchorX = (viewport.scrollLeft + x - left) / (viewerImage.offsetWidth || 1);
  const anchorY = (viewport.scrollTop + y - top) / (viewerImage.offsetHeight || 1);
  scale = Math.max(1, Math.min(maxScale, requestedScale));
  viewerImage.style.width = `${Math.min(viewport.clientWidth, viewport.clientHeight * aspectRatio) * scale}px`;
  const nextLeft = viewerImage.offsetLeft - viewport.offsetLeft;
  const nextTop = viewerImage.offsetTop - viewport.offsetTop;
  viewport.scrollLeft = nextLeft + anchorX * viewerImage.offsetWidth - x;
  viewport.scrollTop = nextTop + anchorY * viewerImage.offsetHeight - y;
  viewport.classList.toggle('is-zoomed', scale > 1);
  zoomIn.disabled = scale >= maxScale;
  zoomOut.disabled = scale <= 1;
}

for (const button of mapContent.querySelectorAll('[data-enlarge-map]')) {
  button.addEventListener('click', () => {
    const entry = button.closest('.event-map-entry');
    const image = entry.querySelector('img');
    opener = button;
    viewerTitle.textContent = entry.querySelector('h3').textContent;
    viewerImage.alt = image.alt;
    viewerImage.src = image.src;
    viewerImage.width = Number(image.getAttribute('width'));
    viewerImage.height = Number(image.getAttribute('height'));
    aspectRatio = viewerImage.width / viewerImage.height;
    viewer.showModal();
    setZoom(1);
  });
}
viewer.addEventListener('close', () => {
  pinch = null;
  opener?.focus({ preventScroll: true });
});
zoomIn.addEventListener('click', () => setZoom(scale * 1.5));
zoomOut.addEventListener('click', () => setZoom(scale / 1.5));
zoomReset.addEventListener('click', () => setZoom(1));
new ResizeObserver(() => {
  if (viewer.open) setZoom(scale);
}).observe(viewport);

viewport.addEventListener('keydown', (event) => {
  const requested = { '+': scale * 1.5, '=': scale * 1.5, '-': scale / 1.5, '0': 1 }[event.key];
  if (requested === undefined) return;
  event.preventDefault();
  setZoom(requested);
});

viewport.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' || event.button !== 0 || scale === 1) return;
  drag = { x: event.clientX + viewport.scrollLeft, y: event.clientY + viewport.scrollTop };
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add('is-dragging');
});
viewport.addEventListener('pointermove', (event) => {
  if (!drag || !viewport.hasPointerCapture(event.pointerId)) return;
  viewport.scrollLeft = drag.x - event.clientX;
  viewport.scrollTop = drag.y - event.clientY;
});
viewport.addEventListener('lostpointercapture', () => {
  drag = null;
  viewport.classList.remove('is-dragging');
});

const distance = (first, second) => Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
viewport.addEventListener('touchstart', (event) => {
  if (event.touches.length !== 2) return;
  event.preventDefault();
  pinch = { scale, distance: Math.max(distance(...event.touches), 1) };
}, { passive: false });
viewport.addEventListener('touchmove', (event) => {
  if (!pinch || event.touches.length !== 2) return;
  if (event.cancelable) event.preventDefault();
  const [first, second] = event.touches;
  const bounds = viewport.getBoundingClientRect();
  const x = (first.clientX + second.clientX) / 2 - bounds.left;
  const y = (first.clientY + second.clientY) / 2 - bounds.top;
  setZoom(pinch.scale * distance(first, second) / pinch.distance, x, y);
}, { passive: false });
for (const eventName of ['touchend', 'touchcancel']) {
  viewport.addEventListener(eventName, () => { pinch = null; });
}
