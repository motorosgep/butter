/**
 * Server-sent events from the gateway.
 *
 * The gateway emits named events (`device#v2#updateDeviceState` etc.) with a JSON
 * payload. This module has a transport-neutral parser plus a `fetch`-streaming
 * subscriber that works on the web and under Node. React Native's fetch cannot
 * stream, so the app wires the same parser to an XHR-based transport
 * (see `sse.native.ts` once it exists).
 */

import type { CubeEvent } from './types';

export type EventHandler = (event: CubeEvent) => void;

/** Incremental SSE parser: feed it text chunks, it emits complete events. */
export class SseParser {
  private buffer = '';

  constructor(private readonly onEvent: EventHandler) {}

  feed(chunk: string): void {
    this.buffer += chunk;
    let index: number;
    // Events are separated by a blank line.
    while ((index = this.buffer.search(/\r?\n\r?\n/)) !== -1) {
      const block = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index).replace(/^\r?\n\r?\n/, '');
      this.dispatch(block);
    }
  }

  private dispatch(block: string): void {
    let name = 'message';
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') name = value;
      else if (field === 'data') dataLines.push(value);
    }
    if (dataLines.length === 0) return;
    const raw = dataLines.join('\n');
    let data: unknown = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      // keep the raw string
    }
    this.onEvent({ name, data, raw });
  }
}

export interface Subscription {
  close(): void;
}

/**
 * Subscribe with a streaming `fetch` (web / Node). Reconnects with backoff
 * until closed. `onStatus` reports connection changes for the UI.
 */
export function subscribeWithFetch(
  url: string,
  onEvent: EventHandler,
  options: { fetch?: typeof fetch; onStatus?: (status: 'connecting' | 'open' | 'closed', detail?: string) => void } = {},
): Subscription {
  const fetchImpl = options.fetch ?? fetch;
  let closed = false;
  let controller: AbortController | undefined;
  let backoff = 1_000;

  const run = async (): Promise<void> => {
    while (!closed) {
      controller = new AbortController();
      options.onStatus?.('connecting');
      try {
        const res = await fetchImpl(url, { headers: { Accept: 'text/event-stream' }, signal: controller.signal });
        if (!res.ok || !res.body) throw new Error(`stream answered ${res.status}`);
        options.onStatus?.('open');
        backoff = 1_000;
        const parser = new SseParser(onEvent);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }
        options.onStatus?.('closed', 'stream ended');
      } catch (error) {
        if (closed) return;
        options.onStatus?.('closed', error instanceof Error ? error.message : String(error));
      }
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff = Math.min(backoff * 2, 30_000);
    }
  };

  void run();
  return {
    close() {
      closed = true;
      controller?.abort();
    },
  };
}
