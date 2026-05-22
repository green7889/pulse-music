const modes = {
  running: {
    title: "Running",
    label: "Running boost",
    bpm: "154 BPM",
    description: "Raises loudness carefully, searches for brighter high-tempo tracks, and keeps the beat locked to your stride.",
    track: ["Rainwalk Loop", "PULSE Tapes"],
    colorA: "#5ee0a2",
    colorB: "#67d5f7",
    mixer: { volume: 82, bass: 68, vocals: 76, noise: 42, smooth: 35 },
    queue: [
      ["Sidewalk Drizzle", "PULSE Tapes", "96"],
      ["Soft Shoes", "Luma Vale", "102"],
      ["Pocket Tempo", "Kairo North", "108"]
    ]
  },
  studying: {
    title: "Studying",
    label: "Focus isolation",
    bpm: "92 BPM",
    description: "Increases noise cancellation, pulls vocals close to zero, and favors steady songs that stay out of your way.",
    track: ["Desk Lamp Dust", "Mira Sol"],
    colorA: "#67d5f7",
    colorB: "#e7f4f0",
    mixer: { volume: 48, bass: 36, vocals: 8, noise: 91, smooth: 64 },
    queue: [
      ["Margin Notes", "Elio Trace", "82"],
      ["Paper Glow", "North Window", "78"],
      ["Deep Work", "Iris Bloom", "84"]
    ]
  },
  gym: {
    title: "Gym",
    label: "Workout drive",
    bpm: "142 BPM",
    description: "Boosts bass and impact based on the selected workout, then adapts intensity to your set pace.",
    track: ["Chalk Room Groove", "Vex Harbor"],
    colorA: "#f16f5b",
    colorB: "#f0b455",
    mixer: { volume: 78, bass: 92, vocals: 62, noise: 55, smooth: 28 },
    queue: [
      ["Heavy Count", "Rook Signal", "112"],
      ["Set Break", "Atlas Ray", "106"],
      ["Drive Phase", "Nova Black", "118"]
    ]
  },
  lateNight: {
    title: "Late Night",
    label: "Low-light smooth",
    bpm: "78 BPM",
    description: "Lowers volume, softens grainy edges, and preserves the emotion and shape of the original song.",
    track: ["Window Static", "Lennox Blue"],
    colorA: "#9b7cff",
    colorB: "#5ee0a2",
    mixer: { volume: 34, bass: 44, vocals: 58, noise: 66, smooth: 88 },
    queue: [
      ["Dim Hallway", "Sol Rae", "72"],
      ["After Hours Bloom", "Maison Field", "76"],
      ["Velvet Signal", "Cleo Finch", "70"]
    ]
  }
};

const workoutMixes = {
  strength: { bass: 95, volume: 80, smooth: 24 },
  hiit: { bass: 88, volume: 86, smooth: 18 },
  cycling: { bass: 76, volume: 82, smooth: 30 }
};

const els = {
  canvas: document.querySelector("#pulseCanvas"),
  playButton: document.querySelector("#playButton"),
  playIcon: document.querySelector("#playIcon"),
  trackTitle: document.querySelector("#trackTitle"),
  trackArtist: document.querySelector("#trackArtist"),
  adaptiveLabel: document.querySelector("#adaptiveLabel"),
  modeTitle: document.querySelector("#modeTitle"),
  modeDescription: document.querySelector("#modeDescription"),
  bpmBadge: document.querySelector("#bpmBadge"),
  progressFill: document.querySelector("#progressFill"),
  elapsed: document.querySelector("#elapsed"),
  queueList: document.querySelector("#queueList"),
  workoutPicker: document.querySelector("#workoutPicker"),
  autoTuneButton: document.querySelector("#autoTuneButton"),
  fileInput: document.querySelector("#fileInput"),
  uploadStatus: document.querySelector("#uploadStatus"),
  uploadedAudio: document.querySelector("#uploadedAudio"),
  previousButton: document.querySelector("#previousButton"),
  rewindButton: document.querySelector("#rewindButton"),
  nextButton: document.querySelector("#nextButton"),
  aiVocalButton: document.querySelector("#aiVocalButton"),
  aiVocalStatus: document.querySelector("#aiVocalStatus"),
  separateStemsButton: document.querySelector("#separateStemsButton"),
  stemStatus: document.querySelector("#stemStatus"),
  stemMixer: document.querySelector("#stemMixer")
};

