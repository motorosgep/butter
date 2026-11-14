/**
 * The themes the user can pick from. Butter is the app's own look: cream and
 * soft shadows in light, midnight blue with glowing butter in dark.
 */

import type { Palette, ReadingColors, SkyKind, SkyPalette, SolarPalette, Theme, ThemeId } from './types';

export const BUTTER = '#F2B544';
export const BUTTER_DARK = '#C98A12';

// ----- Butter ---------------------------------------------------------------------

const STATE = { on: BUTTER, cool: '#4FA3E0', heat: '#F0803C', fan: '#4CBB7A', dry: '#3FB8AF', alert: '#E05A5A' };

const READINGS: ReadingColors = {
  temperature: [
    [6, '#5B9DF2'],
    [15, '#79C4EC'],
    [19, '#8FD6A3'],
    [23, '#A9DC8E'],
    [26, BUTTER],
    [31, '#F0803C'],
    [38, '#E05A5A'],
  ],
  humidity: { dry: BUTTER, ok: '#4FA3E0', wet: '#5B9DF2' },
  air: { good: '#8FD6A3', fair: BUTTER, poor: '#F0803C' },
  light: '#E8C547',
  power: '#F0803C',
  idle: '#9a9a9f',
  pressure: '#9B7BDA',
};

const SERIES = { humidity: '#4FA3E0', power: '#F0803C', battery: '#4CBB7A', light: '#E8C547', air: '#9B7BDA', pressure: '#9B7BDA' };

const SUN: [string, number] = ['#FFE39A', 0.95];
const MOON: [string, number] = ['#E3EAFF', 0.35];

const SKY: SkyPalette = {
  kinds: {
    clear: { day: { top: '#2B74C9', bottom: '#6FB5E6', glow: SUN }, night: { top: '#0B1230', bottom: '#1F2F5C', glow: MOON, stars: true } },
    partly: { day: { top: '#3A7CC0', bottom: '#8CB9DB', glow: ['#FFE39A', 0.6] }, night: { top: '#141C3A', bottom: '#2E3D63', glow: ['#E3EAFF', 0.2], stars: true } },
    overcast: { day: { top: '#4B5663', bottom: '#6E7A87' }, night: { top: '#272D36', bottom: '#3E4650' } },
    fog: { day: { top: '#5A6671', bottom: '#8C969F' }, night: { top: '#2A3139', bottom: '#454C55' } },
    storm: { day: { top: '#1E2331', bottom: '#3A4154' }, night: { top: '#101320', bottom: '#262B3A' } },
    snow: { day: { top: '#4F6F8E', bottom: '#93B0C7' }, night: { top: '#243245', bottom: '#3C4F66' } },
    rain: { day: { top: '#2C4664', bottom: '#4B6B8C' }, night: { top: '#141F2E', bottom: '#2A3A50' } },
  },
  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.78)',
  rain: '#A9D6FF',
  sun: '#FFD27A',
  chip: 'rgba(255,255,255,0.16)',
  divider: 'rgba(255,255,255,0.25)',
  star: '#FFFFFF',
};

/** The light scheme's sky: pale and hazy, with dark type, so the tile sits calmly on cream. */
const SKY_LIGHT: SkyPalette = {
  kinds: {
    clear: { day: { top: '#CFE4F7', bottom: '#E4F0FA', glow: ['#FFE08A', 0.75] }, night: { top: '#C7CDEB', bottom: '#E0E4F5', glow: ['#FFFFFF', 0.6], stars: true } },
    partly: { day: { top: '#CCE0F2', bottom: '#E6EFF8', glow: ['#FFE08A', 0.5] }, night: { top: '#CDD2EA', bottom: '#E3E6F4', glow: ['#FFFFFF', 0.4], stars: true } },
    overcast: { day: { top: '#D5DBE2', bottom: '#E8ECF0' }, night: { top: '#CFD3DC', bottom: '#E2E5EB' } },
    fog: { day: { top: '#DDE1E5', bottom: '#EEF0F2' }, night: { top: '#D6D9DF', bottom: '#E8EAEE' } },
    storm: { day: { top: '#B9C0CE', bottom: '#D4D9E2' }, night: { top: '#B4B8C8', bottom: '#CED1DC' } },
    snow: { day: { top: '#DCE7F1', bottom: '#EFF4F9' }, night: { top: '#D3DBE8', bottom: '#E8EDF4' } },
    rain: { day: { top: '#C3D3E3', bottom: '#DCE6EF' }, night: { top: '#C0C8D8', bottom: '#D9DFE9' } },
  },
  text: '#16324F',
  textSoft: 'rgba(22,50,79,0.72)',
  rain: '#1F6FB8',
  sun: BUTTER_DARK,
  chip: 'rgba(255,255,255,0.7)',
  divider: 'rgba(22,50,79,0.14)',
  star: '#3A4A7A',
};

