/**
 * The shape of a theme: a named look with a light and a dark palette, plus
 * how its cards are drawn and which fonts it uses. Screens read the resolved
 * theme through `useTheme()` (or the older `useColors()`), never a theme
 * object directly.
 */

export type ThemeId = 'butter';

/** What the user picked: follow the phone, or force one scheme. */
export type ColorMode = 'system' | 'light' | 'dark';

export type Scheme = 'light' | 'dark';

/** What an active device is doing; each maps to a colour in `Palette.state`. */
export type StateTone = 'on' | 'cool' | 'heat' | 'fan' | 'dry' | 'alert';

/** Colours for big sensor readings, from cold/low to hot/high. */
export interface ReadingColors {
  /** Temperature in °C to colour, interpolated between stops. */
  temperature: [number, string][];
  humidity: { dry: string; ok: string; wet: string };
  air: { good: string; fair: string; poor: string };
  light: string;
  power: string;
  /** A power meter reading next to nothing. */
  idle: string;
  pressure: string;
}

/** Weather kinds the sky backdrop knows, from WMO codes. */
export type SkyKind = 'clear' | 'partly' | 'overcast' | 'fog' | 'storm' | 'snow' | 'rain';

export interface Sky {
  top: string;
  bottom: string;
  /** Sun or moon glow colour and strength. */
  glow?: [string, number];
  stars?: boolean;
}

/** The weather tile and screen header, painted as the sky. */
export interface SkyPalette {
  kinds: Record<SkyKind, { day: Sky; night: Sky }>;
  text: string;
  textSoft: string;
  rain: string;
  /** The sun, when the sky is clear enough to show it. */
  sun: string;
  /** Pills and chips over the sky. */
  chip: string;
  divider: string;
  star: string;
}

/** The solar tile's backdrop, warm while producing and dusky while resting. */
export interface SolarPalette {
  making: { top: string; bottom: string; fill: string };
  resting: { top: string; bottom: string; fill: string };
  /** The curve and the sun riding on it. */
  gold: string;
  /** Today's energy, the one figure that stands out in the stats row. */
  highlight: string;
  /** The Producing pill and its dot. */
  pill: string;
  pillText: string;
  pillDot: string;
  /** The small boxes under the curve; the first (today) is stronger. */
  stat: string;
  statStrong: string;
  glow: string;
  dot: string;
  text: string;
  textSoft: string;
  chip: string;
  divider: string;
  baseline: string;
}

/** Named colours a screen may use. Every theme fills every key in both schemes. */
export interface Palette {
  text: string;
  textSecondary: string;
  /** Device names on tiles that are idle: quieter than text, louder than secondary. */
  tileName: string;
  background: string;
  /** Cards and tiles sitting on the background. */
  backgroundElement: string;
  /** Selected chips, pressed rows, icon wells. */
  backgroundSelected: string;
  accent: string;
  accentSoft: string;
  /** Text and icons drawn on the accent colour. */
  onAccent: string;
  ok: string;
  danger: string;
  dangerSoft: string;
  onDanger: string;
  /** Rain, links to charts and other neutral-blue information. */
  info: string;
  infoSoft: string;
  /** Rain chances drawn on the plain background. */
  rain: string;
  border: string;
  /** Card outlines and hard shadows, when the theme's shape uses them. */
  line: string;
  /** Colour of a `soft` card shadow. */
  shadow: string;
  /** A hairline around cards in this scheme, where a shadow would not show. */
  cardOutline?: string;
  /** Chart grid lines, drawn at low opacity. */
  gridHex: string;
  /** Slider thumb at rest. */
  thumb: string;
  /** Device state colours; colour always means state, never decoration. */
  state: Record<StateTone, string>;
  /** Icons drawn on each state colour: dark on butter, white on the deeper ones. */
  onState: Record<StateTone, string>;
  /** How strongly something that is on glows around its icon (0 for no glow). */
  glow: number;
  /** How strongly an active tile takes its state colour (0 none, 1 solid), and how much its label does. */
  tint: { tile: number; label: number };
  /** Status chips with a state: the tint behind the text and, in dark, a coloured edge (0 for none). */
  chipTint: { fill: number; edge: number };
  /** Small round buttons sitting on a card, like − and + on a thermostat. */
  raised: string;
  /** The floating tab bar and the shadow under it. */
  tabBar: string;
  tabShadow: string;
  /** How much reading colours darken toward black to stay legible (0 on dark backgrounds). */
  readingShade: number;
  readings: ReadingColors;
  /** Chart line colours per measured quantity. */
  series: { humidity: string; power: string; battery: string; light: string; air: string; pressure: string };
  sky: SkyPalette;
  solar: SolarPalette;
}

/** How cards are drawn. */
export interface Shape {
  cardRadius: number;
  /** Outline around cards, in `Palette.line`; 0 for none. */
  borderWidth: number;
  /** `soft` blurs, `offset` is a hard shadow in `Palette.line` shifted down-right, `none` is flat. */
  shadow: 'none' | 'soft' | 'offset';
}

export type Weight = '300' | '400' | '500' | '600' | '700' | '800' | '900';

/** The theme's typeface, one loaded font file per weight; none uses the system font. */
export interface ThemeFonts {
  family?: Partial<Record<Weight, string>>;
}

/** How heavy the type is: screen titles, and the big numbers on cards and tiles. */
export interface ThemeType {
  title: Weight;
  hero: Weight;
}

export interface Theme {
  id: ThemeId;
  name: string;
  /** One line for the theme picker. */
  description: string;
  schemes: Record<Scheme, Palette>;
  shape: Shape;
  fonts: ThemeFonts;
  type: ThemeType;
}

/** A theme with the scheme already chosen: what `useTheme()` returns. */
export interface ResolvedTheme extends Palette {
  scheme: Scheme;
  theme: Theme;
  shape: Shape;
  fonts: ThemeFonts;
  type: ThemeType;
}
