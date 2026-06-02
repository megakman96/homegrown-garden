import '@/global.css';
import { Platform } from 'react-native';

export const G = {
  forest:   '#1b4332',
  hunter:   '#2d6a4f',
  fern:     '#40916c',
  sage:     '#52b788',
  mint:     '#74c69d',
  seafoam:  '#95d5b2',
  mist:     '#b7e4c7',
  dew:      '#d8f3dc',
  foam:     '#f0f7ee',
  sun:      '#f9c74f',
  bloom:    '#f8961e',
  petal:    '#ffd6e7',
  rose:     '#ff6b8a',
  soil:     '#6b4226',
  bark:     '#9c6644',
  cloud:    '#ffffff',
  fog:      '#f8fafb',
  stone:    '#7a8c85',
  slate:    '#4a5568',
  ink:      '#1a2e22',
  danger:   '#e53e3e',
  warning:  '#d97706',
};

export const Shadow = {
  soft: {
    shadowColor: G.forest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  card: {
    shadowColor: G.forest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  float: {
    shadowColor: G.forest,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
};

export const R = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30, full: 9999 };

export const Spring = {
  gentle:  { damping: 22, stiffness: 220 },
  snappy:  { damping: 18, stiffness: 320 },
  bouncy:  { damping: 12, stiffness: 200 },
  slow:    { damping: 28, stiffness: 120 },
};

export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'ui-serif',
    rounded: 'ui-rounded',
    mono:    'ui-monospace',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    rounded: 'normal',
    mono:    'monospace',
  },
  web: {
    sans:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    serif:   'Georgia, serif',
    rounded: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono:    'monospace',
  },
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 820;

export const Colors = {
  light: {
    text:               G.ink,
    textSecondary:      G.stone,
    background:         G.foam,
    backgroundElement:  G.dew,
    backgroundSelected: G.mist,
    tint:               G.hunter,
    border:             G.mist,
  },
  dark: {
    text:               '#f0f7ee',
    textSecondary:      '#8fa898',
    background:         '#0d2018',
    backgroundElement:  '#162a1e',
    backgroundSelected: '#1e3828',
    tint:               G.sage,
    border:             '#2a4535',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;
