// All sound in Lumenfall is synthesised with WebAudio: no audio files ship
// with the game. Short effects are one-shot oscillator/noise envelopes; the
// music is a slow ambient pad whose chord changes every few bars. Everything
// is guarded so the game plays silently (never throws) where audio is
// unavailable, such as a headless screenshot run.

let context = null;
let master = null;
let musicNodes = null;
let muted = false;

function ensureContext() {
  if (context) return context;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = 0.5;
  master.connect(context.destination);
  return context;
}

/** Call from the first user gesture; browsers block audio before one. */
export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  startMusic();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function blip({ type = 'sine', from = 440, to = 440, seconds = 0.12, volume = 0.2, when = 0 }) {
  const ctx = ensureContext();
  if (!ctx || muted) return;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + seconds + 0.02);
}

function burst({ seconds = 0.25, volume = 0.25, lowpass = 1200, when = 0 }) {
  const ctx = ensureContext();
  if (!ctx || muted) return;
  const start = ctx.currentTime + when;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, seconds);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(start);
  source.stop(start + seconds + 0.02);
}

export const sfx = {
  shoot() {
    blip({ type: 'square', from: 880, to: 420, seconds: 0.07, volume: 0.08 });
  },
  hit() {
    burst({ seconds: 0.08, volume: 0.12, lowpass: 2400 });
  },
  enemyDie() {
    burst({ seconds: 0.28, volume: 0.22, lowpass: 900 });
    blip({ type: 'triangle', from: 220, to: 55, seconds: 0.22, volume: 0.16 });
  },
  playerHurt() {
    blip({ type: 'sawtooth', from: 180, to: 60, seconds: 0.25, volume: 0.22 });
    burst({ seconds: 0.18, volume: 0.14, lowpass: 700 });
  },
  lanternHit() {
    blip({ type: 'sine', from: 140, to: 45, seconds: 0.4, volume: 0.3 });
  },
  pickup() {
    blip({ type: 'sine', from: 660, to: 990, seconds: 0.09, volume: 0.12 });
  },
  heart() {
    blip({ type: 'sine', from: 520, to: 780, seconds: 0.12, volume: 0.14 });
    blip({ type: 'sine', from: 780, to: 1040, seconds: 0.14, volume: 0.12, when: 0.09 });
  },
  dash() {
    burst({ seconds: 0.16, volume: 0.1, lowpass: 3200 });
  },
  waveHorn() {
    blip({ type: 'sawtooth', from: 196, to: 196, seconds: 0.5, volume: 0.1 });
    blip({ type: 'sawtooth', from: 294, to: 294, seconds: 0.5, volume: 0.08, when: 0.02 });
  },
  upgrade() {
    [523, 659, 784].forEach((freq, i) => {
      blip({ type: 'sine', from: freq, to: freq, seconds: 0.22, volume: 0.12, when: i * 0.08 });
    });
  },
  bossRoar() {
    blip({ type: 'sawtooth', from: 90, to: 40, seconds: 0.9, volume: 0.28 });
    burst({ seconds: 0.7, volume: 0.2, lowpass: 500 });
  },
  victory() {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      blip({ type: 'triangle', from: freq, to: freq, seconds: 0.4, volume: 0.14, when: i * 0.11 });
    });
  },
  gameOver() {
    [392, 330, 262, 196].forEach((freq, i) => {
      blip({ type: 'triangle', from: freq, to: freq * 0.94, seconds: 0.5, volume: 0.14, when: i * 0.16 });
    });
  },
};

// A slow two-oscillator pad that drifts through a minor chord set. It starts
// once, stays quiet, and never needs a file.
const CHORDS = [
  [110.0, 164.81, 220.0],
  [98.0, 146.83, 196.0],
  [87.31, 130.81, 174.61],
  [103.83, 155.56, 207.65],
];

function startMusic() {
  const ctx = ensureContext();
  if (!ctx || muted || musicNodes) return;
  const padGain = ctx.createGain();
  padGain.gain.value = 0.045;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 640;
  filter.connect(padGain);
  padGain.connect(master);
  const oscillators = CHORDS[0].map((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 8;
    osc.connect(filter);
    osc.start();
    return osc;
  });
  musicNodes = { oscillators, filter, chord: 0 };
  const stepChord = () => {
    if (!musicNodes) return;
    musicNodes.chord = (musicNodes.chord + 1) % CHORDS.length;
    const chord = CHORDS[musicNodes.chord];
    musicNodes.oscillators.forEach((osc, i) => {
      osc.frequency.linearRampToValueAtTime(chord[i], ctx.currentTime + 2.5);
    });
    musicNodes.timer = window.setTimeout(stepChord, 9000);
  };
  musicNodes.timer = window.setTimeout(stepChord, 9000);
}
