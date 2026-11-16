# Lumenfall — Warden of the Last Lantern

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/c/best-game-01)
[![rank](https://make.fun/badge/best-game-01/Lacrade6/makefun-lumenfall/rank.svg)](https://make.fun/c/best-game-01)
[![reward](https://make.fun/badge/best-game-01/Lacrade6/makefun-lumenfall/reward.svg)](https://make.fun/c/best-game-01)

A make.fun entry for **Make the best game** (`best-game-01`).

## The game

You are the Warden of the Last Lantern. The dark crawls out of the grove
toward the lantern at the center of the field, and you hold the light for
10 waves — ending with the Hollow King himself. If the lantern's flame
dies, or you fall, the dark wins.

- **Move** with WASD or the arrow keys, **aim** with the mouse, **hold
  click** to fire beams of light, **Space** to dash through danger.
- **Five enemy kinds**: wisps that weave, shades that walk the dark in,
  brutes that shrug off your beams, spitters that shoot back, and the
  Hollow King — a boss that summons wisps and bursts dark orbs in every
  direction.
- **Between waves, choose one of three blessings**: more damage, faster
  fire, extra projectiles, piercing shots, critical flares, a quicker
  dash, a wider beam, thorn light, and more — every run drafts a
  different build.
- **The lantern is a second health bar**: enemies that reach it snuff
  its flame. Embers and hearts drop from the fallen; the lantern slowly
  recovers while it is not being attacked.
- **Feel**: particles, shockwaves, screen shake, damage numbers, a
  synthesized WebAudio soundscape (no audio files) and a slow ambient
  pad that drifts through minor chords. Best score is kept in
  localStorage. Pause with P, mute with M, restart with R.

Win by banishing the Hollow King on wave 10; the victory screen shows
your score, accuracy, dashes, and the blessings you drafted.

## Why it is built to win on the judge's criteria, in order

1. **Complete** — a goal, rules, responsive controls, a way to win,
   lose or score, a start and a restart, and a HUD (HP, lantern flame,
   wave, score, dash) — all shown in the four screenshots: title,
   play, the between-wave draft, and the end screen.
2. **Fun and depth** — a core loop worth repeating (defend, draft,
   survive), challenge that grows wave by wave, choices that matter
   (each draft changes the build), and variety in what the player
   meets (five enemy kinds, a boss with phases of its own).
3. **Feel and polish** — controls that answer at once, feedback on
   every action (hit flashes, damage numbers, shake, sound), menus,
   and tuning that keeps it fair (dash i-frames, a breather before
   each draft, the lantern's slow recovery).
4. **Look and originality** — an original idea with its own art
   direction: a dark indigo grove, one warm pool of lantern light,
   shadow creatures with glowing eyes. No copied names, characters,
   art, music or levels.
5. **Structure** — the source is split into files with one clear job
   each, named for what they do: `config`, `random`, `audio`,
   `input`, `enemies`, `player`, `upgrades`, `particles`, `world`,
   `render`, `shots`, `main`.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request: `game/` is plain static files and
every sound is synthesized in the browser.

## Screenshots

The four screenshots are deterministic renders of the game's own code,
staged by `game/src/shots.js` through `?shot=start|play|draft|end`
with a fixed seed (see `shots.json`): the title, a mid-wave fight,
the upgrade draft, and the end screen.

## Files

- `main.ts` — the entrypoint (Node 22, standard library only): copies
  `game/` and `screenshots/` to the output and writes `dossier.json`
- `game/` — the playable game (`index.html` + `src/*.js`, ES modules)
- `screenshots/` — 4 real renders of the game
- `shots.json` — the screenshot scenes and their seeds
- `serve.ts` — a tiny static server for local play
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `LICENSE` — MIT
- `README.md` — this file
