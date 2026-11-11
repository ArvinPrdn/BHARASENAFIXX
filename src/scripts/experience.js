// The browser bundle is intentionally dependency-free and authored as
// progressive enhancement code. Keep this source type-checkable in strict
// projects while preserving the no-build static fallback.
// @ts-nocheck
import { initMusic } from './music.js';
import { initHeritage } from './heritage.js';
import { countMessageWords, MESSAGE_MIN_WORDS } from '../data/message-rules.js';
import {
  EVENT, rundown, envelopes, gallery,
  getPhase, getCountdown, getJakartaDate,
  getCurrentSession, getEnvelopeState,
} from '../data/event.js';

// The page is useful without this file. Every enhancement below is optional.
const root = document.documentElement;
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const mobileQuery = matchMedia('(max-width: 767px)');
const finePointerQuery = matchMedia('(hover: hover) and (pointer: fine)');
const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 4)
  || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const reduceMotion = () => motionQuery.matches;
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

if (lowEnd) root.classList.add('low-end');
if (reduceMotion()) root.classList.add('reduce-motion');
motionQuery.addEventListener?.('change', () => {
  root.classList.toggle('reduce-motion', reduceMotion());
  requestFrame();
});

// The server timestamp anchors the story clock so a visitor's device clock
// cannot make a sealed detail appear early or move the countdown backwards.
const serverNowMeta = document.querySelector('meta[name="server-now"]')?.getAttribute('content');
const serverNowAtRender = serverNowMeta ? Date.parse(serverNowMeta) : NaN;
const clockOffset = Number.isFinite(serverNowAtRender) ? serverNowAtRender - Date.now() : 0;
const currentTime = () => new Date(Date.now() + clockOffset);
const eventStartMeta = document.querySelector('meta[name="event-start"]')?.getAttribute('content');
const eventEndMeta = document.querySelector('meta[name="event-end"]')?.getAttribute('content');
const eventVenueMeta = document.querySelector('meta[name="event-venue"]')?.getAttribute('content');
if (eventStartMeta) EVENT.start = eventStartMeta;
if (eventEndMeta) EVENT.end = eventEndMeta;
if (eventVenueMeta) EVENT.venue = eventVenueMeta || null;

// All continuous visual work shares one frame loop. Hidden tabs schedule none.
const frameTasks = new Set();
let frameId = 0;
function requestFrame() {
  if (!frameId && !document.hidden) frameId = requestAnimationFrame(runFrame);
}
function runFrame(time) {
  frameId = 0;
  let again = false;
  for (const task of frameTasks) again = task(time) || again;
  if (again) requestFrame();
}
function addFrameTask(task) { frameTasks.add(task); requestFrame(); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden && frameId) cancelAnimationFrame(frameId);
  frameId = 0;
  if (!document.hidden) requestFrame();
});

function initTime() {
  const clock = $('.scene-clock');
  const clockFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: EVENT.tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const countdown = $('#hero-countdown');
  const liveStrip = $('#live-status');
  let liveStatus = $('[data-live-status]') || liveStrip?.querySelector('span:last-child');
  // Server-rendered fallbacks may mark the wrapper; always write into the
  // readable status span so the lamp and progress indicator stay intact.
  if (liveStatus?.id === 'live-status') {
    liveStatus = liveStatus.querySelector('[data-live-status]')
      || liveStatus.querySelector('span:not(.live-lamp):not(.live-progress)')
      || liveStatus;
  }
  let liveProgress = $('[data-live-progress]');
  let liveTrack = liveProgress?.closest?.('.live-progress');
  if (liveProgress?.classList.contains('live-progress')) {
    liveTrack = liveProgress;
    const nested = liveProgress.querySelector('span');
    if (nested) liveProgress = nested;
    else {
      liveProgress = document.createElement('span');
      liveProgress.dataset.liveProgress = '';
      liveProgress.setAttribute('aria-hidden', 'true');
      liveProgress.className = 'live-progress__fill';
      liveTrack.append(liveProgress);
    }
  }
  if (!liveProgress && liveStrip && rundown.some((day) => day.sessions.some((session) => !session.placeholder))) {
    const progress = document.createElement('span');
    progress.className = 'live-progress';
    liveProgress = document.createElement('span');
    liveProgress.dataset.liveProgress = '';
    progress.append(liveProgress);
    liveStrip.append(progress);
    liveTrack = progress;
  }
  const finaleText = $('[data-finale-message]') || $('.finale-message');
  const dayTabs = $$('.day-tab[data-day]');
  let lastPhase = '';
  let lastDate = '';
  countdown?.setAttribute('aria-live', 'off');

  function ensureCountdownUnits() {
    if (!countdown || $('[data-countdown-days]', countdown)) return;
    const title = document.createElement('span');
    title.className = 'countdown-caption';
    title.textContent = 'MENUJU MALAM KITA';
    const group = document.createElement('span');
    group.className = 'countdown-units';
    [['days', 'HARI'], ['hours', 'JAM'], ['minutes', 'MENIT'], ['seconds', 'DETIK']].forEach(([key, label]) => {
      const unit = document.createElement('span');
      unit.className = 'countdown-unit';
      const number = document.createElement('strong');
      number.dataset[`countdown${key[0].toUpperCase()}${key.slice(1)}`] = '';
      number.textContent = '00';
      const caption = document.createElement('small');
      caption.textContent = label;
      unit.append(number, caption);
      group.append(unit);
    });
    countdown.replaceChildren(title, group);
    countdown.classList.add('has-units');
  }

  function writeUnit(unit, value) {
    const node = $(`[data-countdown-${unit}]`, countdown);
    if (node && node.textContent !== value) {
      node.textContent = value;
      if (!reduceMotion()) {
        node.classList.remove('is-ticking');
        void node.offsetWidth;
        node.classList.add('is-ticking');
      }
    }
  }

  function update() {
    if (clock) {
      const label = clockFormatter.format(new Date());
      if (clock.textContent !== label) clock.textContent = label;
    }

    const now = currentTime();
    const phase = getPhase(now);
    if (phase !== lastPhase) {
      root.dataset.phase = phase;
      root.classList.remove('phase-pra', 'phase-minggu-h', 'phase-live', 'phase-pasca');
      root.classList.add(`phase-${phase}`);
      if (finaleText && phase === 'pasca') finaleText.textContent = 'Terima kasih telah menjadi bagian dari BHARASENA.';
      lastPhase = phase;
    }

    if (countdown) {
      if (phase === 'pra' || phase === 'minggu-h') {
        ensureCountdownUnits();
        const left = getCountdown(now);
        const values = {
          days: String(left.days).padStart(2, '0'),
          hours: String(left.hours).padStart(2, '0'),
          minutes: String(left.minutes).padStart(2, '0'),
          seconds: String(left.seconds).padStart(2, '0'),
        };
        if ($('[data-countdown-days]', countdown)) {
          Object.entries(values).forEach(([key, value]) => writeUnit(key, value));
        } else {
          const label = `${left.days} hari · ${values.hours}:${values.minutes}:${values.seconds}`;
          if (countdown.textContent !== label) countdown.textContent = label;
        }
        countdown.setAttribute('aria-label', `${left.days} hari, ${left.hours} jam, ${left.minutes} menit menuju BHARASENA`);
      } else {
        const label = phase === 'live' ? 'BHARASENA sedang berlangsung' : 'Terima kasih telah hadir';
        if (countdown.textContent !== label) countdown.textContent = label;
        countdown.classList.remove('has-units');
        countdown.setAttribute('aria-label', label);
      }
    }

    const date = getJakartaDate(now);
    if (date !== lastDate) {
      const matchingTab = dayTabs.find((tab) => tab.dataset.day === date || tab.dataset.day === date.slice(-2));
      if (matchingTab && phase === 'live') matchingTab.click();
      lastDate = date;
    }
    if (liveStatus) {
      if (phase === 'live') {
        const { current, next, progress } = getCurrentSession(now);
        const label = current
          ? `Sekarang: ${current.title}${next ? `. Berikutnya: ${next.title}` : ''}`
          : next ? `Berikutnya: ${next.title}` : 'Rundown resmi akan diumumkan oleh panitia.';
        if (liveStatus.textContent !== label) liveStatus.textContent = label;
        if (liveProgress) liveProgress.style.transform = `scaleX(${progress})`;
        $$('[data-session-start]').forEach((row) => row.classList.toggle('is-current', row.dataset.sessionStart === current?.start));
      } else {
        const label = phase === 'pasca' ? 'Rangkaian BHARASENA telah selesai.' : '11–13 Desember · Seluruh waktu dalam WIB.';
        if (liveStatus.textContent !== label) liveStatus.textContent = label;
        $$('[data-session-start]').forEach((row) => row.classList.remove('is-current'));
      }
    }
    if (liveTrack) liveTrack.hidden = phase !== 'live';
    if (liveProgress && phase !== 'live') liveProgress.style.transform = 'scaleX(0)';
  }

  update();
  setInterval(update, 1000);
  window.addEventListener('pageshow', update);
}

