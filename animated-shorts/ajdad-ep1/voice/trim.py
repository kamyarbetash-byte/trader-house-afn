# trim lead/tail silence and squeeze internal pauses; writes tNN.wav (24 kHz mono) and prints durations
import wave, glob, sys, numpy as np
MAXP = float(sys.argv[1]) if len(sys.argv) > 1 else 0.35
tot = 0
for p in sorted(glob.glob("l[0-9][0-9].wav")):
    w = wave.open(p); sr = w.getframerate(); ch = w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, ch).mean(1)
    hop = int(sr * 0.01); n = len(x) // hop
    e = np.array([np.sqrt((x[i*hop:(i+1)*hop] ** 2).mean()) for i in range(n)])
    on = e > max(e.max() * 0.03, 60)
    idx = np.where(on)[0]; a, b = max(idx[0] - 3, 0), min(idx[-1] + 8, n)
    keep, run = [], 0
    for i in range(a, b):
        run = 0 if on[i] else run + 1
        if run * 0.01 <= MAXP: keep.append(i)
    y = np.concatenate([x[i*hop:(i+1)*hop] for i in keep]).astype(np.int16)
    o = wave.open("t" + p[1:], "w"); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes(y.tobytes()); o.close()
    d = len(y) / sr; tot += d; print(p, round(n*0.01, 2), "->", round(d, 2))
print("total", round(tot, 1))
