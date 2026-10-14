/**
 * API spike: exercise the gateway the way the app will, from Node.
 *
 *   npx tsx scripts/spike.ts http://192.168.68.55 [token]
 *
 * Without a token it starts the Allow handshake: press Allow on the gateway's web
 * console within five minutes. It then prints the device inventory, listens to
 * the event stream for a while, and exits. It never sends a command.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CubeClient } from '../src/lib/cube/client';
import { subscribeWithFetch } from '../src/lib/cube/sse';

const [baseUrl, tokenArg] = process.argv.slice(2);
if (!baseUrl) {
  console.error('usage: tsx scripts/spike.ts <gateway base url> [token]');
  process.exit(2);
}

const LISTEN_SECONDS = Number(process.env.LISTEN_SECONDS ?? 45);
// The token is a credential for your hub: it is kept in a git-ignored file, never printed.
const TOKEN_FILE = join(__dirname, '.spike-token');

async function main(): Promise<void> {
  const savedToken = existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, 'utf8').trim() : undefined;
  const client = new CubeClient({ baseUrl, token: tokenArg ?? savedToken, appName: 'Butter' });

  const info = await client.bridgeInfo();
  console.log(`gateway: ${info.name} ${info.fw_version} at ${info.ip} (${info.domain})`);

  if (!client.token) {
    console.log('requesting a token: press Allow on the gateway web console...');
    const token = await client.waitForToken(300_000, 2_000, (n) => {
      if (n % 5 === 0) console.log(`  still waiting (${n * 2}s)`);
    });
    writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
    console.log(`token received and saved to ${TOKEN_FILE}`);
  }

  const devices = await client.listDevices();
  console.log(`\n${devices.length} device(s):`);
  for (const d of devices) {
    const caps = d.capabilities.map((c) => (c.name ? `${c.capability}/${c.name}` : c.capability)).join(', ');
    console.log(`- ${d.name} [${d.display_category}] ${d.online ? 'online' : 'OFFLINE'} ${d.protocol ?? ''}`);
    console.log(`    serial ${d.serial_number}  caps: ${caps}`);
    console.log(`    state: ${JSON.stringify(d.state)}`);
    if (d.tags && Object.keys(d.tags).length) console.log(`    tags: ${JSON.stringify(d.tags)}`);
  }

  const security = await client.listSecurityModes().catch((e: Error) => {
    console.log(`\nsecurity list failed: ${e.message}`);
    return [];
  });
  if (security.length) {
    console.log(`\nsecurity modes: ${security.map((s) => `${s.name} (sid ${s.sid}, ${s.enable ? 'armed' : 'off'})`).join(', ')}`);
  }

  console.log(`\nlistening to the event stream for ${LISTEN_SECONDS}s (change something on the hub)...`);
  let count = 0;
  const sub = subscribeWithFetch(client.sseUrl, (event) => {
    count += 1;
    console.log(`  event ${event.name}: ${JSON.stringify(event.data).slice(0, 300)}`);
  }, { onStatus: (status, detail) => console.log(`  stream ${status}${detail ? ` (${detail})` : ''}`) });
  await new Promise((resolve) => setTimeout(resolve, LISTEN_SECONDS * 1_000));
  sub.close();
  console.log(`\n${count} event(s) received. Done.`);
}

main().catch((error) => {
  console.error('spike failed:', error);
  process.exit(1);
});