const sliders = ["volume", "bass", "vocals", "noise", "smooth"].reduce((all, key) => {
  all[key] = document.querySelector(`#${key}`);
  all[`${key}Value`] = document.querySelector(`#${key}Value`);
  return all;
}, {});

const stemSliders = ["stemVocals", "stemDrums", "stemBass", "stemOther"].reduce((all, key) => {
  all[key] = document.querySelector(`#${key}`);
  all[`${key}Value`] = document.querySelector(`#${key}Value`);
  return all;
}, {});

const ctx = els.canvas.getContext("2d");
let currentMode = "running";
let isPlaying = false;
let progress = 34;
let tick = 0;
let audio = null;
let beatTimer = null;
let uploadedTracks = [];
let currentTrackIndex = 0;
let hasUploadedTrack = false;
let aiVocalRemove = false;
let stemSession = {
  active: false,
  elements: {},
  gains: {},
  sources: {}
};

function createAudioEngine() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return null;
  }

  const audioCtx = new AudioContext();
  const master = audioCtx.createGain();
  const bassGain = audioCtx.createGain();
  const leadGain = audioCtx.createGain();
  const padGain = audioCtx.createGain();
  const chordGain = audioCtx.createGain();
  const noiseGain = audioCtx.createGain();
  const fileGain = audioCtx.createGain();
  const lowpass = audioCtx.createBiquadFilter();
  const bassFilter = audioCtx.createBiquadFilter();
  const fileBassFilter = audioCtx.createBiquadFilter();
  const fileVocalFilter = audioCtx.createBiquadFilter();
  const fileVocalNotchLow = audioCtx.createBiquadFilter();
  const fileVocalNotchMid = audioCtx.createBiquadFilter();
  const fileVocalNotchHigh = audioCtx.createBiquadFilter();
  const fileSibilanceFilter = audioCtx.createBiquadFilter();
  const fileAiHighCut = audioCtx.createBiquadFilter();
  const fileNoiseGate = audioCtx.createGain();
  const fileDryGain = audioCtx.createGain();
  const fileVocalCutGain = audioCtx.createGain();
  const fileSplitter = audioCtx.createChannelSplitter(2);
  const fileMerger = audioCtx.createChannelMerger(2);
  const rightInvert = audioCtx.createGain();
  const compressor = audioCtx.createDynamicsCompressor();

  const bassOsc = audioCtx.createOscillator();
  const leadOsc = audioCtx.createOscillator();
  const padOsc = audioCtx.createOscillator();
  const chordOsc = audioCtx.createOscillator();
  const noiseSource = audioCtx.createBufferSource();

  bassOsc.type = "triangle";
  leadOsc.type = "sine";
  padOsc.type = "sine";
  chordOsc.type = "triangle";
  bassFilter.type = "lowshelf";
  bassFilter.frequency.value = 120;
  fileBassFilter.type = "lowshelf";
  fileBassFilter.frequency.value = 120;
  fileVocalFilter.type = "peaking";
  fileVocalFilter.frequency.value = 1200;
  fileVocalFilter.Q.value = 1.3;
  fileVocalNotchLow.type = "peaking";
  fileVocalNotchLow.frequency.value = 350;
  fileVocalNotchLow.Q.value = 1.1;
  fileVocalNotchMid.type = "peaking";
  fileVocalNotchMid.frequency.value = 1800;
  fileVocalNotchMid.Q.value = 1.4;
  fileVocalNotchHigh.type = "peaking";
  fileVocalNotchHigh.frequency.value = 3200;
  fileVocalNotchHigh.Q.value = 1.6;
  fileSibilanceFilter.type = "peaking";
  fileSibilanceFilter.frequency.value = 6500;
  fileSibilanceFilter.Q.value = 2.2;
  fileAiHighCut.type = "lowpass";
  fileAiHighCut.frequency.value = 18000;
  rightInvert.gain.value = -1;
  lowpass.type = "lowpass";
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.24;

  const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.18;
  }
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  bassOsc.connect(bassFilter).connect(bassGain).connect(lowpass);
  leadOsc.connect(leadGain).connect(lowpass);
  padOsc.connect(padGain).connect(lowpass);
  chordOsc.connect(chordGain).connect(lowpass);
  noiseSource.connect(noiseGain).connect(lowpass);
  fileBassFilter
    .connect(fileVocalFilter)
    .connect(fileVocalNotchLow)
    .connect(fileVocalNotchMid)
    .connect(fileVocalNotchHigh)
    .connect(fileSibilanceFilter)
    .connect(fileAiHighCut)
    .connect(fileDryGain)
    .connect(fileNoiseGate);
  fileBassFilter.connect(fileSplitter);
  fileSplitter.connect(fileMerger, 0, 0);
  fileSplitter.connect(fileMerger, 0, 1);
  fileSplitter.connect(rightInvert, 1);
  rightInvert.connect(fileMerger, 0, 0);
  rightInvert.connect(fileMerger, 0, 1);
  fileMerger.connect(fileVocalCutGain).connect(fileNoiseGate);
  fileNoiseGate.connect(fileGain).connect(lowpass);
  lowpass.connect(compressor).connect(master).connect(audioCtx.destination);

  master.gain.value = 0;
  bassOsc.start();
  leadOsc.start();
  padOsc.start();
  chordOsc.start();
  noiseSource.start();

  return {
    ctx: audioCtx,
    master,
    bassGain,
    leadGain,
    padGain,
    chordGain,
    noiseGain,
    fileGain,
    lowpass,
    bassFilter,
    fileBassFilter,
    fileVocalFilter,
    fileVocalNotchLow,
    fileVocalNotchMid,
    fileVocalNotchHigh,
    fileSibilanceFilter,
    fileAiHighCut,
    fileNoiseGate,
    fileDryGain,
    fileVocalCutGain,
    bassOsc,
    leadOsc,
    padOsc,
    chordOsc,
    uploadedSource: null
  };
}

