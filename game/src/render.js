// Everything the player sees, drawn on one canvas. Rendering reads the world
// and never mutates it. The field is drawn in world units under a fit
// transform; the HUD and menus are drawn in screen pixels afterwards.

import { FIELD, LANTERN, PALETTE, WIN_WAVE } from './config.js';
import { makeRng } from './random.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_DRAFT, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN } from './world.js';

// A fixed star field and grass tufts, seeded once so every frame agrees.
const starRng = makeRng(20261116);
const STARS = [];
for (let i = 0; i < 90; i += 1) {
  STARS.push({ x: starRng() * FIELD.width, y: starRng() * FIELD.height, r: 0.5 + starRng() * 1.4, tw: starRng() * Math.PI * 2 });
}
const TUFTS = [];
for (let i = 0; i < 46; i += 1) {
  TUFTS.push({ x: starRng() * FIELD.width, y: starRng() * FIELD.height, lean: (starRng() - 0.5) * 0.6 });
}

export function computeView(canvasWidth, canvasHeight) {
  const scale = Math.min(canvasWidth / FIELD.width, canvasHeight / FIELD.height);
  return {
    scale,
    offsetX: (canvasWidth - FIELD.width * scale) / 2,
    offsetY: (canvasHeight - FIELD.height * scale) / 2,
    width: canvasWidth,
    height: canvasHeight,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, world, view) {
  const grad = ctx.createRadialGradient(
    FIELD.width / 2, FIELD.height / 2, 60,
    FIELD.width / 2, FIELD.height / 2, 620,
  );
  grad.addColorStop(0, PALETTE.grove);
  grad.addColorStop(0.55, PALETTE.night);
  grad.addColorStop(1, PALETTE.nightEdge);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  for (const star of STARS) {
    const alpha = 0.25 + 0.35 * Math.abs(Math.sin(world.time * 0.7 + star.tw));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#cdd6ff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(90, 140, 90, 0.35)';
  ctx.lineWidth = 1.4;
  for (const tuft of TUFTS) {
    ctx.beginPath();
    ctx.moveTo(tuft.x, tuft.y);
    ctx.quadraticCurveTo(tuft.x + tuft.lean * 8, tuft.y - 7, tuft.x + tuft.lean * 12, tuft.y - 11);
    ctx.stroke();
  }

  // The lantern's warm pool of light.
  const flicker = 0.85 + 0.15 * Math.sin(world.time * 7) * Math.sin(world.time * 3.1);
  const glow = ctx.createRadialGradient(LANTERN.x, LANTERN.y, 10, LANTERN.x, LANTERN.y, 210 * flicker);
  glow.addColorStop(0, 'rgba(255, 217, 138, 0.30)');
  glow.addColorStop(0.5, 'rgba(255, 190, 90, 0.10)');
  glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawLantern(ctx, world) {
  const flameRatio = world.flame / LANTERN.maxFlame;
  const flicker = 1 + 0.08 * Math.sin(world.time * 9) + 0.05 * Math.sin(world.time * 23);
  ctx.fillStyle = '#2c2f45';
  ctx.beginPath();
  ctx.arc(LANTERN.x, LANTERN.y, LANTERN.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a4f6e';
  ctx.lineWidth = 3;
  ctx.stroke();
  const core = ctx.createRadialGradient(LANTERN.x, LANTERN.y - 4, 2, LANTERN.x, LANTERN.y - 4, 20 * flicker);
  core.addColorStop(0, PALETTE.lanternCore);
  core.addColorStop(0.6, PALETTE.lanternGlow);
  core.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(LANTERN.x, LANTERN.y - 4, 20 * flicker, 0, Math.PI * 2);
  ctx.fill();
  // A thin flame ring shows the lantern's remaining flame.
  ctx.strokeStyle = flameRatio > 0.35 ? PALETTE.lanternGlow : PALETTE.danger;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(LANTERN.x, LANTERN.y, LANTERN.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * flameRatio);
  ctx.stroke();
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (p.invulnerable > 0 && Math.floor(world.time * 16) % 2 === 0) return;
  const aim = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  ctx.save();
  ctx.translate(p.x, p.y);
  // Cloak.
  ctx.fillStyle = PALETTE.playerCloak;
  ctx.beginPath();
  ctx.moveTo(0, -p.radius - 4);
  ctx.lineTo(p.radius + 2, p.radius);
  ctx.lineTo(-p.radius - 2, p.radius);
  ctx.closePath();
  ctx.fill();
  // Hood and face glow.
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(0, -2, p.radius - 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2b00';
  ctx.beginPath();
  ctx.arc(Math.cos(aim) * 4, -2 + Math.sin(aim) * 4, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // The warden's beam-staff points at the aim.
  ctx.strokeStyle = PALETTE.bullet;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(aim) * (p.radius + 12), Math.sin(aim) * (p.radius + 12));
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(ctx, enemy, time) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const flash = enemy.hitFlash > 0;
  ctx.fillStyle = flash ? '#ffffff' : enemy.color;
  if (enemy.kind === 'wisp') {
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3.5, -2, 2, 0, Math.PI * 2);
    ctx.arc(3.5, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.arc(-3.5, -2, 1, 0, Math.PI * 2);
    ctx.arc(3.5, -2, 1, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'shade') {
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius - 4);
    ctx.quadraticCurveTo(enemy.radius, -enemy.radius * 0.4, enemy.radius * 0.8, enemy.radius * 0.6);
    ctx.quadraticCurveTo(0, enemy.radius + 4, -enemy.radius * 0.8, enemy.radius * 0.6);
    ctx.quadraticCurveTo(-enemy.radius, -enemy.radius * 0.4, 0, -enemy.radius - 4);
    ctx.fill();
    ctx.fillStyle = '#ffe9f5';
    ctx.beginPath();
    ctx.arc(-5, -3, 2.6, 0, Math.PI * 2);
    ctx.arc(5, -3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'brute') {
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + time * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * enemy.radius * 0.8, Math.sin(angle) * enemy.radius * 0.8);
      ctx.lineTo(Math.cos(angle) * (enemy.radius + 8), Math.sin(angle) * (enemy.radius + 8));
      ctx.lineTo(Math.cos(angle + 0.3) * enemy.radius * 0.8, Math.sin(angle + 0.3) * enemy.radius * 0.8);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd7de';
    ctx.beginPath();
    ctx.arc(-7, -4, 3, 0, Math.PI * 2);
    ctx.arc(7, -4, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'spitter') {
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#06281c';
    ctx.beginPath();
    ctx.arc(0, 2, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8fff0';
    ctx.beginPath();
    ctx.arc(-4.5, -5, 2, 0, Math.PI * 2);
    ctx.arc(4.5, -5, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // The Hollow King: a crowned dark mass with a burning core.
    ctx.fillStyle = flash ? '#ffffff' : enemy.color;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b0010';
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 12 - 6, -enemy.radius + 4);
      ctx.lineTo(i * 12, -enemy.radius - 14);
      ctx.lineTo(i * 12 + 6, -enemy.radius + 4);
      ctx.closePath();
      ctx.fill();
    }
    const pulse = 0.7 + 0.3 * Math.sin(time * 5);
    ctx.fillStyle = `rgba(255, 220, 120, ${pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0008';
    ctx.beginPath();
    ctx.arc(-12, -8, 4, 0, Math.PI * 2);
    ctx.arc(12, -8, 4, 0, Math.PI * 2);
    ctx.fill();
    // Boss health bar.
    const w = 90;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-w / 2, -enemy.radius - 26, w, 7);
    ctx.fillStyle = PALETTE.boss;
    ctx.fillRect(-w / 2, -enemy.radius - 26, w * Math.max(0, enemy.hp / enemy.maxHp), 7);
  }
  ctx.restore();
}

function drawWorldEntities(ctx, world) {
  drawLantern(ctx, world);
  for (const pickup of world.pickups) {
    if (pickup.kind === 'ember') {
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(world.time * 2 + pickup.x);
      ctx.fillStyle = PALETTE.ember;
      ctx.shadowColor = PALETTE.ember;
      ctx.shadowBlur = 10;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.fillStyle = PALETTE.heart;
      ctx.shadowColor = PALETTE.heart;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.bezierCurveTo(-9, -3, -6, -10, 0, -5);
      ctx.bezierCurveTo(6, -10, 9, -3, 0, 6);
      ctx.fill();
      ctx.restore();
    }
  }
  for (const bullet of world.bullets) {
    ctx.strokeStyle = PALETTE.bullet;
    ctx.lineWidth = bullet.radius;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bullet.x - bullet.vx * 0.03, bullet.y - bullet.vy * 0.03);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
  }
  for (const orb of world.orbs) {
    const pulse = 1 + 0.25 * Math.sin(world.time * 8 + orb.x);
    ctx.fillStyle = PALETTE.orb;
    ctx.shadowColor = PALETTE.orb;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  for (const enemy of world.enemies) drawEnemy(ctx, enemy, world.time);
  drawPlayer(ctx, world);

  const effects = world.effects;
  for (const ring of effects.rings) {
    ctx.globalAlpha = Math.max(0, ring.life / ring.maxLife);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of effects.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const t of effects.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.font = `bold ${t.size}px system-ui, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  if (effects.flash > 0) {
    ctx.fillStyle = `rgba(255, 120, 90, ${effects.flash * 0.35})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
}

function bar(ctx, x, y, w, h, ratio, fill, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = fill;
  if (ratio > 0) {
    roundRect(ctx, x + 1, y + 1, Math.max(4, (w - 2) * Math.min(1, ratio)), h - 2, 3);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + w + 8, y + h - 3);
}

function drawHud(ctx, world, view) {
  const p = world.player;
  ctx.textBaseline = 'alphabetic';
  bar(ctx, 16, 14, 190, 16, p.hp / p.maxHp, '#ff5d73', `HP ${Math.ceil(p.hp)}/${p.maxHp}`);
  bar(ctx, 16, 38, 190, 16, world.flame / LANTERN.maxFlame, '#ffd98a', `FLAME ${Math.ceil(world.flame)}`);
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`SCORE ${world.score}`, view.width - 16, 30);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText(`BEST ${Math.max(world.best, world.score)}`, view.width - 16, 50);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 18px system-ui, sans-serif';
  const left = world.enemies.length + world.spawnQueue.length;
  ctx.fillText(world.wave >= WIN_WAVE ? 'FINAL WAVE' : `WAVE ${world.wave}  ·  ${left} LEFT`, view.width / 2, 30);
  // Dash readiness.
  const ready = p.dashCooldown <= 0;
  ctx.fillStyle = ready ? '#b9a8ff' : 'rgba(150,140,190,0.4)';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(ready ? 'DASH READY  [SPACE]' : 'DASH …', view.width / 2, view.height - 16);
  if (world.bannerTimer > 0) {
    ctx.globalAlpha = Math.min(1, world.bannerTimer);
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillStyle = PALETTE.lanternGlow;
    ctx.shadowColor = PALETTE.lanternGlow;
    ctx.shadowBlur = 18;
    ctx.fillText(world.banner, view.width / 2, view.height * 0.3);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function drawCrosshair(ctx, world, view, mouse) {
  if (!mouse) return;
  const x = mouse.x;
  const y = mouse.y;
  ctx.strokeStyle = 'rgba(255, 226, 122, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 15, y);
  ctx.lineTo(x - 6, y);
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + 15, y);
  ctx.moveTo(x, y - 15);
  ctx.lineTo(x, y - 6);
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x, y + 15);
  ctx.stroke();
}

function drawTitle(ctx, world, view) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.45)';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.lanternGlow;
  ctx.font = 'bold 64px Georgia, serif';
  ctx.shadowColor = PALETTE.lanternGlow;
  ctx.shadowBlur = 30;
  ctx.fillText('LUMENFALL', view.width / 2, view.height * 0.32);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('Warden of the Last Lantern', view.width / 2, view.height * 0.32 + 38);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('The dark crawls toward the lantern. Hold the light for 10 waves.', view.width / 2, view.height * 0.32 + 74);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '15px system-ui, sans-serif';
  const lines = [
    'WASD / arrows — move      Mouse — aim      Hold click — fire',
    'SPACE — dash through danger      P — pause      M — mute',
    'Between waves, choose one upgrade. If the lantern dies, the dark wins.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, view.width / 2, view.height * 0.55 + i * 26));
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.lanternGlow;
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillText('CLICK TO BEGIN', view.width / 2, view.height * 0.55 + 3 * 26 + 34);
  ctx.globalAlpha = 1;
  if (world.best > 0) {
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`Best score: ${world.best}`, view.width / 2, view.height * 0.55 + 3 * 26 + 66);
  }
}

function drawDraft(ctx, world, view) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.62)';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.lanternGlow;
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText(`WAVE ${world.wave} CLEARED`, view.width / 2, view.height * 0.22);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Choose one blessing before the dark returns  —  click a card, or press 1 / 2 / 3', view.width / 2, view.height * 0.22 + 30);
  const cardW = 220;
  const cardH = 190;
  const gap = 26;
  const total = cardW * 3 + gap * 2;
  const startX = (view.width - total) / 2;
  const y = view.height * 0.36;
  world.draft.forEach((card, i) => {
    const x = startX + i * (cardW + gap);
    const selected = world.draftIndex === i;
    ctx.fillStyle = selected ? '#2a3560' : PALETTE.card;
    roundRect(ctx, x, y, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = selected ? PALETTE.lanternGlow : PALETTE.cardEdge;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.lanternGlow;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`[${i + 1}]`, x + cardW / 2, y + 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 19px Georgia, serif';
    ctx.fillText(card.name, x + cardW / 2, y + 68);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    wrapText(ctx, card.desc, x + cardW / 2, y + 100, cardW - 28, 21);
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let offset = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + offset);
      offset += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + offset);
}

function drawPause(ctx, view) {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.6)';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('PAUSED', view.width / 2, view.height / 2 - 10);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('Press P or click to return to the fight', view.width / 2, view.height / 2 + 24);
}

function drawEnd(ctx, world, view, won) {
  ctx.fillStyle = won ? 'rgba(20, 26, 8, 0.55)' : 'rgba(10, 4, 10, 0.62)';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? PALETTE.lanternGlow : PALETTE.danger;
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText(won ? 'THE LIGHT HOLDS' : 'THE DARK PREVAILS', view.width / 2, view.height * 0.3);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px Georgia, serif';
  ctx.fillText(
    won ? 'The Hollow King is broken. Dawn returns to the grove.' : 'The lantern gutters out — but a warden always rises again.',
    view.width / 2,
    view.height * 0.3 + 36,
  );
  const accuracy = world.stats.shots > 0 ? Math.round((world.stats.hits / world.stats.shots) * 100) : 0;
  ctx.font = '17px system-ui, sans-serif';
  const rows = [
    `Score  ${world.score}`,
    `Best  ${world.best}`,
    `Wave reached  ${world.wave}`,
    `Shades banished  ${world.kills}`,
    `Accuracy  ${accuracy}%`,
    `Dashes  ${world.stats.dashes}`,
  ];
  rows.forEach((row, i) => ctx.fillText(row, view.width / 2, view.height * 0.46 + i * 28));
  if (world.player.upgradeNames && world.player.upgradeNames.length > 0) {
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Blessings: ${world.player.upgradeNames.join(' · ')}`, view.width / 2, view.height * 0.46 + rows.length * 28 + 10);
  }
  ctx.fillStyle = PALETTE.lanternGlow;
  ctx.font = 'bold 20px system-ui, sans-serif';
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillText('CLICK OR PRESS R TO PLAY AGAIN', view.width / 2, view.height * 0.46 + rows.length * 28 + 52);
  ctx.globalAlpha = 1;
}

/** Draw one frame. `mouse` is {x, y} in canvas pixels, or null. */
export function render(ctx, world, view, mouse) {
  ctx.fillStyle = PALETTE.nightEdge;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.save();
  const shake = world.effects.shake;
  const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(view.offsetX + sx * view.scale, view.offsetY + sy * view.scale);
  ctx.scale(view.scale, view.scale);
  ctx.beginPath();
  ctx.rect(0, 0, FIELD.width, FIELD.height);
  ctx.clip();
  drawBackground(ctx, world, view);
  if (world.screen === SCREEN_TITLE) {
    for (const drifter of world.ambient) drawEnemy(ctx, drifter, world.time);
  } else {
    drawWorldEntities(ctx, world);
  }
  ctx.restore();

  if (world.screen === SCREEN_PLAY || world.screen === SCREEN_DRAFT || world.screen === SCREEN_PAUSE) {
    drawHud(ctx, world, view);
  }
  if (world.screen === SCREEN_PLAY) drawCrosshair(ctx, world, view, mouse);
  if (world.screen === SCREEN_TITLE) drawTitle(ctx, world, view);
  if (world.screen === SCREEN_DRAFT) drawDraft(ctx, world, view);
  if (world.screen === SCREEN_PAUSE) drawPause(ctx, view);
  if (world.screen === SCREEN_OVER) drawEnd(ctx, world, view, false);
  if (world.screen === SCREEN_WIN) drawEnd(ctx, world, view, true);
}