function initTimeline() {
  const scenes = $$('.scene[data-scene]');
  const hero = $('.hero');
  const heroLayers = hero ? $$('[data-depth]', hero) : [];
  const parallaxLayers = () => $$('[data-parallax-depth]');
  const dots = $$('.scene-dot');
  const navigationLinks = $$('.header-nav a[href^="#"], .mobile-dock a[href^="#"]');
  let dirty = true;
  let activeIndex = -1;

  function selectScene(index) {
    if (index === activeIndex || index < 0) return;
    activeIndex = index;
    scenes.forEach((scene, sceneIndex) => scene.classList.toggle('is-active', sceneIndex === index));
    dots.forEach((dot, dotIndex) => {
      const id = dot.getAttribute('href')?.slice(1) || dot.dataset.sceneTarget;
      const selected = id ? scenes[index]?.id === id : dotIndex === index;
      dot.classList.toggle('is-active', selected);
      if (selected) dot.setAttribute('aria-current', 'location');
      else dot.removeAttribute('aria-current');
    });
    navigationLinks.forEach((link) => {
      const selected = link.hash === `#${scenes[index]?.id}`;
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function update() {
    if (!dirty) return false;
    dirty = false;
    const maxScroll = Math.max(1, root.scrollHeight - innerHeight);
    const t = clamp(scrollY / maxScroll, 0, 1);
    root.style.setProperty('--t', t.toFixed(4));
    const lightStops = [[82, 31, 31], [48, 19, 27], [19, 12, 22]];
    const span = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const a = t < 0.5 ? lightStops[0] : lightStops[1];
    const b = t < 0.5 ? lightStops[1] : lightStops[2];
    root.style.setProperty('--ambient-rgb', a.map((value, i) => Math.round(lerp(value, b[i], span))).join(', '));
    if (hero && !reduceMotion()) {
      const heroRect = hero.getBoundingClientRect();
      if (heroRect.bottom >= 0 && heroRect.top <= innerHeight) {
        const heroProgress = clamp(-heroRect.top / Math.max(1, heroRect.height), 0, 1);
        heroLayers.forEach((layer) => {
          const depth = clamp(Number(layer.dataset.depth) || 0.03, -0.2, 0.2);
          layer.style.setProperty('--parallax-scroll', `${(heroProgress * depth * (mobileQuery.matches ? 95 : 180)).toFixed(2)}px`);
        });
      }
    }
    const sceneAmplitude = lowEnd ? 54 : 104;
    parallaxLayers().forEach((layer) => {
      const scene = layer.closest('.scene');
      if (!scene) return;
      const rect = scene.getBoundingClientRect();
      if (rect.bottom < -innerHeight * 0.15 || rect.top > innerHeight * 1.15) return;
      const progress = clamp((innerHeight - rect.top) / (innerHeight + rect.height), 0, 1);
      const depth = clamp(Number(layer.dataset.parallaxDepth) || 0, -0.2, 0.2);
      const offset = (progress - 0.5) * depth * sceneAmplitude;
      layer.style.setProperty('--parallax-offset', `${offset.toFixed(2)}px`);
    });
    const visualCenter = innerHeight * 0.48;
    let nearest = 0;
    let distance = Infinity;
    scenes.forEach((scene, index) => {
      const rect = scene.getBoundingClientRect();
      const sceneDistance = Math.abs(clamp(visualCenter, rect.top, rect.bottom) - visualCenter);
      if (sceneDistance < distance) { distance = sceneDistance; nearest = index; }
    });
    selectScene(nearest);
    return false;
  }
  addFrameTask(update);
  const markDirty = () => { dirty = true; requestFrame(); };
  addEventListener('scroll', markDirty, { passive: true });
  addEventListener('resize', markDirty, { passive: true });
  document.fonts?.ready.then(markDirty);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) entry.target.classList.add('is-visible');
    }, { threshold: 0.12 });
    scenes.forEach((scene) => observer.observe(scene));
  } else scenes.forEach((scene) => scene.classList.add('is-visible'));

  dots.forEach((dot, index) => {
    if (dot.tagName !== 'A') dot.addEventListener('click', () => scenes[index]?.scrollIntoView({ behavior: reduceMotion() ? 'instant' : 'smooth' }));
  });
  document.addEventListener('keydown', (event) => {
    if (!['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || $('.seal-gate')) return;
    if (event.target.closest?.('input, textarea, select, button, a, [contenteditable="true"], dialog')) return;
    const next = clamp(activeIndex + (event.key.endsWith('Down') ? 1 : -1), 0, scenes.length - 1);
    if (next === activeIndex || !scenes[next]) return;
    event.preventDefault();
    scenes[next].scrollIntoView({ behavior: reduceMotion() ? 'instant' : 'smooth' });
  });
  markDirty();
}

function initSeal(onOpened) {
  let visited = false;
  try { visited = sessionStorage.getItem('bharasena-opened') === '1'; } catch { /* private mode */ }
  if (visited) { onOpened?.(); return; }
  const gate = document.createElement('div');
  gate.className = 'seal-gate';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-labelledby', 'seal-title');
  gate.innerHTML = `
    <div class="seal-gate__ambient" aria-hidden="true"></div>
    <div class="seal-card">
      <span class="seal-card__eyebrow">SEBUAH UNDANGAN</span>
      <h2 id="seal-title">Untuk malam<br>yang kita rayakan.</h2>
      <p>BHARASENA · 11—13 DESEMBER 2026</p>
      <button class="seal-hold" type="button" aria-label="Tahan untuk membuka undangan">
        <svg class="seal-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="327" stroke-dashoffset="calc(327 * (1 - var(--seal-progress, 0)))" /></svg>
        <span class="seal-wax" aria-hidden="true">B</span>
        <span class="seal-hold__label">${reduceMotion() ? 'Buka undangan' : 'Tahan untuk membuka'}</span>
      </button>
      <div class="seal-actions"><button type="button" class="seal-direct">Buka undangan</button></div>
    </div>`;
  document.body.append(gate);
  const oldFocus = document.activeElement;
  const siblings = [...document.body.children].filter((child) => child !== gate && !['SCRIPT', 'STYLE'].includes(child.tagName));
  const previousInert = siblings.map((child) => child.inert);
  siblings.forEach((child) => { child.inert = true; });
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const hold = $('.seal-hold', gate);
  const ring = $('.seal-ring circle', gate);
  const direct = $('.seal-direct', gate);
  let holding = false;
  let holdStart = 0;
  let closing = false;

  function close() {
    if (closing) return;
    closing = true;
    holding = false;
    try { sessionStorage.setItem('bharasena-opened', '1'); } catch { /* private mode */ }
    gate.classList.add('is-opening');
    setTimeout(() => {
      gate.remove();
      siblings.forEach((child, i) => { child.inert = previousInert[i]; });
      document.body.style.overflow = previousOverflow;
      if (oldFocus instanceof HTMLElement && oldFocus !== document.body && oldFocus.isConnected) oldFocus.focus();
      else { const main = $('main'); if (main) { main.tabIndex = -1; main.focus({ preventScroll: true }); } }
      onOpened?.();
    }, reduceMotion() ? 120 : 520);
  }
  function stopHold() {
    if (!holding) return;
    holding = false;
    hold.style.setProperty('--seal-progress', '0');
    if (ring) ring.style.strokeDashoffset = '327';
    gate.classList.remove('is-holding');
  }
  function startHold(event) {
    if (reduceMotion()) { close(); return; }
    if (event?.type === 'pointerdown' && event.button !== 0) return;
    if (holding || closing) return;
    holding = true;
    holdStart = performance.now();
    gate.classList.add('is-holding');
    if (event?.pointerId !== undefined) hold.setPointerCapture?.(event.pointerId);
    requestFrame();
  }
  addFrameTask((time) => {
    if (!holding || closing) return false;
    const progress = clamp((time - holdStart) / 900, 0, 1);
    hold.style.setProperty('--seal-progress', String(progress));
    if (ring) ring.style.strokeDashoffset = String(327 * (1 - progress));
    if (progress >= 1) {
      navigator.vibrate?.(35);
      close();
      return false;
    }
    return true;
  });
  hold.addEventListener('pointerdown', startHold);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => hold.addEventListener(name, stopHold));
  hold.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); startHold(event); }
  });
  hold.addEventListener('keyup', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); stopHold(); }
  });
  hold.addEventListener('click', (event) => event.preventDefault());
  direct.addEventListener('click', close);
  gate.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const options = [hold, direct].filter((node) => getComputedStyle(node).display !== 'none');
    const first = options[0], last = options.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  (reduceMotion() ? direct : hold).focus();
}

