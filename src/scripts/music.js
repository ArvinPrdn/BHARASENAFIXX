const tracks = [
  { title: 'Melukis Senja', file: 'melukis-senja', note: 'Untuk saling menguatkan' },
  { title: 'Mesin Waktu', file: 'mesin-waktu', note: 'Tentang rindu dan kenangan' },
  { title: 'Tak Kan Hilang', file: 'tak-kan-hilang', note: 'Tentang cinta yang menetap' },
  { title: 'Tolong', file: 'tolong', note: 'Untuk hati yang menunggu' },
];

export function initMusic() {
  const trigger = document.querySelector('#audio-toggle');
  if (!trigger) return;
  trigger.removeAttribute('aria-pressed');
  trigger.setAttribute('aria-label', 'Pilih lagu Budi Doremi');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'music-panel');
  trigger.setAttribute('popovertarget', 'music-panel');
  trigger.title = 'Pilih lagu Budi Doremi';

  const panel = document.createElement('section');
  panel.id = 'music-panel';
  panel.className = 'music-panel';
  panel.setAttribute('popover', 'auto');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'music-title');
  panel.innerHTML = `
    <div class="music-panel__top">
      <span class="music-panel__eyebrow"><span aria-hidden="true">♫</span> THE BALLROOM SESSIONS</span>
      <button class="music-close" type="button" popovertarget="music-panel" popovertargetaction="hide" aria-label="Tutup pilihan lagu">×</button>
    </div>
    <div class="music-intro">
      <div class="music-turntable" aria-hidden="true"><div class="music-record"><img src="assets/budi-doremi.jpg" alt="" /><span class="music-record__label">BHARASENA · SIDE A</span></div><span class="music-tonearm"></span></div>
      <div><p class="music-artist">BUDI DOREMI</p><h2 id="music-title">Lagu untuk<br /><em>malam ini.</em></h2><p class="music-intro__note">Pilih lagu. Nikmati ceritanya.</p></div>
    </div>
    <div class="music-list-heading"><span>PILIHAN LAGU</span><span>04 TRACKS</span></div>
    <div class="music-tracks" role="group" aria-label="Lagu Budi Doremi">
      ${tracks.map((track, index) => `<button class="music-track" type="button" data-track="${index}" aria-pressed="false" aria-label="Pilih ${track.title}">
        <span class="music-track__number" aria-hidden="true">0${index + 1}</span>
        <span class="music-track__copy"><strong>${track.title}</strong><small>${track.note}</small></span>
        <span class="music-track__play" aria-hidden="true"></span>
      </button>`).join('')}
    </div>
    <div class="music-player" aria-label="Pemutar lagu">
      <div class="music-player__empty"><span aria-hidden="true">♫</span><p>Malam ini, lagumu yang memilih suasana.</p><small>Pilih salah satu lagu di atas untuk mulai.</small></div>
    </div>
    <div class="music-playing"><p class="music-status" role="status" aria-live="polite">Belum ada lagu dipilih</p><button class="music-stop" type="button" hidden>Hentikan</button></div>
    <p class="music-panel__foot">Musik tetap menemanimu saat menjelajahi halaman.</p>`;
  document.body.append(panel);

  const choices = [...panel.querySelectorAll('.music-track')];
  const player = panel.querySelector('.music-player');
  const empty = player.firstElementChild;
  const status = panel.querySelector('.music-status');
  const stop = panel.querySelector('.music-stop');
  const record = panel.querySelector('.music-record');
  const audio = document.createElement('audio');
  audio.hidden = true;
  audio.preload = 'none';
  audio.setAttribute('aria-label', 'Pemutar lagu Budi Doremi');
  const sources = new Map();
  let sourceCheck;
  let selectedIndex = -1;
  let pendingIndex = -1;

  const icons = {
    play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
    previous: '<path d="M6 5v14m13-14L9 12l10 7Z"/>',
    next: '<path d="M18 5v14M5 5l10 7-10 7Z"/>',
    volume: '<path d="M4 9v6h4l5 4V5L8 9Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    muted: '<path d="M4 9v6h4l5 4V5L8 9Zm13 0 5 6m0-6-5 6"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  const controls = document.createElement('div');
  controls.className = 'music-console';
  controls.innerHTML = `
    <div class="music-console__heading"><div><span class="music-console__kicker">PILIHAN MALAM INI</span><strong class="music-console__title"></strong><small>Budi Doremi</small></div><span class="music-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div>
    <input class="music-seek music-slider" type="range" min="0" max="100" step="0.1" value="0" aria-label="Posisi lagu" disabled />
    <div class="music-console__time"><span class="music-elapsed">0:00</span><span class="music-duration">0:00</span></div>
    <div class="music-console__bottom">
      <div class="music-transport"><button class="music-control music-previous" type="button" aria-label="Lagu sebelumnya">${icon('previous')}</button><button class="music-play" type="button" aria-label="Putar lagu">${icon('play')}</button><button class="music-control music-next" type="button" aria-label="Lagu berikutnya">${icon('next')}</button></div>
      <div class="music-volume"><button class="music-control music-mute" type="button" aria-label="Bisukan suara" aria-pressed="false">${icon('volume')}</button><input class="music-slider music-volume__slider" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume" /></div>
    </div>`;
  const playButton = controls.querySelector('.music-play');
  const seek = controls.querySelector('.music-seek');
  const volume = controls.querySelector('.music-volume__slider');
  const mute = controls.querySelector('.music-mute');
  const timeLabel = (value) => {
    const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };

  function updateTimeline() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    seek.disabled = duration <= 0;
    seek.max = String(duration || 100);
    seek.value = String(audio.currentTime || 0);
    seek.style.setProperty('--fill', `${duration ? (audio.currentTime / duration) * 100 : 0}%`);
    seek.setAttribute('aria-valuetext', `${timeLabel(audio.currentTime)} dari ${timeLabel(duration)}`);
    controls.querySelector('.music-elapsed').textContent = timeLabel(audio.currentTime);
    controls.querySelector('.music-duration').textContent = timeLabel(duration);
  }

  function updatePlayback() {
    const playing = !audio.paused && !audio.ended;
    playButton.innerHTML = icon(playing ? 'pause' : 'play');
    playButton.setAttribute('aria-label', playing ? 'Jeda lagu' : 'Putar lagu');
  }

  function updateVolume() {
    const silent = audio.muted || audio.volume === 0;
    mute.innerHTML = icon(silent ? 'muted' : 'volume');
    mute.setAttribute('aria-label', silent ? 'Aktifkan suara' : 'Bisukan suara');
    mute.setAttribute('aria-pressed', String(silent));
    volume.value = String(audio.muted ? 0 : audio.volume);
    volume.style.setProperty('--fill', `${Number(volume.value) * 100}%`);
    volume.setAttribute('aria-valuetext', `${Math.round(Number(volume.value) * 100)} persen`);
  }

  function play() {
    const index = selectedIndex;
    audio.play().catch((error) => {
      if (index !== selectedIndex || error.name === 'AbortError' || !audio.paused) return;
      status.textContent = error.name === 'NotAllowedError' ? 'Tekan play untuk mulai mendengarkan.' : 'Audio belum dapat diputar. Pilih lagu lain.';
      updatePlayback();
    });
  }
  playButton.addEventListener('click', () => { if (audio.paused) play(); else audio.pause(); });
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Math.min(audio.duration, Number(seek.value));
    updateTimeline();
  });
  volume.addEventListener('input', () => { audio.volume = Number(volume.value); audio.muted = false; updateVolume(); });
  mute.addEventListener('click', () => {
    const silent = audio.muted || audio.volume === 0;
    if (!audio.volume) audio.volume = .5;
    audio.muted = !silent;
    updateVolume();
  });
  function skipTrack(direction) {
    const available = [...sources.keys()].sort((a, b) => a - b);
    if (!available.length) return;
    const next = (available.indexOf(selectedIndex) + direction + available.length) % available.length;
    selectTrack(available[next]);
  }
  controls.querySelector('.music-previous').addEventListener('click', () => skipTrack(-1));
  controls.querySelector('.music-next').addEventListener('click', () => skipTrack(1));
  for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'emptied']) audio.addEventListener(event, updateTimeline);
  for (const event of ['play', 'pause', 'ended', 'error']) audio.addEventListener(event, updatePlayback);
  audio.addEventListener('volumechange', updateVolume);
  updateVolume();

  function setPlaying(playing) {
    trigger.classList.toggle('is-playing', playing);
    record.classList.toggle('is-spinning', playing);
    controls.classList.toggle('is-playing', playing);
  }

  function reset() {
    pendingIndex = -1;
    setPlaying(false);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    player.replaceChildren(empty);
    choices.forEach((choice) => choice.setAttribute('aria-pressed', 'false'));
    selectedIndex = -1;
    status.textContent = 'Belum ada lagu dipilih';
    stop.hidden = true;
  }

  function selectTrack(index) {
    const source = sources.get(index);
    if (!source) {
      if (sourceCheck) pendingIndex = index;
      status.textContent = sourceCheck ? 'Memeriksa ketersediaan audio…' : 'Rekaman lagu ini belum tersedia.';
      return;
    }
    pendingIndex = -1;
    if (index === selectedIndex) return;
    selectedIndex = index;
    const track = tracks[index];
    choices.forEach((item, itemIndex) => item.setAttribute('aria-pressed', String(itemIndex === index)));
    audio.pause();
    audio.src = source;
    audio.load();
    audio.setAttribute('aria-label', `Putar ${track.title} — Budi Doremi`);
    controls.querySelector('.music-console__title').textContent = track.title;
    player.replaceChildren(audio, controls);
    updateTimeline();
    status.textContent = `Pilihanmu: ${track.title}`;
    stop.hidden = false;
    play();
  }
  choices.forEach((choice, index) => choice.addEventListener('click', () => selectTrack(index)));

  audio.addEventListener('playing', () => {
    if (selectedIndex < 0) return;
    status.textContent = `Sedang diputar: ${tracks[selectedIndex].title}`;
    setPlaying(true);
  });
  audio.addEventListener('pause', () => {
    setPlaying(false);
    if (selectedIndex >= 0) status.textContent = `Dijeda: ${tracks[selectedIndex].title}`;
  });
  audio.addEventListener('ended', () => {
    setPlaying(false);
    if (selectedIndex >= 0) status.textContent = `Selesai: ${tracks[selectedIndex].title}`;
  });
  audio.addEventListener('waiting', () => setPlaying(false));
  audio.addEventListener('emptied', () => setPlaying(false));
  audio.addEventListener('error', () => {
    if (selectedIndex >= 0) status.textContent = 'Audio belum dapat diputar. Pilih lagu lain.';
    setPlaying(false);
  });

  async function checkSources() {
    await Promise.all(tracks.map(async (track, index) => {
      if (sources.has(index)) return;
      for (const extension of ['mp3', 'm4a', 'ogg', 'wav']) {
        const path = `assets/audio/${track.file}.${extension}`;
        try {
          const response = await fetch(path, { method: 'HEAD', cache: 'no-store' });
          if (response.ok && response.headers.get('content-type')?.startsWith('audio/')) {
            sources.set(index, path);
            break;
          }
        } catch { /* Show unavailable audio without blocking the page. */ }
      }
      const available = sources.has(index);
      choices[index].setAttribute('aria-disabled', String(!available));
      choices[index].querySelector('small').textContent = available ? track.note : 'Audio belum tersedia';
      if (pendingIndex === index && available) selectTrack(index);
    }));
    if (!sources.size) {
      empty.querySelector('p').textContent = 'Koleksi lagu sedang disiapkan.';
      empty.querySelector('small').textContent = 'Rekaman audio belum ditambahkan.';
      status.textContent = 'Belum ada audio yang tersedia';
    }
  }

  stop.addEventListener('click', () => {
    const previous = selectedIndex;
    reset();
    choices[previous]?.focus();
  });
  panel.addEventListener('beforetoggle', (event) => {
    const open = event.newState === 'open';
    trigger.setAttribute('aria-expanded', String(open));
    if (open && !sourceCheck) {
      sourceCheck = checkSources().finally(() => { sourceCheck = null; });
    }
  });

  // The invitation opening is the first intentional gesture. Browsers may
  // still block audio, in which case the player keeps a visible play control.
  document.addEventListener('bharasena:entered', () => {
    if (selectedIndex >= 0) return;
    sources.set(0, 'assets/audio/melukis-senja.mp3');
    selectTrack(0);
  }, { once: true });
  document.addEventListener('bharasena:resume-audio', () => {
    if (selectedIndex >= 0 && audio.paused) play();
  });

  let enteredBefore = false;
  try { enteredBefore = sessionStorage.getItem('bharasena-opened') === '1'; } catch { /* private mode */ }
  if (enteredBefore) {
    const onKeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      document.removeEventListener('keydown', onKeydown);
      beginOnGesture();
    };
    const beginOnGesture = () => {
      if (selectedIndex >= 0) return;
      sources.set(0, 'assets/audio/melukis-senja.mp3');
      selectTrack(0);
    };
    document.addEventListener('click', beginOnGesture, { once: true });
    document.addEventListener('keydown', onKeydown);
  }
}
