// The world: everything the rules touch. One fixed-step function advances
// the simulation; rendering reads the state and never mutates it. The screens
// (title, playing, draft, paused, over, victory) are states of this same
// object, so the screenshot stager can drive it with the autopilot.

import { FIELD, LANTERN, ORB, PICKUP, STEP, WIN_WAVE, wavePlan } from './config.js';
import { makeRng } from './random.js';
import { makePlayer, movePlayer, firePlayer, playerDamage, playerPierce, playerCritChance, playerBulletRadius, playerPickupRadius } from './player.js';
import { makeEnemy, edgeSpawn, buildSpawnQueue, updateEnemy, ambientKind } from './enemies.js';
import { dealDraft, applyUpgrade } from './upgrades.js';
import { createEffects, spawnBurst, spawnText, spawnRing, addShake, addFlash, updateEffects, spawnEmberTrail } from './particles.js';
import { sfx } from './audio.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'playing';
export const SCREEN_DRAFT = 'draft';
export const SCREEN_PAUSE = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'victory';

export function createWorld(seed) {
  const world = {
    rng: makeRng(seed),
    seed,
    screen: SCREEN_TITLE,
    time: 0,
    player: makePlayer(),
    enemies: [],
    bullets: [],
    orbs: [],
    pickups: [],
    effects: createEffects(),
    wave: 0,
    score: 0,
    best: 0,
    flame: LANTERN.maxFlame,
    kills: 0,
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 1,
    breather: 0,
    banner: '',
    bannerTimer: 0,
    draft: [],
    draftIndex: 0,
    ambient: [],
    muted: false,
    stats: { shots: 0, hits: 0, dashes: 0 },
  };
  seedAmbient(world);
  return world;
}

function seedAmbient(world) {
  world.ambient = [];
  for (let i = 0; i < 7; i += 1) {
    const kind = ambientKind(world.rng);
    const enemy = makeEnemy(kind, world.rng() * FIELD.width, world.rng() * FIELD.height);
    enemy.ambient = true;
    world.ambient.push(enemy);
  }
}

export function resetWorld(world, seed) {
  const fresh = createWorld(seed);
  for (const key of Object.keys(fresh)) world[key] = fresh[key];
}

function setBanner(world, text, seconds = 2.2) {
  world.banner = text;
  world.bannerTimer = seconds;
}

export function startGame(world, seed) {
  resetWorld(world, seed === undefined ? (Math.random() * 0xffffffff) >>> 0 : seed);
  world.screen = SCREEN_PLAY;
  world.best = Number(localStorage.getItem('lumenfall-best') || 0);
  startWave(world, 1);
}

function startWave(world, wave) {
  world.wave = wave;
  const plan = wavePlan(wave);
  world.spawnQueue = buildSpawnQueue(world.rng, plan.counts);
  world.spawnInterval = plan.interval;
  world.spawnTimer = 0.8;
  setBanner(world, wave >= WIN_WAVE ? 'THE HOLLOW KING AWAKENS' : `WAVE ${wave}`, 2.4);
  if (wave >= WIN_WAVE) sfx.bossRoar();
  else sfx.waveHorn();
}

function openDraft(world) {
  world.screen = SCREEN_DRAFT;
  world.draft = dealDraft(world.rng, world.player);
  world.draftIndex = 0;
  sfx.upgrade();
}

export function chooseDraft(world, index) {
  const upgrade = world.draft[index];
  if (!upgrade) return;
  applyUpgrade(world.player, world, upgrade);
  spawnText(world.effects, world.player.x, world.player.y - 30, upgrade.name, '#ffe27a', 17);
  startWave(world, world.wave + 1);
  world.screen = SCREEN_PLAY;
}

function endGame(world, won) {
  world.screen = won ? SCREEN_WIN : SCREEN_OVER;
  if (won) {
    world.score += 500;
    sfx.victory();
  } else {
    sfx.gameOver();
  }
  if (world.score > world.best) {
    world.best = world.score;
    try {
      localStorage.setItem('lumenfall-best', String(world.best));
    } catch {
      // Storage unavailable (private mode, headless): best still shows.
    }
  }
}

function damageEnemy(world, enemy, amount, crit) {
  enemy.hp -= amount;
  enemy.hitFlash = 0.12;
  spawnText(world.effects, enemy.x, enemy.y - enemy.radius - 6, String(Math.round(amount)), crit ? '#ffd23e' : '#f4ead8', crit ? 18 : 13);
  if (enemy.hp <= 0) killEnemy(world, enemy);
  else sfx.hit();
}

