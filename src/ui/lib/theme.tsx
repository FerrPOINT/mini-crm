import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'gray' | 'light';
const storageKey = 'mini-crm-theme';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);
function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'gray' || value === 'light';
}

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(storageKey);
    if (isTheme(value)) return value;
  } catch {
    // The in-memory preference remains usable when browser storage is blocked.
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState(readTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) updateTheme(isTheme(event.newValue) ? event.newValue : 'dark');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  function setTheme(value: Theme) {
    updateTheme(value);
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // Theme selection does not require persistent browser storage.
    }
  }
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider is required');
  return value;
}
