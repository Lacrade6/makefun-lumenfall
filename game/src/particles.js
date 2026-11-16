// Particles, floating score text, shockwave rings and screen shake. Purely
// cosmetic: nothing here changes the rules, only how a hit reads.

export function createEffects() {
  return {
    particles: [],
    texts: [],
    rings: [],
    shake: 0,
    flash: 0,
  };
}

export function spawnBurst(effects, x, y, color, count, speed, life = 0.6, size = 3) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.35 + Math.random() * 0.65);
    effects.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: life * (0.6 + Math.random() * 0.6),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      drag: 0.92,
    });
  }
}

export function spawnEmberTrail(effects, x, y) {
  effects.particles.push({
    x: x + (Math.random() - 0.5) * 8,
    y: y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 24,
    vy: -20 - Math.random() * 30,
    life: 0.7,
    maxLife: 0.7,
    size: 2.2,
    color: '#ffb347',
    drag: 0.98,
  });
}

export function spawnText(effects, x, y, text, color = '#f4ead8', size = 15) {
  effects.texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
}

export function spawnRing(effects, x, y, color, maxRadius = 70) {
  effects.rings.push({ x, y, color, radius: 6, maxRadius, life: 0.45, maxLife: 0.45 });
}

export function addShake(effects, amount) {
  effects.shake = Math.min(14, effects.shake + amount);
}

export function addFlash(effects, amount) {
  effects.flash = Math.min(0.6, effects.flash + amount);
}

export function updateEffects(effects, dt) {
  for (let i = effects.particles.length - 1; i >= 0; i -= 1) {
    const p = effects.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      effects.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= p.drag;
    p.vy *= p.drag;
  }
  for (let i = effects.texts.length - 1; i >= 0; i -= 1) {
    const t = effects.texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) effects.texts.splice(i, 1);
  }
  for (let i = effects.rings.length - 1; i >= 0; i -= 1) {
    const r = effects.rings[i];
    r.life -= dt;
    r.radius += (r.maxRadius - r.radius) * dt * 9;
    if (r.life <= 0) effects.rings.splice(i, 1);
  }
  effects.shake = Math.max(0, effects.shake - dt * 26);
  effects.flash = Math.max(0, effects.flash - dt * 1.8);
}
