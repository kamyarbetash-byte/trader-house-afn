# join the trimmed lines (tNN.wav, made by trim.py) into voice.wav (48 kHz mono) + timing.json
# per-speaker tempo (pitch kept), gaps: same speaker 0.3 s, speaker change 0.45 s, scene change 0.8 s
import json, subprocess, wave, numpy as np
lines = [l.rstrip("\n").split("\t") for l in open("lines.tsv", encoding="utf-8") if l.strip()]
SKIP = {"20"}                         # 20: outro (added by make_final)
TEMPO = {"F": 1.08, "B": 1.12, "N": 1.12}
POEM = set()
SCENE = {"06", "07", "11", "13", "15"}      # first line of a new place
SR = 48000
out, tim, t, prev = [], [], 0.35, None
for n, spk, text in lines:
    if n in SKIP: continue
    tempo = 1.0 if n in POEM else TEMPO[spk]
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f"t{n}.wav", "-af", f"atempo={tempo},aresample={SR}", "-f", "s16le", "-ac", "1", "-"], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, np.int16).astype(np.float32)
    if prev is not None: t += 0.8 if n in SCENE else 0.3 if spk == prev else 0.45
    a = int(t * SR)
    if len(out) < a + len(y): out.extend([0.0] * (a + len(y) - len(out)))
    arr = np.array(out, np.float32); arr[a:a + len(y)] += y; out = list(arr)
    tim.append({"n": n, "spk": spk, "text": text, "s": round(t, 3), "e": round(t + len(y) / SR, 3)})
    t += len(y) / SR; prev = spk
total = t + 1.2
arr = np.zeros(int(total * SR), np.float32); o = np.array(out, np.float32); arr[:len(o)] = o
w = wave.open("voice.wav", "w"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.clip(arr, -32767, 32767).astype(np.int16).tobytes()); w.close()
json.dump({"total": round(total, 3), "lines": tim}, open("timing.json", "w"), ensure_ascii=False, indent=1)
for l in tim: print(l["n"], l["spk"], l["s"], l["e"])
print("total", round(total, 2))
