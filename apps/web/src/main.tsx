import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createWorkerCandleSource } from './compute/candle-source';
import { createWorkerImporter } from './import/importer';
import { createDexieMarketRepo } from './storage/db-market';
import { createDexiePrefsRepo } from './storage/db-user';
import './theme/tokens.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');

createRoot(root).render(
  <StrictMode>
    <App
      repo={createDexieMarketRepo()}
      prefs={createDexiePrefsRepo()}
      createImporter={createWorkerImporter}
      candleSource={createWorkerCandleSource()}
    />
  </StrictMode>,
);
