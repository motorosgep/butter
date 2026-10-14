/**
 * Event stream transport for iOS/Android.
 *
 * React Native's fetch cannot stream a response body, so the app uses
 * react-native-sse (an EventSource over XMLHttpRequest). Same contract as the
 * fetch-based `subscribe` in `sse.ts`.
 */

import EventSource from 'react-native-sse';

import type { CubeEvent } from './types';

export type EventHandler = (event: CubeEvent) => void;
export type StreamStatus = 'connecting' | 'open' | 'closed';

export interface SubscribeOptions {
  fetch?: typeof fetch;
  onStatus?: (status: StreamStatus, detail?: string) => void;
}

export interface Subscription {
  close(): void;
}

/** Event names the gateway sends. react-native-sse only dispatches names it was told to listen for. */
const KNOWN_EVENTS = [
  'device#v2#addDevice',
  'device#v2#updateDeviceState',
  'device#v2#updateDeviceInfo',
  'device#v2#deleteDevice',
  'device#v2#updateDeviceOnline',
  'bridge#v2#updateSecurityState',
  'security#v2#updateArmState',
] as const;

type KnownEvent = (typeof KNOWN_EVENTS)[number];

export function subscribe(url: string, onEvent: EventHandler, options: SubscribeOptions = {}): Subscription {
  const source = new EventSource<KnownEvent>(url, { pollingInterval: 3_000 });
  options.onStatus?.('connecting');

  source.addEventListener('open', () => options.onStatus?.('open'));
  source.addEventListener('error', (event) => {
    const detail = 'message' in event && typeof event.message === 'string' ? event.message : 'stream error';
    options.onStatus?.('closed', detail);
  });
  source.addEventListener('close', () => options.onStatus?.('closed'));

  const dispatch = (name: string, raw: string | null) => {
    if (raw === null) return;
    let data: unknown = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      // keep the raw string
    }
    onEvent({ name, data, raw });
  };
  for (const name of KNOWN_EVENTS) {
    source.addEventListener(name, (event) => dispatch(name, event.data));
  }
  source.addEventListener('message', (event) => {
    // keep-alives arrive here as empty messages
    if (event.data) dispatch('message', event.data);
  });

  return {
    close() {
      source.removeAllEventListeners();
      source.close();
    },
  };
}
