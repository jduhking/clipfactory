# 07 Art and audio

## The look

- **Pixel art at 320×180**, nearest-neighbour, integer scaled (4× = 1280×720, 6× = 1920×1080). Any upscaling
  that isn't a whole number blurs it; the game's own camera never zooms below 1× for the same reason.
- Bold dark outlines, chibi proportions, soft pastel worlds against **void purple-black** corruption with glowing
  white eyes.
- Dithered black edges for exits, dithered pits, a custom shader that fuses Moku's sprite into whatever he grabs.
- Some backgrounds are low-poly 3D renders reduced to pixel art (the Level 5 corrupted plains is a Blender scene
  rendered at 1280×720 and reduced to 320×180). The clipfactory low-poly cold open follows the same idea.
- Font: **Abaddon** (pixel font).
- Dialogue boxes are 244×74 cards with a named tab (Keena, Moku, Cleo, Bartholomew, Millie) and a 58×60 portrait.
- Studio splash: the Crowning Games logo on purple `#4A2B77`.

## Title screen

By Cammi (posted 2026-11-22): a 14-frame 320×180 animated loop at 0.35 s per frame. Keena stands on a grassy hill by a
big leafy tree, looking up at a swirling vortex of blue sky and white clouds. The animated logo is 160×108, 15 frames.
Files: `Sprites/UI/TitleScreen/title_background.png`, `title_logo.png`, `menu_buttons.png`.

## Palettes

Six dominant swatches per image, extracted from the game files (share of opaque pixels), plus a reading of the
image. Use these to colour-match generated shots to the game.

| Image | Feel | Swatches |
|---|---|---|
| Title screen | Bright, airy, wonder | `#70BFFF` `#81AAA9` `#FDFAFA` `#3F4B56` `#6DB8FF` |
| Opening night | Quiet, mysterious | `#180892` `#016D75` `#021630` `#05656D` `#0B4958` |
| Petunia Plains | Soft, dreamy pinks over deep purple | `#43374F` `#CECDCF` `#807189` `#483549` |
| Carrot Crossing | Warm, sunny, surreal | `#702F0C` `#C86919` `#AB6D3E` `#BD6A30` `#D59F3D` |
| Sakura Forest (tree) | Blossom pink and violet | `#F8AFD0` `#372A3A` `#7C2A81` `#85177A` `#9D79DE` |
| Solfege Steppe | Calm blues, overcast | `#CCD4D2` `#397495` `#5A99BB` `#BACBCF` `#7BB0C7` |
| Corrupted plains (Level 5) | Drained, melancholy lavender | `#B8A8BF` `#CAAFC5` `#AE9EB6` `#87748F` `#D3C8D3` |
| Purified tree (ending) | Cheerful, restored | `#52C097` `#405253` `#1995D4` `#E8FFEA` `#8DD9AA` |
| Keena sprite | Pink hair, red accents | `#F3597B` `#D77491` `#D0354A` `#A99F95` `#C5CEBE` |
| Moku sprite | Near-black navy, white eyes | `#212559` `#2D2A5E` `#0B1236` `#1A1F50` `#FFFFFF` |

The colour story for clips: **pastel and saturated where it's healthy, drained lavender and grey where the Void has
been, near-black navy-purple for the Void itself.** Purification is a return of colour.

## Art assets worth using in clips

| Asset | Path (game repo) |
|---|---|
| Keena sheet (124 frames, 64×64) | `Sprites/Player/keena_sprite_sheet.png` (+ `.aseprite`) |
| Moku sheet (75 frames), faces, ball | `Sprites/Moku/` |
| Cleo (idle, walk, cry, caged) | `Sprites/Entities/Cleo/` |
| Barto (idle, hurt, walk) | `Sprites/Entities/Barto/barto_complete.png` |
| Millie (41 frames, 144×144), explosion sheets, seated point | `Sprites/Entities/Enemies/Boss/Millie/` |
| Miniboss sheets | `Sprites/Entities/Enemies/MiniBoss/{Carrnage,Sunnie,TroubleClef}/` |
| Level backgrounds | `Sprites/Backgrounds/{PetuniaPlanes,CarrotCrossing,SakuraForest,SolfegeSteppe,Level5}/` |
| Opening panels: night, meteor, clean map, hive before, corrupted tree | `Sprites/Cutscenes/Opening/` |
| Ending: purified tree, departure, dev-team portraits | `Sprites/Cutscenes/Ending/` |
| Title loop and logo | `Sprites/UI/TitleScreen/` |
| Source art (GIFs, Blender files, originals) | `docs/art/sources/` |
| Moodboard (Vi Nguyen) | This project's Knowledge Base: KTVS DS Style Moodboard.png |

## Soundtrack

All in `Audio/Music/`. Most are marked "rough mix"; several mp3/wav names misspell the title ("Voidslapyer").

| Track | Where it plays |
|---|---|
| Title Theme (no mix) | Title screen; the devlog cold-open music |
| File Select (rough mix) | Save select |
| opening_night | Opening cutscene |
| level_select | World map (also the opening's finale) |
| general_track_1 | Tutorial and Petunia Plains |
| Petunia Plains Track (revised) | Loaded as the tutorial track, though the tutorial now plays general_track_1; the devlog's "Petunia Plains Track" |
| General Track #2 | Carrot Crossing |
| General Track #3 | Sakura Forest |
| Metronome tracks (100 BPM tambourine, 75 BPM click) | Solfege Steppe's beat sections; the chase runs at 50 BPM |
| MiniBoss Track | Petals, Carrnage, Trouble Clef |
| Approaching The Boss | Millie's Hive reveal |
| Layer 1 / 2 / 3 Boss Battle | Millie, stacking by phase |
| Level Complete Jingle | End of a level |
| Keena's Death, Game Over | Death and game over |
| Friendship Theme Original | The good ending into the credits |
| Up up and Away, Uncanny Valley | OST pieces the devlog script uses (reflective, melancholic) |

Credit the composer before using any track publicly; the repo doesn't name one.

Sound effects (`Audio/Sound/`, 53 files) include lunge, grab, yank, throw, goop absorbed, animal purified, Moku grow,
prism pickup, rock break, carrot break, petals unfurl and launch, note switch and warning, boss force-field hit,
portal swirl, crowd cheer, boulder roll, "it's boss time" and miniboss defeated.
