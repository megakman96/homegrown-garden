import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

const DARK_COLORS = {
  bg:        '#0d2018',
  bgCard:    '#162a1e',
  bgElement: '#1e3828',
  text:      '#f0f7ee',
  textSec:   '#8fa898',
  border:    '#2a4535',
  tint:      '#52b788',
  tintDark:  '#40916c',
};

const LIGHT_COLORS = {
  bg:        '#f0f7ee',
  bgCard:    '#ffffff',
  bgElement: '#d8f3dc',
  text:      '#1a2e22',
  textSec:   '#52796f',
  border:    '#b7e4c7',
  tint:      '#2d6a4f',
  tintDark:  '#1b4332',
};

interface AppThemeCtx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  isDark: boolean;
  colors: typeof LIGHT_COLORS;
}

const AppThemeContext = createContext<AppThemeCtx>({
  mode: 'system',
  setMode: () => {},
  isDark: false,
  colors: LIGHT_COLORS,
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hg_theme') as ThemeMode;
      if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
    } catch {}
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    try { localStorage.setItem('hg_theme', m); } catch {}
  }

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <AppThemeContext.Provider value={{ mode, setMode, isDark, colors }}>
      {children}
    </AppThemeContext.Provider>
  );
}

export const useAppTheme = () => useContext(AppThemeContext);

// Birthday helpers
export function saveBirthday(userId: string, mmdd: string) {
  try { localStorage.setItem(`hg_bday_${userId}`, mmdd); } catch {}
}

export function loadBirthday(userId: string): string | null {
  try { return localStorage.getItem(`hg_bday_${userId}`); } catch { return null; }
}

export function isBirthdayToday(mmdd: string | null): boolean {
  if (!mmdd) return false;
  const [m, d] = mmdd.split('/').map(Number);
  const now = new Date();
  return now.getMonth() + 1 === m && now.getDate() === d;
}
