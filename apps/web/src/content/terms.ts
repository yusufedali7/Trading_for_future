/**
 * Glossary ids used for contextual help (<Term>) across the UI, kept in one place so a test can
 * prove every one still exists in docs/ogrenme/sozluk.md after the glossary is edited.
 */
export const TERMS = {
  r: 'r-risk-birimi',
  winRate: 'kazanma-orani-ve-beklenen-deger',
  expectancy: 'profit-factor-ve-beklenen-deger',
  profitFactor: 'profit-factor',
  drawdown: 'drawdown-dusus',
  drawdownR: 'maksimum-dusus-r-cinsinden',
  streaks: 'kazanc-kayip-serisi',
  sample: 'orneklem-buyuklugu',
  ambiguous: 'belirsiz-mum',
  skipped: 'atlanan-kurulum',
  costs: 'spread-ve-kayma-slippage',
  split: 'in-sample-out-of-sample',
  trials: 'deneme-sayisi',
  slTp: 'stop-loss-sl-ve-take-profit-tp',
  lotRisk: 'lot-ve-risk-yuzdesi',
  candidate: 'aday-candidate',
  confirmationDelay: 'onay-gecikmesi',
} as const;
