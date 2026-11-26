# Keena the Void Slayer trailer (sample video)

`keena-trailer-live-intro.mp4` is a sample video to try Clip Factory on: the Keena the Void Slayer trailer with a new
live-action-style cold open. It is 78.1 s long, 1920×1080 at 30 fps, H.264 video with AAC stereo sound, 46 MB.

| Time | What happens |
|---|---|
| 0–6.3 s | The camera starts low at Keena's boots in wet grass and rises behind her to reveal Leporidia: the valley, the giant tree and a swarm of voidlings. |
| 6.3–10 s | The giant tree and its hive, corrupted by purple void in a storm. It cuts on a lightning flash. |
| 10–11.7 s | Close-up of Keena's serious stare on the big hit. |
| 11.7–14.2 s | The music stops dead. She pulls a goofy face, Moku floats up beside her and copies it, and a bassoon and tuba sting lands on A, the key the trailer opens in. |
| 14.2–78.1 s | The original trailer, without its old 3D shot (9.0–13.07 s of the original). That shot is exactly 8 beats long, so the music stays on the beat. |

Keena is played as a live-action character: a young woman in a practical version of her costume. Moku is as he is
in the game: a small floating dark-teal blob with bunny ears and no legs.

## How it was made

| Step | Tool | Cost |
|---|---|---|
| Two 17 s drafts of the whole intro to block the shots, the second in live-action style | Seedance 2.5 omni-reference on MuAPI at 480p, with crops of the style moodboard and a meadow photo as references | $5.78 |
| Shot A, boots to the valley, from a frame of the second draft | Veo 3.1 Fast image-to-video on MuAPI | refunded by MuAPI |
| Shot B, the corrupted tree | Veo 3.1 Fast text-to-video | $0.78 |
| Shot CD, the stare to the goofy face, from a frame of the second draft | Veo 3.1 Fast image-to-video | refunded by MuAPI |
| Music | `score.py`, from VSCO 2 Community Edition orchestral samples | free |
| Edit, grade, film grain and the 24 to 30 fps conversion | ffmpeg | free |

The total was $6.56 against a $10 budget. Veo was asked for 1080p but returned 720p, so `build.sh` scales the shots up.
Veo's own sound is not used.

The score follows the 3D intro's harmony (D major, D minor, B flat, C) into an A minor hit on Keena's face. Every
note is a recorded instrument: string sections, horn, trombone, tuba, bassoon, clarinet, timpani, gong and cymbals,
with a woodblock and vibraslap for the joke. Only the wind and the reverb are shaped noise.

## Rebuild it

You need ffmpeg, Python 3 with numpy, scipy and soundfile, and the original trailer, `keenathevoidslayertrailer.mp4`,
from the [Knowledge Base](https://factory.8090.ai/project/8285d823-63bb-4371-8922-2c2c4975ec86/knowledge-base/7c45dd12-4742-434d-a822-050440785cf4). It is not in the repo.

The three Veo takes are not in the repo either. The ones used here can be downloaded until 25 December 2026:

```sh
cd samples/keena-the-void-slayer/generator-v2
mkdir -p out/takes
curl -L -o out/takes/clipA-1.mp4 https://cdn.muapi.ai/outputs/generated/271c588e-580d-44de-a9e7-173334c02a8e_4f05adf3.mp4
curl -L -o out/takes/clipB-1.mp4 https://cdn.muapi.ai/outputs/generated/5988257d-8503-4723-96cc-f56e505a6216_8f5cc22f.mp4
curl -L -o out/takes/clipCD2-1.mp4 https://cdn.muapi.ai/outputs/generated/3e8255cd-8501-4b59-90bb-2ada8ba29293_8ef1f6ad.mp4
PYTHON=python3 bash build.sh /path/to/keenathevoidslayertrailer.mp4
```

`build.sh`:

1. downloads the VSCO samples the score uses into `out/vsco` on the first run, about 800 MB;
2. cuts the three takes, scales them to 1080p, grades them, adds film grain and converts them to 30 fps;
3. renders the score to the cut and removes the old 3D shot from the trailer's sound;
4. writes `out/keena-trailer-live-intro.mp4` (two-pass H.264 at 4.6 Mbps, as committed here) and `out/intro-live.mp4`
   (the intro on its own).

To make new takes instead, set `MUAPI_API_KEY` and run `python3 muapi.py run clipA` (or `clipB`, `clipCD2`). Each shot
costs about $0.78 and comes out different every time, so check the trims and cue times at the top of `build.sh`
afterwards. `muapi.py price <job>` shows the cost first, and `run` refuses any job that would take the total in
`out/ledger.json` past `BUDGET_USD` (default 10). Shots A and CD start from frames of the second draft, upscaled to
1920×1080 in `out/keys/`: 0.17 s for A and 12.70 s for CD. That draft can be downloaded until the same date
from https://cdn.muapi.ai/outputs/generated/bd42150e-f1b5-4ad6-a17a-1f878f81f1b2_1a982641.mp4.

## What is where

| File in `generator-v2/` | Contents |
|---|---|
| `jobs.json` | Prompts and settings for every generated shot, including both drafts and `clipCD`, a first take of CD that made Moku a rabbit on her shoulder |
| `muapi.py` | MuAPI client: prices a job, keeps to the budget, runs it and downloads the take. `reconcile` records what MuAPI actually charged. |
| `score.py` | The intro's music, timed to `out/cues.json` |
| `fetch_vsco.py` | Downloads the VSCO samples the score uses |
| `assemble_audio.py` | Removes the old 3D shot from the trailer's sound and joins it after the intro |
| `build.sh` | Cuts, grades and scores the intro, then encodes |

## The earlier 3D intro

`generator/` holds the first version: a toon-shaded Three.js intro rendered in software, with synthesised music.
`bash generator/build.sh /path/to/keenathevoidslayertrailer.mp4` writes it to `generator/out/keena-trailer-3d-intro.mp4`
in about 15 minutes on 8 CPU cores. It needs Node 20 or later as well; see the comments at the top of the script.

## Credits

- Character reference: the KTVS DS style moodboard, art by Vi Nguyen.
- Look reference for the second draft: [Soda Springs Meadow](https://commons.wikimedia.org/wiki/File:Soda_Springs_Meadow.jpg),
  Wikimedia Commons, public domain.
- Orchestral samples: [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) by Versilian Studios, CC0.
