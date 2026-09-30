import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createMemoryRepo } from './storage/memory-repo';
import './theme/tokens.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');

const repo = createMemoryRepo();

createRoot(root).render(
  <StrictMode>
    <App repo={repo} />
  </StrictMode>,
);
