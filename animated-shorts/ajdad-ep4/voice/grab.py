# usage: python3 grab.py NN:<tool-result.txt> ...  -> lNN.wav (copies the saved Speko wav blob)
import json, re, shutil, sys
for arg in sys.argv[1:]:
    n, p = arg.split(":", 1)
    arr = json.load(open(p))
    blob = re.search(r"saved to (\S+\.wav)", arr[0]["text"]).group(1)
    d = json.loads(arr[1]["text"])
    shutil.copy(blob, f"l{n}.wav"); print(n, d["duration_seconds"])
