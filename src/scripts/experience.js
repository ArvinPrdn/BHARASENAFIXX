// The browser bundle is intentionally dependency-free and authored as
// progressive enhancement code. Keep this source type-checkable in strict
// projects while preserving the no-build static fallback.
// @ts-nocheck
import { initMusic } from './music.js';
import { initHeritage } from './heritage.js';
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
const eventMapsMeta = document.querySelector('meta[name="event-maps"]')?.getAttribute('content');
const eventContactMeta = document.querySelector('meta[name="event-contact"]')?.getAttribute('content');
const eventInstagramMeta = document.querySelector('meta[name="event-instagram"]')?.getAttribute('content');
if (eventStartMeta) EVENT.start = eventStartMeta;
if (eventEndMeta) EVENT.end = eventEndMeta;
if (eventVenueMeta) EVENT.venue = eventVenueMeta || null;
if (eventMapsMeta) EVENT.mapsUrl = eventMapsMeta || null;
if (eventContactMeta) EVENT.contact = eventContactMeta || null;
if (eventInstagramMeta) EVENT.instagram = eventInstagramMeta || null;

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
        const label = phase === 'pasca' ? 'Rangkaian BHARASENA telah selesai.' : 'Rundown resmi akan hadir di sini.';
        if (liveStatus.textContent !== label) liveStatus.textContent = label;
        $$('[data-session-start]').forEach((row) => row.classList.remove('is-current'));
      }
    }
    if (liveTrack) liveTrack.hidden = phase !== 'live';
    if (liveProgress && phase !== 'live') liveProgress.style.transform = 'scaleX(0)';
  }

  update();
  const timer = setInterval(update, 1000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
}

function initTimeline() {
  const scenes = $$('.scene[data-scene]');
  const hero = $('.hero');
  const heroLayers = hero ? $$('[data-depth]', hero) : [];
  const clock = $('.scene-clock');
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
    if (hero && !reduceMotion() && !mobileQuery.matches && !lowEnd) {
      const heroRect = hero.getBoundingClientRect();
      if (heroRect.bottom >= 0 && heroRect.top <= innerHeight) {
        const heroProgress = clamp(-heroRect.top / Math.max(1, heroRect.height), 0, 1);
        heroLayers.forEach((layer) => {
          const depth = clamp(Number(layer.dataset.depth) || 0.03, -0.2, 0.2);
          layer.style.setProperty('--parallax-scroll', `${(heroProgress * depth * (mobileQuery.matches ? 95 : 180)).toFixed(2)}px`);
        });
      }
    }
    const minutes = Math.round(t * 360);
    const hours = 18 + Math.floor(minutes / 60);
    const label = `${String(hours).padStart(2, '0')}.${String(minutes % 60).padStart(2, '0')}`;
    if (clock && clock.textContent !== label) clock.textContent = label;
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
  markDirty();
}

function initSeal() {
  let visited = false;
  try { visited = sessionStorage.getItem('bharasena-opened') === '1'; } catch { /* private mode */ }
  if (visited) {
    root.classList.add('is-entered');
    return;
  }
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
    document.dispatchEvent(new Event('bharasena:entered'));
    try { sessionStorage.setItem('bharasena-opened', '1'); } catch { /* private mode */ }
    gate.classList.add('is-opening');
    setTimeout(() => {
      gate.remove();
      root.classList.add('is-entered');
      siblings.forEach((child, i) => { child.inert = previousInert[i]; });
      document.body.style.overflow = previousOverflow;
      if (oldFocus instanceof HTMLElement && oldFocus !== document.body && oldFocus.isConnected) oldFocus.focus();
      else { const main = $('main'); if (main) { main.tabIndex = -1; main.focus({ preventScroll: true }); } }
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
  hold.addEventListener('pointerup', () => {
    if (closing) document.dispatchEvent(new Event('bharasena:resume-audio'));
  });
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
    if (usingGyro || reduceMotion() || !finePointerQuery.matches || lowEnd) return;
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
  const tabs = $$('.day-tab[data-day]');
  const panels = $$('.day-panel[data-day]');
  const track = $('.day-panels') || panels[0]?.parentElement;
  if (!tabs.length || !panels.length) return;

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

  function activate(day, focus = false, fromSwipe = false) {
    tabs.forEach((tab) => {
      const selected = tab.dataset.day === day;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach((panel) => {
      const selected = panel.dataset.day === day;
      panel.classList.toggle('is-active', selected);
      panel.hidden = !mobileQuery.matches && !selected;
      if (selected && mobileQuery.matches && !fromSwipe) panel.scrollIntoView({ behavior: reduceMotion() ? 'instant' : 'smooth', block: 'nearest', inline: 'start' });
    });
  }
  function syncLayout() {
    const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0];
    panels.forEach((panel) => { panel.hidden = !mobileQuery.matches && panel.dataset.day !== selected.dataset.day; });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.dataset.day));
    tab.addEventListener('keydown', (event) => {
      const offsets = { ArrowRight: 1, ArrowLeft: -1 };
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : Object.hasOwn(offsets, event.key) ? (index + offsets[event.key] + tabs.length) % tabs.length : -1;
      if (target < 0) return;
      event.preventDefault();
      activate(tabs[target].dataset.day, true);
    });
  });
  if (track && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!mobileQuery.matches) return;
      const mostVisible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (mostVisible) activate(mostVisible.target.dataset.day, false, true);
    }, { root: track, threshold: [0.5, 0.75] });
    panels.forEach((panel) => observer.observe(panel));
  }
  mobileQuery.addEventListener?.('change', syncLayout);
  activate(tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')?.dataset.day || tabs[0].dataset.day, false, true);
}

