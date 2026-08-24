#!/bin/sh
# 배포 시 캐시 무효화용 버전 올리기:  sh bump.sh
cur=$(grep -o 'style\.css?v=[0-9]*' index.html | head -1 | sed 's/.*v=//')
next=$((cur + 1))
sed -i '' "s/\.css?v=$cur\"/.css?v=$next\"/; s/\.js?v=$cur\"/.js?v=$next\"/g" index.html
echo "asset version: $cur -> $next"
