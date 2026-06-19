import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type TempUnit = 'C' | 'F';
export type MeasureUnit = 'metric' | 'us';
export type WaterTime = 'morning' | 'afternoon' | 'evening';

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
  measureUnit: MeasureUnit;
  setMeasureUnit: (u: MeasureUnit) => void;
  waterTime: WaterTime;
  setWaterTime: (t: WaterTime) => void;
}

export function formatTemp(celsius: number, unit: TempUnit): string {
  if (unit === 'F') return `${Math.round(celsius * 9 / 5 + 32)}°F`;
  return `${Math.round(celsius)}°C`;
}

export function formatLength(cm: number, unit: MeasureUnit): string {
  if (unit === 'us') {
    const inches = cm / 2.54;
    if (inches < 12) return `${Math.round(inches)}"`;
    const feet = Math.floor(inches / 12);
    const rem = Math.round(inches % 12);
    return rem > 0 ? `${feet} ft ${rem}"` : `${feet} ft`;
  }
  return `${Math.round(cm)} cm`;
}

export function formatPrecip(mm: number, unit: MeasureUnit): string {
  if (unit === 'us') return `${(mm / 25.4).toFixed(2)}"`;
  return `${Math.round(mm)} mm`;
}

export function formatWeight(grams: number, unit: MeasureUnit): string {
  if (unit === 'us') {
    const oz = grams / 28.35;
    if (oz >= 16) return `${(oz / 16).toFixed(1)} lbs`;
    return `${Math.round(oz)} oz`;
  }
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${Math.round(grams)} g`;
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
  measureUnit: 'metric',
  setMeasureUnit: () => {},
  waterTime: 'morning',
  setWaterTime: () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [tempUnit, setTempUnitState] = useState<TempUnit>('C');
  const [measureUnit, setMeasureUnitState] = useState<MeasureUnit>('metric');
  const [waterTime, setWaterTimeState] = useState<WaterTime>('morning');

  useEffect(() => {
    (async () => {
      const savedTheme = await loadPref('hg_theme');
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        setModeState(savedTheme);
      }
      const savedUnit = await loadPref('hg_temp_unit');
      if (savedUnit === 'C' || savedUnit === 'F') setTempUnitState(savedUnit);
      const savedMeasure = await loadPref('hg_measure_unit');
      if (savedMeasure === 'metric' || savedMeasure === 'us') setMeasureUnitState(savedMeasure);
      const savedWaterTime = await loadPref('hg_water_time');
      if (savedWaterTime === 'morning' || savedWaterTime === 'afternoon' || savedWaterTime === 'evening') {
        setWaterTimeState(savedWaterTime);
      }
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

  function setMeasureUnit(u: MeasureUnit) {
    setMeasureUnitState(u);
    savePref('hg_measure_unit', u);
  }

  function setWaterTime(t: WaterTime) {
    setWaterTimeState(t);
    savePref('hg_water_time', t);
  }

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <AppThemeContext.Provider value={{ mode, setMode, isDark, colors, tempUnit, setTempUnit, measureUnit, setMeasureUnit, waterTime, setWaterTime }}>
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
