# Arc & Iron

Chris's kettlebell, steel mace and steel club workout app, published with GitHub Pages at
https://eljorge788.github.io/arc-and-iron/

## Layout
- `index.html`: the whole app (markup, CSS and JS in one file, no build step).
- `sw.js`: service worker. Network-first for the page so updates reach phones on next open. Bump `CACHE` when changing icons or the manifest.
- `manifest.webmanifest` and `icons/`: home-screen install. `icons/badge.svg` is the master logo.

## Data
User data lives in each browser's localStorage (`ironflow`, `ironflow-logs`, `ironflow-checks`, `ironflow-state`, `ironflow-setup`). Keep these key names and record shapes backward compatible so updates never wipe anyone's history.
Equipment: `S.setups` holds named setups and `S.eq` always points at the active setup's equipment (older saves without setups are migrated into a "Home" setup by `linkSetups()`). `S.today` is a today-only tweak; the generator reads equipment through `effEq()`. The in-app backup file uses `app: "arc-and-iron"`.

## Working on it
- Test changes before pushing (a jsdom smoke test is enough: build a workout, run guided mode, log it, check Programs).
- Pushing to `main` publishes the site within a couple of minutes.
- Keep the copy plain and the training cues safety-minded; it is a training aid, not medical advice.