function initHero() {
  const hero = $('.hero');
  if (!hero) return;
  const tickets = $$('.event-ticket', hero);
  for (const ticket of tickets) {
    ticket.addEventListener('click', () => {
      const wasPressed = ticket.getAttribute('aria-pressed') === 'true';
      for (const item of tickets) item.setAttribute('aria-pressed', String(item === ticket && !wasPressed));
    });
  }
  const layers = $$('[data-depth]', hero);
  const chandelier = $('.chandelier', hero);
  const crystals = chandelier ? $$('[data-crystal]', chandelier) : [];
  const gyroButton = $('[data-gyro-toggle]') || $('#gyro-toggle') || $('#motion-toggle');
  let pointerTarget = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0 };
  let usingGyro = false;
  let swing = 0, swingVelocity = 0, swingTarget = 0;
  let dragStart = null;
  let crystalCount = 0;

  function setPointer(event) {
    if (usingGyro || reduceMotion()) return;
    const box = hero.getBoundingClientRect();
    pointerTarget = {
      x: clamp(((event.clientX - box.left) / box.width - 0.5) * 2, -1, 1),
      y: clamp(((event.clientY - box.top) / box.height - 0.5) * 2, -1, 1),
    };
    requestFrame();
  }
  hero.addEventListener('pointermove', setPointer, { passive: true });
  hero.addEventListener('pointerleave', () => { if (!usingGyro) { pointerTarget = { x: 0, y: 0 }; requestFrame(); } });
  if (gyroButton && !reduceMotion() && mobileQuery.matches && 'DeviceOrientationEvent' in window) gyroButton.hidden = false;
  if (gyroButton) gyroButton.addEventListener('click', async () => {
    if (usingGyro) {
      usingGyro = false;
      gyroButton.setAttribute('aria-pressed', 'false');
      gyroButton.textContent = 'Aktifkan gerak';
      pointerTarget = { x: 0, y: 0 };
      return;
    }
    if (!('DeviceOrientationEvent' in window)) {
      gyroButton.textContent = 'Gerak tidak tersedia';
      gyroButton.disabled = true;
      return;
    }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') return;
      }
      usingGyro = true;
      gyroButton.setAttribute('aria-pressed', 'true');
      gyroButton.textContent = 'Matikan gerak';
    } catch { gyroButton.textContent = 'Gerak tidak tersedia'; }
  });
  addEventListener('deviceorientation', (event) => {
    if (!usingGyro || reduceMotion()) return;
    pointerTarget.x = clamp((event.gamma || 0) / 35, -1, 1);
    pointerTarget.y = clamp(((event.beta || 45) - 45) / 45, -1, 1);
    requestFrame();
  }, { passive: true });

  if (chandelier) {
    chandelier.style.touchAction = 'pan-y';
    chandelier.addEventListener('pointerdown', (event) => {
      if (reduceMotion() || event.button !== 0) return;
      if (event.target.closest?.('[data-crystal]')) return;
      dragStart = { x: event.clientX, angle: swingTarget };
      chandelier.classList.add('is-dragging');
      chandelier.setPointerCapture?.(event.pointerId);
    });
    chandelier.addEventListener('pointermove', (event) => {
      if (!dragStart) return;
      swingTarget = clamp(dragStart.angle + (event.clientX - dragStart.x) * 0.12, -16, 16);
      requestFrame();
    });
    const release = () => { dragStart = null; swingTarget = 0; chandelier.classList.remove('is-dragging'); requestFrame(); };
    chandelier.addEventListener('pointerup', release);
    chandelier.addEventListener('pointercancel', release);
  }
  crystals.forEach((crystal, index) => {
    if (crystal.tagName !== 'BUTTON') {
      crystal.setAttribute('role', 'button');
      crystal.tabIndex = 0;
    }
    crystal.setAttribute('aria-label', `Nyalakan kristal ${index + 1}`);
    crystal.setAttribute('aria-pressed', 'false');
    const light = () => {
      if (crystal.classList.contains('is-lit')) return;
      crystal.classList.add('is-lit');
      crystal.setAttribute('aria-pressed', 'true');
      crystalCount += 1;
      if (crystalCount === crystals.length) startRain(4500);
    };
    crystal.addEventListener('click', light);
    crystal.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); light(); }
    });
  });

  addFrameTask(() => {
    if (reduceMotion()) return false;
    const factor = lowEnd ? 0.18 : 0.12;
    pointer.x = lerp(pointer.x, pointerTarget.x, factor);
    pointer.y = lerp(pointer.y, pointerTarget.y, factor);
    const pointerMoving = Math.abs(pointer.x - pointerTarget.x) + Math.abs(pointer.y - pointerTarget.y) > 0.003;
    if (pointerMoving || Math.abs(pointer.x) + Math.abs(pointer.y) > 0.003) {
      hero.style.setProperty('--shine-x', `${50 + pointer.x * 18}%`);
      hero.style.setProperty('--shine-y', `${40 + pointer.y * 12}%`);
      layers.forEach((layer) => {
        const depth = clamp(Number(layer.dataset.depth) || 0.03, -0.2, 0.2);
        layer.style.setProperty('--parallax-x', `${(pointer.x * depth * 120).toFixed(2)}px`);
        layer.style.setProperty('--parallax-y', `${(pointer.y * depth * 85).toFixed(2)}px`);
      });
    }
    if (chandelier) {
      swingVelocity = (swingVelocity + (swingTarget - swing) * 0.11) * 0.82;
      swing += swingVelocity;
      if (Math.abs(swing) + Math.abs(swingVelocity) > 0.015) chandelier.style.setProperty('--swing', `${swing.toFixed(2)}deg`);
    }
    return pointerMoving || Math.abs(swing) + Math.abs(swingVelocity) > 0.015;
  });
}

