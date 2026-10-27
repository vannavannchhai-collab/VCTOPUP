import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { StoreProvider } from './lib/store.jsx';
import App from './App.jsx';
// Self-hosted fonts (Khmer + Latin) — the site works fully offline.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/noto-sans-khmer/khmer-400.css';
import '@fontsource/noto-sans-khmer/khmer-700.css';
import '@fontsource/bayon/khmer-400.css';
import '@fontsource/battambang/khmer-400.css';
import '@fontsource/battambang/khmer-700.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/pages.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);
