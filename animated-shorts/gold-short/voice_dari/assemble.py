# Dari narration (Google Gemini TTS via Speko, voice Charon): trim each line, join with the English cut's pauses,
# and write the time map English -> Dari (line starts/ends) that the picture and the sound are warped with.
import json, numpy as np, soundfile as sf
from scipy.signal import resample_poly
SR = 24000
EN_PAUSE = [0.55, 0.2, 0.3, 0.4, 0.4, 0.25, 0.35, 0.2, 0.4, 0.25, 0.3, 0.45, 0.3, 0.55, 0.5, 0.6, 0.3, 0.45, 0.45, 0.45, 0.6, 0.3, 0.55, 0.0]
EN_COUNTS = [19, 2, 15, 7, 14, 9, 4, 4, 7, 3, 1, 8, 3, 24, 7, 7, 17, 10, 7, 16, 8, 9, 9, 17]
words = json.load(open("gold-short/voice/words.json"))
assert sum(EN_COUNTS) == len(words), (sum(EN_COUNTS), len(words))
en, k = [], 0
for n in EN_COUNTS:
    en.append((words[k]["start"], words[k + n - 1]["end"])); k += n
out, t, rows = [np.zeros(int(0.25 * SR))], 0.25, []
for i in range(24):
    x, sr = sf.read(f"gold-short/voice_dari/l{i + 1:02d}.wav"); x = x if x.ndim == 1 else x[:, 0]
    if sr != SR: x = resample_poly(x, SR, sr)
    e = np.sqrt(np.convolve(x ** 2, np.ones(240) / 240, "same")); on = np.where(e > e.max() * 0.03)[0]
    x = x[max(0, on[0] - 240): on[-1] + 600]
    rows.append({"line": i + 1, "en": en[i], "fa": (round(t, 3), round(t + len(x) / SR, 3))})
    out += [x, np.zeros(int(EN_PAUSE[i] * 0.8 * SR))]; t += len(x) / SR + EN_PAUSE[i] * 0.8
y = np.concatenate(out + [np.zeros(int(0.9 * SR))]); y = y / np.abs(y).max() * 0.89
sf.write("gold-short/voice_dari/voice.wav", y, SR, subtype="PCM_16")
total = len(y) / SR
json.dump({"en_total": 2067 / 30, "fa_total": round(total, 3), "lines": rows}, open("gold-short/voice_dari/timemap.json", "w"), indent=1)
for r in rows: print(r["line"], "en %.2f-%.2f" % r["en"], "fa %.2f-%.2f" % r["fa"], "x%.2f" % ((r["fa"][1] - r["fa"][0]) / (r["en"][1] - r["en"][0])))
print("total", total)
