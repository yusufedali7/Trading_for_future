# Tanım: Swing (tepe / dip) — v1

Kod: `packages/engine/src/features/swing.ts` · Test: `packages/engine/test/swing.test.ts`

## Tanım
Grafiğin kendi zaman dilimindeki **kapanmış** mumlar üzerinde:
- **Swing tepe (aday tepe):** `i` mumunun en yükseği, solundaki `left` mumun hepsinin en yükseğinden **kesin büyük**, sağındaki `right` mumun hepsinin en yükseğinden **büyük ya da eşit**.
- **Swing dip (aday dip):** Simetrik olarak en düşüklerle.

| Parametre | Varsayılan | Anlam |
|---|---|---|
| `left` | 3 | Soldaki karşılaştırma mumu sayısı |
| `right` | 3 | Sağdaki karşılaştırma mumu sayısı; aynı zamanda onay gecikmesi |

## Onay gecikmesi
Tepe, sağındaki `right` mum kapanana kadar bilinemez. `formedIndex = i`, `confirmedIndex = i + right`, `confirmedAt = (i + right). mumun kapanışı`. Grafikte işaret `i` mumuna konur ama **ancak `confirmedAt`'ten sonra** görünür (replay'de de böyle). Strateji ve backtest de yalnızca onay sonrasını görür.

## Varsayımlar
- Eşit tepelerde soldaki (ilk) mum tepe sayılır; ikincisi solunda eşit bir tepe olduğu için sayılmaz.
- Bir mum aynı anda hem tepe hem dip olabilir (çok geniş aralıklı mum).
- Yalnızca grafiğin zaman dilimi kullanılır; çoklu zaman dilimi (ör. 15m grafikte 1h swing) v1'de yok.

## Bilinen başarısızlık durumları
- Yatay, sıkışık piyasada çok sayıda küçük swing çıkar; hepsi "önemli" değildir.
- Veri boşluğu, boşluğun iki yanındaki mumları komşu gibi gösterir.
- `right` büyüdükçe tespit güvenilir görünür ama geç gelir; küçüldükçe erken ama gürültülü olur.

## Kanıt
Her kesme noktası için, kesilmiş veriden hesaplanan swing'ler = tam veriden hesaplanıp `confirmedIndex < k` ile süzülenler (rastgele yürüyüşte 300 kesme noktası).
