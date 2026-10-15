/**
 * A drag slider with no native dependency, for levels such as brightness.
 * The value is committed when the finger lifts, so the hub is not flooded.
 */

import { useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { useColors } from './ui';

const THUMB = 28;
const TRACK = 8;

export function Slider({
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
  onRelease,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  /** Called while dragging, for a live readout. */
  onChange?: (value: number) => void;
  /** Called once when the finger lifts. */
  onRelease: (value: number) => void;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<number | undefined>();
  const widthRef = useRef(0);
  const latest = useRef(value);

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step));
  const valueAt = (e: GestureResponderEvent) =>
    clamp(min + ((e.nativeEvent.locationX - THUMB / 2) / Math.max(1, widthRef.current - THUMB)) * (max - min));

  const grant = (e: GestureResponderEvent) => {
    const v = valueAt(e);
    latest.current = v;
    setDragging(v);
    onChange?.(v);
  };
  const move = (e: GestureResponderEvent) => {
    const v = valueAt(e);
    if (v === latest.current) return;
    latest.current = v;
    setDragging(v);
    onChange?.(v);
  };
  const release = () => {
    setDragging(undefined);
    onRelease(latest.current);
  };

  const shown = dragging ?? value;
  const ratio = max > min ? (Math.min(max, Math.max(min, shown)) - min) / (max - min) : 0;
  const x = ratio * Math.max(0, width - THUMB);

  return (
    <View
      style={[styles.hit, { opacity: disabled ? 0.4 : 1 }]}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={grant}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminate={() => setDragging(undefined)}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: shown }}>
      {/* children never take the touch, so locationX stays relative to the whole track */}
      <View pointerEvents="none" style={[styles.track, { backgroundColor: c.backgroundSelected }]} />
      <View pointerEvents="none" style={[styles.track, styles.fill, { backgroundColor: c.accent, width: x + THUMB / 2 }]} />
      <View pointerEvents="none" style={[styles.thumb, { left: x, backgroundColor: dragging !== undefined ? c.accent : '#FFFFFF', borderColor: c.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 44, justifyContent: 'center' },
  track: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: TRACK, borderRadius: TRACK / 2 },
  fill: { right: undefined },
  thumb: { position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
});
