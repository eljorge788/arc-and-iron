# Arc & Iron

Chris's kettlebell, steel mace and steel club workout app, published with GitHub Pages at
https://eljorge788.github.io/arc-and-iron/

## Layout
- `index.html`: the whole app (markup, CSS and JS in one file, no build step).
- `sw.js`: service worker. Network-first for the page so updates reach phones on next open. Bump `CACHE` when changing icons or the manifest.
- `demos.js`: animated move demos (front and side views) for the mace and the steel club. A pose's `len` picks the implement (MACE or CLUB); club moves follow the beginner reference in the Arc & Iron project (steel-club-exercises.md).
- `art.js`: theme-aware SVG artwork (tab backgrounds, program and skill-path heroes). Brief in `art.brief.md`. `S.art` picks poster, engraved or off.
- `keepawake.js`: keeps the screen on during guided workouts (Wake Lock API, with the NoSleep.js video fallback, MIT).
- `manifest.webmanifest` and `icons/`: home-screen install. `icons/badge.svg` is the master logo.

## Data
User data lives in each browser's localStorage (`ironflow`, `ironflow-logs`, `ironflow-checks`, `ironflow-state`, `ironflow-setup`, `ironflow-resume`). Keep these key names and record shapes backward compatible so updates never wipe anyone's history.
Equipment: `S.setups` holds named setups and `S.eq` always points at the active setup's equipment (older saves without setups are migrated into a "Home" setup by `linkSetups()`). `S.today` is a today-only tweak; the generator reads equipment through `effEq()`. The in-app backup file uses `app: "arc-and-iron"`.
In progress: `Store.state.week` is the saved weekly plan (`days` are full workouts with `weekRef`, `done` maps day to time), `Store.state.lastBuilt` is the last workout built, and `ironflow-resume` holds an unfinished guided workout. Logging a workout calls `finishedWorkout()` to tick these off. The Continue tab reads all of them.
Workout sections: `S.warm` / `S.cool` (default on) decide whether new workouts get a warm-up and cool-down; when off, their minutes go to the main work. A skipped section on one workout moves to `w.skipped.warm` / `w.skipped.cool` and can be added back. Every section is a collapsible `details.block`; `S.fold[kind]` remembers which kinds are collapsed.
Themes: `S.skin` (forge, akhara, chalk, patina) sets `data-skin` on the root and `S.appearance` (auto, light, dark) sets `data-theme`; themes only swap color tokens, including the `--eq-*` equipment colors used by the movement banners.

## Working on it
- Test changes before pushing (a jsdom smoke test is enough: build a workout, run guided mode, log it, check Programs).
- Pushing to `main` publishes the site within a couple of minutes.
- Keep the copy plain and the training cues safety-minded; it is a training aid, not medical advice.
