# Artwork brief (art.js)

Hand-drawn in code (SVG). Recraft, the usual image generator, was not connected when this was made,
and the art needed to follow the app's four themes, so every color reads a theme token.

- Subject: steel mace, steel club and kettlebell, shown mid-movement with motion trails (no people).
- Styles: Poster (filled shapes, soft gradients, glow) and Engraved (line art with diagonal hatching).
- Palette: theme tokens only: --eq-kb, --eq-mace, --eq-club, --accent, --ink, --bg, --line.
- Size: 400 x 200 scenes, used as card heroes (sliced to fit) and faded tab backgrounds.
- Scenes: mace360 (Mace Foundations, mace path), clubs (Club Foundations, club path),
  swing (Swing Builder, kettlebell path), hybrid (Iron Hybrid, Programs tab), rack (Build),
  progress (Progress), recovery (Recovery), resume (Continue), ledger (Log).
- Add a scene: write a function in SCENES using K.kb / K.mace / K.club / K.trail / K.floor, then map it in
  PROG_ART, PATH_ART or VIEW_ART in index.html.
