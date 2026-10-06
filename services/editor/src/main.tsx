import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/index.js';
import { App } from './App.js';
import { createPlatform } from './composition/createPlatform.js';

createRoot(document.getElementById('root')!).render(<StrictMode><App platform={createPlatform()} /></StrictMode>);
