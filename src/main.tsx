import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('=== MAIN.TSX LOADED ===');
console.log('Environment:', import.meta.env);

try {
  console.log('Creating React root...');
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root element not found!');
  }

  console.log('Root element found:', rootElement);

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  console.log('✅ React app rendered successfully');
} catch (error) {
  console.error('❌ Error rendering app:', error);
  document.body.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #111; color: white; font-family: system-ui;">
      <h1 style="color: #ef4444; font-size: 24px; margin-bottom: 16px;">Application Error</h1>
      <pre style="background: #222; padding: 20px; border-radius: 8px; max-width: 600px; overflow: auto;">${error instanceof Error ? error.message : String(error)}</pre>
      <p style="margin-top: 16px; color: #888;">Check browser console for more details</p>
    </div>
  `;
}