function killEnemy(world, enemy) {
  const index = world.enemies.indexOf(enemy);
  if (index !== -1) world.enemies.splice(index, 1);
  world.score += enemy.score;
  world.kills += 1;
  spawnBurst(world.effects, enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 60 : 16, 260, 0.7, 4);
  spawnRing(world.effects, enemy.x, enemy.y, enemy.color, enemy.radius * 3);
  addShake(world.effects, enemy.kind === 'boss' ? 12 : 3);
  sfx.enemyDie();
  for (let i = 0; i < enemy.embers; i += 1) {
    const angle = world.rng() * Math.PI * 2;
    world.pickups.push({
      kind: 'ember',
      x: enemy.x + Math.cos(angle) * 10,
      y: enemy.y + Math.sin(angle) * 10,
      vx: Math.cos(angle) * 60,
      vy: Math.sin(angle) * 60,
      value: PICKUP.emberScore,
      life: 14,
    });
  }
  const dropsHeart = enemy.kind === 'brute' || enemy.kind === 'boss' || world.rng() < PICKUP.heartChance;
  if (dropsHeart && enemy.kind !== 'boss') {
    world.pickups.push({
      kind: 'heart',
      x: enemy.x,
      y: enemy.y,
      vx: 0,
      vy: 0,
      value: PICKUP.heartHeal,
      life: 12,
    });
  }
  if (enemy.kind === 'boss') {
    spawnBurst(world.effects, enemy.x, enemy.y, '#ffd98a', 80, 320, 1.1, 5);
    addFlash(world.effects, 0.5);
  }
}

function hurtPlayer(world, amount) {
  const player = world.player;
  if (player.invulnerable > 0 || player.dashTimer > 0) return;
  player.hp -= amount;
  player.invulnerable = 0.5;
  addShake(world.effects, 7);
  addFlash(world.effects, 0.25);
  spawnBurst(world.effects, player.x, player.y, '#ff5d73', 12, 200, 0.5, 3);
  sfx.playerHurt();
  if (player.hp <= 0) {
    player.hp = 0;
    endGame(world, false);
  }
}

function hurtLantern(world, amount) {
  world.flame -= amount;
  addFlash(world.effects, 0.3);
  spawnBurst(world.effects, LANTERN.x, LANTERN.y, '#ff9d5c', 14, 180, 0.6, 3);
  sfx.lanternHit();
  if (world.flame <= 0) {
    world.flame = 0;
    endGame(world, false);
  }
}

