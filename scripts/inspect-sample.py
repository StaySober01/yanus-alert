"""Offline measurements only; runtime remains browser-local TypeScript."""
from PIL import Image
import numpy as np
from pathlib import Path

root = Path(__file__).resolve().parent.parent
image = np.asarray(Image.open(root / 'samples/private/yanus-47.png').convert('RGB'), dtype=float)
template = np.asarray(Image.open(root / 'public/templates/sol-yanus.png').convert('RGB'), dtype=float)
gray = image.mean(axis=2)
tgray = template.mean(axis=2)
yy, xx = np.indices(tgray.shape)
# Timer occupies the middle; exclude it and the outermost UI frame.
mask = (xx >= 2) & (xx < 27) & (yy >= 2) & (yy < 30) & ((yy < 10) | (yy >= 25) | (xx < 5) | (xx >= 25))
target = tgray[mask]
target -= target.mean()
scores = []
for y in range(0, 10):
    for x in range(1625, 1638):
        candidate = gray[y:y+32,x:x+29][mask]
        candidate -= candidate.mean()
        score = np.dot(candidate, target) / max(1, np.linalg.norm(candidate) * np.linalg.norm(target))
        scores.append((score,x,y))
print(sorted(scores,reverse=True)[:8])
