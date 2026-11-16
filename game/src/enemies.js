// Enemies: what each kind is, how it moves, and how waves are dealt out.
// An enemy is a plain object; its kind names its tuning in config.js and its
// behaviour switch below. The boss gets its own timers for summons and bursts.

import { ENEMY_KINDS, FIELD, LANTERN, ORB } from './config.js';
import { pick } from './random.js';

let nextId = 1;

export function makeEnemy(kind, x, y) {
  const tune = ENEMY_KINDS[kind];
  return {
    id: nextId,
    kind,
    x,
    y,
    hp: tune.hp,
    maxHp: tune.hp,
    speed: tune.speed,
    radius: tune.radius,
    score: tune.score,
    embers: tune.embers,
    flame: tune.flame,
    color: tune.color,
    hitFlash: 0,
    // Spitters keep their distance and shoot; the boss keeps its own clocks.
    shootTimer: 1.5 + Math.random() * 1.5,
    summonTimer: 4,
    burstTimer: 5,
    wobble: Math.random() * Math.PI * 2,
  };
}

/** A spawn point on the field edge, away from the player. */
export function edgeSpawn(rng, player) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const side = Math.floor(rng() * 4);
    const margin = 24;
    let x;
    let y;
    if (side === 0) {
      x = margin + rng() * (FIELD.width - margin * 2);
      y = margin;
    } else if (side === 1) {
      x = margin + rng() * (FIELD.width - margin * 2);
      y = FIELD.height - margin;
    } else if (side === 2) {
      x = margin;
      y = margin + rng() * (FIELD.height - margin * 2);
    } else {
      x = FIELD.width - margin;
      y = margin + rng() * (FIELD.height - margin * 2);
    }
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx * dx + dy * dy > 240 * 240) return { x, y };
  }
  return { x: 30, y: 30 };
}

/**
 * Deal a wave's roster into a shuffled spawn queue. The queue is drained one
 * enemy per spawn interval so a wave arrives as a stream, not a wall.
 */
export function buildSpawnQueue(rng, counts) {
  const queue = [];
  for (const [kind, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i += 1) queue.push(kind);
  }
  // Shuffle, but keep the boss (if any) first: the wave opens on it.
  const bossIndex = queue.indexOf('boss');
  const shuffled = [];
  const rest = queue.filter((kind) => kind !== 'boss');
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = rest[i];
    rest[i] = rest[j];
    rest[j] = tmp;
  }
  if (bossIndex !== -1) shuffled.push('boss');
  return shuffled.concat(rest);
}

function steerToward(enemy, tx, ty, dt) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.x += (dx / dist) * enemy.speed * dt;
  enemy.y += (dy / dist) * enemy.speed * dt;
}

/**
 * Advance one enemy one tick. Returns events the world must handle:
 * orbs the spitter fired, wisps the boss summoned, a radial burst, or the
 * enemy reaching the lantern.
 */
export function updateEnemy(enemy, world, dt) {
  const events = { orbs: [], summons: [], burst: false, reachedLantern: false };
  const lanternDx = LANTERN.x - enemy.x;
  const lanternDy = LANTERN.y - enemy.y;
  const lanternDist = Math.hypot(lanternDx, lanternDy);
  enemy.wobble += dt * 3;
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

  if (enemy.kind === 'spitter') {
    // Hold a ring around the lantern and shoot dark orbs at the player.
    const want = 250;
    if (lanternDist > want + 30) steerToward(enemy, LANTERN.x, LANTERN.y, dt);
    else if (lanternDist < want - 30) {
      const dx = enemy.x - LANTERN.x;
      const dy = enemy.y - LANTERN.y;
      const dist = Math.hypot(dx, dy) || 1;
      enemy.x += (dx / dist) * enemy.speed * 0.6 * dt;
      enemy.y += (dy / dist) * enemy.speed * 0.6 * dt;
    } else {
      enemy.x += Math.cos(enemy.wobble) * 22 * dt;
      enemy.y += Math.sin(enemy.wobble * 0.7) * 22 * dt;
    }
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0) {
      enemy.shootTimer = 2.6;
      const dx = world.player.x - enemy.x;
      const dy = world.player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      events.orbs.push({
        x: enemy.x,
        y: enemy.y,
        vx: (dx / dist) * ORB.speed,
        vy: (dy / dist) * ORB.speed,
        radius: ORB.radius,
        damage: ORB.damage,
        life: 6,
      });
    }
  } else if (enemy.kind === 'boss') {
    steerToward(enemy, LANTERN.x, LANTERN.y, dt);
    enemy.summonTimer -= dt;
    if (enemy.summonTimer <= 0) {
      enemy.summonTimer = 6;
      for (let i = 0; i < 3; i += 1) {
        const angle = (i / 3) * Math.PI * 2 + enemy.wobble;
        events.summons.push({
          kind: 'wisp',
          x: enemy.x + Math.cos(angle) * 60,
          y: enemy.y + Math.sin(angle) * 60,
        });
      }
    }
    enemy.burstTimer -= dt;
    if (enemy.burstTimer <= 0) {
      enemy.burstTimer = 5;
      events.burst = true;
    }
  } else {
    // Wisps weave; shades and brutes walk straight at the lantern.
    if (enemy.kind === 'wisp') {
      const weave = Math.sin(enemy.wobble * 2) * 40;
      const px = LANTERN.x + weave * 0.4;
      steerToward(enemy, px, LANTERN.y, dt);
    } else {
      steerToward(enemy, LANTERN.x, LANTERN.y, dt);
    }
  }

  // Keep enemies inside the field and off each other lightly.
  enemy.x = Math.max(enemy.radius, Math.min(FIELD.width - enemy.radius, enemy.x));
  enemy.y = Math.max(enemy.radius, Math.min(FIELD.height - enemy.radius, enemy.y));

  if (lanternDist <= LANTERN.radius + enemy.radius * 0.5) {
    events.reachedLantern = true;
  }
  return events;
}

/** A random enemy kind for ambient title-screen drifters. */
export function ambientKind(rng) {
  return pick(rng, ['wisp', 'wisp', 'shade']);
}