/** The light scheme's solar tile: buttery while producing, lavender at rest. */
const SOLAR_LIGHT: SolarPalette = {
  making: { top: '#FCE3A4', bottom: '#FDF1CF', fill: '#FCE6AE' },
  resting: { top: '#E6E1F0', bottom: '#F3F0F8', fill: '#ECE8F4' },
  gold: BUTTER_DARK,
  area: BUTTER_DARK,
  areaOpacity: 0.28,
  highlight: '#7A4E00',
  pill: BUTTER,
  pillText: '#3B2804',
  pillDot: '#3B2804',
  stat: 'rgba(255,255,255,0.4)',
  statStrong: 'rgba(255,255,255,0.75)',
  glow: '#FFF3C4',
  dot: '#FFF7DF',
  text: '#3B2804',
  textSoft: 'rgba(59,40,4,0.68)',
  chip: 'rgba(255,255,255,0.6)',
  divider: 'rgba(59,40,4,0.15)',
  baseline: '#3B2804',
};

const SOLAR: SolarPalette = {
  making: { top: '#2A1808', bottom: '#7C4A12', fill: '#5A3610' },
  resting: { top: '#15131F', bottom: '#2D2640', fill: '#221D30' },
  gold: '#FFD27A',
  area: '#FFD27A',
  areaOpacity: 0.28,
  highlight: '#FFD27A',
  pill: 'rgba(255,255,255,0.14)',
  pillText: '#FFFFFF',
  pillDot: '#FFD27A',
  stat: 'rgba(255,255,255,0.07)',
  statStrong: 'rgba(255,210,122,0.16)',
  glow: '#FFE9B0',
  dot: '#FFF3D0',
  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.74)',
  chip: 'rgba(255,255,255,0.14)',
  divider: 'rgba(255,255,255,0.25)',
  baseline: '#FFFFFF',
};

/** What Butter's light and dark palettes share. */
const BUTTER_COMMON = {
  onAccent: '#1c1c1e',
  ok: '#1a9a4a',
  danger: '#d23b3b',
  dangerSoft: 'rgba(210,59,59,0.14)',
  onDanger: '#FFFFFF',
  info: '#4FA3E0',
  infoSoft: 'rgba(79,163,224,0.18)',
  thumb: '#FFFFFF',
  state: STATE,
  onState: { on: '#2A2418', cool: '#FFFFFF', heat: '#FFFFFF', fan: '#FFFFFF', dry: '#FFFFFF', alert: '#FFFFFF' },
  readings: READINGS,
  series: SERIES,
} satisfies Partial<Palette>;

