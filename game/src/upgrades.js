// The between-wave draft: three upgrade cards, one choice. Each upgrade has
// an id, a name, a one-line promise, a cap on how often it can be taken, and
// an apply step that mutates the player (or the world, for lantern wards).
// The draft deals three distinct upgrades the player has not maxed out.

import { LANTERN } from './config.js';
import { shuffle } from './random.js';

export const UPGRADES = [
  {
    id: 'damage',
    name: 'Bright Rounds',
    desc: '+25% bullet damage',
    max: 5,
    apply(player) { player.damageLevel += 1; },
  },
  {
    id: 'rate',
    name: 'Rapid Lantern',
    desc: '+20% fire rate',
    max: 5,
    apply(player) { player.rateLevel += 1; },
  },
  {
    id: 'multi',
    name: 'Twin Beams',
    desc: '+1 projectile per shot',
    max: 3,
    apply(player) { player.multiLevel += 1; },
  },
  {
    id: 'pierce',
    name: 'Piercing Light',
    desc: 'Bullets pass through +1 enemy',
    max: 3,
    apply(player) { player.pierceLevel += 1; },
  },
  {
    id: 'speed',
    name: 'Swift Boots',
    desc: '+15% move speed',
    max: 4,
    apply(player) { player.speedLevel += 1; },
  },
  {
    id: 'heart',
    name: 'Ember Heart',
    desc: '+25 max HP and heal 25',
    max: 4,
    apply(player) {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
  },
  {
    id: 'dash',
    name: 'Dash Mastery',
    desc: 'Dash recharges 30% faster',
    max: 3,
    apply(player) { player.dashLevel += 1; },
  },
  {
    id: 'magnet',
    name: 'Magnet Halo',
    desc: '+60% pickup radius',
    max: 3,
    apply(player) { player.magnetLevel += 1; },
  },
  {
    id: 'crit',
    name: 'Critical Flare',
    desc: '+12% critical chance (2x damage)',
    max: 5,
    apply(player) { player.critLevel += 1; },
  },
  {
    id: 'wide',
    name: 'Wide Beam',
    desc: 'Bigger bullets, +10% damage',
    max: 3,
    apply(player) { player.wideLevel += 1; },
  },
  {
    id: 'ward',
    name: 'Lantern Ward',
    desc: 'Restore 30 lantern flame',
    max: 99,
    apply(player, world) {
      world.flame = Math.min(LANTERN.maxFlame, world.flame + 30);
    },
  },
  {
    id: 'thorn',
    name: 'Thorn Light',
    desc: 'Touching enemies take 12 damage',
    max: 3,
    apply(player) { player.thornLevel += 1; },
  },
];

/** How many times the player has taken an upgrade id. */
export function takenCount(player, id) {
  return player.takenUpgrades ? player.takenUpgrades[id] || 0 : 0;
}

/** Deal three draft cards the player can still take. */
export function dealDraft(rng, player) {
  const available = UPGRADES.filter((up) => takenCount(player, up.id) < up.max);
  const dealt = shuffle(rng, available).slice(0, 3);
  return dealt;
}

/** Apply the chosen card and record the take. */
export function applyUpgrade(player, world, upgrade) {
  upgrade.apply(player, world);
  if (!player.takenUpgrades) player.takenUpgrades = {};
  player.takenUpgrades[upgrade.id] = (player.takenUpgrades[upgrade.id] || 0) + 1;
  player.upgradeNames = player.upgradeNames || [];
  player.upgradeNames.push(upgrade.name);
}
