import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createWorkerCandleSource } from './compute/candle-source';
import { createWorkerImporter } from './import/importer';
import { createDexieMarketRepo } from './storage/db-market';
import { createDexieUserRepos } from './storage/db-user';
import './theme/tokens.css';

const user = createDexieUserRepos();

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');

createRoot(root).render(
  <StrictMode>
    <App
      repo={createDexieMarketRepo()}
      prefs={user.prefs}
      drawingsRepo={user.drawings}
      journalRepo={user.journal}
      createImporter={createWorkerImporter}
      candleSource={createWorkerCandleSource()}
    />
  </StrictMode>,
);
