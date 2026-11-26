# 04 Enemies and bosses

Behaviour comes from the game's `docs/agent-kb/05-enemies.md` and the level scenes. Looks are read from each sprite
sheet's first frame (`Sprites/Entities/Enemies/...`); treat them as a guide and check the sheet before generating
art. Almost every enemy is void-touched: purple-black with glowing white eyes.

## Regular enemies

| Enemy | Levels | What it does | Look |
|---|---|---|---|
| **Pawn** | 1, 2, 4, 5 | Chess-piece minion that walks surfaces; a floating version chases in the air (also in 3) | Round dark-purple body, glowing outline, jagged white eyes |
| **Rook** | 2, 3, 4, 5 | Chess-piece brute: walks, charges, raises a shield, gets stuck | Pale body with purple base and curved golden horns |
| **HornHopper** | 1, 2, 4, 5 | Bounces along; turns and reverses on wall hits | Teal insect with a long curved horn and purple legs |
| **Nellie** | 1, 2, 4, 5 | Flyer; still hits terrain when thrown | Heart-shaped red and navy flyer |
| **Dandy Lion** | 1, 2, 4 | Plant that fires petals; its head can be pulled off | Orange grinning flower head with glowing eyes on a leafy stem |
| **Vetunia** | 1, 5 | Void petunia whose plant head lunges; Moku can pull the head | Dark purple bulb with fangs and a purple glow |
| **Caraang** | 2, 3 | Carrot creature; Moku pops its head off on the first grab; Carrnage summons them | Orange round body with a green leafy crown and a toothy grin |
| **Goopa** | 3 | Walks, jumps, hides in a shell; Keena can ride on top | Stout purple-and-grey creature with green eyes and feet |
| **Ugnet** | 3 | Masked flyer that swoops and fans tornadoes; Moku peels its mask off and Keena can throw the mask | Red-faced masked head with a long snout and a spiky purple aura |
| **Pandor** | 3 | Climbs bamboo stalks and aims at Keena | Orange-and-purple creature with a spiky mane |
| **Dark Onna** | 3 | A chain of orbs Moku yanks off one at a time; carries the keys for key doors | Pale grinning face with dark purple hair |
| **DeathNote** | 4 | Hopping music note that spawns on the beat; Keena can grab and throw it | Dark purple note with a horned head, white grin and purple flames |
| **Void bee** | 5 | Waits in swarms, chases once on screen; Millie also summons rings of them | Small corrupted bee |
| **Cactus** | not placed | Group that jumps and splits | — |

Cut and removed in the 2026-11-20 cleanup: Knight, VoidBird, Chucknaut, the Aladdin-themed birds, the void ant,
Homies (purified animal friends, including a starfish) and a sea otter. These can appear in devlog "cut features"
montages from old commits.

## Corrupted things to purify

Not enemies, but purification targets that give goop: **corrupted wheat** (Carrot Crossing), **corrupted petunias**
(Petunia Plains), **corrupted bamboo** (Sakura Forest) and **corrupted bunnies** (Levels 1, 2 and 4), which hide in
bushes. Moku lunges into them and they return to normal (with an "animal purified" sound).

## Minibosses

All three use a goop-burst defeat ("Mario & Luigi-style": a recoil, then they pop into goop) and the MiniBoss track.

### Petals (Sunnie): Petunia Plains, optional side room

An angry sunflower: dark purple face, white eyes, yellow petals, teal stem. It does three short hops, then a
telegraphed big hop, crouches and shudders, then fires a **ring of petals**. Spam it with lunges and it does an
escape hop that lands on Keena.

### Carrnage: Carrot Crossing

A giant carrot with a big glowing purple eye. It bursts out of the ground at the start, burrows and resurfaces,
rushes and skids, and slams into walls (screen shake, rock debris). It can't be grabbed: Keena **uproots the arena's
vegetables and throws them at it** (5 HP, about three hits); crops regrow every 5 s. While burrowing it launches up to
two Caraangs.

### Trouble Clef: Solfege Steppe

A dark purple, wide-eyed creature whose tail curls into a giant musical note, fought on a five-line staff. It
alternates three-note volleys with summoning waves of 1 to 5 DeathNotes, then does a warned dash and relocates.
4 HP. Beating it releases a Rainbow Prism.

### Enemy Gang: Sakura Forest arena

Not a single boss but a wave fight: 3 to 5 waves of 1 to 5 enemies from a pool.

## Chase hazard: Bass Clef (Solfege Steppe)

A giant bass clef that slides in after a zoom-out reveal and crawls after Keena; contact is instant death. Thrown
enemies push it back and make it flash.

## Boss: Queen Millie (Millie's Hive)

18 HP, three cumulative phases. Moku lunges chip her for 0.5; **throwing her own bees back** deals 2.

- **Parabola flight** with two escort bees firing shots.
- **Swoop** dives from a high perch.
- **Bee summon:** a portal opens and six bees fan into a ring.
- **Spear smash:** a full spear swing, a hidden then locked floor warning, a drop, and she gets **stuck in the floor**
  (a pull-out animation): the opening to hit her.
- **Shield billiards:** after a shriek she raises a shield and ricochets diagonally around the arena.
- **Unshielded rush:** two or three passes, each either low (jump over) or high (duck under).

Music: three layered boss tracks that stack as phases progress. Defeat leads straight into the ending.
