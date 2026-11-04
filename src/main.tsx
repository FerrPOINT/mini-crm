import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { uiLocales } from './ui/i18n';
import { ThemeProvider } from './ui/lib/theme';
import { App } from './App';
import './styles.css';

void i18n.init({
  lng: 'ru',
  fallbackLng: 'ru',
  defaultNS: 'base',
  resources: { ru: { base: uiLocales.ru }, en: { base: uiLocales.en } },
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
