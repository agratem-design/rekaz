// Derive all CSS variables from a single HSL base color
export function deriveThemeColors(h: number, s: number, l: number) {
  return {
    '--primary': `${h} ${s}% ${l}%`,
    '--primary-foreground': '0 0% 100%',
    '--ring': `${h} ${s}% ${l}%`,
    '--accent': `${h} ${Math.round(s * 0.7)}% ${Math.min(Math.round(l + 45), 85)}%`,
    '--accent-foreground': `${h} ${Math.round(s * 0.9)}% 20%`,
    '--sidebar-primary': `${h} ${s}% ${l}%`,
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': `${h} ${Math.round(s * 0.35)}% 90%`,
    '--sidebar-accent-foreground': `${h} ${Math.round(s * 0.5)}% 20%`,
    '--sidebar-ring': `${h + 5} ${s}% ${Math.min(l + 10, 50)}%`,
    '--chart-1': `${h} ${s}% ${l}%`,
    '--chart-2': `${h - 5} ${Math.round(s * 0.8)}% ${Math.max(l - 10, 20)}%`,
    '--chart-3': `${h + 5} ${s}% ${Math.min(l + 15, 60)}%`,
    '--chart-4': `${h} ${Math.round(s * 0.5)}% ${Math.min(l + 20, 60)}%`,
    '--chart-5': `${h + 2} ${Math.round(s * 0.9)}% ${Math.min(l + 30, 70)}%`,
  };
}

// Dark mode needs slightly different derivations
export function deriveThemeColorsDark(h: number, s: number, l: number) {
  const lightL = Math.min(l + 10, 50);
  return {
    '--primary': `${h + 5} ${s}% ${lightL}%`,
    '--primary-foreground': '0 0% 100%',
    '--ring': `${h + 5} ${s}% ${lightL}%`,
    '--accent': `${h} ${Math.round(s * 0.6)}% 25%`,
    '--accent-foreground': `0 0% 95%`,
    '--sidebar-primary': `${h + 5} ${s}% ${Math.min(lightL + 5, 55)}%`,
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': `${h} ${Math.round(s * 0.5)}% 20%`,
    '--sidebar-accent-foreground': '0 0% 98%',
    '--sidebar-ring': `${h + 5} ${s}% ${Math.min(lightL + 5, 50)}%`,
    '--chart-1': `${h + 5} ${s}% ${lightL}%`,
    '--chart-2': `${h - 5} ${Math.round(s * 0.6)}% ${Math.max(lightL - 10, 28)}%`,
    '--chart-3': `${h + 5} ${s}% ${Math.min(lightL + 10, 60)}%`,
    '--chart-4': `${h} ${Math.round(s * 0.35)}% ${Math.min(lightL + 5, 45)}%`,
    '--chart-5': `${h + 2} ${Math.round(s * 0.45)}% ${Math.min(lightL + 10, 58)}%`,
  };
}

export type ThemeOverrides = Partial<Record<string, string>>;

export function applyThemeColor(hslString: string, overrides?: ThemeOverrides) {
  const parts = hslString.match(/(\d+\.?\d*)\s+(\d+\.?\d*)%?\s+(\d+\.?\d*)%?/);
  if (!parts) return;
  const h = parseFloat(parts[1]);
  const s = parseFloat(parts[2]);
  const l = parseFloat(parts[3]);

  const root = document.documentElement;
  const isDark = root.classList.contains('dark');

  const colors = isDark ? deriveThemeColorsDark(h, s, l) : deriveThemeColors(h, s, l);
  
  // Apply overrides on top of derived colors
  const finalColors = overrides ? { ...colors, ...overrides } : colors;
  
  Object.entries(finalColors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function clearThemeColor() {
  const root = document.documentElement;
  const keys = [
    '--primary', '--primary-foreground', '--ring', '--accent', '--accent-foreground',
    '--sidebar-primary', '--sidebar-primary-foreground', '--sidebar-accent', '--sidebar-accent-foreground', '--sidebar-ring',
    '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
  ];
  keys.forEach(k => root.style.removeProperty(k));
}

export function parseHSL(hslString: string): { h: number; s: number; l: number } | null {
  const parts = hslString.match(/(\d+\.?\d*)\s+(\d+\.?\d*)%?\s+(\d+\.?\d*)%?/);
  if (!parts) return null;
  return { h: parseFloat(parts[1]), s: parseFloat(parts[2]), l: parseFloat(parts[3]) };
}

export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Foreground color labels for preview
export const COLOR_PREVIEW_CONFIG: Array<{
  key: string;
  label: string;
  fgKey?: string; // foreground CSS var key
  fgFallback: string; // fallback foreground HSL
}> = [
  { key: '--primary', label: 'أساسي', fgKey: '--primary-foreground', fgFallback: '0 0% 100%' },
  { key: '--accent', label: 'تمييز', fgKey: '--accent-foreground', fgFallback: '30 50% 20%' },
  { key: '--sidebar-primary', label: 'شريط أساسي', fgKey: '--sidebar-primary-foreground', fgFallback: '0 0% 100%' },
  { key: '--sidebar-accent', label: 'شريط تمييز', fgKey: '--sidebar-accent-foreground', fgFallback: '0 0% 98%' },
  { key: '--chart-1', label: 'رسم 1', fgFallback: '0 0% 100%' },
  { key: '--chart-2', label: 'رسم 2', fgFallback: '0 0% 100%' },
  { key: '--chart-3', label: 'رسم 3', fgFallback: '0 0% 100%' },
  { key: '--chart-4', label: 'رسم 4', fgFallback: '0 0% 100%' },
  { key: '--chart-5', label: 'رسم 5', fgFallback: '0 0% 100%' },
];

// Keys that can be manually overridden
export const OVERRIDE_KEYS = [
  '--accent', '--accent-foreground',
  '--sidebar-primary', '--sidebar-accent',
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
] as const;

export const DEFAULT_THEME_COLOR = '30 55% 35%';

export const THEME_PRESETS = [
  { name: "ذهبي ركاز (افتراضي)", hsl: "30 55% 35%" },
  { name: "أزرق فولاذي", hsl: "215 60% 45%" },
  { name: "أخضر زيتوني", hsl: "150 45% 35%" },
  { name: "برتقالي عميق", hsl: "20 70% 45%" },
  { name: "بنفسجي", hsl: "270 45% 45%" },
  { name: "أحمر كلاسيكي", hsl: "0 55% 42%" },
  { name: "رمادي فولاذي", hsl: "210 15% 40%" },
  { name: "تركواز", hsl: "175 50% 38%" },
  { name: "كحلي", hsl: "225 55% 30%" },
  { name: "ذهبي فاخر", hsl: "45 70% 40%" },
];
