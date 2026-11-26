# 05 Mechanics

The one thing to get across: **Keena moves, Moku fights.** "You lunge him out like a living grappling weapon: grab
enemies, yank them, throw them, roll him into a ball, send him through tunnels." It is not a Kirby inhale game,
whatever the "Kirby-inspired" label suggests.

## Controls (dev branch)

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows or A/D | D-pad or left stick |
| Dash | Double-tap left or right | same |
| Crouch / drop through a one-way floor | Down or S (double-tap Down, or crouch + Jump) | same |
| Jump | Space, Z or K | A / Cross (button 0) |
| Command Moku (lunge, hold to grab, release to throw) | X or J | X / Square (button 2) |
| Pause | Esc or P | Start |
| Skip cutscene | Esc | Back / Select |

With the game's editor `debug_mode` on, number keys give capture helpers: **3** toggles 0.1× slow motion, **1**
restarts, **0** opens the debug room, **4** spawns enemies, **5** deals damage, **6** kills Keena, **2** shows the
debug keys. Debug mode also opens every level on the map.

## Keena

- Run with momentum, a skid when turning at speed, a double-tap dash.
- Jump with coyote time (0.1 s), a generous jump buffer (0.2 s) and variable height; wall jump; ride moving
  platforms with carried momentum.
- Hearts for health; pits and crushing kill outright. Checkpoints per section.
- Rides Ball Moku and Goopa shells, carries and throws things Moku has grabbed.

## Moku's moves

| Move | What you see |
|---|---|
| **Lunge** | Moku shoots out in the aimed direction, stretching from Keena; hits enemies (minibosses and Millie take chip damage) and slams into walls with recoil |
| **Grab** | Hold the button mid-lunge: Moku latches on. Grabbing an enemy fuses the two sprites into one gooey silhouette at the contact (a custom shader effect) |
| **Yank** | Pulls things toward Keena: enemies, petunia platforms, ropes that move whole floor slabs, Dark Onna orbs, Ugnet's mask, vegetables out of the ground, plant heads |
| **Throw** | Keena throws what Moku hauled in: enemies into enemies, vegetables into Carrnage, bees back into Millie |
| **Purify / absorb** | Lunging into corrupted plants and animals turns them back to normal and releases goop pellets Moku absorbs |
| **Tunnels** | Moku travels through small tunnels Keena can't fit through |
| **Grow** | The goop meter is the share of the level's goop absorbed; Moku grows SMALL → MEDIUM → LARGE (Level 2 thresholds: 34% and 67%); only LARGE breaks big rocks |
| **Ball Moku** | Level 5: Moku eats a giant acorn and becomes a rolling ball Keena rides; she can't be hurt while riding |
| ~~Clone Bomb~~ | Cut. Moku split into six homing clones; the state is still in the code but nothing triggers it, so it can't be captured from the current build |

## Progress and scoring

- **Goop meter / absorption rank:** unique goop captured over the level's total. End-of-level rank: S (100%),
  A (90%+), B (75%+), C (45%+), else F. Captures persist through deaths during a session.
- **Rainbow Prisms:** 12 in total, three in each of Levels 1 to 4; all 12 give the good ending.
- **Unlocks:** each level opens once the ones before it are cleared.

## Shot-worthy mechanics, ranked

1. A lunge, grab, yank and throw chain on an enemy (the gooey fuse reads well up close).
2. Moku visibly growing a size after a purify.
3. The Ball Moku ride and the ramp launch through rocks.
4. The Bass Clef chase and the beat blocks switching to the music.
5. Uprooting a vegetable and throwing it into Carrnage.
6. Throwing a bee back into Millie, or Millie stuck in the floor after her spear smash.
7. Yanking a petunia platform into place, then jumping onto it.
8. A corrupted bunny turning back to normal.

## Vocabulary traps (from the game's docs)

- "Absorb" means goop pellets and purifying, not inhaling enemies.
- "Umbrella" or "parasol" glide exists in code but is only partly wired; don't show it as a feature.
- "Fat Moku" just means the LARGE tier.
