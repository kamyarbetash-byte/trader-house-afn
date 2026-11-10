# cartoon-3d-short: local setup notes

Skill: `.claude/skills/cartoon-3d-short/` in this repo (from github.com/mromidev/claude-animated-shorts @ e3b817b; reference frames/sheets left out, see references/NOTE.md).
Remotion project: `animated-shorts/` (this folder) (composition `BridgeShort`, entry `src/index.ts`, bridge source in `src/videos/bridge/`).
Audio project: `animated-shorts/bridge-short/audio/` (voice goes in `bridge-short/voice/voice.wav` + `words.json`). Where SKILL.md says `~/bridge-short/`, use this folder.

Install: `npm ci && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt` (the cloud environment's setup script does this for new sessions).

## Versions
- Node 22, Python 3.13 (venv at `.venv`: numpy, scipy, pillow), FFmpeg 6.1
- remotion / @remotion/* 4.0.542, react 19, @react-three/fiber 9
- three **0.181.2** (pinned: r182 deprecated and r186 removed PCFSoftShadowMap, which the template uses)
- @react-three/postprocessing **3.0.4** (pinned: 3.0.5+ renders a blank frame inside Remotion's ThreeCanvas)

## Local changes vs the skill templates
- `scripts/bridge-stills.mjs`: browser path and GL backend from env (`REMOTION_BROWSER`, `REMOTION_GL`) instead of a hardcoded Windows Chrome.
- `remotion.config.ts`: uses `/opt/pw-browsers/chromium` and `REMOTION_GL`.
- `src/videos/bridge/Bridge.tsx`: EffectComposer children filtered to satisfy 3.0.4 types (no behaviour change).

## Environment (no GPU in this container)
    export REMOTION_TMP=/tmp/claude-0/remotion-tmp TMPDIR=/tmp/claude-0/remotion-tmp REMOTION_GL=swangle
    node scripts/bridge-stills.mjs out/test/x_ 100,400 0.5
    npx remotion render src/index.ts BridgeShort out/test/clip.mp4 --scale 0.5 --frames 100-129 --concurrency 2 --timeout 240000
On a machine with a GPU, use REMOTION_GL=angle (default). CPU rendering is ~11 s/frame at 0.5 scale.

## Missing optional assets
`public/bridge/kenney/*.glb` (Kenney CC0 Nature/Survival kits: trees, grass, stalls, windmill, canoe...) are not in the
skill repo. The world loads without them (props are skipped); download from kenney.nl and drop the .glb files there for the full look.
