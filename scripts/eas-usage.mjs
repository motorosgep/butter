#!/usr/bin/env node
// Prints this month's EAS Build usage against the Free plan (15 iOS + 15 Android builds per month).
// Usage: npm run eas:usage
import { execFileSync } from 'node:child_process';

const LIMIT = 15;
const month = new Date().toISOString().slice(0, 7);
let raw;
try {
  raw = execFileSync('npx', ['eas-cli@latest', 'build:list', '--limit', '50', '--json', '--non-interactive'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  console.error(String(error.stderr ?? error.message).trim());
  process.exit(1);
}
const builds = JSON.parse(raw).filter((b) => b.createdAt.startsWith(month));
for (const platform of ['IOS', 'ANDROID']) {
  const mine = builds.filter((b) => b.platform === platform);
  const byStatus = mine.reduce((acc, b) => ({ ...acc, [b.status]: (acc[b.status] ?? 0) + 1 }), {});
  const detail = Object.entries(byStatus).map(([s, n]) => `${n} ${s.toLowerCase()}`).join(', ');
  console.log(`${platform.padEnd(8)} ${String(mine.length).padStart(2)} / ${LIMIT} builds in ${month}${detail ? `  (${detail})` : ''}`);
}
console.log('Updates are not counted; the Free plan caps them at 1,000 monthly active users and 100 GiB.');
console.log('Account usage page: https://expo.dev/accounts/b2fodist/settings/usage');