function ensureAudioEngine() {
  if (!audio) {
    audio = createAudioEngine();
  }
  return audio;
}

function modeFrequency(modeName) {
  const roots = {
    running: 49,
    studying: 43.65,
    gym: 46.25,
    lateNight: 41.2
  };
  return roots[modeName];
}

function demoBpm(modeName) {
  return {
    running: 96,
    studying: 78,
    gym: 108,
    lateNight: 72
  }[modeName];
}

function updateAudioMix() {
  if (!audio) {
    return;
  }

  const now = audio.ctx.currentTime;
  const volume = Number(sliders.volume.value) / 100;
  const bass = Number(sliders.bass.value) / 100;
  const vocalSlider = Number(sliders.vocals.value) / 100;
  const vocals = aiVocalRemove ? 0 : vocalSlider;
  const noiseCancel = Number(sliders.noise.value) / 100;
  const smooth = Number(sliders.smooth.value) / 100;
  const root = modeFrequency(currentMode);
  const externalAudioActive = hasUploadedTrack || stemSession.active;
  const synthLevel = externalAudioActive ? 0 : 1;

  audio.master.gain.setTargetAtTime(isPlaying ? Math.max(0.02, volume * 0.72) : 0, now, 0.05);
  audio.bassGain.gain.setTargetAtTime((0.03 + bass * 0.34) * synthLevel, now, 0.08);
  audio.leadGain.gain.setTargetAtTime((0.004 + vocals * 0.1) * synthLevel, now, 0.12);
  audio.padGain.gain.setTargetAtTime((0.08 + smooth * 0.18) * synthLevel, now, 0.18);
  audio.chordGain.gain.setTargetAtTime((0.04 + smooth * 0.12) * synthLevel, now, 0.22);
  audio.noiseGain.gain.setTargetAtTime((1 - noiseCancel) * 0.08 * synthLevel, now, 0.18);
  audio.fileGain.gain.setTargetAtTime(externalAudioActive ? 1 : 0, now, 0.08);
  audio.fileNoiseGate.gain.setTargetAtTime(0.48 + (1 - noiseCancel) * 0.52, now, 0.08);
  audio.fileDryGain.gain.setTargetAtTime(vocals, now, 0.05);
  audio.fileVocalCutGain.gain.setTargetAtTime(aiVocalRemove ? 1.35 : 1 - vocals, now, 0.05);
  audio.bassFilter.gain.setTargetAtTime(-10 + bass * 28, now, 0.08);
  audio.fileBassFilter.gain.setTargetAtTime(-18 + bass * 42, now, 0.05);
  audio.fileVocalFilter.gain.setTargetAtTime(aiVocalRemove ? -48 : -34 + vocals * 46, now, 0.05);
  audio.fileVocalNotchLow.gain.setTargetAtTime(aiVocalRemove ? -18 : 0, now, 0.06);
  audio.fileVocalNotchMid.gain.setTargetAtTime(aiVocalRemove ? -26 : 0, now, 0.06);
  audio.fileVocalNotchHigh.gain.setTargetAtTime(aiVocalRemove ? -22 : 0, now, 0.06);
  audio.fileSibilanceFilter.gain.setTargetAtTime(aiVocalRemove ? -30 : 0, now, 0.06);
  audio.fileAiHighCut.frequency.setTargetAtTime(aiVocalRemove ? 5200 : 18000, now, 0.12);
  audio.lowpass.frequency.setTargetAtTime(650 + (1 - smooth) * 3300, now, 0.16);
  audio.bassOsc.frequency.setTargetAtTime(root, now, 0.04);
  audio.leadOsc.frequency.setTargetAtTime(root * 3 * (currentMode === "studying" ? 0.75 : 1), now, 0.16);
  audio.padOsc.frequency.setTargetAtTime(root * 2, now, 0.24);
  audio.chordOsc.frequency.setTargetAtTime(root * 2.5, now, 0.28);
}