function initRundown() {
  const layout = $('.programme-layout');
  if (!layout) return;

  function wireTabs(tabs, panels, restoreStart) {
    if (!tabs.length || !panels.length) return;

    function select(tab, event) {
      const returnToStart = event?.isTrusted && restoreStart
        && tab.getAttribute('aria-selected') !== 'true'
        && restoreStart.getBoundingClientRect().top < tab.parentElement.getBoundingClientRect().top - 2;
      tabs.forEach((item) => {
        item.setAttribute('aria-selected', String(item === tab));
        item.tabIndex = item === tab ? 0 : -1;
      });
      const id = tab.getAttribute('aria-controls');
      panels.forEach((panel) => { panel.hidden = panel.id !== id; });
      if (returnToStart) restoreStart.scrollIntoView({ block: 'start', behavior: 'instant' });
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', (event) => select(tab, event));
      tab.addEventListener('keydown', (event) => {
        const direction = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
          : direction ? (index + direction + tabs.length) % tabs.length : -1;
        if (next < 0) return;
        event.preventDefault();
        select(tabs[next], event);
        tabs[next].focus();
      });
    });
    select(tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0]);
  }

  const panels = $$('.day-panel[data-day]', layout);
  for (const details of $$('.programme-details', layout)) {
    const sessionTabs = $$('.programme-session-tabs [role="tab"]', details);
    if (!sessionTabs.length) continue;
    wireTabs(sessionTabs, $$('.programme-session', details));
    details.classList.add('is-interactive');
  }

  wireTabs($$('.day-tab[data-day]', layout), panels, layout);
  layout.classList.add('is-interactive');

  const timeLabel = (iso) => new Intl.DateTimeFormat('id-ID', {
    timeZone: EVENT.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
  rundown.forEach((day) => {
    const panel = panels.find((item) => item.dataset.day === day.date || item.dataset.day === day.date.slice(-2));
    const sessions = day.sessions.filter((session) => !session.placeholder && session.title && session.start && session.end);
    if (!panel || !sessions.length) return;
    const old = $('.schedule-locked', panel);
    const list = document.createElement('div');
    list.className = 'schedule-list';
    sessions.forEach((session) => {
      const row = document.createElement('div');
      row.className = 'schedule-row';
      row.dataset.sessionStart = session.start;
      const time = document.createElement('time');
      time.dateTime = session.start;
      time.textContent = `${timeLabel(session.start)}—${timeLabel(session.end)}`;
      const details = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = session.title;
      details.append(title);
      if (session.desc) {
        const desc = document.createElement('p');
        desc.textContent = session.desc;
        details.append(desc);
      }
      row.append(time, details);
      list.append(row);
    });
    old?.replaceWith(list);
  });
}

async function rollUpLetter(dialog) {
  const paper = $('.letter-paper', dialog);
  if (!paper || dialog.classList.contains('is-catalogue') || reduceMotion()) {
    dialog.close();
    return;
  }
  // Clip the paper without scaling its text; move the two rollers together.
  const travel = Math.max(0, paper.offsetHeight / 2 - 8);
  const timing = { duration: 440, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' };
  const animations = [
    paper.animate([
      { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, offset: 0 },
      { clipPath: 'inset(49% 0% 49% 0%)', opacity: 1, offset: .85 },
      { clipPath: 'inset(50% 0% 50% 0%)', opacity: 0, offset: 1 },
    ], timing),
  ];
  [['.letter-roll-top', travel], ['.letter-roll-bottom', -travel]].forEach(([selector, distance]) => {
    const roller = $(selector, dialog);
    if (roller) animations.push(roller.animate([
      { transform: 'translateY(0)', opacity: 1, offset: 0 },
      { transform: `translateY(${distance}px)`, opacity: 1, offset: .85 },
      { transform: `translateY(${distance}px)`, opacity: 0, offset: 1 },
    ], timing));
  });
  const bottle = $('.letter-bottle', dialog);
  if (bottle) animations.push(bottle.animate([{ opacity: .62 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }));
  try { await Promise.all(animations.map((animation) => animation.finished)); }
  catch { /* Closing must still complete if an animation is interrupted. */ }
  finally {
    dialog.close();
    animations.forEach((animation) => animation.cancel());
  }
}

function initEnvelopes() {
  const cards = $$('.envelope[data-envelope]');


  const parkingCard = cards.find((card) => ['parkir', 'parking'].includes(card.dataset.envelope));
  const parkingDialog = $('#parking-dialog');
  if (parkingCard && parkingDialog) {
    const viewport = $('#parking-viewport', parkingDialog);
    const image = $('[data-parking-image]', parkingDialog);
    let closingParking = false;
    const closeParking = async () => {
      if (closingParking || !parkingDialog.open) return;
      closingParking = true;
      await rollUpLetter(parkingDialog);
      closingParking = false;
    };
    const status = $('[data-parking-status]', parkingDialog);
    image.addEventListener('load', () => { status.textContent = ''; resetZoom(); });
    image.addEventListener('error', () => {
      status.textContent = 'Denah belum berhasil dimuat. Tutup lalu buka kembali, atau pilih Buka gambar penuh.';
    });
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let gesture = null;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const renderMap = () => {
      offsetX = clamp(offsetX, viewport.clientWidth * (1 - scale), 0);
      offsetY = clamp(offsetY, viewport.clientHeight * (1 - scale), 0);
      image.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      viewport.classList.toggle('is-zoomed', scale > 1);
    };
    const resetZoom = () => { scale = 1; offsetX = 0; offsetY = 0; gesture = null; renderMap(); };
    const touchPoint = (touches) => {
      const bounds = viewport.getBoundingClientRect();
      const first = touches[0];
      const second = touches[1] || first;
      return { x: (first.clientX + second.clientX) / 2 - bounds.left, y: (first.clientY + second.clientY) / 2 - bounds.top, distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY) };
    };
    const beginGesture = (event) => {
      if (!event.touches.length || !image.naturalWidth) { gesture = null; return; }
      gesture = { ...touchPoint(event.touches), scale, offsetX, offsetY, count: event.touches.length };
      if (event.touches.length > 1 || scale > 1) event.preventDefault();
    };
    viewport.addEventListener('touchstart', beginGesture, { passive: false });
    viewport.addEventListener('touchmove', (event) => {
      if (!gesture || (!image.naturalWidth) || (event.touches.length < 2 && scale === 1)) return;
      event.preventDefault();
      if (event.touches.length !== gesture.count) { beginGesture(event); return; }
      const point = touchPoint(event.touches);
      const nextScale = event.touches.length > 1 ? clamp(gesture.scale * point.distance / Math.max(gesture.distance, 1), 1, 5) : scale;
      const ratio = nextScale / gesture.scale;
      offsetX = point.x - (gesture.x - gesture.offsetX) * ratio;
      offsetY = point.y - (gesture.y - gesture.offsetY) * ratio;
      scale = nextScale;
      renderMap();
    }, { passive: false });
    viewport.addEventListener('touchend', beginGesture, { passive: false });
    viewport.addEventListener('touchcancel', () => { gesture = null; });
    const zoomAt = (nextScale, x, y) => {
      if (!image.naturalWidth) return;
      nextScale = clamp(nextScale, 1, 5);
      const ratio = nextScale / scale;
      offsetX = x - (x - offsetX) * ratio;
      offsetY = y - (y - offsetY) * ratio;
      scale = nextScale;
      renderMap();
    };
    viewport.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && scale === 1) return;
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      if (event.ctrlKey) zoomAt(scale * Math.exp(-event.deltaY * .01), event.clientX - bounds.left, event.clientY - bounds.top);
      else { offsetX -= event.deltaX; offsetY -= event.deltaY; renderMap(); }
    }, { passive: false });
    viewport.addEventListener('keydown', (event) => {
      if (['+', '=', '-', '_'].includes(event.key)) {
        event.preventDefault();
        zoomAt(scale * (['+', '='].includes(event.key) ? 1.25 : .8), viewport.clientWidth / 2, viewport.clientHeight / 2);
      } else if (event.key === '0' || event.key === 'Home') { event.preventDefault(); resetZoom(); }
      else if (scale > 1 && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        offsetX += event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0;
        offsetY += event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0;
        renderMap();
      }
    });
    new ResizeObserver(resetZoom).observe(viewport);
    parkingCard.classList.remove('is-sealed');
    parkingCard.classList.add('is-open');
    parkingCard.setAttribute('role', 'button');
    parkingCard.setAttribute('tabindex', '0');
    parkingCard.setAttribute('aria-label', 'Buka denah parkir motor dan mobil');
    parkingCard.setAttribute('aria-haspopup', 'dialog');
    parkingCard.setAttribute('aria-controls', 'parking-dialog');
    parkingCard.setAttribute('aria-expanded', 'false');
    $('.envelope-body p', parkingCard).textContent = 'Lihat denah dan jalur parkir motor serta mobil.';
    $('.envelope-bottom > span:first-child', parkingCard).textContent = 'LIHAT DENAH';
    const openParking = () => {
      resetZoom();
      if (!image.getAttribute('src') || (image.complete && !image.naturalWidth)) {
        status.textContent = 'Memuat denah…';
        image.src = image.dataset.src;
      }
      $('.letter-paper', parkingDialog).scrollTop = 0;
      parkingDialog.showModal();
      document.body.classList.add('busana-open');
      parkingCard.setAttribute('aria-expanded', 'true');
    };
    parkingCard.addEventListener('click', openParking);
    parkingCard.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openParking(); }
    });
    $('.parking-dialog__close', parkingDialog).addEventListener('click', closeParking);
    parkingDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeParking(); });
    parkingDialog.addEventListener('click', (event) => {
      if (event.target === parkingDialog || event.target.classList.contains('letter-dialog-stage')) closeParking();
    });
    parkingDialog.addEventListener('close', () => {
      document.body.classList.remove('busana-open');
      parkingCard.setAttribute('aria-expanded', 'false');
      parkingCard.focus();
    });
  }

  const infoDialog = $('#info-letter-dialog');
  const infoCards = new Set();
  if (infoDialog) {
    let activeInfoCard = null;
    let closingInfo = false;
    const closeInfo = async () => {
      if (closingInfo || !infoDialog.open) return;
      closingInfo = true;
      await rollUpLetter(infoDialog);
      closingInfo = false;
    };
    $('.letter-dialog-close', infoDialog).addEventListener('click', closeInfo);
    infoDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeInfo(); });
    infoDialog.addEventListener('click', (event) => {
      if (event.target === infoDialog || event.target.classList.contains('letter-dialog-stage')) closeInfo();
    });
    infoDialog.addEventListener('close', () => {
      document.body.classList.remove('busana-open');
      activeInfoCard?.setAttribute('aria-expanded', 'false');
      activeInfoCard?.focus();
    });
    const renderInfoDetails = (content, venue) => {
      const container = $('[data-info-body]', infoDialog);
      const list = document.createElement('dl');
      const addDetail = (label, paragraphs) => {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        paragraphs.forEach((text) => {
          const paragraph = document.createElement('p');
          paragraph.textContent = text;
          description.append(paragraph);
        });
        row.append(term, description);
        list.append(row);
      };
      const text = String(content || '').trim();
      if (venue) {
        const address = text.replace(/\s*[·•]?\s*Google Maps:\s*https?:\/\/\S+/iu, '').trim();
        const separator = address.indexOf(',');
        if (separator > 0) {
          addDetail('Tempat', [address.slice(0, separator).trim()]);
          addDetail('Alamat', [address.slice(separator + 1).trim()]);
        } else if (address) addDetail('Tempat', [address]);
      } else {
        const pending = [];
        text.split(/(?<=[.!?])\s+/u).filter(Boolean).forEach((sentence) => {
          if (/\bmenyusul\b/iu.test(sentence)) pending.push(sentence);
          else addDetail(/parkir|konsumsi/iu.test(sentence) ? 'Fasilitas' : /hadir|peserta|tamu/iu.test(sentence) ? 'Peserta' : 'Informasi', [sentence]);
        });
        if (pending.length) addDetail('Menyusul', pending);
      }
      container.replaceChildren(list);
    };
    cards.forEach((card) => {
      const venue = ['lokasi', 'venue'].includes(card.dataset.envelope);
      const admission = ['masuk', 'admission'].includes(card.dataset.envelope);
      if (!venue && !admission) return;
      infoCards.add(card);
      const title = venue ? 'Tempat acara' : 'Ketentuan masuk';
      const body = $('.envelope-body p', card);
      const content = card.classList.contains('is-open') && body.textContent.trim() ? body.textContent.trim() : venue ? EVENT.venue : EVENT.admission;
      body.textContent = content;
      card.classList.remove('is-sealed');
      card.classList.add('is-open');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Buka surat ${title}`);
      card.setAttribute('aria-haspopup', 'dialog');
      card.setAttribute('aria-controls', 'info-letter-dialog');
      card.setAttribute('aria-expanded', 'false');
      $('.envelope-bottom > span:first-child', card).textContent = 'TERBUKA';
      const openInfo = () => {
        activeInfoCard = card;
        $('[data-info-kicker]', infoDialog).textContent = `${venue ? '01 / LOKASI' : '03 / AKSES'} · SURAT BHARASENA`;
        $('#info-letter-title', infoDialog).textContent = title;
        renderInfoDetails(content, venue);
        $('[data-info-map]', infoDialog).hidden = !venue;
        $('.letter-paper', infoDialog).scrollTop = 0;
        infoDialog.showModal();
        document.body.classList.add('busana-open');
        card.setAttribute('aria-expanded', 'true');
      };
      card.addEventListener('click', openInfo);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openInfo(); }
      });
    });
  }

  const busanaCard = cards.find((card) => ['busana', 'dress-code'].includes(card.dataset.envelope));
  const busanaDialog = $('#busana-dialog');
  if (busanaCard && busanaDialog) {
    busanaCard.setAttribute('role', 'button');
    busanaCard.setAttribute('tabindex', '0');
    busanaCard.setAttribute('aria-label', 'Buka surat Busana acara');
    busanaCard.setAttribute('aria-haspopup', 'dialog');
    busanaCard.setAttribute('aria-controls', 'busana-dialog');
    busanaCard.setAttribute('aria-expanded', 'false');
    let jerseySleeve = 'short';
    let jerseyView = 'front';
    let requestedSleeve = jerseySleeve;
    let requestedView = jerseyView;
    let jerseyRequest = 0;
    let closingBusana = false;
    let switchingBusana = false;
    let viewTransition = 0;
    const motions = new Set();
    const image = $('#jersey-main', busanaDialog);
    const status = $('.busana-status', busanaDialog);
    const summary = $('.busana-summary', busanaDialog);
    const catalogue = $('.busana-layout', busanaDialog);
    const animateBusana = (element, frames, options) => {
      if (reduceMotion()) return Promise.resolve();
      const motion = element.animate(frames, { easing: 'cubic-bezier(.22,1,.36,1)', ...options });
      motions.add(motion);
      return motion.finished.catch(() => {}).finally(() => { motions.delete(motion); motion.cancel(); });
    };
    const cancelMotions = () => motions.forEach((motion) => motion.cancel());
    const enterBusana = (design) => {
      if (!design) return;
      animateBusana(catalogue, [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 560 });
      animateBusana(image, [{ opacity: 0, transform: 'translateY(28px) rotateY(-12deg)' }, { opacity: 1, transform: 'translateY(0) rotateY(0)' }], { duration: 760 });
      animateBusana($('.busana-editorial', busanaDialog), [{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 650, delay: 90, fill: 'backwards' });
    };
    const updateJersey = async (sleeve, view) => {
      const request = ++jerseyRequest;
      const source = `assets/jersey/${sleeve}-${view}.webp`;
      if (source === image.getAttribute('src')) {
        image.getAnimations().forEach((motion) => motion.cancel());
        image.removeAttribute('aria-busy');
        return;
      }
      image.setAttribute('aria-busy', 'true');
      const nextImage = new Image();
      nextImage.src = source;
      try { await nextImage.decode(); }
      catch {
        if (request === jerseyRequest) {
          requestedSleeve = jerseySleeve;
          requestedView = jerseyView;
          image.removeAttribute('aria-busy');
          status.textContent = 'Desain belum dapat dimuat. Silakan coba lagi.';
        }
        return;
      }
      if (request !== jerseyRequest) return;
      image.getAnimations().forEach((motion) => motion.cancel());
      await animateBusana(image, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 130 });
      if (request !== jerseyRequest) return;
      jerseySleeve = sleeve;
      jerseyView = view;
      image.src = source;
      const caption = `Lengan ${sleeve === 'short' ? 'pendek' : 'panjang'} · Tampak ${view === 'front' ? 'depan' : 'belakang'}`;
      image.alt = `Jersey BHARASENA VI ${caption.toLowerCase()}`;
      image.removeAttribute('aria-busy');
      $$('[data-jersey-sleeve]', busanaDialog).forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.jerseySleeve === jerseySleeve)));
      $$('[data-jersey-view]', busanaDialog).forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.jerseyView === jerseyView)));
      $('[data-jersey-caption]', busanaDialog).textContent = caption.toUpperCase();
      status.textContent = caption;
      animateBusana(image, [{ opacity: 0, transform: 'translateY(14px) rotateY(-7deg)' }, { opacity: 1, transform: 'translateY(0) rotateY(0)' }], { duration: 400 });
    };
    $$('[data-jersey-sleeve]', busanaDialog).forEach((button) => button.addEventListener('click', () => {
      requestedSleeve = button.dataset.jerseySleeve;
      updateJersey(requestedSleeve, requestedView);
    }));
    $$('[data-jersey-view]', busanaDialog).forEach((button) => button.addEventListener('click', () => {
      requestedView = button.dataset.jerseyView;
      updateJersey(requestedSleeve, requestedView);
    }));
    const setBusanaView = async (design) => {
      if (switchingBusana || closingBusana || !busanaDialog.open) return;
      switchingBusana = true;
      const transition = ++viewTransition;
      cancelMotions();
      const outgoing = design ? summary : catalogue;
      await animateBusana(outgoing, [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${design ? -18 : 18}px)` }], { duration: 180 });
      if (transition !== viewTransition || closingBusana || !busanaDialog.open) return;
      summary.hidden = design;
      catalogue.hidden = !design;
      busanaDialog.classList.toggle('is-catalogue', design);
      busanaDialog.setAttribute('aria-labelledby', design ? 'busana-title' : 'busana-summary-title');
      busanaDialog.scrollTop = 0;
      enterBusana(design);
      (design ? $('.busana-back', busanaDialog) : $('.busana-design-link', busanaDialog)).focus({ preventScroll: design });
      switchingBusana = false;
    };
    $$('.busana-design-link', busanaDialog).forEach((button) => button.addEventListener('click', () => setBusanaView(true)));
    $('.busana-back', busanaDialog).addEventListener('click', () => setBusanaView(false));
    const closeBusana = async () => {
      if (closingBusana || !busanaDialog.open) return;
      closingBusana = true;
      viewTransition += 1;
      jerseyRequest += 1;
      requestedSleeve = jerseySleeve;
      requestedView = jerseyView;
      cancelMotions();
      image.removeAttribute('aria-busy');
      if (busanaDialog.classList.contains('is-catalogue')) {
        await animateBusana(busanaDialog, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(16px)' }], { duration: 220 });
        busanaDialog.close();
      } else await rollUpLetter(busanaDialog);
      closingBusana = false;
    };
    const openBusana = () => {
      if (busanaDialog.open) return;
      summary.hidden = false;
      catalogue.hidden = true;
      switchingBusana = false;
      busanaDialog.classList.remove('is-catalogue');
      busanaDialog.setAttribute('aria-labelledby', 'busana-summary-title');
      $('.letter-paper', busanaDialog).scrollTop = 0;
      busanaDialog.showModal();
      busanaDialog.scrollTop = 0;
      busanaCard.setAttribute('aria-expanded', 'true');
      document.body.classList.add('busana-open');
    };
    busanaCard.addEventListener('click', openBusana);
    busanaCard.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openBusana(); }
    });
    $$('.busana-close', busanaDialog).forEach((button) => button.addEventListener('click', closeBusana));
    busanaDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeBusana(); });
    busanaDialog.addEventListener('click', (event) => {
      if (event.target === busanaDialog || event.target.classList.contains('letter-dialog-stage')) closeBusana();
    });
    busanaDialog.addEventListener('close', () => {
      document.body.classList.remove('busana-open');
      cancelMotions();
      switchingBusana = false;
      busanaCard.setAttribute('aria-expanded', 'false');
      busanaCard.focus({ preventScroll: true });
    });
  }
  const performerEnvelope = $('.mini-envelope[data-envelope="performer"]');
  if (performerEnvelope) {
    performerEnvelope.setAttribute('role', 'button');
    performerEnvelope.setAttribute('tabindex', '0');
    performerEnvelope.setAttribute('aria-label', `Jadwal penampilan Budi Doremi, ${$('strong', performerEnvelope).textContent.trim()}`);
    const nudge = () => {
      performerEnvelope.classList.remove('is-jolted');
      void performerEnvelope.offsetWidth;
      performerEnvelope.classList.add('is-jolted');
      setTimeout(() => performerEnvelope.classList.remove('is-jolted'), 460);
    };
    performerEnvelope.addEventListener('click', nudge);
    performerEnvelope.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); nudge(); }
    });
  }
  if (!cards.length) return;
  const serverRendered = root.dataset.rendered === 'server';
  function refresh() {
    if (serverRendered) return;
    const now = currentTime();
    cards.forEach((card, index) => {
      const ids = { lokasi: 'venue', masuk: 'admission', busana: 'dress-code', parkir: 'parking' };
      const data = envelopes.find((item) => item.id === (ids[card.dataset.envelope] || card.dataset.envelope)) || envelopes[index];
      if (!data) return;
      if (card === busanaCard || (card === parkingCard && parkingDialog) || infoCards.has(card)) return;
      const field = { venue: EVENT.venue, admission: EVENT.admission, 'dress-code': EVENT.dressCode }[data.id];
      const resolved = field && !data.body ? { ...data, body: field, placeholder: false } : data;
      const open = getEnvelopeState(resolved, now) === 'open';
      card.classList.toggle('is-open', open);
      card.classList.toggle('is-sealed', !open);
      card.setAttribute('aria-expanded', String(open));
      const body = $('[data-envelope-body]', card) || $('.envelope-body p', card);
      if (body) body.textContent = open ? resolved.body : data.id === 'parking' ? 'Denah parkir akan segera dibuka.' : 'Informasi resmi segera dibuka.';
      const status = $('[data-envelope-status]', card) || $('.envelope-bottom > span:first-child', card);
      if (status) status.textContent = open ? 'Terbuka' : resolved.unlockAt && !resolved.placeholder ? 'Dibuka sesuai jadwal' : 'Segera dibuka';
    });
  }
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      if (card === busanaCard || (card === parkingCard && parkingDialog) || infoCards.has(card) || !card.classList.contains('is-sealed')) return;
      card.classList.remove('is-jolted');
      void card.offsetWidth;
      card.classList.add('is-jolted');
      setTimeout(() => card.classList.remove('is-jolted'), 460);
    });
  });
  if (busanaCard) {
    busanaCard.classList.remove('is-sealed');
    busanaCard.classList.add('is-open');
    $('.envelope-body p', busanaCard).textContent = 'Lihat panduan busana dan desain jersey BHARASENA VI.';
    $('.envelope-bottom > span:first-child', busanaCard).textContent = 'LIHAT BUSANA';
  }
  refresh();
  const timer = setInterval(refresh, 30_000);
  addEventListener('pagehide', () => clearInterval(timer), { once: true });
}

