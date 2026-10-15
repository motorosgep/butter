/**
 * A faint 24-hour trace along the bottom of a tile. SVG rendered by expo-image,
 * like the charts, so it needs no native module.
 */

import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { SparkPoint } from '@/lib/history/sparkline';

function svgUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function Sparkline({
  points,
  color,
  height = 44,
  minSpan = 1,
  style,
}: {
  points: SparkPoint[];
  color: string;
  height?: number;
  minSpan?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);

  const uri = useMemo(() => {
    if (!width || points.length < 2) return undefined;
    const values = points.map((p) => p.v);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
    if (hi - lo < minSpan) {
      const mid = (hi + lo) / 2;
      lo = mid - minSpan / 2;
      hi = mid + minSpan / 2;
    }
    const pad = (hi - lo) * 0.15;
    lo -= pad;
    hi += pad;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * width;
    const y = (v: number) => height - 1.5 - ((v - lo) / (hi - lo)) * (height - 3);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const area = `${path} L${width} ${height} L0 ${height} Z`;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<path d="${area}" fill="${color}" fill-opacity="0.13"/>` +
      `<path d="${path}" fill="none" stroke="${color}" stroke-opacity="0.85" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>` +
      `</svg>`;
    return svgUri(svg);
  }, [points, color, width, height, minSpan]);

  return (
    <View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, height }, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {uri ? <Image source={{ uri }} style={{ width, height }} contentFit="fill" /> : null}
    </View>
  );
}
