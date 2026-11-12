import sys, numpy as np
import wave
for p in sys.argv[1:]:
    w = wave.open(p); sr = w.getframerate(); ch = w.getnchannels(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float).reshape(-1, ch); x = (x if x.ndim == 1 else x.mean(1)); x /= (np.abs(x).max() + 1e-9)
    f0 = []
    N = int(sr*0.04)
    for i in range(0, len(x)-N, N//2):
        s = x[i:i+N]
        if np.sqrt((s**2).mean()) < 0.02: continue
        s = s - s.mean(); c = np.correlate(s, s, 'full')[N-1:]
        lo, hi = int(sr/400), int(sr/60)
        k = lo + np.argmax(c[lo:hi])
        if c[k] > 0.4*c[0]: f0.append(sr/k)
    print(p, "median F0 %.0f Hz" % np.median(f0), len(f0))
