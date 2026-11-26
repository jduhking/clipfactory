# 09 Current state (as of 2026-11-25)

**In short:** the whole game can be played from title to credits. It is in a final polish pass and has not been
released. The last stated target (end of September 2026) has passed, and no new date is recorded in the repo.

## Done and capturable

- Crowning Games intro → animated title (new art 2026-11-22) → save select.
- Opening cutscene (night narration, meteor, crater, Moku's naming, Barto, Cleo's capture); skippable.
- Tutorial, the world map, and all five levels with their set pieces, minibosses and the Millie fight.
- Both endings (all 12 prisms, or fewer), the credits with dev-team portraits, and the return to the map.
- Saves, prisms per level, absorption ranks, level unlocks.
- Keyboard and gamepad (with prompts that change for Nintendo-style pads); a Web build.
- A QA pass of 48 logged bugs (`bug_list.txt`), every one marked fixed and verified by a check script, plus 41 more
  items in `.claude/bugfix-progress.md`, all done. About 100 automated check scripts in `Tests/`.

Recent polish worth knowing for capture (2026-11-22 to 25): Carrnage's charge and wall bounce were given more impact
and the Caraang summon was redesigned; the miniboss defeat (a 1.2 s recoil and goop burst) was standardised; Carrot
Crossing's greens were toned down; the Solfege chase platforms now move in time with the note blocks; the Ball Moku
ride zooms out cleanly; the music no longer cuts between scenes.

## Still open (from `docs/specs/final-update-pass.md`, 2026-11-20)

The spec was written from an agent playtest before the last three days of work, so several items have since been
done (the ending, cutscene skipping, Level 4's final art, Moku's dialogue faces). What is still visibly not in the code:

- **Game feel:** an apex hang at the top of the jump, snappier falls, corner correction, squash and stretch on
  Keena, jump, land and skid dust, one hitstop service, one camera-shake model, landing feedback.
- **Menus:** erase is not wired on save select (the save function exists); the title has no Options or controls page.
- **Unverified:** smaller art fixes (the Level 1 cave tiles, a pillar seam in Level 3, the HUD shrinking in zoomed
  views) and the spec's P0 checkpoint-loop items. The spec says the gate for these is a checkpoint audit that prints
  no problems for all five levels.
- **Not tested by the agents:** finishing every level by hand, full boss fights, the audio mix and gamepad feel.
  The spec asks for a human playtest.

## Implications for clips

- Footage from the current `dev` build is close to final. Re-capture anything from before 2026-11-22 (the title,
  opening, ending, Carrnage and Level 4 have all changed).
- Avoid showing things that are known to change: jump arcs and landings (game-feel work is coming), menus (Options
  and Erase are coming).
- Don't show cut features as part of the game: glide or umbrella, clone bomb, club or slash combos, grapple hook,
  copy abilities, homies, extra worlds. They belong only in "what we cut" devlog segments.
- Release messaging is unsettled: no date, and Steam vs Itch.io is unresolved (the trailer's end card says "Play it
  now on Itch.io").
