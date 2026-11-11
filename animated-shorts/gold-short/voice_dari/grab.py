# copy Speko synthesis results (tool-result json -> saved wav blob) to lNN.wav in order
import json, shutil, sys, re
start = int(sys.argv[1])
for k, p in enumerate(sys.argv[2:]):
    arr = json.load(open(p))
    blob = re.search(r"saved to (\S+\.wav)", arr[0]["text"]).group(1)
    d = json.loads(arr[1]["text"])
    out = f"gold-short/voice_dari/l{start + k:02d}.wav"
    shutil.copy(blob, out); print(out, d["duration_seconds"])