const butter: Theme = {
  id: 'butter',
  name: 'Butter',
  description: 'Soft and calm',
  schemes: {
    // Cream paper, white cards with a warm soft shadow, brown-black type.
    light: {
      ...BUTTER_COMMON,
      text: '#2A2418',
      textSecondary: '#7A6C55',
      tileName: '#5C513F',
      background: '#FBF6EC',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#F3EDE0',
      accent: BUTTER_DARK,
      accentSoft: 'rgba(242,181,68,0.28)',
      rain: '#2F7FC4',
      border: 'rgba(60,40,0,0.10)',
      line: '#2A2418',
      shadow: 'rgba(60,40,0,0.07)',
      gridHex: '#2A2418',
      tint: { tile: 0.22, label: 0.55 },
      chipTint: { fill: 0.25, edge: 0 },
      raised: '#FFFFFF',
      tabBar: 'rgba(255,255,255,0.94)',
      tabShadow: 'rgba(60,40,0,0.14)',
      readingShade: 0.3,
      glow: 0,
      sky: SKY_LIGHT,
      solar: SOLAR_LIGHT,
    },
    // Midnight blue, cards edged with a hairline, butter glowing where something is on.
    dark: {
      ...BUTTER_COMMON,
      text: '#EEF0F6',
      textSecondary: '#8F97AD',
      tileName: '#D9DDE8',
      background: '#0E111A',
      backgroundElement: '#171B26',
      backgroundSelected: '#242A38',
      accent: BUTTER,
      accentSoft: 'rgba(242,181,68,0.18)',
      rain: '#A9D6FF',
      border: 'rgba(255,255,255,0.08)',
      line: '#EEF0F6',
      shadow: 'rgba(0,0,0,0.35)',
      cardOutline: 'rgba(255,255,255,0.08)',
      gridHex: '#FFFFFF',
      tint: { tile: 0.14, label: 0.45 },
      chipTint: { fill: 0.12, edge: 0.35 },
      raised: 'rgba(255,255,255,0.08)',
      tabBar: 'rgba(30,34,48,0.94)',
      tabShadow: 'rgba(0,0,0,0.4)',
      readingShade: 0,
      glow: 0.45,
      sky: SKY,
      solar: SOLAR,
    },
  },
  shape: { cardRadius: 22, borderWidth: 0, shadow: 'soft', well: { radius: 19, border: 0 }, boxedCells: false },
  fonts: {
    family: {
      '300': 'PlusJakartaSans_300Light',
      '400': 'PlusJakartaSans_400Regular',
      '500': 'PlusJakartaSans_500Medium',
      '600': 'PlusJakartaSans_600SemiBold',
      '700': 'PlusJakartaSans_700Bold',
      '800': 'PlusJakartaSans_800ExtraBold',
    },
  },
  type: { title: '800', hero: '300', caps: false },
};

// ----- Bold Blocks ---------------------------------------------------------------

/** Flat, bright skies with black type; night is a deeper periwinkle so the type still reads. */
function blocksSky(day: Record<SkyKind, string>, night: Record<SkyKind, string>, rain: string): SkyPalette {
  const kinds = {} as SkyPalette['kinds'];
  for (const k of Object.keys(day) as SkyKind[]) kinds[k] = { day: { top: day[k], bottom: day[k] }, night: { top: night[k], bottom: night[k], stars: k === 'clear' || k === 'partly' } };
  return { kinds, text: '#111111', textSoft: 'rgba(17,17,17,0.72)', rain, sun: '#111111', chip: 'rgba(255,255,255,0.8)', divider: 'rgba(17,17,17,0.25)', star: '#111111' };
}

const BLOCKS_SKY_LIGHT = blocksSky(
  { clear: '#8FD3FF', partly: '#A6DCFF', overcast: '#C7D1DB', fog: '#D6DCE2', storm: '#9FA9C2', snow: '#D9E9FA', rain: '#86B9EC' },
  { clear: '#A9B8F2', partly: '#B5C1F0', overcast: '#BCC3D3', fog: '#C9CED8', storm: '#9AA1BD', snow: '#C9D6EE', rain: '#98AEDF' },
  '#1F3FB0',
);
const BLOCKS_SKY_DARK = blocksSky(
  { clear: '#5AA9DB', partly: '#6DB3DE', overcast: '#97A3B0', fog: '#A5AEB8', storm: '#7B86A3', snow: '#A9C4E2', rain: '#5F95CC' },
  { clear: '#7F8FD0', partly: '#8B99D2', overcast: '#929AAC', fog: '#9EA5B2', storm: '#737A99', snow: '#9DADD0', rain: '#7186BF' },
  '#13287A',
);

