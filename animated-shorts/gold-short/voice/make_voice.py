# Narration for "The Gold That Hid for Fourteen Years": Kokoro-82M (Apache-2.0, local ONNX), one voice, one steady tone.
# Each line is synthesised on its own (natural prosody), trimmed, and joined with set pauses, so line starts are exact.
# Word times inside a line: phoneme-weighted split of the voiced span, each boundary snapped to the nearest energy dip.
import json, re, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
VOICE, SPEED, SR = "af_heart", 1.24, 24000
# (text, pause after in s)
LINES = [
 ("Twenty thousand pieces of ancient gold disappeared in Kabul, and the people who hid them never said a word.", 0.55),
 ("It's 1978.", 0.2),
 ("In northern Afghanistan, diggers open a little mound the locals call the Hill of Gold.", 0.3),
 ("The name turns out to be honest.", 0.4),
 ("Six graves, two thousand years old, packed with crowns, belts and tiny golden rams.", 0.4),
 ("The treasure goes to the national museum in Kabul.", 0.25),
 ("Then the wars come.", 0.35),
 ("Rockets hit the roof.", 0.2),
 ("Thieves carry off almost everything that's left.", 0.4),
 ("And the gold?", 0.25), ("Gone.", 0.3),
 ("Everyone says it was melted down and sold.", 0.45),
 ("Except it wasn't.", 0.3),
 ("Back in 1989, a few quiet bank and museum workers had locked it in a vault under the palace, and each kept one key.", 0.55),
 ("Luckily, nobody knew where the gold was.", 0.5),
 ("Unluckily, nobody knew where the gold was.", 0.6),
 ("You see, a lock with many keys works like a secret shared by a group of friends.", 0.3),
 ("Threaten one friend, and you still only get one key.", 0.45),
 ("For fourteen years, those keyholders said nothing.", 0.45),
 ("In 2003, the new government couldn't even find them all, so they called in a safecracker.", 0.45),
 ("Behind the door, every piece was still there.", 0.6),
 ("Today, the words carved at the museum's door read:", 0.3),
 ("a nation stays alive when its culture stays alive.", 0.55),
 ("And the gold that hid in the dark has since toured the world's museums, in the spotlight.", 0.0),
]
LEAD_IN = 0.25
k = Kokoro(".tts/kokoro-v1.0.onnx", ".tts/voices-v1.0.bin")
NUM = {"1978": "nineteen seventy-eight", "1989": "nineteen eighty-nine", "2003": "two thousand three"}

def env(x, hop=240):  # 10 ms RMS envelope
    n = len(x) // hop
    return np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)

out, words, t = [np.zeros(int(LEAD_IN * SR), np.float32)], [], LEAD_IN
for text, pause in LINES:
    spoken = re.sub(r"\d{4}", lambda m: NUM[m.group()], text)
    s, sr = k.create(spoken, voice=VOICE, speed=SPEED, lang="en-us")
    e = env(s); thr = e.max() * 0.03; on = np.where(e > thr)[0]
    a, b = max(0, on[0] * 240 - 480), min(len(s), (on[-1] + 1) * 240 + 1200)
    s = s[a:b].astype(np.float32); e = env(s)
    toks = text.split()
    sp_toks = [re.sub(r"\d{4}", lambda m: NUM[m.group()], w) for w in toks]
    wts = [max(1, len(k.tokenizer.phonemize(re.sub(r"[^\w' -]", "", w), lang="en-us").replace(" ", ""))) + (3 if re.search(r"[,;:]$", w) else 0) for w in sp_toks]
    dur = len(s) / SR - 0.05; cum = np.concatenate([[0], np.cumsum(wts)]) / sum(wts) * dur
    bounds = [0.02]
    for j in range(1, len(cum) - 1):  # snap to the quietest 10 ms within +-90 ms, never past a third of a neighbour
        c = cum[j]; lo = c - min(0.09, (c - cum[j - 1]) / 3); hi = c + min(0.09, (cum[j + 1] - c) / 3)
        i0, i1 = max(int(bounds[-1] * 100) + 6, int(lo * 100)), min(len(e) - 1, int(hi * 100))
        bounds.append((i0 + int(np.argmin(e[i0:i1 + 1]))) / 100 if i1 > i0 else c)
    bounds.append(dur)
    for w, b0, b1 in zip(toks, bounds[:-1], bounds[1:]):
        words.append({"word": w, "start": round(t + b0, 3), "end": round(t + b1, 3)})
    pause *= 0.8
    out += [s, np.zeros(int(pause * SR), np.float32)]; t += len(s) / SR + pause
    print(f"{t:6.2f}  {text}")
y = np.concatenate(out + [np.zeros(int(0.9 * SR), np.float32)])
y = y / np.abs(y).max() * 0.89
sf.write("gold-short/voice/voice.wav", y, SR, subtype="PCM_16")
json.dump(words, open("gold-short/voice/words.json", "w"), indent=0)
print("total", len(y) / SR, "s,", len(words), "words,", round(len(words) / (len(y) / SR), 2), "w/s")
