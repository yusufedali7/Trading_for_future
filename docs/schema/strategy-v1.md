# Strateji şeması v1

Kod: `packages/engine/src/strategy/schema.ts` (tipler, doğrulama, `specHash`), `strategy/matcher.ts` (kurulum bulucu), `backtest/run.ts` (emir, lot, simülasyon).

## Örnek
```json
{
  "schema": "strategy/v1",
  "instrument": "EURUSD",
  "timeframe": "15m",
  "direction": "LONG",
  "window": { "start": "08:00", "end": "11:00", "tz": "Europe/London" },
  "steps": [
    { "id": "sweep", "type": "LIQUIDITY_SWEEP", "direction": "BULLISH", "levels": ["ASIA_LOW"] },
    { "id": "mss", "type": "STRUCTURE_BREAK", "direction": "BULLISH", "maxBars": 12 },
    { "id": "fvg", "type": "FVG", "direction": "BULLISH", "maxBars": 6 }
  ],
  "entry": { "type": "LIMIT_AT", "ref": "fvg.top", "expireBars": 8 },
  "stop": { "type": "BEYOND_REF", "ref": "sweep.extreme", "bufferPips": 1 },
  "target": { "type": "R_MULTIPLE", "r": 2 },
  "risk": { "percentPerTrade": 0.5 },
  "maxTradesPerDay": null,
  "features": {
    "swing": { "left": 3, "right": 3 },
    "fvg": { "minSizePips": 1 },
    "structure": { "breakBy": "CLOSE" },
    "sweep": { "swingMaxAgeBars": 100 }
  }
}
```

## Adımlar
| Tür | Filtreler | Referans alanları |
|---|---|---|
| `LIQUIDITY_SWEEP` | `direction`, `levels` (boşsa hepsi) | `level`, `extreme` |
| `STRUCTURE_BREAK` | `direction`, `kind` (`BOS` / `CHOCH`) | `level` |
| `FVG` | `direction` | `top`, `bottom`, `mid` |
| `SWING` | `kind` (`HIGH` / `LOW`) | `price` |

- İlk adımdan sonraki her adımın `maxBars` değeri olmalı: adım, bir önceki adımın onaylandığı mumda ya da en fazla `maxBars` mum sonra onaylanmalı.
- Birden fazla aday varsa **en erken onaylanan** seçilir. İlk adımın birden fazla adayı aynı son tespite götürüyorsa tek kurulum sayılır.
- Kurulum, son adımın onaylandığı mumun **kapanışında** bilinir (`signalAt`). Zaman penceresi bu mumun **açılış** saatine uygulanır (`[start, end)`, gece yarısını aşabilir).

## Giriş, stop, hedef
- `MARKET`: kurulum mumunun kapanışından sonraki ilk 1m mumun açılışı. Pip mesafeleri ve R, kurulum mumunun kapanışından ölçülür.
- `LIMIT_AT` / `STOP_AT ref`: emir fiyatı referans değeri; `expireBars` grafik mumu sonra düşer.
- Stop `BEYOND_REF`: long için `ref − tampon`, short için `ref + tampon`. `FIXED_PIPS`: giriş referansından.
- Hedef `R_MULTIPLE`: planlanan girişten `r × |giriş − stop|`. `AT_REF`: referansın tampon kadar önünde. Gerçek dolum (spread, gap) farklı olabilir; R gerçek dolumdan ölçülür.
- Fiyatlar tick'e yuvarlanır. Stop ya da hedef yanlış taraftaysa kurulum "geçersiz" sayılıp atlanır.

## Doğrulama (kaydetmeden önce)
`UNKNOWN_INSTRUMENT`, `BAD_TIMEFRAME`, `NO_STEPS`, `BAD_STEP_ID` (`^[a-z][a-z0-9_]{0,23}$`), `DUPLICATE_STEP_ID`, `MAX_BARS`, `BAD_REF` (yalnızca adımların alanları), `EXPIRE_BARS`, `BAD_NUMBER`, `RISK_RANGE` (0 < x ≤ 5), `BAD_WINDOW`, `MAX_PER_DAY`, `FEATURE_PARAMS`. Uyarı: `DIRECTION_MISMATCH`.

## Versiyonlar
`specHash` = sıralı anahtarlı JSON'un SHA-256'sı. Kaydedilen versiyon değişmez; yalnızca durumu (`IDEA → RESEARCH → TESTING → VALIDATED_ON_SAMPLE → PAPER → LIVE_CANDIDATE`) geçmişiyle birlikte değişir.

## v1'in ifade edemedikleri
VEYA/alternatif dallar, olumsuzlama ("FVG yoksa"), çoklu zaman dilimi koşulu, indikatörler, kısmi kâr / breakeven / trailing, birden fazla pozisyon, haber filtresi, "en büyük/en son aday" seçimi, referans aritmetiği (`fvg.mid + 2 pip`), özel seanslar (ör. ICT Asya aralığı).