/**
 * Wire the public guestbook to the moderated messages endpoint. The static
 * empty state remains visible when the API is unavailable, so the page still
 * feels complete during local previews and before the server is deployed.
 */
function initMessageWall() {
  const form = $('[data-message-form]');
  const nameInput = $('[data-message-name]', form || document);
  const bodyInput = $('[data-message-body]', form || document);
  const trap = $('[data-message-honeypot]', form || document);
  const counter = $('[data-message-count]');
  const status = $('[data-message-status]');
  const list = $('[data-messages-list]');
  const empty = $('[data-message-empty]');
  const state = $('[data-message-state]');
  if (!form || !nameInput || !bodyInput) return;
  const managedWall = root.dataset.hosting === 'static';
  let wallEnabled = !managedWall;
  let formStartedAt = Date.now();
  let requestId = null;
  if (managedWall) {
    form.querySelectorAll('input, textarea, button').forEach((control) => { control.disabled = true; });
    if (status) status.textContent = 'Memeriksa ketersediaan dinding pesan…';
    if (state) state.textContent = 'MEMUAT PESAN';
  }

  const clean = (value, max) => String(value || '')
    // eslint-disable-next-line no-control-regex -- Remove control characters from visitor text.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  const cleanBody = (value, max) => String(value || '')
    // eslint-disable-next-line no-control-regex -- Remove control characters from visitor text.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, max);

  function setStatus(message, tone = '') {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }
  function updateCount() {
    if (counter) counter.textContent = String(bodyInput.value.length);
  }
  function renderMessage(item) {
    if (!list || !item || typeof item !== 'object') return null;
    const message = cleanBody(item.body ?? item.message, 80);
    const author = clean(item.nickname ?? item.name ?? item.displayName ?? 'Tamu BHARASENA', 20) || 'Tamu BHARASENA';
    if (!message) return null;
    const card = document.createElement('article');
    card.className = 'message-card';
    card.dataset.messageId = item.id ? String(item.id) : '';
    const quote = document.createElement('p');
    quote.textContent = message;
    const footer = document.createElement('footer');
    const label = document.createElement('strong');
    label.textContent = author;
    footer.append(label);
    if (item.createdAt || item.created_at) {
      const date = new Date(item.createdAt || item.created_at);
      if (Number.isFinite(date.getTime())) {
        const separator = document.createTextNode(' · ');
        const time = document.createElement('time');
        time.dateTime = date.toISOString();
        time.textContent = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
        footer.append(separator, time);
      }
    }
    card.append(quote, footer);
    return card;
  }
  function renderMessages(messages) {
    if (!list || !Array.isArray(messages)) return;
    // Clear both the canonical cards and the server's lightweight fallback
    // list items before hydrating the approved feed.
    list.querySelectorAll('.message-card, :scope > li').forEach((card) => card.remove());
    let count = 0;
    messages.slice(0, 40).forEach((item) => {
      const card = renderMessage(item);
      if (card) { list.append(card); count += 1; }
    });
    if (empty) empty.hidden = count > 0;
    if (state) state.textContent = count ? `${count} PESAN TERBIT` : 'MENUNGGU PESAN';
  }
  async function loadMessages() {
    if (!list || !('fetch' in window)) return;
    try {
      const response = await fetch('/api/messages?status=approved', {
        headers: { Accept: 'application/json' }, credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Feed unavailable');
      const payload = await response.json();
      const messages = Array.isArray(payload) ? payload : payload?.messages;
      if (!Array.isArray(messages)) throw new Error('Invalid feed');
      renderMessages(messages);
      if (managedWall) {
        const wasEnabled = wallEnabled;
        wallEnabled = payload?.enabled === true;
        if (!form.hasAttribute('aria-busy')) form.querySelectorAll('input, textarea, button').forEach((control) => { control.disabled = !wallEnabled; });
        if (!wallEnabled) {
          setStatus('Pengiriman pesan akan segera dibuka.');
          if (state && !messages.length) state.textContent = 'SEGERA DIBUKA';
        } else if (!wasEnabled) {
          formStartedAt = Date.now();
          setStatus('Pesan yang memenuhi ketentuan langsung tampil di dinding.');
        }
      }
    } catch {
      if (managedWall && !wallEnabled) {
        setStatus('Dinding pesan belum tersedia. Silakan kembali lagi nanti.');
        if (state) state.textContent = 'SEGERA DIBUKA';
      }
    }
  }
  bodyInput.addEventListener('input', () => { updateCount(); requestId = null; });
  nameInput.addEventListener('input', () => { requestId = null; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!wallEnabled || form.hasAttribute('aria-busy')) return;
    const name = clean(nameInput.value, 20);
    const body = cleanBody(bodyInput.value, 80);
    if (trap?.value) return;
    if (countMessageWords(body) < MESSAGE_MIN_WORDS) { setStatus(`Pesan minimal ${MESSAGE_MIN_WORDS} kata.`, 'error'); bodyInput.focus(); return; }
    const submit = $('button[type="submit"]', form);
    if (submit) submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    setStatus('Mengirim pesan ke dinding…');
    if (!requestId) requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const csrf = $('meta[name="csrf-token"]')?.getAttribute('content') || form.dataset.csrf;
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const response = await fetch('/api/messages', {
        method: 'POST', credentials: 'same-origin',
        headers,
        body: JSON.stringify({ nickname: name, body, website: '', formStartedAt, requestId }),
      });
      let payload = null;
      try { payload = await response.json(); } catch { /* empty error body */ }
      if (!response.ok) throw new Error(payload?.error || 'Pesan belum dapat dikirim.');
      const approved = payload?.message && (payload.message.approved === true || payload.message.status === 'approved');
      if (approved) {
        const card = renderMessage(payload.message);
        if (card && list) { empty?.setAttribute('hidden', ''); list.prepend(card); }
      }
      form.reset();
      requestId = null;
      formStartedAt = Date.now();
      updateCount();
      setStatus(approved ? 'Pesanmu sudah tampil di dinding.' : 'Pesan diterima. Setelah disetujui panitia, pesanmu akan tampil.', 'success');
      if (state && approved) state.textContent = 'PESAN TERBARU';
    } catch (error) {
      setStatus(error?.message || 'Pesan belum dapat dikirim. Coba lagi nanti.', 'error');
    } finally {
      form.removeAttribute('aria-busy');
      if (submit) submit.disabled = !wallEnabled;
    }
  });
  updateCount();
  loadMessages();
  const refreshMessages = setInterval(() => { if (document.visibilityState === 'visible' && !form.hasAttribute('aria-busy')) loadMessages(); }, 30_000);
  addEventListener('pagehide', () => clearInterval(refreshMessages), { once: true });
}