function blocksSolar(butter: string, rest: string): SolarPalette {
  return {
    making: { top: butter, bottom: butter, fill: butter },
    resting: { top: rest, bottom: rest, fill: rest },
    gold: '#111111',
    area: '#FF8A4C',
    areaOpacity: 1,
    highlight: butter,
    pill: '#111111',
    pillText: butter,
    pillDot: butter,
    stat: 'rgba(255,255,255,0.75)',
    statStrong: '#111111',
    glow: butter,
    dot: '#FFFFFF',
    text: '#111111',
    textSoft: 'rgba(17,17,17,0.72)',
    chip: 'rgba(255,255,255,0.75)',
    divider: 'rgba(17,17,17,0.25)',
    baseline: '#111111',
  };
}

const BLOCKS_COMMON = {
  ok: '#1a9a4a',
  danger: '#E5484D',
  dangerSoft: 'rgba(229,72,77,0.16)',
  onDanger: '#FFFFFF',
  onAccent: '#111111',
  thumb: '#FFFFFF',
  shadow: 'transparent',
  readings: READINGS,
  series: SERIES,
  glow: 0,
  tint: { tile: 1, label: 1 },
  chipTint: { fill: 1, edge: 0 },
  onState: { on: '#111111', cool: '#111111', heat: '#111111', fan: '#111111', dry: '#111111', alert: '#111111' },
} satisfies Partial<Palette>;

const blocks: Theme = {
  id: 'blocks',
  name: 'Bold Blocks',
  description: 'Loud and playful',
  schemes: {
    // Butter-cream paper, black outlines and hard shadows, solid colour where something is on.
    light: {
      ...BLOCKS_COMMON,
      text: '#111111',
      textSecondary: '#555555',
      tileName: '#111111',
      background: '#FFF4D6',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#F3E7C6',
      accent: '#FFC93C',
      accentSoft: 'rgba(255,201,60,0.35)',
      info: '#2F5FE0',
      infoSoft: 'rgba(47,95,224,0.16)',
      rain: '#2F5FE0',
      border: 'rgba(17,17,17,0.15)',
      line: '#111111',
      gridHex: '#111111',
      readingShade: 0.35,
      raised: '#FFFFFF',
      tabBar: '#FFFFFF',
      tabShadow: '#111111',
      state: { on: '#FFC93C', cool: '#8FD3FF', heat: '#FF8A4C', fan: '#7BE0AD', dry: '#7BE0AD', alert: '#FF5C5C' },
      sky: BLOCKS_SKY_LIGHT,
      solar: blocksSolar('#FFC93C', '#D8CFF5'),
    },
    // Warm charcoal with the same black outlines; the colours a shade deeper so they do not glare.
    dark: {
      ...BLOCKS_COMMON,
      text: '#F3EAD3',
      textSecondary: '#BDB39C',
      tileName: '#F3EAD3',
      background: '#24221D',
      backgroundElement: '#33302A',
      backgroundSelected: '#423E36',
      accent: '#F2B83A',
      accentSoft: 'rgba(242,184,58,0.25)',
      info: '#8FB7FF',
      infoSoft: 'rgba(143,183,255,0.16)',
      rain: '#8FB7FF',
      border: 'rgba(255,255,255,0.12)',
      line: '#050505',
      gridHex: '#F3EAD3',
      readingShade: 0,
      raised: '#423E36',
      tabBar: '#33302A',
      tabShadow: '#050505',
      state: { on: '#F2B83A', cool: '#5AA9DB', heat: '#EE7B42', fan: '#4FBF89', dry: '#4FBF89', alert: '#F05252' },
      sky: BLOCKS_SKY_DARK,
      solar: blocksSolar('#F2B83A', '#B8AEDF'),
    },
  },
  shape: { cardRadius: 18, borderWidth: 2.5, shadow: 'offset', well: { radius: 12, border: 2.5 }, boxedCells: true },
  fonts: {
    family: {
      '500': 'Archivo_500Medium',
      '700': 'Archivo_700Bold',
      '800': 'Archivo_800ExtraBold',
      '900': 'Archivo_900Black',
    },
  },
  type: { title: '900', hero: '900', caps: true },
};

export const THEMES: Record<ThemeId, Theme> = { butter, blocks };

export const DEFAULT_THEME: ThemeId = 'butter';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in THEMES;
}
