/**
 * The themes the user can pick from. Butter is the app's own look: cream and
 * soft shadows in light, midnight blue with glowing butter in dark.
 */

import type { Palette, ReadingColors, SkyPalette, SolarPalette, Theme, ThemeId } from './types';

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
  chip: 'rgba(255,255,255,0.16)',
  divider: 'rgba(255,255,255,0.25)',
  star: '#FFFFFF',
};

/** The light scheme's sky: pale and hazy, with dark type, so the tile sits calmly on cream. */
const SKY_LIGHT: SkyPalette = {
  kinds: {
    clear: { day: { top: '#BFDDF6', bottom: '#E4F0FA', glow: ['#FFE08A', 0.75] }, night: { top: '#C7CDEB', bottom: '#E0E4F5', glow: ['#FFFFFF', 0.6], stars: true } },
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
  chip: 'rgba(255,255,255,0.7)',
  divider: 'rgba(22,50,79,0.14)',
  star: '#3A4A7A',
};

/** The light scheme's solar tile: buttery while producing, lavender at rest. */
const SOLAR_LIGHT: SolarPalette = {
  making: { top: '#FCE3A4', bottom: '#FDF1CF', fill: '#FCE6AE' },
  resting: { top: '#E6E1F0', bottom: '#F3F0F8', fill: '#ECE8F4' },
  gold: BUTTER_DARK,
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
  onState: '#1a1a1c',
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
      tint: { tile: 0.24, label: 0.45 },
      readingShade: 0,
      glow: 0.45,
      sky: SKY,
      solar: SOLAR,
    },
  },
  shape: { cardRadius: 22, borderWidth: 0, shadow: 'soft' },
  fonts: {},
  type: { title: '800', hero: '300' },
};

export const THEMES: Record<ThemeId, Theme> = { butter };

export const DEFAULT_THEME: ThemeId = 'butter';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in THEMES;
}