function triggerBeat() {
  if (!audio || !isPlaying) {
    return;
  }

  const now = audio.ctx.currentTime;
  const bass = Number(sliders.bass.value) / 100;
  const smooth = Number(sliders.smooth.value) / 100;
  const kick = audio.ctx.createOscillator();
  const kickGain = audio.ctx.createGain();
  const click = audio.ctx.createOscillator();
  const clickGain = audio.ctx.createGain();

  kick.type = "sine";
  kick.frequency.setValueAtTime(88, now);
  kick.frequency.exponentialRampToValueAtTime(46, now + 0.18);
  kickGain.gain.setValueAtTime(0.0001, now);
  kickGain.gain.exponentialRampToValueAtTime(0.12 + bass * 0.24, now + 0.018);
  kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

  click.type = "triangle";
  click.frequency.value = currentMode === "studying" || currentMode === "lateNight" ? 360 : 520;
  clickGain.gain.setValueAtTime(0.0001, now);
  clickGain.gain.exponentialRampToValueAtTime((1 - smooth) * 0.018, now + 0.012);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  kick.connect(kickGain).connect(audio.lowpass);
  click.connect(clickGain).connect(audio.lowpass);
  kick.start(now);
  click.start(now);
  kick.stop(now + 0.26);
  click.stop(now + 0.06);
}

