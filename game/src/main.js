// Lumenfall boot and main loop. The loop runs the world at a fixed 60 Hz
// step and draws every animation frame. Clicks and keys move between the
// screens; ?shot=start|play|draft|end&seed=N stages one deterministic scene
// for a screenshot and stops (window.__shotReady tells the renderer it is
// safe to capture).

import { FIELD, STEP } from './config.js';
import { createInput, attachInput, consumeKey, endTick } from './input.js';
import { createWorld, stepWorld, startGame, chooseDraft, resetWorld, SCREEN_TITLE, SCREEN_PLAY, SCREEN_DRAFT, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN } from './world.js';
import { render, computeView } from './render.js';
import { stageShot } from './shots.js';
import { unlockAudio, toggleMute } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || 1) >>> 0;

const input = createInput();
attachInput(input, canvas);
const world = createWorld(shotSeed);
world.best = Number(localStorage.getItem('lumenfall-best') || 0);
// A debug handle for play-testing (read-only from the console).
window.__lumenfall = { world, input };

let view = computeView(window.innerWidth, window.innerHeight);
let mouse = null;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  view = computeView(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

canvas.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
});

/** Convert the mouse position into world units for aiming. */
function aimFromMouse() {
  if (!mouse) return { x: FIELD.width / 2, y: FIELD.height / 2 - 100 };
  return {
    x: (mouse.x - view.offsetX) / view.scale,
    y: (mouse.y - view.offsetY) / view.scale,
  };
}

/** Which draft card (if any) sits under the mouse. Mirrors render.js layout. */
function draftCardAt(x, y) {
  const cardW = 220;
  const cardH = 190;
  const gap = 26;
  const total = cardW * 3 + gap * 2;
  const startX = (window.innerWidth - total) / 2;
  const top = window.innerHeight * 0.36;
  if (y < top || y > top + cardH) return -1;
  for (let i = 0; i < 3; i += 1) {
    const left = startX + i * (cardW + gap);
    if (x >= left && x <= left + cardW) return i;
  }
  return -1;
}

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

canvas.addEventListener('pointerdown', () => {
  unlockAudio();
  if (world.screen === SCREEN_TITLE) {
    startGame(world);
    announce('Wave 1. Defend the lantern.');
  } else if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
    startGame(world);
    announce('Wave 1. Defend the lantern.');
  } else if (world.screen === SCREEN_PAUSE) {
    world.screen = SCREEN_PLAY;
  } else if (world.screen === SCREEN_DRAFT && mouse) {
    const card = draftCardAt(mouse.x, mouse.y);
    if (card >= 0) chooseDraft(world, card);
  }
});

function handleKeys() {
  if (consumeKey(input, 'KeyM')) {
    const muted = toggleMute();
    announce(muted ? 'Sound muted.' : 'Sound on.');
  }
  if (world.screen === SCREEN_PLAY) {
    if (consumeKey(input, 'KeyP') || consumeKey(input, 'Escape')) {
      world.screen = SCREEN_PAUSE;
      announce('Paused.');
    }
  } else if (world.screen === SCREEN_PAUSE) {
    if (consumeKey(input, 'KeyP') || consumeKey(input, 'Escape')) {
      world.screen = SCREEN_PLAY;
      announce('Back to the fight.');
    }
  } else if (world.screen === SCREEN_DRAFT) {
    for (const [index, code] of ['Digit1', 'Digit2', 'Digit3'].entries()) {
      if (consumeKey(input, code)) {
        chooseDraft(world, index);
        break;
      }
    }
    if (mouse) {
      const hovered = draftCardAt(mouse.x, mouse.y);
      if (hovered >= 0) world.draftIndex = hovered;
    }
  } else if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
    if (consumeKey(input, 'KeyR')) startGame(world);
  } else if (world.screen === SCREEN_TITLE) {
    if (consumeKey(input, 'Enter') || consumeKey(input, 'Space')) {
      unlockAudio();
      startGame(world);
    }
  }
  // Clear the rest of this tick's presses so a held key does not repeat.
  input.pressedKeys.clear();
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  accumulator += elapsed;
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    const aim = aimFromMouse();
    input.aimWorldX = aim.x;
    input.aimWorldY = aim.y;
    handleKeys();
    stepWorld(world, input, STEP);
    endTick(input);
    accumulator -= STEP;
    steps += 1;
  }
  if (steps === 5) accumulator = 0;
  render(ctx, world, view, world.screen === SCREEN_PLAY ? mouse : null);
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && world.screen === SCREEN_PLAY) world.screen = SCREEN_PAUSE;
});

if (shotName) {
  // Deterministic screenshot mode: stage the scene, draw once, stop.
  const staged = stageShot(shotName, world, shotSeed);
  world.screen = staged.screen;
  world.best = staged.best;
  render(ctx, world, view, null);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