function initCard() {
  const input = $('#invite-name');
  const preview = $('#invite-preview');
  const downloadButton = $('#invite-download');
  const shareButton = $('#invite-share');
  if (!input || !preview) return;
  const previewName = $('[data-invite-name]', preview) || $('[data-name]', preview) || $('#invite-preview-name', preview);
  const heroName = $('[data-hero-name]');
  const form = $('#invite-form');
  const status = $('#invite-status');
  const urlName = new URLSearchParams(location.search).get('to');
  // eslint-disable-next-line no-control-regex -- Remove control characters from visitor text.
  const safeName = (value) => [...String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()].slice(0, 40).join('');
  let name = safeName(urlName || input.value);
  if (name) input.value = name;

  function updateName(normalizeInput = false) {
    const clean = safeName(input.value);
    // Leave in-progress spaces and the caret intact while the visitor types.
    if (normalizeInput && input.value !== clean) input.value = clean;
    name = clean;
    if (previewName) previewName.textContent = clean || 'Nama Anda';
    if (heroName) heroName.textContent = clean ? `Untuk ${clean}` : 'Untuk kamu';
    preview.setAttribute('aria-label', `Pratinjau undangan BHARASENA untuk ${clean || 'Anda'}`);
  }
  input.addEventListener('input', () => updateName());
  input.addEventListener('blur', () => updateName(true));
  form?.addEventListener('submit', (event) => { event.preventDefault(); updateName(true); preview.focus({ preventScroll: true }); });
  updateName(true);

  const tilt = { x: 0, y: 0 };
  let target = { x: 0, y: 0 };
  preview.addEventListener('pointermove', (event) => {
    if (reduceMotion()) return;
    const rect = preview.getBoundingClientRect();
    target.x = clamp(((event.clientY - rect.top) / rect.height - 0.5) * -12, -6, 6);
    target.y = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 12, -6, 6);
    requestFrame();
  }, { passive: true });
  preview.addEventListener('pointerleave', () => { target = { x: 0, y: 0 }; requestFrame(); });
  addFrameTask(() => {
    if (reduceMotion()) return false;
    tilt.x = lerp(tilt.x, target.x, 0.16);
    tilt.y = lerp(tilt.y, target.y, 0.16);
    preview.style.setProperty('--tilt-x', `${tilt.x.toFixed(2)}deg`);
    preview.style.setProperty('--tilt-y', `${tilt.y.toFixed(2)}deg`);
    return Math.abs(tilt.x - target.x) + Math.abs(tilt.y - target.y) > 0.02;
  });

  async function makeCard() {
    await document.fonts?.ready;
    const loadImage = (src) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Gambar undangan tidak dapat dimuat.'));
      image.src = src;
    });
    const guest = name || 'Nama Anda';
    const [crest, corner] = await Promise.all([
      loadImage('assets/batalyon/bhara-arsa-nawasena.png'),
      loadImage('assets/invitation-corner.svg'),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#eee4ce';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a8864520';
    for (let x = 0; x < w; x += 12) {
      for (let y = 0; y < h; y += 12) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.strokeStyle = '#ac8a4f';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, w - 60, h - 60);
    ctx.strokeStyle = '#ac8a4f60';
    ctx.strokeRect(42, 42, w - 84, h - 84);
    [[52,52,0],[w-52,52,Math.PI/2],[w-52,h-52,Math.PI],[52,h-52,-Math.PI/2]].forEach(([x,y,angle]) => {
      ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.drawImage(corner,0,0,155,155); ctx.restore();
    });
    ctx.drawImage(crest, w/2-105, 90, 210, 210);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#392b23';
    ctx.font = '500 60px "Bodoni Moda", Georgia, serif';
    ctx.fillText('BHARASENA',w/2,380);
    ctx.font = '400 22px "Hanken Grotesk", sans-serif';
    ctx.fillText('B H A R A  A R S A  N A W A S E N A',w/2,425);
    ctx.strokeStyle = '#b9996060';
    ctx.beginPath(); ctx.moveTo(260,495); ctx.lineTo(480,495); ctx.moveTo(600,495); ctx.lineTo(820,495); ctx.stroke();
    ctx.fillStyle = '#a5864e'; ctx.font = '32px Georgia'; ctx.fillText('✦',w/2,507);
    ctx.fillStyle = '#76624b'; ctx.font = '400 25px "Hanken Grotesk", sans-serif';
    ctx.fillText('Dengan hangat kami mengundang',w/2,580);
    ctx.fillStyle = '#392b23';
    let fontSize = 86;
    ctx.font = `italic ${fontSize}px "Bodoni Moda", Georgia, serif`;
    while (ctx.measureText(guest).width > 830 && fontSize > 24) {
      fontSize -= 2; ctx.font = `italic ${fontSize}px "Bodoni Moda", Georgia, serif`;
    }
    ctx.fillText(guest,w/2,705);
    ctx.fillStyle = '#76624b'; ctx.font = '400 32px Georgia, serif';
    ctx.fillText('Menjadi bagian dari perayaan,',w/2,805);
    ctx.fillText('pertemuan, dan kenangan yang tinggal.',w/2,855);
    ctx.strokeStyle = '#b9996050';
    [930,1045].forEach(y=>{ctx.beginPath();ctx.moveTo(210,y);ctx.lineTo(870,y);ctx.stroke();});
    ctx.fillStyle = '#392b23'; ctx.font = '400 30px "Hanken Grotesk", sans-serif';
    ctx.fillText('11 — 13 DESEMBER 2026',w/2,1000);
    ctx.font = 'italic 38px Georgia, serif'; ctx.fillText('Sampai bertemu,',w/2,1140);
    ctx.font = '400 22px "Hanken Grotesk", sans-serif';
    ctx.fillText('BATALYON BHARA ARSA NAWASENA',w/2,1210);
    ctx.fillText('SMAN 2 TARUNA BHAYANGKARA',w/2,1255);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
  }
  function download(blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'undangan-bharasena.png';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async function exportCard(share) {
    const button = share ? shareButton : downloadButton;
    if (!button) return;
    button.disabled = true;
    try {
      const blob = await makeCard();
      if (!blob) throw new Error('Canvas export failed');
      if (share && navigator.share && navigator.canShare && typeof File !== 'undefined') {
        const file = new File([blob], 'undangan-bharasena.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'Undangan BHARASENA' }); return; }
          catch (error) { if (error?.name === 'AbortError') return; }
        }
      }
      download(blob);
      if (status) status.textContent = 'Kartu berhasil disiapkan. Jika belum tersimpan, periksa unduhan browser.';
    } catch (error) {
      console.error('Kartu undangan gagal dibuat:', error);
      if (status) status.textContent = 'Kartu belum berhasil dibuat. Coba lagi.';
    } finally { button.disabled = false; }
  }
  downloadButton?.addEventListener('click', () => exportCard(false));
  shareButton?.addEventListener('click', () => exportCard(true));
}

let rainTrigger = () => {};
function startRain(duration = 6500) { rainTrigger(duration); }
function initGalleryAndFinale() {
  const track = $('.gallery-track');
  const dialog = $('#gallery-dialog');
  const finale = $('.finale');
  let galleryIndex = 0;
  let drag = null;
  let velocity = 0;

  if (track && gallery.length) {
    track.replaceChildren();
    gallery.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gallery-frame';
      button.dataset.galleryIndex = String(index);
      button.dataset.parallaxDepth = String([-0.03, -0.07, 0.05][index % 3]);
      const image = document.createElement('img');
      image.src = item.src;
      image.alt = item.alt || 'Dokumentasi BHARASENA';
      image.loading = 'lazy';
      image.decoding = 'async';
      const plaque = document.createElement('span');
      plaque.className = 'gallery-plaque';
      plaque.textContent = item.day || 'BHARASENA';
      button.append(image, plaque);
      track.append(button);
    });
  }
  if (track) {
    track.addEventListener('click', (event) => {
      if (track.dataset.dragged === 'true') return;
      const frame = event.target.closest('[data-gallery-index]');
      if (frame && gallery.length) showGallery(Number(frame.dataset.galleryIndex));
    });
    track.addEventListener('wheel', (event) => {
      if (!finePointerQuery.matches || track.scrollWidth <= track.clientWidth || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const delta = event.deltaY;
      const atStart = track.scrollLeft <= 0 && delta < 0;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1 && delta > 0;
      if (atStart || atEnd) return;
      event.preventDefault();
      track.scrollLeft += delta;
    }, { passive: false });
    track.addEventListener('pointerdown', (event) => {
      if (!finePointerQuery.matches || event.button !== 0) return;
      drag = { x: event.clientX, left: track.scrollLeft, time: performance.now(), lastX: event.clientX, captured: false };
      velocity = 0;
      track.dataset.dragged = 'false';
      track.classList.add('is-dragging');
    });
    track.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > 6) {
        track.dataset.dragged = 'true';
        if (!drag.captured) { track.setPointerCapture?.(event.pointerId); drag.captured = true; }
      }
      if (track.dataset.dragged === 'true') {
        track.scrollLeft = drag.left - dx;
        const dt = Math.max(1, performance.now() - drag.time);
        velocity = (drag.lastX - event.clientX) / dt * 16;
        drag.time = performance.now();
        drag.lastX = event.clientX;
      }
    });
    const release = () => {
      if (!drag) return;
      drag = null;
      track.classList.remove('is-dragging');
      if (Math.abs(velocity) > 0.1 && !reduceMotion()) requestFrame();
      setTimeout(() => { track.dataset.dragged = 'false'; }, 80);
    };
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);
    addFrameTask(() => {
      if (!track || drag || reduceMotion() || Math.abs(velocity) < 0.1) return false;
      track.scrollLeft += velocity;
      velocity *= 0.9;
      return true;
    });
  }
  function showGallery(index) {
    if (!dialog || !gallery.length) return;
    galleryIndex = (index + gallery.length) % gallery.length;
    const item = gallery[galleryIndex];
    const image = $('img', dialog);
      const caption = $('[data-gallery-caption]', dialog) || $('p', dialog);
    if (image) { image.src = item.src; image.alt = item.alt || 'Dokumentasi BHARASENA'; }
    if (caption) caption.textContent = item.day || 'BHARASENA';
    if (!dialog.open) dialog.showModal();
  }
  if (dialog) {
    $('[data-gallery-prev]', dialog)?.addEventListener('click', () => showGallery(galleryIndex - 1));
    $('[data-gallery-next]', dialog)?.addEventListener('click', () => showGallery(galleryIndex + 1));
    ($('[data-gallery-close]', dialog) || $('.dialog-close', dialog))?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); showGallery(galleryIndex - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); showGallery(galleryIndex + 1); }
    });
    let touchX = null;
    dialog.addEventListener('touchstart', (event) => { touchX = event.touches[0]?.clientX; }, { passive: true });
    dialog.addEventListener('touchend', (event) => {
      if (touchX === null) return;
      const dx = event.changedTouches[0]?.clientX - touchX;
      if (Math.abs(dx) > 45) showGallery(galleryIndex + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  }

  const canvas = $('#gold-rain') || document.createElement('canvas');
  canvas.className = 'gold-rain';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90;display:none';
  if (canvas.parentElement !== document.body) document.body.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  let particles = [];
  let rainUntil = 0;
  let rainRequiresFinale = false;
  let finaleVisible = false;
  let rang = false;
  function resizeCanvas() {
    const dpr = Math.min(devicePixelRatio || 1, lowEnd ? 1 : 1.5);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function rain(duration = 6500, requireFinale = false) {
    if (reduceMotion() || !ctx) return;
    rainRequiresFinale = requireFinale;
    resizeCanvas();
    canvas.style.display = 'block';
    const count = lowEnd ? 35 : 90;
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth,
      y: -Math.random() * innerHeight,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 1.1 + Math.random() * 1.8,
      size: 1 + Math.random() * 2.5,
      alpha: 0.3 + Math.random() * 0.55,
    }));
    rainUntil = performance.now() + duration;
    requestFrame();
  }
  rainTrigger = rain;
  addFrameTask((time) => {
    if (!particles.length || reduceMotion() || (rainRequiresFinale && finale && !finaleVisible)) {
      if (particles.length) { particles = []; ctx.clearRect(0, 0, innerWidth, innerHeight); canvas.style.display = 'none'; }
      return false;
    }
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const fading = clamp((rainUntil - time) / 1200, 0, 1);
    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.y > innerHeight && time < rainUntil - 1200) particle.y = -10;
      ctx.fillStyle = `rgba(233,212,154,${particle.alpha * fading})`;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size * 2);
    }
    if (time >= rainUntil) {
      particles = [];
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      canvas.style.display = 'none';
      return false;
    }
    return true;
  });
  addEventListener('resize', () => { if (particles.length) resizeCanvas(); }, { passive: true });
  if (finale && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      finaleVisible = entries[0]?.isIntersecting || false;
      if (finaleVisible && !rang) {
        rang = true;
        rain(6500, true);

      }
    }, { threshold: 0.35 }).observe(finale);
  }
}

