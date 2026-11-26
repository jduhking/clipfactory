# Keena the Void Slayer trailer (sample video)

`keena-trailer-lowpoly-intro.mp4` is a sample video to try Clip Factory on: the Keena the Void Slayer trailer with a
new low-poly pixel-art cold open. It is 78.1 s long, 1920×1080 at 30 fps, H.264 video with AAC stereo sound, 47 MB.

| Time | What happens |
|---|---|
| 0–6.3 s | The camera starts at Keena's boots on a dirt path and cranes up around her to reveal Leporidia: the valley, the giant tree with its hive and a swarm of voidlings. |
| 6.3–10 s | The giant tree and its hive, half taken by purple void in a storm. Lightning strikes the canopy and it cuts on the flash. |
| 10–11.7 s | Close-up of Keena's serious stare on the big hit. |
| 11.7–14.2 s | The music stops dead. She crosses her eyes and sticks her tongue out, Moku floats up beside her, glances at her and copies it, and a bassoon and tuba sting lands on A, the key the trailer opens in. |
| 14.2–78.1 s | The original trailer, without its old 3D shot (9.0–13.07 s of the original). That shot is exactly 8 beats long, so the music stays on the beat. |

## The look

The intro is real 3D, rendered at 320×180 and scaled up exactly 6× with nearest neighbour, so each rendered pixel
is a sharp 6×6 block, about the size of the pixels in the gameplay it cuts into. Surfaces are flat-shaded low poly in
four tones each, from a limited palette taken from the KTVS DS style moodboard and the game. Fog falls off in steps,
edges get 1-pixel ink outlines, the storm sky is solid bands with dithered edges and the rain is pixel streaks.
Keena and Moku follow the moodboard: Moku is a small floating dark-teal blob with bunny ears and no limbs.

## How it was made

| Step | Tool | Cost |
|---|---|---|
| The intro | A Three.js scene in `generator-lowpoly/`, rendered frame by frame in headless Chromium with software WebGL | free |
| Music | `generator-v2/score.py`, from VSCO 2 Community Edition orchestral samples, on the same cues as the live-action version | free |
| Edit and encode | ffmpeg | free |

This version cost nothing. The live-action version before it spent $6.56 of the $10 budget on Seedance and Veo, and
that total is unchanged.

The score follows the first 3D intro's harmony (D major, D minor, B flat, C) into an A minor hit on Keena's face.
Every note is a recorded instrument: string sections, horn, trombone, tuba, bassoon, clarinet, timpani, gong and
cymbals, with a woodblock and vibraslap for the joke. Only the wind and the reverb are shaped noise.

## Rebuild it

You need Node 20 or later, ffmpeg, Python 3 with numpy, scipy and soundfile, and the original trailer,
`keenathevoidslayertrailer.mp4`, from the [Knowledge Base](https://factory.8090.ai/project/8285d823-63bb-4371-8922-2c2c4975ec86/knowledge-base/7c45dd12-4742-434d-a822-050440785cf4). It is not in the repo.

```sh
cd samples/keena-the-void-slayer/generator-lowpoly
PYTHON=python3 bash build.sh /path/to/keenathevoidslayertrailer.mp4
```

`build.sh`:

1. installs Three.js, Playwright and Playwright's Chromium on the first run;
2. renders the intro's 425 frames at 320×180, about 20 s on 8 CPU cores (no GPU needed);
3. downloads the VSCO samples the score uses into `generator-v2/out/vsco` on the first run, about 800 MB;
4. renders the score to the intro's cues and removes the old 3D shot from the trailer's sound;
5. writes `out/keena-trailer-lowpoly-intro.mp4` (two-pass H.264 at 4.2 Mbps, as committed here) and
   `out/intro-lowpoly.mp4` (the intro on its own).

To look at one moment, run `python3 -m http.server 8393` in `generator-lowpoly/` and open
`http://127.0.0.1:8393/scene/index.html?t=3.75&scale=4`, where `t` is in seconds and `scale` blows the 320×180
frame up for viewing. With that server running, `node render.mjs --stills <dir> 3.75 7 13.9` saves stills instead.

## What is where

| File in `generator-lowpoly/` | Contents |
|---|---|
| `scene/kit.js` | The palette, the four-tone shaders and geometry helpers |
| `scene/chars.js` | Keena and Moku, their faces and their animation |
| `scene/world.js` | The hill, the valley, the giant tree and hive, the void, the voidlings, the storm and the bolt |
| `scene/main.js` | The three shots' cameras and timing, and the pixel pass: outlines, sky, rain and the lightning flash |
| `render.mjs` | Renders frames or stills in headless Chromium |
| `build.sh` | Renders, scores and encodes |

## Earlier versions

`generator-v2/` made the live-action version: two Seedance 2.5 drafts to block the shots ($5.78), then the three
shots with Veo 3.1 Fast on MuAPI ($0.78 after refunds), graded with ffmpeg. The low-poly build reuses its score and
sound editing. To rebuild it, download the three takes (available until 25 December 2026) and run its `build.sh`,
which writes `generator-v2/out/keena-trailer-live-intro.mp4`:

```sh
cd samples/keena-the-void-slayer/generator-v2
mkdir -p out/takes
curl -L -o out/takes/clipA-1.mp4 https://cdn.muapi.ai/outputs/generated/271c588e-580d-44de-a9e7-173334c02a8e_4f05adf3.mp4
curl -L -o out/takes/clipB-1.mp4 https://cdn.muapi.ai/outputs/generated/5988257d-8503-4723-96cc-f56e505a6216_8f5cc22f.mp4
curl -L -o out/takes/clipCD2-1.mp4 https://cdn.muapi.ai/outputs/generated/3e8255cd-8501-4b59-90bb-2ada8ba29293_8ef1f6ad.mp4
PYTHON=python3 bash build.sh /path/to/keenathevoidslayertrailer.mp4
```

`jobs.json` holds every prompt. `muapi.py` makes new takes: set `MUAPI_API_KEY` and run `python3 muapi.py run clipA`
(or `clipB`, `clipCD2`). Each shot costs about $0.78, and `run` refuses any job that would take the total in
`out/ledger.json` past `BUDGET_USD` (default 10).

`generator/` holds the first version: a toon-shaded Three.js intro with synthesised music.
`bash generator/build.sh /path/to/keenathevoidslayertrailer.mp4` writes `generator/out/keena-trailer-3d-intro.mp4`
in about 15 minutes on 8 CPU cores.

## Credits

- Character reference: the KTVS DS style moodboard, art by Vi Nguyen.
- Orchestral samples: [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) by Versilian Studios, CC0.
- Look reference for the live-action version's second draft: [Soda Springs Meadow](https://commons.wikimedia.org/wiki/File:Soda_Springs_Meadow.jpg),
  Wikimedia Commons, public domain.
