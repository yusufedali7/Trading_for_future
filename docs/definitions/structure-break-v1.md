# Tanım: Yapı kırılımı (BOS / CHoCH) — v1

Kod: `packages/engine/src/features/structure.ts` · Test: `packages/engine/test/structure.test.ts`

## Tanım
- **Referans tepe:** En son **onaylanmış** swing tepe (bkz. `swing-v1`). Yeni bir tepe onaylanınca eskisinin yerini alır (eskisi kırılmamış olsa bile).
- **Yükseliş kırılımı:** Bir mumun kapanışı (`breakBy: CLOSE`) ya da en yükseği (`breakBy: WICK`) referans tepenin **üstüne** çıkarsa. Referans kullanılmış olur; bir sonraki tepe onaylanana kadar yeni yükseliş kırılımı olmaz.
- **Düşüş kırılımı:** Simetrik olarak referans dip ile.
- **Tür:** Önceki kırılım aynı yöndeyse ya da ilk kırılımsa **BOS** (break of structure, yapının devamı). Önceki kırılım ters yöndeyse **CHoCH** (change of character, karakter değişimi; bazı kaynaklarda MSS).

| Parametre | Varsayılan | Anlam |
|---|---|---|
| `breakBy` | `CLOSE` | `CLOSE`: kapanışla kırılım; `WICK`: fitille kırılım |
| (swing) | `left = right = 3` | Referans swing'lerin tanımı |

## Onay gecikmesi
Kırılım, kırılım mumunun kapanışında bilinir (`confirmedIndex = formedIndex`). Bir swing, onaylandığı mumdan **sonraki** mumdan itibaren kırılabilir.

## Varsayımlar
- Yalnızca en son onaylı swing referans alınır; daha eski ama kırılmamış swing'ler v1'de izlenmez.
- İlk kırılımın öncesinde yön bilinmediği için ilk kırılım BOS sayılır.

## Bilinen başarısızlık durumları
- `WICK` modunda tek bir geniş mum hem tepeyi hem dibi kırabilir; iki kırılım da raporlanır (önce yükseliş).
- Swing gecikmesi yüzünden hızlı hareketlerde kırılım, swing onaylanmadan gerçekleşmiş olabilir; o zaman kırılım olarak sayılmaz.
- Yatay piyasada art arda BOS/CHoCH üretir.

## Kanıt
Kesme değişmezliği testi (rastgele yürüyüş, 400 kesme noktası) ve elle yazılmış BOS → CHoCH örneği.
