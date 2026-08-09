import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

const envVars = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const apiBase = envVars.VITE_API_URL ?? (isLocalHost ? 'http://localhost:8000' : '');
if (apiBase) setBaseUrl(apiBase);

createRoot(document.getElementById('root')!).render(<App />);
