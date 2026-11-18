import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import '@/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Element #root not found in index.html');
}

const root = createRoot(rootElement);
// StrictMode runs effects twice in development, so a missing cleanup (a memory leak) shows up early.
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
