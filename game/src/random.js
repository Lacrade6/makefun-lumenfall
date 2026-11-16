// A tiny seeded random generator (mulberry32) so screenshot scenes and wave
// layouts replay exactly from a seed. The live game seeds it from the clock;
// ?shot= scenes pass their own seed, which is why the same URL always draws
// the same frame.

export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max] from the generator. */
export function intIn(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of an array, picked by the generator. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** A shuffled copy of an array (Fisher-Yates, driven by the generator). */
export function shuffle(rng, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
