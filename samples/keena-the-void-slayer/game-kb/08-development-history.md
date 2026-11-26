# 08 Development history

Sources: the git history of every branch (1,924 commits, 2024-05-18 to 2026-11-25), the devlog script
(`VideoAssets/Keena_Devlog_Script.docx`) and its chart clips.

## Team

**Crowning Games**, a group of college friends who had been doing small game jams together.

The in-game credits list six developers, in this order: **Cammi, Zach, Oscar Else, James, Ray, Lanz**. Cammi and
Lanz are credited for sprites; Cammi made the title-screen animation and Millie's defeat explosions. The devlog thanks
"Cammi, Oscar, Lanz, Ray, Zach, Vi, everyone at Crowning Games". Vi Nguyen drew the KTVS DS Style Moodboard.

Commit authors (git handles; most don't map to the credit names on record):

| Author | Commits | Active |
|---|---|---|
| James Odebiyi (jduhking, JtheKing) | 1,806 | 2024-05 to now; lead and nearly all code since late 2024 |
| JPRR212 | 65 | 2024-05 to 2024-11 (world map, up-binding, ladders, corrupted animals) |
| powellisaac6 | 29 | 2024-05 to 2024-08 (transitions, world-map states, code review) |
| Tommy Nguyen | 17 | 2024-05 to 2024-07 (a bee enemy and its charge) |
| Carlos | 6 | 2024-07 to 2024-08 |
| Vi Nguyen | 2 | 2024-07 (comment-to-audio) |
| Michael | 1 | 2025-05 (a controller fix) |

Art and music largely live outside git (Discord `#pixel-art`, the source folders), so commit counts understate the
artists' work.

## The story the devlog tells

Title: **"2 Months → 2 Years"**, a confessional ~10-minute postmortem with a hopeful ending.

1. **May 2024, the summer dream.** Students decide to make "a short, marketable game we could ship in a summer and
   put on Steam". A team vote picks "a small girl with bunny-ear hair and a shapeshifting shadow companion who eats
   corruption out of the world". Keena means courage; Moku means charcoal.
2. **Building everything.** A three-hit melee combo, a club, an air-slash, an ability wheel to swallow and copy
   enemies ("full Kirby"), an umbrella glide, a grapple hook, ladders, a homing clone bomb. "Every one of these
   worked. And almost every one of these is gone. We were building four different games at once."
3. **Fall 2024, the cliff.** School and jobs return. Discord went from over a thousand messages a month to almost
   nothing. Deadlines missed: Steam Next Fest March 2025, June 2025, "World 1 flawless by August" 2025, November
   2025, February 2026. A programmer who did much of the early art left; the main sprite artist was running on empty.
4. **2026-01-29, the decision.** "We're ending the game at World One." Three more worlds, extra Moku forms and half
   the mechanics are cut, and the game will be **free**. "A finished game that's one great world is a game."
5. **The final push.** One world, five levels, minibosses and the Millie boss fight "that took me weeks to get
   right". Target: end of September 2026.
6. **Lessons.** Open-ended scope is the enemy, not scope; deadlines force the cut; a team of students is not a
   studio; nobody owes you attention ("a couple hundred wishlists after two years", still a placeholder).

The deadline chart's last entry is "the real one": September 2026, end of Q3. As of 2026-11-25 that one has passed
too, and the game is in its final polish pass ([09](09-current-state.md)).

## Timeline from the commits

| When | What happened |
|---|---|
| 2024-05-18 | First commit. Movement and a variable-height jump within three days |
| 2024-06 | The busiest month (299 commits). Clone bomb, first level design, a Godot 4.3 branch |
| 2024-07 | Scene transitions, Moku carrying things; `main` frozen on 2024-07-13 (PR #45, Moku pickup fix) |
| 2024-08 | File select, menus, the world map; `release-playtest-3` (2024-08-31) |
| 2024-09 | Checkpoints, lives, level altar data; world map and ECS work merged |
| 2024-10 | `qa-session-release` (2024-10-01); grapple hook feel; a void ant enemy; corrupted-animals branch |
| 2024-11 to 12 | Directional lunge, a column form, glide, a starfish "homie", a coconut, the ball transform |
| 2025-01 to 04 | Slash and "blitz" attacks, rolling, a club swing; then the lunge command state, wall-jump timing, grabbing, momentum and skids |
| 2025-05 | Level 2 and its miniboss (Carrnage, Caraang); `gia` branches |
| 2025-06 to 07 | Chucknaut and a sand-shooting crab (both later cut); playtest prep; boss-fight zooms; gamepad support |
| 2025-08 to 09 | Trouble Clef and a two-beat level cadence; Dandy Lion art; Millie's flight; a big code revamp |
| 2025-10 to 12 | Rainbow Prism collecting, Goopa, a rebuilt throw, death animations; upgraded to Godot 4.5 |
| 2026-01 | Enemy health bars, the bunny, winged petunias, Moku slams, larger Mokus; the scope cut on the 29th |
| 2026-02 | Upgraded to Godot 4.6; Level 1 revamp |
| 2026-03 to 05 | Petals, Level 1 progression, pendulum petunias, rope work, the end-of-level routine, bulb switch, Carrnage bursting from the ground |
| 2026-06 to 08 | A cleanup refactor, SMB2-style grass tiles, a lot of World 3 (Sakura Forest) |
| 2026-10 | Godot 4.7; an in-editor agent dock and ten Godot skills added. From here the work is done with AI coding agents working from the repo's agent knowledge base |
| 2026-11-20 to 25 | An agent playtest and the final-update spec; the ending, opening and menus polished; about 100 automated check scripts; a 48-bug QA pass, all fixed |

In 2026 there are few commits but very large ones (the 2026-11-22 commit alone touched 1,643 files), so commit counts
understate how much changed this year.

## Branches

`dev` is the real line (1,374 commits ahead of `main`). Older branches are snapshots: `release-playtest-3`,
`qa-session-release`, `featureCorruptedAnimals`, `featureWorldMap`, `gia`/`gia-test-branch`, and small 2024 feature
branches. Useful for "then vs now" footage: check out an old branch and capture it.

## Devlog clip assets already made

In the game repo's `VideoAssets/` (1920×1080):

| Clip | Length | Shows |
|---|---|---|
| `01_the_cliff.mp4` | 3.9 s | Bar chart "THE CLIFF": git commits per month over 26 months, 1,904 commits, the May 2024 spike and the fall |
| `02_same_shape.mp4` | 5.7 s | Commits and Discord activity, each indexed to its own peak, tracing the same shape |
| `03_deadlines.mp4` | 5.1 s | Deadline tombstones marked R.I.P. and missed, ending on "the real one", September 2026 |

Each has a matching `.png` thumbnail.