function initNavigation() {
  const button = $('.menu-button');
  const nav = $('#site-nav');
  if (!button || !nav) return;
  const close = () => {
    button.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  };
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  $$('a', nav).forEach((link) => link.addEventListener('click', close));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  document.addEventListener('click', (event) => { if (!nav.contains(event.target) && !button.contains(event.target)) close(); });
}

function initPublishedContent() {
  if (EVENT.venue) {
    const place = $('.ticket-place strong');
    const note = $('.ticket-place > span:last-child');
    if (place) place.textContent = EVENT.venue;
    if (note) note.textContent = 'Lokasi acara';
  }
  if (EVENT.artistAt && root.dataset.rendered !== 'server') {
    const artistTime = $('.mini-envelope[data-envelope="performer"] strong');
    if (artistTime) artistTime.textContent = EVENT.artistAt;
  }
  if (EVENT.contact) {
    const note = $('.contact-note');
    if (note) note.textContent = `Kontak panitia: ${EVENT.contact}`;
  }
}

function initPerformer() {
  const stage = document.querySelector('#penampil');
  if (!stage) return;
  stage.querySelector('.performer-listen')?.addEventListener('click', () => {
    document.querySelector('#audio-toggle')?.click();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      stage.classList.toggle('is-on-stage', entry.isIntersecting);
    }, { threshold: 0.05 }).observe(stage);
  } else stage.classList.add('is-on-stage');
}

function init() {
  initPublishedContent();
  initTimeline();
  initHero();
  initRundown();
  initTime();
  initEnvelopes();
  initMessageWall();
  initCard();
  initGalleryAndFinale();
  const openMusic = initMusic();
  initPerformer();
  initHeritage();
  initNavigation();
  initSeal(openMusic);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
