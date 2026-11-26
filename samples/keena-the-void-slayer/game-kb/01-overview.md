# 01 Overview

## The pitch

**One line:** a small girl and her goopy shadow companion purify a color-drained island, one corrupted creature
at a time.

**Short:** Keena can't really fight on her own, so her whole moveset is Moku, a silent blob of void goop who
follows her everywhere. Lunge him out like a living grappling weapon to grab, yank and throw enemies, roll him into
a ball, send him through tunnels. Moku absorbs the corruption, grows through three sizes, and together they hunt the
Rainbow Prisms that can cleanse Lepordia and bring Keena's kidnapped brother home.

**Story hook:** one starry night something falls from the sky. Keena finds a strange creature in the crater and
names him Moku. Moments later shadow creatures snatch her little brother Cleo, and the queen bee Millie's hive has
gone dark.

**Studio story hook:** a summer project by college friends that was supposed to take two months and took two
years; they cut four of five worlds so they could finish one, and are giving it away free. See
[08](08-development-history.md).

Taglines already in use or drafted:

- "Save Leporidia" (trailer end card; the game spells the world Lepordia)
- "Command Moku" (trailer caption)
- "Keena the Voidslayer. One world. Free." (devlog close)
- "2 Months → 2 Years" (devlog title)

## Facts

| Field | Value |
|---|---|
| Title | Keena The VoidSlayer |
| Studio | Crowning Games (purple splash with the Crowning logo before the title) |
| Genre | 2D action-adventure platformer, "reminiscent of retro Kirby games" |
| Engine | Godot 4.7, GL Compatibility renderer |
| Resolution | 320×180 native pixel art; 1280×720 default window; integer scaling; movie-maker override 1920×1080 |
| Platforms in the repo | Export presets for **Web** and **macOS** (the web build hides Quit); keyboard and gamepad; the code also handles Linux and Steam Deck window scaling |
| Scope | World One: a tutorial plus five levels, three minibosses and a wave arena, one boss (Millie), opening and ending cutscenes, credits |
| Price | Free (decided 2026-01-29) |
| Status | Final polish pass, not yet released (see [09](09-current-state.md)) |

## Core loop

1. Title screen → New Game (opening cutscene, then the tutorial) or Load Save. One save slot is used.
2. A world map hub: Keena walks dotted trails between five level stops.
3. In a level: platform through sections, command Moku to fight and solve puzzles, purify corrupted plants and
   animals to absorb their goop, find the Rainbow Prisms (three per level in Levels 1 to 4).
4. Absorbed goop fills a meter and makes Moku grow SMALL → MEDIUM → LARGE; bigger Moku breaks bigger things.
5. Each of Levels 1 to 4 ends at a gate: a prism beat, Keena walks off into a dithered black edge, a rainbow, and an
   absorption rank (S, A, B, C or F by the share of the level's goop captured).
6. Level 5 ends with the Millie fight and one of two endings, depending on whether all 12 prisms were found, then
   credits.

Levels unlock in order. The tutorial (level 0) is not on the map.

## What makes it different (for clip angles)

- **A companion as the weapon.** Most of the action is Moku stretching out, latching on and hauling things around.
- **Growth as a reward.** The same blob visibly gets bigger as you purify the level.
- **Purify, don't kill.** Corrupted wheat, petunias, bamboo and bunnies turn back to normal; defeated minibosses
  burst into goop.
- **A rhythm level.** Solfege Steppe's platforms switch on the beat of the music, ending in a chase by a giant bass
  clef.
- **Ride the acorn.** In Millie's Hive, Moku eats a giant acorn, becomes a huge rolling ball, and Keena rides on top
  of it down a hill course, ending in a launch off a ramp through a wall of rock.
