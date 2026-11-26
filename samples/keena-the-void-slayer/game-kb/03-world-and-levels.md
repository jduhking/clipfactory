# 03 World and levels

## Lepordia

An island ("The island is under attack!") described as "a happy go-lucky and peaceful land". The opening map shows a
small house on a green hill, a tree on an islet, water and a pink cloud, and the queen's hive in a giant tree. After the
meteor, shadow creatures spread purple void goop that drains colour and corrupts plants and animals. Spelling: the game
narration says **Lepordia**; the trailer card says **Leporidia** (see [README](README.md#open-questions-for-the-team)).

The world map (`Scenes/LevelSelect/level_select.tscn`) links five stops with dotted trails, in this order:
**Petunia Plains → Carrot Crossing → Sakura Forest → Solfege Steppe → Millie's Hive.** The game's code calls these
levels 1-1 to 1-5 (all World One). An art folder for a sixth area, BluffBeach, exists from the cut scope.

## Tutorial (level 0)

Plays after the opening on New Game. Basic movement and Moku commands, a cracked wall to shatter, no prisms, and a
dithered black edge that leads straight to the world map. Music: General Track 1.

## 1. Petunia Plains

- **Look:** rolling hills of pastel pink flowers, teal-green trees, deep purple foreground. Bright and soft.
- **Music:** General Track 1 (the devlog also cites the "Petunia Plains Track").
- **Set pieces:** the first draggable petunia ("Hmm... how do I get up there?" / "Mrrp! Mrrp mrrp!" / "Oh really?"),
  winged and pendulum petunia platforms Moku yanks into place, ropes, a bulb switch, breakable blocks, a goop bulb
  reveal near the exit.
- **Optional miniboss:** **Petals** (Sunnie), a sunflower, in a side room. Optional encounters never block the main
  route; that is a design rule.
- **Ending:** Barto walks in at the exit gate: "Hmm… ah! Above you, Keena!" A Rainbow Prism drifts down; Barto
  explains the legend. This is where the prism quest starts.
- **Enemies:** HornHopper, Nellie, Pawn and floating Pawn, Dandy Lion, Vetunia, corrupted petunias and bunnies.

## 2. Carrot Crossing

- **Look:** a warm, slightly surreal landscape of giant carrots in cracked golden earth under an orange sun. The
  grass was toned down on 2026-11-25 because it read as neon.
- **Music:** General Track 2.
- **Set pieces:** rope columns that lower and raise whole slabs of floor, a descending ceiling, a winged rotating
  crossing platform, tunnels only Moku fits through, LARGE-Moku-only rocks, vegetables to uproot and throw.
- **Miniboss:** **Carrnage**, a giant carrot that bursts out of the ground, burrows and rushes; Keena throws the
  arena's vegetables back at him, and he summons Caraang carrot heads.
- **Enemies:** Caraang, Rook, Pawn, HornHopper, Nellie, Dandy Lion, corrupted wheat and bunnies.

## 3. Sakura Forest

- **Look:** pink cherry trees, wooden bridges over water, the inside of a hollow tree.
- **Music:** General Track 3.
- **Set pieces:** key doors opened with keys carried by Dark Onna chains, Pandor climbing bamboo, a hidden prism
  passage behind a hatch, corrupted bamboo, an arena with branch platforms.
- **Arena:** the **Enemy Gang**, 3 to 5 waves of mixed enemies.
- **Enemies:** Goopa, Ugnet, Pandor, Dark Onna, Rook, Caraang, floating Pawn.
- Developed most recently ("Alot of progress world 3", August 2026).

## 4. Solfege Steppe (the music level)

- **Look:** calm rolling blue mountains under a pale overcast sky; terrain built from musical staff lines that Keena
  can drop through.
- **Music and rhythm:** the level runs on a metronome. Beat blocks and half-beat blocks switch solid/ghost on the
  beat (an opening 100 BPM corridor of 44 linked blocks), moving wall notes slide on the beat, DeathNotes spawn on
  beats from holes in the staff.
- **Miniboss:** **Trouble Clef**, fought on a musical staff, with an "it's boss time" sting.
- **Chase:** a giant **Bass Clef** crawls in from the left at 50 BPM and kills on contact; Keena pulls ropes to reveal
  note blocks and throws enemies to push it back. Strong clip material.
- **Enemies:** DeathNote, Rook, Pawn, HornHopper, Nellie, Dandy Lion, corrupted bunnies.

## 5. Millie's Hive

- **Look:** outside, the corrupted plains: ash-purple hills, wilted bell flowers, polygonal clouds and goop channels
  under a pink-to-lavender twilight (a low-poly Blender render reduced to 320×180). Then the giant tree, a grey
  spiral hive, and a hive interior of honeycomb hex tiles in browns and tans.
- **Beats, in order:**
  1. Barto lies injured at the entrance and warns her off; Keena: "No, I have to help her. I can get rid of them."
  2. A dead end: Moku eats a giant acorn and turns into a rolling ball ("OH WOW, thats a big boi").
  3. The rolling course: Keena rides Ball Moku down and up hills while void bees chase; a ramp launch smashes through
     rocks ("Wow. That was ... AWESOME!").
  4. The hive reveal: "Moku, it looks like we're here..." Music: Approaching The Boss.
  5. **Millie**, a three-phase boss fight with layered boss music, then the ending ([06](06-story-and-dialogue.md)).
- **Enemies:** void bees, Rook, Pawn, HornHopper, Nellie, Vetunia.
- No prisms in this level; the 12 found in Levels 1 to 4 decide the ending.

## Rainbow Prisms

Three per level in Levels 1 to 4, 12 in total. One sits at each exit gate (always the rightmost HUD slot); the others
are hidden (for example Sakura Forest's hidden passage, and the one released by beating Trouble Clef). They save when a
level is completed and show on the world-map banner.