function restartBeatClock() {
  clearInterval(beatTimer);
  if (!isPlaying || hasUploadedTrack) {
    return;
  }

  const bpm = demoBpm(currentMode);
  const interval = 60000 / bpm;
  triggerBeat();
  beatTimer = setInterval(triggerBeat, interval);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function displayTitle(title) {
  return title.length > 42 ? `${title.slice(0, 39)}...` : title;
}

function showPlayIcon() {
  els.playIcon.innerHTML = isPlaying
    ? '<path d="M8 5h3v14H8zM13 5h3v14h-3z"></path>'
    : '<path d="M8 5v14l11-7Z"></path>';
}

function connectUploadedAudio() {
  const engine = ensureAudioEngine();
  if (!engine || engine.uploadedSource) {
    return;
  }

  engine.uploadedSource = engine.ctx.createMediaElementSource(els.uploadedAudio);
  engine.uploadedSource.connect(engine.fileBassFilter);
}

function cleanupStemSession() {
  Object.values(stemSession.elements).forEach((element) => {
    element.pause();
    element.removeAttribute("src");
  });
  Object.values(stemSession.sources).forEach((source) => source.disconnect());
  Object.values(stemSession.gains).forEach((gain) => gain.disconnect());
  stemSession.masterGain?.disconnect();
  stemSession = {
    active: false,
    elements: {},
    gains: {},
    sources: {},
    masterGain: null
  };
  els.stemMixer.classList.add("hidden");
}

function updateStemGains() {
  const mapping = {
    vocals: stemSliders.stemVocals,
    drums: stemSliders.stemDrums,
    bass: stemSliders.stemBass,
    other: stemSliders.stemOther
  };

  Object.entries(mapping).forEach(([stem, slider]) => {
    const gain = stemSession.gains[stem];
    if (gain && audio) {
      gain.gain.setTargetAtTime(Number(slider.value) / 100, audio.ctx.currentTime, 0.04);
    }
  });
}

function loadStemSession(stems, title) {
  const engine = ensureAudioEngine();
  if (!engine) {
    els.stemStatus.textContent = "This browser does not support Web Audio.";
    return;
  }

  cleanupStemSession();
  els.uploadedAudio.pause();
  hasUploadedTrack = false;
  stemSession.active = true;
  stemSession.masterGain = engine.ctx.createGain();
  stemSession.masterGain.gain.value = 1;
  stemSession.masterGain.connect(engine.lowpass);

  ["vocals", "drums", "bass", "other"].forEach((stem) => {
    const element = new Audio(stems[stem]);
    element.preload = "metadata";
    element.crossOrigin = "anonymous";
    const source = engine.ctx.createMediaElementSource(element);
    const gain = engine.ctx.createGain();
    gain.gain.value = Number(stemSliders[`stem${stem[0].toUpperCase()}${stem.slice(1)}`]?.value || 100) / 100;
    source.connect(gain).connect(stemSession.masterGain);
    stemSession.elements[stem] = element;
    stemSession.sources[stem] = source;
    stemSession.gains[stem] = gain;
  });

  stemSession.elements.vocals.addEventListener("loadedmetadata", () => {
    document.querySelector("#duration").textContent = formatTime(stemSession.elements.vocals.duration);
  });

  stemSession.elements.vocals.addEventListener("ended", () => {
    isPlaying = false;
    showPlayIcon();
    updateAudioMix();
  });

  els.stemMixer.classList.remove("hidden");
  els.trackTitle.textContent = displayTitle(title);
  els.trackArtist.textContent = "Separated stems";
  els.adaptiveLabel.textContent = "Stem mixer active";
  els.stemStatus.textContent = "Stems ready. Use the stem sliders to control each layer.";
  els.elapsed.textContent = "0:00";
  document.querySelector("#duration").textContent = "--:--";
  els.progressFill.style.width = "0%";
  isPlaying = false;
  showPlayIcon();
  updateAudioMix();
  updateStemGains();
}

function waitForStemReadiness() {
  const elements = Object.values(stemSession.elements);
  return Promise.all(elements.map((element) => {
    if (element.readyState >= 2) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        element.removeEventListener("canplay", onReady);
        element.removeEventListener("loadeddata", onReady);
        element.removeEventListener("error", onError);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(element.error?.message || "A stem failed to load."));
      };
      element.addEventListener("canplay", onReady, { once: true });
      element.addEventListener("loadeddata", onReady, { once: true });
      element.addEventListener("error", onError, { once: true });
      element.load();
    });
  }));
}

async function playStemSession() {
  const elements = Object.values(stemSession.elements);
  await waitForStemReadiness();
  const startTime = stemSession.elements.vocals?.currentTime || 0;
  elements.forEach((element) => {
    element.currentTime = startTime;
  });
  await Promise.all(elements.map((element) => element.play()));
}

function pauseStemSession() {
  Object.values(stemSession.elements).forEach((element) => element.pause());
}

function seekStemSession(seconds) {
  Object.values(stemSession.elements).forEach((element) => {
    element.currentTime = Math.max(0, Math.min(element.duration || seconds, seconds));
  });
}

function revokeUploadedTracks() {
  uploadedTracks.forEach((track) => URL.revokeObjectURL(track.url));
  uploadedTracks = [];
}

