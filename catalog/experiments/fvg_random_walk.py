"""SENTETİK deney: rastgele yürüyüşte FVG'nin yeniden ziyaret oranı vs aynı mesafedeki rastgele seviye.
claims.jsonl -> fvg-random-walk kaydını üretir. Yapı yok, avantaj yok: taban çizgisi ölçümüdür.
Çalıştır: python fvg_random_walk.py   (numpy gerekir)"""
import numpy as np

SEED, N_BARS, STEPS, HORIZON = 42, 400_000, 20, 20
rng = np.random.default_rng(SEED)
path = np.cumsum(rng.normal(0, 1, size=N_BARS * STEPS)).reshape(N_BARS, STEPS)
open_ = np.concatenate(([0.0], path[:-1, -1]))
high = np.maximum(path.max(axis=1), open_)
low = np.minimum(path.min(axis=1), open_)
close = path[:, -1]
sigma = np.sqrt(STEPS)

i = np.arange(0, N_BARS - 2 - HORIZON)
gap_bottom, gap_top = high[i], low[i + 2]          # yükselen FVG: low[i+2] > high[i]
is_fvg = gap_top > gap_bottom
c3 = i + 2
dist = close[c3] - gap_top

def revisit(level, start):
    idx = start[:, None] + 1 + np.arange(HORIZON)[None, :]
    return (low[idx] <= level[:, None]).any(axis=1)

f_idx, f_lvl = c3[is_fvg], gap_top[is_fvg]
fvg_hit = revisit(f_lvl, f_idx).mean()
ctrl_bars = rng.integers(2, N_BARS - HORIZON - 2, size=f_idx.size)
ctrl_hit = revisit(close[ctrl_bars] - dist[is_fvg], ctrl_bars).mean()

print(f"seed={SEED} bars={N_BARS:,} steps/bar={STEPS} horizon={HORIZON}")
print(f"yükselen FVG oranı: {is_fvg.mean()*100:.1f}%  (n={f_idx.size:,})")
print(f"FVG üst kenarı {HORIZON} mum içinde ziyaret: {fvg_hit*100:.1f}%")
print(f"aynı mesafedeki rastgele seviye ziyaret: {ctrl_hit*100:.1f}%")
d = dist[is_fvg] / sigma
for a, b in zip(np.quantile(d, [0, .25, .5, .75]), np.quantile(d, [.25, .5, .75, 1])):
    m = (d >= a) & (d <= b)
    print(f"  mesafe {a:.2f}-{b:.2f} sigma: {revisit(f_lvl[m], f_idx[m]).mean()*100:.1f}%")