function initEnvelopes() {
  const cards = $$('.envelope[data-envelope]');
  const performerEnvelope = $('.mini-envelope[data-envelope="performer"]');
  if (performerEnvelope) {
    performerEnvelope.setAttribute('role', 'button');
    performerEnvelope.setAttribute('tabindex', '0');
    performerEnvelope.setAttribute('aria-label', 'Jadwal penampilan Budi Doremi, menunggu pengumuman');
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
      const ids = { lokasi: 'venue', masuk: 'admission', busana: 'dress-code', terbaru: 'updates' };
      const data = envelopes.find((item) => item.id === (ids[card.dataset.envelope] || card.dataset.envelope)) || envelopes[index];
      if (!data) return;
      const field = { venue: EVENT.venue, admission: EVENT.admission, 'dress-code': EVENT.dressCode }[data.id];
      const resolved = field && !data.body ? { ...data, body: field, placeholder: false } : data;
      const open = getEnvelopeState(resolved, now) === 'open';
      card.classList.toggle('is-open', open);
      card.classList.toggle('is-sealed', !open);
      card.setAttribute('aria-expanded', String(open));
      const body = $('[data-envelope-body]', card) || $('.envelope-body p', card);
      if (body) body.textContent = open ? resolved.body : 'Informasi resmi segera dibuka.';
      const status = $('[data-envelope-status]', card) || $('.envelope-bottom > span:first-child', card);
      if (status) status.textContent = open ? 'Terbuka' : resolved.unlockAt && !resolved.placeholder ? 'Dibuka sesuai jadwal' : 'Segera dibuka';
    });
  }
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      if (!card.classList.contains('is-sealed')) return;
      card.classList.remove('is-jolted');
      void card.offsetWidth;
      card.classList.add('is-jolted');
      setTimeout(() => card.classList.remove('is-jolted'), 460);
    });
  });
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
  if (root.dataset.hosting === 'static') {
    form.querySelectorAll('input, textarea, button').forEach((control) => { control.disabled = true; });
    if (status) status.textContent = 'Pengiriman pesan akan segera dibuka.';
    if (state) state.textContent = 'SEGERA DIBUKA';
    return;
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
      if (!response.ok) return;
      const payload = await response.json();
      const messages = Array.isArray(payload) ? payload : payload?.messages;
      if (Array.isArray(messages)) renderMessages(messages);
    } catch { /* The empty state is the intended offline fallback. */ }
  }
  bodyInput.addEventListener('input', updateCount);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = clean(nameInput.value, 20);
    const body = cleanBody(bodyInput.value, 80);
    if (trap?.value) return;
    if (body.length < 4) { setStatus('Pesanmu masih terlalu singkat.', 'error'); bodyInput.focus(); return; }
    const submit = $('button[type="submit"]', form);
    if (submit) submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    setStatus('Mengirim pesan ke meja redaksi…');
    try {
      const csrf = $('meta[name="csrf-token"]')?.getAttribute('content') || form.dataset.csrf;
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const response = await fetch('/api/messages', {
        method: 'POST', credentials: 'same-origin',
        headers,
        body: JSON.stringify({ nickname: name, body, website: '', formStartedAt: Date.now() - 1500 }),
      });
      let payload = null;
      try { payload = await response.json(); } catch { /* empty error body */ }
      if (!response.ok) throw new Error(payload?.error || 'Pesan belum dapat dikirim.');
      const approved = payload?.message && (payload.message.approved === true || payload.message.status === 'approved');
      if (approved) {
        const card = renderMessage(payload.message);
        if (card && list) {
          empty?.setAttribute('hidden', '');
          list.prepend(card);
          card.classList.add('is-new');
          window.setTimeout(() => card.classList.remove('is-new'), 700);
        }
      }
      form.reset();
      updateCount();
      setStatus(approved ? 'Pesanmu sudah tampil di dinding.' : 'Pesan diterima. Setelah disetujui panitia, pesanmu akan tampil.', 'success');
      if (state && approved) state.textContent = 'PESAN TERBARU';
    } catch (error) {
      setStatus(error?.message || 'Pesan belum dapat dikirim. Coba lagi nanti.', 'error');
    } finally {
      form.removeAttribute('aria-busy');
      if (submit) submit.disabled = false;
    }
  });
  updateCount();
  loadMessages();
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

  function updateName() {
    const clean = safeName(input.value);
    if (input.value !== clean) input.value = clean;
    name = clean;
    if (previewName) previewName.textContent = clean || 'Nama Anda';
    if (heroName) heroName.textContent = clean ? `Untuk ${clean}` : 'Untuk kamu';
    preview.setAttribute('aria-label', `Pratinjau undangan BHARASENA untuk ${clean || 'Anda'}`);
  }
  input.addEventListener('input', updateName);
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    updateName();
    preview.classList.remove('is-updated');
    void preview.offsetWidth;
    preview.classList.add('is-updated');
    window.setTimeout(() => preview.classList.remove('is-updated'), 900);
    preview.focus({ preventScroll: true });
  });
  updateName();

  const tilt = { x: 0, y: 0 };
  let target = { x: 0, y: 0 };
  preview.addEventListener('pointermove', (event) => {
    if (reduceMotion()) return;
    const rect = preview.getBoundingClientRect();
    target.x = clamp(((event.clientY - rect.top) / rect.height - 0.5) * -6, -3, 3);
    target.y = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 6, -3, 3);
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
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#0d0709';
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, 80, w * 0.5, h * 0.42, 950);
    glow.addColorStop(0, '#57202a');
    glow.addColorStop(0.48, '#240c13');
    glow.addColorStop(1, '#0d0709');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const foil = ctx.createLinearGradient(120, 0, 930, 0);
    [['0', '#8a6a2f'], ['0.28', '#e9d49a'], ['0.51', '#fff4c9'], ['0.75', '#b88a3e'], ['1', '#6e4f1e']]
      .forEach(([at, color]) => foil.addColorStop(Number(at), color));
    ctx.strokeStyle = foil;
    ctx.lineWidth = 3;
    ctx.strokeRect(54, 54, w - 108, h - 108);
    ctx.strokeRect(74, 74, w - 148, h - 148);
    ctx.fillStyle = foil;
    ctx.textAlign = 'center';
    ctx.font = '600 32px "Hanken Grotesk", sans-serif';
    ctx.fillText('PROM NIGHT BATALYON 6', w / 2, 215);
    ctx.font = '600 118px "Bodoni Moda", Georgia, serif';
    ctx.fillText('BHARASENA', w / 2, 385);
    ctx.fillStyle = '#f3ead8';
    ctx.font = '400 46px "Hanken Grotesk", sans-serif';
    ctx.fillText('Satu angkatan. Banyak cerita.', w / 2, 492);
    ctx.strokeStyle = '#b88a3e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(220, 560); ctx.lineTo(860, 560); ctx.stroke();
    ctx.fillStyle = '#d9c3a0';
    ctx.font = '400 35px "Hanken Grotesk", sans-serif';
    ctx.fillText('Undangan untuk', w / 2, 730);
    ctx.fillStyle = foil;
    ctx.font = '84px "Pinyon Script", "Bodoni Moda", Georgia, serif';
    const guest = name || 'Anda';
    let fontSize = 84;
    while (ctx.measureText(guest).width > 790 && fontSize > 42) {
      fontSize -= 2;
      ctx.font = `${fontSize}px "Pinyon Script", "Bodoni Moda", Georgia, serif`;
    }
    ctx.fillText(guest, w / 2, 890);
    ctx.fillStyle = '#f3ead8';
    ctx.font = '400 38px "Hanken Grotesk", sans-serif';
    ctx.fillText('11—13 DESEMBER 2026', w / 2, 1125);
    ctx.font = '400 30px "Hanken Grotesk", sans-serif';
    ctx.fillText(EVENT.venue || 'Lokasi akan diumumkan', w / 2, 1190);
    ctx.strokeStyle = '#8a6a2f';
    ctx.beginPath(); ctx.moveTo(250, 1330); ctx.lineTo(830, 1330); ctx.stroke();
    ctx.fillStyle = '#d9c3a0';
    ctx.font = '400 30px "Hanken Grotesk", sans-serif';
    ctx.fillText('Batalyon Bhara Arsa Nawasena', w / 2, 1450);
    ctx.fillText('SMAN 2 Taruna Bhayangkara', w / 2, 1505);
    ctx.fillStyle = foil;
    ctx.font = '72px "Pinyon Script", Georgia, serif';
    ctx.fillText('Sampai bertemu', w / 2, 1655);
    // Deterministic fine texture avoids an extra image request.
    let seed = 2026;
    for (let i = 0; i < (lowEnd ? 1900 : 3500); i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const x = (seed % w);
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const y = (seed % h);
      ctx.fillStyle = i % 3 ? 'rgba(255,244,201,0.035)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(x, y, 1, 1);
    }
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
    const count = lowEnd || mobileQuery.matches ? 28 : 72;
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