function updateTrackDisplay() {
  const track = uploadedTracks[currentTrackIndex];
  if (!track) {
    return;
  }

  els.trackTitle.textContent = displayTitle(track.title);
  els.trackArtist.textContent = `Local MP3 ${currentTrackIndex + 1} of ${uploadedTracks.length}`;
  els.adaptiveLabel.textContent = `${modes[currentMode].label} active`;
  els.uploadStatus.textContent = uploadedTracks.length === 1
    ? track.file.name
    : `${uploadedTracks.length} songs loaded`;
}

async function loadUploadedTrack(index, shouldPlay = isPlaying) {
  if (!uploadedTracks.length) {
    return;
  }

  currentTrackIndex = (index + uploadedTracks.length) % uploadedTracks.length;
  const track = uploadedTracks[currentTrackIndex];
  els.uploadedAudio.pause();
  els.uploadedAudio.src = track.url;
  els.uploadedAudio.load();
  els.elapsed.textContent = "0:00";
  document.querySelector("#duration").textContent = "--:--";
  els.progressFill.style.width = "0%";
  updateTrackDisplay();
  renderUploadedQueue();
  updateAudioMix();

  if (shouldPlay) {
    try {
      await els.uploadedAudio.play();
      isPlaying = true;
    } catch (error) {
      isPlaying = false;
      els.uploadStatus.textContent = "Could not play this file. Try another MP3.";
    }
    showPlayIcon();
    updateAudioMix();
  }
}

function skipTrack(direction) {
  if (!hasUploadedTrack || uploadedTracks.length < 2) {
    return;
  }

  loadUploadedTrack(currentTrackIndex + direction, isPlaying);
}

function rewindCurrentTrack() {
  if (stemSession.active) {
    const current = stemSession.elements.vocals?.currentTime || 0;
    seekStemSession(current - 10);
    updateProgress();
    return;
  }

  if (hasUploadedTrack) {
    els.uploadedAudio.currentTime = Math.max(0, els.uploadedAudio.currentTime - 10);
    updateProgress();
    return;
  }

  progress = Math.max(0, progress - 8);
  els.progressFill.style.width = `${progress}%`;
}

function roundedRect(context, x, y, width, height, radius) {
  if (context.roundRect) {
    context.roundRect(x, y, width, height, radius);
    return;
  }

  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
}

function setMixer(values) {
  Object.entries(values).forEach(([key, value]) => {
    sliders[key].value = value;
    sliders[`${key}Value`].textContent = value;
  });
}

function renderQueue(queue) {
  els.queueList.innerHTML = queue.map(([title, artist, bpm]) => `
    <article class="queue-item">
      <div class="queue-left">
        <span class="art" aria-hidden="true"></span>
        <div>
          <div class="queue-title">${title}</div>
          <div class="queue-artist">${artist}</div>
        </div>
      </div>
      <span class="queue-bpm">${bpm}</span>
    </article>
  `).join("");
}

function renderUploadedQueue() {
  els.queueList.innerHTML = uploadedTracks.map((track, index) => `
    <button class="queue-item playlist-item ${index === currentTrackIndex ? "active" : ""}" type="button" data-track-index="${index}">
      <div class="queue-left">
        <span class="art" aria-hidden="true"></span>
        <div>
          <div class="queue-title">${track.title}</div>
          <div class="queue-artist">Local MP3</div>
        </div>
      </div>
      <span class="queue-bpm">${index + 1}/${uploadedTracks.length}</span>
    </button>
  `).join("");
}

function applyMode(modeName) {
  currentMode = modeName;
  const mode = modes[modeName];

  document.querySelectorAll(".mode-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === modeName);
  });

  if (!hasUploadedTrack) {
    els.trackTitle.textContent = mode.track[0];
    els.trackArtist.textContent = mode.track[1];
    els.adaptiveLabel.textContent = mode.label;
  } else {
    els.adaptiveLabel.textContent = `${mode.label} active`;
  }
  els.modeTitle.textContent = mode.title;
  els.modeDescription.textContent = mode.description;
  els.bpmBadge.textContent = mode.bpm;
  els.workoutPicker.classList.toggle("hidden", modeName !== "gym");
  setMixer(mode.mixer);
  if (hasUploadedTrack) {
    renderUploadedQueue();
  } else {
    renderQueue(mode.queue);
  }
  updateAudioMix();
  restartBeatClock();
}

