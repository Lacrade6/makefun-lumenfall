// The Warden: movement, dash, firing and the stats upgrades mutate.
// The player object carries its base stats and its upgrade levels; effective
// values (damage, fire rate, ...) are computed here so upgrades.js only has
// to bump a level.

import { FIELD, LANTERN, PLAYER } from './config.js';

export function makePlayer() {
  return {
    x: LANTERN.x,
    y: LANTERN.y + 150,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    aimX: LANTERN.x,
    aimY: LANTERN.y - 100,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirY: -1,
    invulnerable: 0,
    // Upgrade levels, all start at zero.
    damageLevel: 0,
    rateLevel: 0,
    multiLevel: 0,
    pierceLevel: 0,
    speedLevel: 0,
    dashLevel: 0,
    magnetLevel: 0,
    critLevel: 0,
    wideLevel: 0,
    thornLevel: 0,
  };
}

export function playerDamage(player) {
  return PLAYER.bulletDamage * (1 + 0.25 * player.damageLevel) * (1 + 0.1 * player.wideLevel);
}

export function playerFireInterval(player) {
  return PLAYER.fireInterval / (1 + 0.2 * player.rateLevel);
}

export function playerSpeed(player) {
  return PLAYER.speed * (1 + 0.15 * player.speedLevel);
}

export function playerBulletCount(player) {
  return 1 + player.multiLevel;
}

export function playerPierce(player) {
  return player.pierceLevel;
}

export function playerCritChance(player) {
  return 0.05 + 0.12 * player.critLevel;
}

export function playerDashCooldown(player) {
  return PLAYER.dashCooldown * (1 - 0.3 * player.dashLevel);
}

export function playerPickupRadius(player) {
  return PLAYER.pickupRadius * (1 + 0.6 * player.magnetLevel);
}

export function playerBulletRadius(player) {
  return PLAYER.bulletRadius + 2 * player.wideLevel;
}

/** Move the player from input; returns true when a dash started this tick. */
export function movePlayer(player, input, dt) {
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
  }
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);

  let dashed = false;
  if (input.dashQueued && player.dashCooldown <= 0 && player.dashTimer <= 0) {
    player.dashTimer = PLAYER.dashTime;
    player.dashCooldown = playerDashCooldown(player);
    const dirLen = Math.hypot(mx, my);
    if (dirLen > 0) {
      player.dashDirX = mx;
      player.dashDirY = my;
    } else {
      // No direction held: dash toward the aim.
      const ax = player.aimX - player.x;
      const ay = player.aimY - player.y;
      const aimLen = Math.hypot(ax, ay) || 1;
      player.dashDirX = ax / aimLen;
      player.dashDirY = ay / aimLen;
    }
    dashed = true;
  }

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.x += player.dashDirX * PLAYER.dashSpeed * dt;
    player.y += player.dashDirY * PLAYER.dashSpeed * dt;
  } else {
    const speed = playerSpeed(player);
    player.x += mx * speed * dt;
    player.y += my * speed * dt;
  }

  player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(FIELD.height - player.radius, player.y));
  return dashed;
}

/** Fire bullets toward the aim point when the trigger is held. */
export function firePlayer(player, input, dt, spawnBullet) {
  player.fireTimer -= dt;
  if (!input.firing || player.fireTimer > 0) return;
  player.fireTimer = playerFireInterval(player);
  const count = playerBulletCount(player);
  const baseAngle = Math.atan2(player.aimY - player.y, player.aimX - player.x);
  const spread = 0.14;
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * spread;
    spawnBullet(baseAngle + offset);
  }
}
