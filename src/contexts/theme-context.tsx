import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type TempUnit = 'C' | 'F';

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
  tempUnit: TempUnit;
  setTempUnit: (u: TempUnit) => void;
}

export function formatTemp(celsius: number, unit: TempUnit): string {
  if (unit === 'F') return `${Math.round(celsius * 9 / 5 + 32)}°F`;
  return `${Math.round(celsius)}°C`;
}

async function loadPref(key: string): Promise<string | null> {
  try {
    const { getItemAsync } = await import('expo-secure-store');
    return await getItemAsync(key);
  } catch {
    try { return localStorage.getItem(key); } catch { return null; }
  }
}

async function savePref(key: string, value: string): Promise<void> {
  try {
    const { setItemAsync } = await import('expo-secure-store');
    await setItemAsync(key, value);
  } catch {
    try { localStorage.setItem(key, value); } catch {}
  }
}

const AppThemeContext = createContext<AppThemeCtx>({
  mode: 'system',
  setMode: () => {},
  isDark: false,
  colors: LIGHT_COLORS,
  tempUnit: 'C',
  setTempUnit: () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [tempUnit, setTempUnitState] = useState<TempUnit>('C');

  useEffect(() => {
    (async () => {
      const savedTheme = await loadPref('hg_theme');
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        setModeState(savedTheme);
      }
      const savedUnit = await loadPref('hg_temp_unit');
      if (savedUnit === 'C' || savedUnit === 'F') setTempUnitState(savedUnit);
    })();
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    savePref('hg_theme', m);
  }

  function setTempUnit(u: TempUnit) {
    setTempUnitState(u);
    savePref('hg_temp_unit', u);
  }

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <AppThemeContext.Provider value={{ mode, setMode, isDark, colors, tempUnit, setTempUnit }}>
      {children}
    </AppThemeContext.Provider>
  );
}

export const useAppTheme = () => useContext(AppThemeContext);

// Birthday helpers
export function saveBirthday(userId: string, mmdd: string) {
  savePref(`hg_bday_${userId}`, mmdd);
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
