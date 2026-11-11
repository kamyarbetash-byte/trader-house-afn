#!/bin/bash
# Render the gold short in resumable chunks (CPU-only container: ~10 s/frame), then join them and mux the mix.
# usage: scripts/gold_render.sh [scale]   (1 = 1080x1920; finished chunks are skipped on a re-run)
cd "$(dirname "$0")/.."
export REMOTION_TMP=/tmp/claude-0/remotion-tmp TMPDIR=/tmp/claude-0/remotion-tmp TEMP=/tmp/claude-0/remotion-tmp REMOTION_GL=swangle
SCALE=${1:-1}; OUT=out/gold/chunks_$SCALE; mkdir -p $OUT $REMOTION_TMP
TOTAL=${TOTAL_FRAMES:-2772}; STEP=150
for ((a=0; a<TOTAL; a+=STEP)); do
  b=$((a+STEP-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  f=$OUT/c_$(printf %04d $a).mp4
  [ -s $f ] && continue
  echo "chunk $a-$b start $(date +%T)"
  npx remotion render src/index.ts GoldShort $f.tmp.mp4 --codec h264 --crf 16 --scale $SCALE --frames $a-$b --concurrency 4 --timeout 300000 --log=error \
    && mv $f.tmp.mp4 $f && echo "chunk $a-$b done $(date +%T)" || echo "chunk $a-$b FAILED"
  rm -rf $REMOTION_TMP/remotion-webpack-bundle-* 2>/dev/null
done
ls $OUT/c_*.mp4 | sed 's/^/file /' | sed "s|file $OUT/|file |" > $OUT/list.txt
(cd $OUT && ffmpeg -loglevel error -y -f concat -safe 0 -i list.txt -c copy video.mp4)
ffmpeg -loglevel error -y -i $OUT/video.mp4 -i gold-short/audio/mix_fa.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest out/gold/gold_final_$SCALE.mp4
echo "ALL DONE out/gold/gold_final_$SCALE.mp4"