function drawVisualizer() {
  const width = els.canvas.width;
  const height = els.canvas.height;
  const mode = modes[currentMode];
  const volume = Number(sliders.volume.value) / 100;
  const bass = Number(sliders.bass.value) / 100;
  const smooth = Number(sliders.smooth.value) / 100;
  const intensity = isPlaying ? 1 : 0.36;

  tick += 0.018 + bass * 0.012;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#111316");
  bg.addColorStop(0.55, "#17100f");
  bg.addColorStop(1, "#0d1516");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 84; i += 1) {
    const x = (i / 83) * width;
    const wave = Math.sin(tick * 2.2 + i * 0.38) * 42 * intensity * volume;
    const pulse = Math.cos(tick * 1.4 + i * 0.12) * 82 * intensity * bass;
    const barHeight = 40 + Math.abs(wave + pulse) + smooth * 18;
    const y = height / 2 - barHeight / 2 + Math.sin(i * 0.22 + tick) * 18;

    ctx.fillStyle = i % 3 === 0 ? mode.colorA : mode.colorB;
    ctx.globalAlpha = 0.18 + intensity * 0.38;
    ctx.beginPath();
    roundedRect(ctx, x, y, 4, barHeight, 6);
    ctx.fill();
  }

  const orb = ctx.createRadialGradient(width * 0.5, height * 0.48, 20, width * 0.5, height * 0.48, width * 0.42);
  orb.addColorStop(0, `${mode.colorA}bb`);
  orb.addColorStop(0.32, `${mode.colorB}44`);
  orb.addColorStop(1, "transparent");
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(width * 0.5, height * 0.48, width * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  requestAnimationFrame(drawVisualizer);
}

function updateProgress() {
  if (stemSession.active && stemSession.elements.vocals?.duration) {
    const element = stemSession.elements.vocals;
    const percent = (element.currentTime / element.duration) * 100;
    els.elapsed.textContent = formatTime(element.currentTime);
    els.progressFill.style.width = `${Math.min(100, percent)}%`;
    return;
  }

  if (hasUploadedTrack && els.uploadedAudio.duration) {
    const percent = (els.uploadedAudio.currentTime / els.uploadedAudio.duration) * 100;
    els.elapsed.textContent = formatTime(els.uploadedAudio.currentTime);
    els.progressFill.style.width = `${Math.min(100, percent)}%`;
    return;
  }

  if (isPlaying) {
    progress = (progress + 0.12) % 100;
    const seconds = Math.floor(72 + progress * 1.56);
    els.elapsed.textContent = formatTime(seconds);
    els.progressFill.style.width = `${progress}%`;
  }
}

document.querySelectorAll(".mode-card").forEach((button) => {
  button.addEventListener("click", () => applyMode(button.dataset.mode));
});

document.querySelectorAll(".workout-picker button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".workout-picker button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    setMixer({ ...modes.gym.mixer, ...workoutMixes[button.dataset.workout] });
    updateAudioMix();
  });
});

Object.keys(sliders).forEach((key) => {
  if (!key.endsWith("Value")) {
    sliders[key].addEventListener("input", () => {
      if (key === "vocals" && Number(sliders[key].value) > 0) {
        aiVocalRemove = false;
        els.aiVocalButton.classList.remove("active");
        els.aiVocalStatus.textContent = "Manual vocal level active.";
      }
      sliders[`${key}Value`].textContent = sliders[key].value;
      updateAudioMix();
    });
  }
});

Object.keys(stemSliders).forEach((key) => {
  if (!key.endsWith("Value")) {
    stemSliders[key].addEventListener("input", () => {
      stemSliders[`${key}Value`].textContent = stemSliders[key].value;
      updateStemGains();
    });
  }
});

els.autoTuneButton.addEventListener("click", () => {
  aiVocalRemove = false;
  els.aiVocalButton.classList.remove("active");
  els.aiVocalStatus.textContent = "For uploaded stereo MP3s.";
  setMixer(modes[currentMode].mixer);
  updateAudioMix();
});

