# Keena The VoidSlayer: game knowledge base for clips

Everything Clip Factory needs to know about **Keena The VoidSlayer** to make clips, trailers and devlog cuts:
what the game is, who is in it, how it looks and sounds, how it was made, where it stands, and what video work
already exists.

It was compiled on 2026-11-25 from the game repository `crowninggames/KeenaTheVoidSlayer`, branch `dev` at
`ebbb1bbe` (the working branch; `main` stopped in July 2024), plus the trailer and moodboard in this project's
Knowledge Base and the trailer work in this repo. The game repo's own agent docs (`docs/agent-kb/`) are the deepest
source; this set restates what matters for video and points to them for engine detail.

## Pages

| Page | Use it for |
|---|---|
| [01 Overview](01-overview.md) | The pitch, loglines, hard facts, the core loop |
| [02 Characters](02-characters.md) | Who is who, how each one looks, voice and design rules |
| [03 World and levels](03-world-and-levels.md) | Lepordia, the five levels, what happens in each |
| [04 Enemies and bosses](04-enemies-and-bosses.md) | Every enemy, the minibosses, the Bass Clef chase and Millie |
| [05 Mechanics](05-mechanics.md) | What the player does, controls, the moves worth showing |
| [06 Story and dialogue](06-story-and-dialogue.md) | The plot beat by beat, both endings, quotable lines |
| [07 Art and audio](07-art-and-audio.md) | Look, palettes per level, the soundtrack, usable assets |
| [08 Development history](08-development-history.md) | Team, timeline, cut features, the devlog story |
| [09 Current state](09-current-state.md) | What is finished, what is still open, as of 2026-11-25 |
| [10 Marketing and clips](10-marketing-and-clips.md) | Existing trailer and devlog material, clip ideas, capture notes |

## Ten facts to get right

1. The title is **Keena The VoidSlayer** (the project file spells it so; the logo reads "Keena THE VOIDSLAYER").
   The studio is **Crowning Games**.
2. **Moku is not a rabbit.** He is a small floating dark blob with two bunny-ear points and no limbs. Image models
   and captioners keep calling him "a small black rabbit"; prompts must say otherwise.
3. Keena does not fight alone. **Every attack goes through Moku**: lunge, grab, yank, throw. It is *not* a Kirby
   inhale game, even though it is pitched as Kirby-inspired.
4. Barto is a **cat** knight. Keena calling him a raccoon is the running joke.
5. Cleo is Keena's little **brother** ("Is he okay?"). He is kidnapped in the opening.
6. There are **12 Rainbow Prisms** (3 in each of Levels 1 to 4). All 12 give the good ending. The game repo's
   dialogue page says "13"; the code says 12.
7. The world is **Lepordia** in the game's narration. The trailer's end card says "Save **Leporidia**".
   Pick one before captioning anything; the game text is the source of truth today.
8. The shipped scope is **World One: five levels plus a tutorial**. Four more worlds were cut on 2026-01-29.
9. It is planned to be **free**. The devlog script points to Steam; the trailer end card says Itch.io.
10. Native resolution is **320×180**. Gameplay capture must be integer-scaled (6× for 1080p) to stay crisp.

## Open questions for the team

- Lepordia or Leporidia?
- Steam, Itch.io or both, and is there a release date now that the September 2026 target has passed?
- The devlog's wishlist figure is still a placeholder ("a couple hundred [NUMBER?]").
- Which contributor handles map to which credited names (see [08](08-development-history.md#team)).

## Refreshing this

The game moves fast (330 files changed on 2026-11-25 alone). To refresh: pull `dev`, reread
`docs/agent-kb/INDEX.md`, `13-dialogue-transcript.md`, `bug_list.txt` and `docs/specs/final-update-pass.md`, and
run `git log origin/dev --since=<last refresh>`.
