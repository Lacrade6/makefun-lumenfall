// The screenshot scenes behind ?shot=start|play|draft|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot, so the frame is what a short game really looks like
// and the same seed always gives the same frame. Staging runs with
// Math.random replaced by a seeded generator, so the same URL always draws
// the same frame (the live game never calls this file).

import { FIELD, LANTERN, STEP, TITLE_AMBIENT_SECONDS } from './config.js';
import { makeRng } from './random.js';
import { startGame, stepWorld, chooseDraft, SCREEN_TITLE, SCREEN_PLAY, SCREEN_DRAFT, SCREEN_OVER } from './world.js';

const WAVE2_PLAY_SECONDS = 18;
const DRAFT_LIMIT_SECONDS = 240;
const END_LIMIT_SECONDS = 600;

/** A blank live-input snapshot the autopilot fills each tick. */
function blankInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    firing: false,
    dashQueued: false,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    pressedKeys: new Set(),
    aimWorldX: FIELD.width / 2,
    aimWorldY: FIELD.height / 2 - 100,
  };
}

function nearestEnemy(world) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of world.enemies) {
    const dx = enemy.x - world.player.x;
    const dy = enemy.y - world.player.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }
  return best;
}

/**
 * Steer the warden: keep a little distance from the nearest shade, drift
 * back toward the lantern's light, and shoot at whatever is closest.
 * `skill` 1 plays well (dashes out of trouble); 0 stands still and never
 * fires, so the dark eventually takes the lantern.
 */
function autopilot(world, skill) {
  const input = blankInput();
  if (skill === 0) return input;
  const player = world.player;
  const threat = nearestEnemy(world);
  let mx = 0;
  let my = 0;
  if (threat) {
    const dx = player.x - threat.x;
    const dy = player.y - threat.y;
    const dist = Math.hypot(dx, dy) || 1;
    const want = 190;
    if (dist < want) {
      mx += dx / dist;
      my += dy / dist;
    }
    input.aimWorldX = threat.x;
    input.aimWorldY = threat.y;
    input.firing = true;
  } else {
    // Nothing close: drift toward the lantern and watch the edges.
    mx += (LANTERN.x - player.x) / FIELD.width;
    my += (LANTERN.y - player.y) / FIELD.height;
    input.aimWorldX = LANTERN.x;
    input.aimWorldY = LANTERN.y - 160;
    input.firing = false;
  }
  // Never stand on the lantern's edge: give it room.
  const ldx = player.x - LANTERN.x;
  const ldy = player.y - LANTERN.y;
  const ldist = Math.hypot(ldx, ldy) || 1;
  if (ldist < 90) {
    mx += (ldx / ldist) * 0.8;
    my += (ldy / ldist) * 0.8;
  }
  const len = Math.hypot(mx, my);
  if (len > 0.01) {
    input.left = mx < -0.2;
    input.right = mx > 0.2;
    input.up = my < -0.2;
    input.down = my > 0.2;
  }
  if (threat) {
    const dx = player.x - threat.x;
    const dy = player.y - threat.y;
    if (dx * dx + dy * dy < 70 * 70) input.dashQueued = true;
  }
  return input;
}

/**
 * Stage the world into the named scene and return the screen to draw.
 * Any unknown name stages the title.
 */
export function stageShot(name, world, seed) {
  const realRandom = Math.random;
  Math.random = makeRng(seed * 7919 + 13);
  try {
    return stageShotSeeded(name, world, seed);
  } finally {
    Math.random = realRandom;
  }
}

function stageShotSeeded(name, world, seed) {
  if (name === 'play' || name === 'draft' || name === 'end') {
    startGame(world, seed);
    const limit = name === 'end' ? END_LIMIT_SECONDS : DRAFT_LIMIT_SECONDS;
    const skill = name === 'end' ? 0 : 1;
    const steps = Math.floor(limit / STEP);
    let wave2Time = 0;
    for (let i = 0; i < steps; i += 1) {
      if (world.screen === SCREEN_OVER) break;
      if (world.screen === SCREEN_DRAFT) {
        if (name === 'draft') break;
        // Keep the run going: take the first blessing and fight on.
        chooseDraft(world, 0);
        continue;
      }
      if (name === 'play' && world.wave === 2) {
        wave2Time += STEP;
        if (wave2Time >= WAVE2_PLAY_SECONDS) break;
      }
      stepWorld(world, autopilot(world, skill), STEP);
    }
    if (name === 'draft' && world.screen !== SCREEN_DRAFT) {
      return { screen: SCREEN_PLAY, best: world.best };
    }
    if (name === 'end' && world.screen !== SCREEN_OVER) {
      return { screen: SCREEN_PLAY, best: world.best };
    }
    return { screen: world.screen, best: world.best };
  }
  // Title: let the ambient drifters wander a while behind the menu.
  const steps = Math.floor(TITLE_AMBIENT_SECONDS / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(world, blankInput(), STEP);
  return { screen: SCREEN_TITLE, best: world.best };
}