els.aiVocalButton.addEventListener("click", () => {
  if (!hasUploadedTrack) {
    els.aiVocalStatus.textContent = "Upload an MP3 first, then run vocal remove.";
    return;
  }

  aiVocalRemove = !aiVocalRemove;
  els.aiVocalButton.classList.toggle("active", aiVocalRemove);
  if (aiVocalRemove) {
    sliders.vocals.value = 0;
    sliders.vocalsValue.textContent = 0;
    els.aiVocalStatus.textContent = "Max removal on. Lyrics should drop hard, but the track may sound darker.";
  } else {
    sliders.vocals.value = modes[currentMode].mixer.vocals;
    sliders.vocalsValue.textContent = sliders.vocals.value;
    els.aiVocalStatus.textContent = "Vocal remove off.";
  }
  updateAudioMix();
});

els.separateStemsButton.addEventListener("click", async () => {
  const track = uploadedTracks[currentTrackIndex];
  if (!track) {
    els.stemStatus.textContent = "Upload an MP3 first.";
    return;
  }

  cleanupStemSession();
  isPlaying = false;
  showPlayIcon();
  els.uploadedAudio.pause();
  els.stemStatus.textContent = "Separating stems. This can take a few minutes locally.";
  els.separateStemsButton.disabled = true;

  try {
    const body = new FormData();
    body.append("audio", track.file);
    const response = await fetch("/api/stem-separate", {
      method: "POST",
      body
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Stem separation failed.");
    }

    loadStemSession(result.stems, result.title || track.title);
  } catch (error) {
    els.stemStatus.textContent = `${error.message} Run the local stem server with Demucs installed.`;
  } finally {
    els.separateStemsButton.disabled = false;
  }
});

els.fileInput.addEventListener("change", () => {
  const files = Array.from(els.fileInput.files).filter((file) => file.type.startsWith("audio/") || /\.mp3$/i.test(file.name));
  if (!files.length) {
    return;
  }

  els.uploadedAudio.pause();
  cleanupStemSession();
  revokeUploadedTracks();
  uploadedTracks = files.map((file) => ({
    file,
    title: file.name.replace(/\.[^/.]+$/, ""),
    url: URL.createObjectURL(file)
  }));
  currentTrackIndex = 0;
  hasUploadedTrack = true;
  els.aiVocalStatus.textContent = "Ready for AI Vocal Remove.";
  isPlaying = false;
  clearInterval(beatTimer);
  connectUploadedAudio();
  loadUploadedTrack(0, false);
  showPlayIcon();
  updateAudioMix();
});

els.uploadedAudio.addEventListener("loadedmetadata", () => {
  document.querySelector("#duration").textContent = formatTime(els.uploadedAudio.duration);
});

els.uploadedAudio.addEventListener("ended", () => {
  if (uploadedTracks.length > 1) {
    loadUploadedTrack(currentTrackIndex + 1, true);
    return;
  }

  isPlaying = false;
  showPlayIcon();
  updateAudioMix();
});

els.previousButton.addEventListener("click", () => {
  if (hasUploadedTrack && els.uploadedAudio.currentTime > 3) {
    els.uploadedAudio.currentTime = 0;
    updateProgress();
    return;
  }

  skipTrack(-1);
});

els.rewindButton.addEventListener("click", rewindCurrentTrack);
els.nextButton.addEventListener("click", () => skipTrack(1));

els.queueList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-track-index]");
  if (!item) {
    return;
  }

  loadUploadedTrack(Number(item.dataset.trackIndex), isPlaying);
});

els.playButton.addEventListener("click", async () => {
  ensureAudioEngine();

  if (audio && audio.ctx.state === "suspended") {
    await audio.ctx.resume();
  }

  isPlaying = !isPlaying;
  if (stemSession.active) {
    if (isPlaying) {
      try {
        await playStemSession();
      } catch (error) {
        isPlaying = false;
        els.stemStatus.textContent = `Could not play separated stems: ${error.message}`;
      }
    } else {
      pauseStemSession();
    }
  } else if (hasUploadedTrack) {
    if (isPlaying) {
      try {
        await els.uploadedAudio.play();
      } catch (error) {
        isPlaying = false;
        els.uploadStatus.textContent = "Could not play this file. Try another MP3.";
      }
    } else {
      els.uploadedAudio.pause();
    }
  }

  updateAudioMix();
  restartBeatClock();
  showPlayIcon();
});

applyMode(currentMode);
drawVisualizer();
setInterval(updateProgress, 300);