function initMotionPolish() {
  if (!('IntersectionObserver' in window)) return;
  const groups = $$('.about-content, .heritage-heading, .heritage-layout, .performer-layout, .programme-heading, .information-heading, .invitation-copy, .proposal-heading, .proposal-card-grid, .gallery-top, .message-wall-heading, .finale-content');
  const items = $$('.envelope, .proposal-card');
  const targets = [...groups, ...items];
  if (!targets.length) return;
  targets.forEach((element) => element.classList.add('motion-reveal'));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
  targets.forEach((element) => observer.observe(element));
  // Keep content visible when the browser restores a page at a scrolled position.
  if (reduceMotion()) targets.forEach((element) => element.classList.add('is-revealed'));
}

function initSubtleHover() {
  if (!finePointerQuery.matches || reduceMotion() || lowEnd) return;
  const targets = $$('.proposal-card, .proposal-primary, .hero-scroll, .return-link');
  targets.forEach((element) => {
    let frame = 0;
    let x = 0, y = 0;
    const strength = element.classList.contains('proposal-card') ? 3 : 4;
    const update = () => {
      frame = 0;
      element.style.setProperty('--hover-x', `${x.toFixed(1)}px`);
      element.style.setProperty('--hover-y', `${y.toFixed(1)}px`);
    };
    element.addEventListener('pointermove', (event) => {
      const box = element.getBoundingClientRect();
      x = clamp((event.clientX - box.left - box.width / 2) / box.width * strength * 2, -strength, strength);
      y = clamp((event.clientY - box.top - box.height / 2) / box.height * strength * 2, -strength, strength);
      if (!frame) frame = requestAnimationFrame(update);
    }, { passive: true });
    element.addEventListener('pointerleave', () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      x = 0; y = 0;
      update();
    });
  });
}

