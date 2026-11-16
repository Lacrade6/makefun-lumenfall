// Lumenfall — tuning constants and palette.
// One place holds every number the designers argue about, so balancing is editing
// this file and nothing else. All distances are in world units; the field is
// 960 by 600 and the camera fits it to the window.

export const FIELD = { width: 960, height: 600 };
export const STEP = 1 / 60;
export const WIN_WAVE = 10;

export const PALETTE = {
  night: '#0a0d1f',
  nightEdge: '#05060f',
  grove: '#11162e',
  grass: '#1b2a1e',
  lanternGlow: '#ffd98a',
  lanternCore: '#fff3c4',
  player: '#ffe9a8',
  playerCloak: '#7a5cff',
  bullet: '#ffe27a',
  ember: '#ffb347',
  heart: '#ff5d73',
  wisp: '#8f7bff',
  shade: '#b06cff',
  brute: '#ff4d6d',
  spitter: '#4dd8a6',
  boss: '#ff2e63',
  orb: '#c44dff',
  text: '#f4ead8',
  dim: '#9a94b8',
  card: '#1a2142',
  cardEdge: '#3d4a7a',
  danger: '#ff5d5d',
};

// How many seconds the title screen idles before its background wisps drift in.
export const TITLE_AMBIENT_SECONDS = 5;

export const PLAYER = {
  radius: 14,
  speed: 245,
  maxHp: 100,
  fireInterval: 0.16,
  bulletSpeed: 540,
  bulletRadius: 5,
  bulletDamage: 12,
  dashSpeed: 760,
  dashTime: 0.16,
  dashCooldown: 2.1,
  pickupRadius: 46,
  invulnerableAfterHit: 0.5,
};

export const LANTERN = {
  x: FIELD.width / 2,
  y: FIELD.height / 2,
  radius: 26,
  maxFlame: 100,
  // Flame the lantern slowly regains while no enemy touches it.
  regenPerSecond: 0.6,
};

// Enemy kinds: hp, speed, radius, score, embers dropped, flame damage on reach.
export const ENEMY_KINDS = {
  wisp: { hp: 14, speed: 98, radius: 10, score: 10, embers: 1, flame: 4, color: PALETTE.wisp },
  shade: { hp: 36, speed: 62, radius: 15, score: 25, embers: 2, flame: 8, color: PALETTE.shade },
  brute: { hp: 130, speed: 34, radius: 24, score: 60, embers: 5, flame: 15, color: PALETTE.brute },
  spitter: { hp: 28, speed: 56, radius: 13, score: 40, embers: 3, flame: 6, color: PALETTE.spitter },
  boss: { hp: 1500, speed: 27, radius: 46, score: 1000, embers: 40, flame: 40, color: PALETTE.boss },
};

// Wave composition: how many of each kind a wave fields, and how fast they arrive.
export function wavePlan(wave) {
  if (wave >= WIN_WAVE) {
    return { counts: { boss: 1, wisp: 10, shade: 6, spitter: 4 }, interval: 1.15 };
  }
  const counts = {
    wisp: 5 + wave * 2,
    shade: wave >= 2 ? 2 + wave : 0,
    brute: wave >= 3 ? Math.floor(wave / 2) : 0,
    spitter: wave >= 4 ? Math.floor((wave - 2) / 2) : 0,
  };
  return { counts, interval: Math.max(0.55, 1.5 - wave * 0.09) };
}

export const ORB = { speed: 165, radius: 7, damage: 9 };
export const PICKUP = { emberScore: 2, heartHeal: 14, heartChance: 0.08 };
