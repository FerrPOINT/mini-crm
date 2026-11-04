import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { pdlcLocales } from '@pdlc/ui/i18n';
import { ThemeProvider } from '@pdlc/ui/lib';
import { App } from './App';
import './styles.css';

void i18n.init({
  lng: 'ru',
  fallbackLng: 'ru',
  resources: pdlcLocales,
  interpolation: { escapeValue: false },
});
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nextProvider>
  </StrictMode>,
);