function initPublishedContent() {
  if (EVENT.venue) {
    const place = $('.ticket-place strong');
    const note = $('.ticket-place > span:last-child');
    if (place) place.textContent = EVENT.venue;
    if (note) {
      const mapLink = $('.ticket-place a');
      if (mapLink && EVENT.mapsUrl) {
        mapLink.href = EVENT.mapsUrl;
        mapLink.textContent = 'Buka Google Maps ↗';
        note.replaceChildren(document.createTextNode('Lokasi acara · '), mapLink);
      } else {
        note.textContent = 'Lokasi acara';
      }
    }
  }
  if (EVENT.artistAt) {
    const artistTime = $('.mini-envelope[data-envelope="performer"] strong');
    if (artistTime) artistTime.textContent = EVENT.artistAt;
  }
  if (EVENT.contact) {
    const note = $('.contact-note');
    if (note) note.textContent = `Kontak panitia: ${EVENT.contact}${EVENT.instagram ? ` · Instagram ${EVENT.instagram}` : ''}`;
  }
}

function init() {
  initPublishedContent();
  initTimeline();
  initMotionPolish();
  initHero();
  initRundown();
  initTime();
  initEnvelopes();
  initMessageWall();
  initCard();
  initGalleryAndFinale();
  initMusic();
  initHeritage();
  initNavigation();
  initSubtleHover();
  initSeal();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
