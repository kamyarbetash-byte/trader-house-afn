import sys, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro(".tts/kokoro-v1.0.onnx", ".tts/voices-v1.0.bin")
line = "Twenty thousand pieces of ancient gold disappeared in Kabul, and the people who hid them never said a word."
for v in sys.argv[1:]:
    s, sr = k.create(line, voice=v, speed=1.0, lang="en-us" if v[0]=="a" else "en-gb")
    sf.write(f"out/voice_{v}.wav", s, sr); print(v, len(s)/sr)
