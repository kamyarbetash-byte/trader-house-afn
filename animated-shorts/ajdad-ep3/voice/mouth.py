# per-frame mouth openness (0..3) for the on-screen speakers, from voice.wav + timing.json -> mouth.json
# {"F": "0012321...", "B": "..."}: one digit per 30 fps frame; narrator lines get none (off screen)
import json, wave, numpy as np
FPS = 30
tim = json.load(open("timing.json"))
w = wave.open("voice.wav"); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32)
N = int(round(tim["total"] * FPS)) + 1
hop = sr // FPS
rms = np.array([np.sqrt((x[i*hop:(i+1)*hop] ** 2).mean()) if i*hop < len(x) else 0 for i in range(N)])
out = {"F": np.zeros(N, int), "B": np.zeros(N, int)}
for l in tim["lines"]:
    if l["spk"] not in out: continue
    a, b = int(l["s"] * FPS), int(np.ceil(l["e"] * FPS))
    seg = rms[a:b]; ref = np.percentile(seg, 90) + 1e-6
    v = seg / ref
    lv = np.where(v > 0.75, 3, np.where(v > 0.45, 2, np.where(v > 0.18, 1, 0)))
    # cartoon rhythm: never hold the same open level more than 3 frames (flap a little)
    for i in range(1, len(lv)):
        if lv[i] > 0 and i >= 3 and lv[i] == lv[i-1] == lv[i-2] == lv[i-3]: lv[i] = max(1, lv[i] - 1)
    out[l["spk"]][a:a+len(lv)] = lv
json.dump({k: "".join(map(str, v)) for k, v in out.items()}, open("mouth.json", "w"))
print({k: (v > 0).mean().round(3) for k, v in out.items()})
