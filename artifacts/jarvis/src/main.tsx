import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

const envVars = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const apiBase = envVars.VITE_API_URL ?? '';
if (apiBase) setBaseUrl(apiBase);

createRoot(document.getElementById('root')!).render(<App />);
