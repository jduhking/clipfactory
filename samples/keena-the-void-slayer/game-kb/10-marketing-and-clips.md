# 10 Marketing and clips

## What already exists

| Piece | Where | Notes |
|---|---|---|
| **Original trailer**, 68 s | This project's Knowledge Base: `keenathevoidslayertrailer.mp4` | Pixel-art gameplay trailer, beats below |
| **KTVS DS Style Moodboard** | Knowledge Base: `KTVS DS Style Moodboard.png` | Vi Nguyen's reference for Keena and Moku |
| In-game screenshot | Knowledge Base | Shows Moku as a navy blob with ear points |
| **Trailer with a new cold open**, 78.1 s | This repo: `samples/keena-the-void-slayer/` ([PR #19](https://github.com/jduhking/clipfactory/pull/19)) | A low-poly 3D intro rendered as 320×180 pixel art, then the original trailer from 14.2 s |
| Earlier cold-open versions | Same folder: `generator/` (Three.js toon, v1), `generator-v2/` (live action with Seedance drafts and Veo 3.1 Fast) | v2 spent $6.56 of a $10 budget; the low-poly one was free |
| **Devlog script** "2 Months → 2 Years" | Game repo: `VideoAssets/Keena_Devlog_Script.docx` | ~10 min, ~1,450 words, with shot, music and edit cues; see [08](08-development-history.md) |
| Devlog chart clips | Game repo: `VideoAssets/01_the_cliff`, `02_same_shape`, `03_deadlines` (.mp4 and .png) | 4 to 6 s each, 1080p |

### The original trailer, beat by beat

| Time | Shot |
|---|---|
| 0 to 9 s | The opening: night narration ("the peace was about to be disrupted...."), the island map, Keena, Cleo and Barto under floating voidlings, "CLEO!!!!", Cleo in a cage |
| 9 to 13 s | A 3D shot of Keena and Moku on a hill (replaced in the new cut; it rendered Moku as a rabbit-like creature) |
| 14 to 19 s | Petunia Plains; the caption "Command Moku" |
| 19 to 28 s | Carrot Crossing and the world map |
| 35 s | Sakura Forest |
| ~44 s | "Save Leporidia" caption over a red sky |
| 49 to 61 s | Millie's Hive: honeycomb halls, Millie, bees, the void portal |
| ~65 s | Title card "Keena THE VOIDSLAYER" and "Play it now on Itch.io" |

## Clip ideas

Short-form first (vertical 9:16 or square), each built on one hook.

| # | Clip | Hook | Source |
|---|---|---|---|
| 1 | "She can't fight. He can." | Keena is tiny; cut to a lunge, grab, yank, throw chain | Any level, Pawns or Rooks |
| 2 | Meet Moku | "how about MOKU?" then him growing SMALL → LARGE | Opening + a purify sequence |
| 3 | "A cat, if ye please." | The raccoon joke, as-is | Opening |
| 4 | "That's a big boi" | Moku eats the acorn, the ride, the ramp launch, "AWESOME!" | Millie's Hive, Area 3 |
| 5 | The level that runs on the beat | Note blocks switching in time, then the Bass Clef chase | Solfege Steppe |
| 6 | Throw the carrots back | Carrnage bursts from the ground; Keena hurls vegetables at it | Carrot Crossing |
| 7 | Purify, don't kill | Before/after colour as corrupted bunnies and plants turn back | Any level |
| 8 | Boss in 30 seconds | Millie's phases cut to the layered boss music | Millie's Hive |
| 9 | Two endings | "I've got every Prism" vs "The Prisms' light isn't whole" (spoiler; save for after launch) | Ending |
| 10 | 2 months → 2 years | The commit-cliff chart and the deadline tombstones, then the game today | Devlog clips + capture |
| 11 | Everything we cut | Old branches: club, glide, grapple, copy abilities, each stamped CUT | `qa-session-release`, `release-playtest-3`, `gia` |
| 12 | Then vs now | May 2024 grey prototype ↔ the current Petunia Plains | Old branch + `dev` |
| 13 | Finishing a game with AI agents | The repo's agent knowledge base, test suites, the 48-bug pass | 2026-10 onward |
| 14 | Free, one world | The scope cut as a promise: "we'd rather actually complete something small" | Devlog section 4:30 to 6:00 |

The devlog script's own music cues: Title Theme for the cold open, "Big World Track" for the cut-features montage
(not in the repo), Uncanny Valley or Keena's Death for the cliff, Friendship Theme for the decision, Petunia Plains
then Sakura Forest tracks for the game, Up up and Away for lessons, Level Complete Jingle into the end card.

## Capturing footage from the game

- **Clean 1080p:** Godot's Movie Maker mode. The project overrides the window to 1920×1080 for movies, which with
  integer scaling is exactly 6× the 320×180 picture. Example: `godot --path . --write-movie out.avi --fixed-fps 60
  res://Scenes/Levels/level_4.tscn` (the project's default movie path is the lead dev's desktop, so pass your own).
- **Jump straight to a moment:** run a level scene directly, or one of the staging scenes in `Tests/Diagnostics/`
  (for example `tutorial_exit_checks.tscn`, `key_door_preview.tscn`). `Tests/ending_flow.tscn -- --auto --good`
  plays the good ending; `--bad-ending` gives the other.
- **Debug helpers** (with `debug_mode` on): 3 for 0.1× slow motion, 4 to spawn enemies, 0 for the debug room; every
  level unlocked.
- **Scale only by whole numbers** (3×, 4×, 6×) with nearest neighbour. For 9:16, crop the 16:9 frame or capture a
  taller window; don't stretch.
- **Old builds:** `git checkout` an old branch (Godot 4.3 era) for "then" footage.

## Rules for generated or redrawn shots

Use these when prompting image or video models, or describing shots to editors:

- **Moku:** "a small floating blob of dark navy-purple goop with two short pointed ear-like tips on top, two small
  white square eyes, no arms, no legs, no tail; not a rabbit, not a bunny, not an animal". Check every output: models
  default to a black rabbit.
- **Keena:** "a small chibi girl with big pink hair styled into two bunny-ear shapes, light green eyes, a teal dress
  with a white collar, dark green boots".
- **Barto:** "a blue-grey cat knight with a white muzzle, dark blue tunic and cape". Not a raccoon (except as a joke).
- **Voidlings and corruption:** purple-black goop with glowing white eyes; corrupted places are drained lavender
  and grey.
- Match the palettes in [07](07-art-and-audio.md#palettes); end any 3D or live-action piece on real pixel-art
  gameplay.
- Use the game's spelling and names; check [README](README.md#open-questions-for-the-team) for the open ones.