function fireBullets(world) {
  const player = world.player;
  firePlayer(player, world.input, STEP, (angle) => {
    const speed = 540;
    const crit = world.rng() < playerCritChance(player);
    world.bullets.push({
      x: player.x + Math.cos(angle) * (player.radius + 6),
      y: player.y + Math.sin(angle) * (player.radius + 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: playerBulletRadius(player),
      damage: playerDamage(player) * (crit ? 2 : 1),
      crit,
      pierceLeft: playerPierce(player),
      hitIds: new Set(),
      life: 1.4,
    });
    world.stats.shots += 1;
    sfx.shoot();
  });
}

function stepPlaying(world, input, dt) {
  const player = world.player;
  player.aimX = input.aimWorldX;
  player.aimY = input.aimWorldY;
  const dashed = movePlayer(player, input, dt);
  if (dashed) {
    world.stats.dashes += 1;
    sfx.dash();
    spawnBurst(world.effects, player.x, player.y, '#b9a8ff', 8, 120, 0.35, 3);
  }
  fireBullets(world);

  // Spawn the wave's stream.
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = world.spawnInterval;
      const kind = world.spawnQueue.shift();
      const spot = edgeSpawn(world.rng, player);
      world.enemies.push(makeEnemy(kind, spot.x, spot.y));
    }
  }

  // Enemies.
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    const events = updateEnemy(enemy, world, dt);
    for (const orb of events.orbs) world.orbs.push(orb);
    for (const summon of events.summons) {
      world.enemies.push(makeEnemy(summon.kind, summon.x, summon.y));
    }
    if (events.burst) {
      for (let k = 0; k < 12; k += 1) {
        const angle = (k / 12) * Math.PI * 2;
        world.orbs.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * ORB.speed,
          vy: Math.sin(angle) * ORB.speed,
          radius: ORB.radius,
          damage: ORB.damage,
          life: 6,
        });
      }
      addShake(world.effects, 8);
      sfx.bossRoar();
    }
    if (events.reachedLantern) {
      world.enemies.splice(i, 1);
      hurtLantern(world, enemy.flame);
      if (world.screen !== SCREEN_PLAY) return;
    }
  }

  // Bullets.
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = world.bullets[i];
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    let dead = bullet.life <= 0;
    dead = dead || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20;
    if (!dead) {
      for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = world.enemies[j];
        if (bullet.hitIds.has(enemy.id)) continue;
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        const reach = enemy.radius + bullet.radius;
        if (dx * dx + dy * dy <= reach * reach) {
          bullet.hitIds.add(enemy.id);
          world.stats.hits += 1;
          damageEnemy(world, enemy, bullet.damage, bullet.crit);
          spawnBurst(world.effects, bullet.x, bullet.y, '#ffe27a', 4, 140, 0.3, 2);
          if (bullet.pierceLeft > 0) {
            bullet.pierceLeft -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }

  // Dark orbs.
  for (let i = world.orbs.length - 1; i >= 0; i -= 1) {
    const orb = world.orbs[i];
    orb.life -= dt;
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const reach = player.radius + orb.radius;
    let dead = orb.life <= 0 || orb.x < -20 || orb.x > FIELD.width + 20 || orb.y < -20 || orb.y > FIELD.height + 20;
    if (!dead && dx * dx + dy * dy <= reach * reach) {
      dead = true;
      hurtPlayer(world, orb.damage);
      if (world.screen !== SCREEN_PLAY) return;
    }
    if (dead) world.orbs.splice(i, 1);
  }

  // Contact damage: touching an enemy hurts, and thorns bite back.
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const reach = player.radius + enemy.radius;
    if (dx * dx + dy * dy <= reach * reach) {
      if (player.thornLevel > 0) damageEnemy(world, enemy, 12 * player.thornLevel, false);
      hurtPlayer(world, enemy.kind === 'brute' ? 16 : 10);
      if (world.screen !== SCREEN_PLAY) return;
      // Shove the enemy back so one touch is not a chain of them.
      const dist = Math.hypot(dx, dy) || 1;
      enemy.x -= (dx / dist) * 26;
      enemy.y -= (dy / dist) * 26;
    }
  }

  // Pickups drift, magnetise, and get collected.
  const magnet = playerPickupRadius(player);
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = world.pickups[i];
    pickup.life -= dt;
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    pickup.vx *= 0.94;
    pickup.vy *= 0.94;
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    const dist = Math.hypot(dx, dy);
    if (dist < magnet) {
      pickup.x += (dx / (dist || 1)) * 260 * dt;
      pickup.y += (dy / (dist || 1)) * 260 * dt;
    }
    if (dist < player.radius + 12) {
      if (pickup.kind === 'ember') {
        world.score += pickup.value;
        spawnEmberTrail(world.effects, pickup.x, pickup.y);
        sfx.pickup();
      } else {
        player.hp = Math.min(player.maxHp, player.hp + pickup.value);
        spawnText(world.effects, player.x, player.y - 26, `+${pickup.value}`, '#ff5d73', 15);
        sfx.heart();
      }
      world.pickups.splice(i, 1);
      continue;
    }
    if (pickup.life <= 0) world.pickups.splice(i, 1);
  }

  // The lantern slowly recovers while it is not being attacked.
  world.flame = Math.min(LANTERN.maxFlame, world.flame + 0.6 * dt);

  // Wave cleared: draft, or victory on the final wave.
  if (world.spawnQueue.length === 0 && world.enemies.length === 0 && world.orbs.length === 0) {
    if (world.wave >= WIN_WAVE) {
      endGame(world, true);
      return;
    }
    world.breather += dt;
    if (world.breather > 1.4) {
      world.breather = 0;
      openDraft(world);
    }
  }

  updateEffects(world.effects, dt);
  world.bannerTimer = Math.max(0, world.bannerTimer - dt);
}

/** Advance the world one fixed step. Input is the live snapshot (or the autopilot's). */
export function stepWorld(world, input, dt) {
  world.input = input;
  world.time += dt;
  if (world.screen === SCREEN_TITLE) {
    for (const drifter of world.ambient) {
      drifter.wobble += dt;
      drifter.x += Math.cos(drifter.wobble) * 12 * dt;
      drifter.y += Math.sin(drifter.wobble * 0.8) * 12 * dt;
      if (drifter.x < 0) drifter.x = FIELD.width;
      if (drifter.x > FIELD.width) drifter.x = 0;
      if (drifter.y < 0) drifter.y = FIELD.height;
      if (drifter.y > FIELD.height) drifter.y = 0;
    }
    updateEffects(world.effects, dt);
    return;
  }
  if (world.screen === SCREEN_PLAY) {
    stepPlaying(world, input, dt);
    return;
  }
  if (world.screen === SCREEN_DRAFT || world.screen === SCREEN_PAUSE || world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
    updateEffects(world.effects, dt);
    world.bannerTimer = Math.max(0, world.bannerTimer - dt);
  }
}
