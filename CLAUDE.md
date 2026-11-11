# Notes for Claude — Imran Rahbar's video channel

Talk to the owner in **Dari/Persian**. They make short vertical videos for Instagram, TikTok and YouTube Shorts.

## Every cartoon short (cartoon-3d-short skill) — house defaults

Do these every time, without being asked:

1. **Narration in Dari** with Google's Gemini voice through the **Speko** connector (`mcp__Speko__audio_synthesize`):
   `provider google-tts`, `model gemini-3.8-flash-tts`, `voice "Charon"`, `speed 1.35`, `intent {language "fa", region "AF"}`,
   instructions: Afghan Dari, natural Kabul accent, warm storyteller. Synthesize one line per call
   (see `animated-shorts/gold-short/voice_dari/` for `grab.py` / `assemble.py`).
2. **Dari subtitles** burned in, Vazirmatn font (`animated-shorts/gold-short/fonts/`), white with black outline,
   placed ~440 px above the bottom so the app buttons don't cover them.
3. **Channel name "عمران راهبر"** at the top of the video, gold on a dark box, the whole video.
4. **Outro (~7 s)** after the story: blurred last frame, the same Dari voice saying
   «گپ خو زیاد اس رفیق! اگر می‌خواهی ای قسم قصه‌ها بشنوی، پیج مره فالو کو!»
   with the text on screen and «پیج مره فالو کو!» in a red button.
   The reusable outro audio is `animated-shorts/gold-short/voice_dari/outro.wav`.
5. Deliver: the full file, plus a smaller copy (~35–50 MB, crf 20–22) committed to `videos/` so the owner
   can download it from GitHub on the phone. Also give a short Dari caption with hashtags and a thumbnail.

Items 2–4 are done in one pass by `animated-shorts/gold-short/subs/make_final.py <in.mp4> <out.mp4>`
(change the line file / timemap paths and `MAIN` length for a new video).

## Rendering

CPU only: render in resumable 150-frame chunks (`animated-shorts/scripts/gold_render.sh` is the pattern),
1080×1920, ~13 min per chunk. The container can restart overnight — chunks already done are kept.
`out/`, `*.wav`, `*.mp4` are gitignored; use `git add -f` for files that must be kept.

## Reference project

`animated-shorts/src/videos/gold/` + `animated-shorts/gold-short/` — "طلای باختر" (Bactrian gold),
the first finished short with all of the above.
