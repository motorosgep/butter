# Butter

*I can't believe it's not an iHost app.*

Butter is an open-source phone app for homes that run on a local eWeLink CUBE
gateway, such as the SONOFF iHost. The gateway keeps everything local by design,
and in exchange it never got a companion app: control happens through a web
console or a tablet dashboard. Butter gives it the phone app it deserves,
without adding a cloud of its own.

- **Direct to the hub.** Butter talks to the gateway's own Open API over your
  network. No account, no server in the middle, nothing leaves your LAN unless you
  choose a VPN for remote use.
- **Every device, every capability.** Tiles are generated from what the hub
  reports, so switches, plugs, lights, curtains, sensors, thermostats, air
  conditioners and third-party add-on devices all get a sensible card, including
  the ones vendor ecosystems leave out.
- **Live.** The hub streams state changes; tiles update the instant something
  happens.
- **Honest about the hub's limits.** The Open API has no rooms or scenes yet.
  Butter keeps room assignments on the hub using device tags, and offers app-side
  scenes until the API grows.

Butter is not affiliated with SONOFF, ITEAD or CoolKit. iHost and eWeLink are
their trademarks; Butter just works with their gateway.

## Status

Early development. Nothing to install yet. Follow the roadmap below.

## How it works

```
phone ──LAN (or VPN)──▶ gateway Open API v2   GET /open-api/v2/rest/devices
                                               PUT /open-api/v2/rest/devices/{id}
                        event stream           GET /open-api/v2/sse/bridge
```

1. **Pairing.** Butter finds the gateway on the network (it advertises itself over
   mDNS) or you type its address. It asks the gateway for an access token; you
   press **Allow** once on the gateway's web console. The token is stored in the
   phone's secure keychain.
2. **Devices.** The device list, with categories and capabilities, becomes the
   tile grid. Rooms come from a `room` tag Butter writes on each device, so they
   sync across phones and survive reinstalls.
3. **Control and updates.** Commands go straight to the hub; state changes come
   back over the server-sent event stream.
4. **Remote use.** Any route that reaches the hub works: Tailscale, your own VPN,
   or CUBE's remote access link. Butter just needs a base URL.

## What the spike established

`scripts/spike.ts` talks to a real iHost (eWeLink CUBE 2.9.0) with the same
client the app will use (`src/lib/cube/`). Confirmed:

- The token handshake is one `GET /bridge/access_token?app_name=Butter` poll
  loop; the gateway shows an Allow dialog with the app name and returns a
  long-lived token.
- `GET /devices` returns every device with category, capabilities (including
  per-capability settings such as ranges and supported modes), full state with
  an `updated_at` timestamp per attribute, custom tags and online flag. Devices
  from third-party add-ons are included.
- Security modes come back as `{sid, name, enable}` with `home_mode`,
  `away_mode` and `sleep_mode`.
- The event stream at `/open-api/v2/sse/bridge?access_token=…` delivers
  `device#v2#updateDeviceState` events (serial plus a state fragment) within a
  second of a change, and keep-alive messages in between.

## Roadmap

1. **Spike.** Done; see above. Still to check: the Open API through CUBE's remote
   link.
2. **MVP.** Onboarding, device tiles for the common capabilities, control, live
   updates, security modes, settings, multiple hubs, demo mode. TestFlight and
   Play internal testing.
3. **Rooms, favourites, scenes.** Rooms via tags; app-side scenes; local
   notifications while the app is open.
4. **Platform polish.** Widgets, Siri Shortcuts, tablet layout, translations.
5. **Assistant.** Ask the house questions and give it instructions in plain language.

## Development

Expo SDK 57 with Expo Router and TypeScript. The project pins the public npm
registry in `.npmrc`.

```bash
npm install
npx expo start          # Expo Go / web
npx tsc --noEmit        # typecheck
npx expo lint           # lint
```

Native modules (mDNS discovery, secure storage) need a development build. SDK 57
requires Xcode 26.4 or newer for local iOS builds; without it, build in the cloud:

```bash
npx eas-cli@latest build --platform ios --profile development-simulator   # iOS Simulator
npx eas-cli@latest build --platform ios --profile development             # iPhone
npx eas-cli@latest build --platform android --profile development         # Android APK
npx expo start --dev-client                                               # then connect the app
```

### Over-the-air updates

JavaScript and asset changes ship with EAS Update, so most releases need no new
binary and no store review. Each build profile has an update channel of the same
name (`development`, `preview`, `production`), and the runtime version is a
fingerprint of the native project. An update can only reach builds whose native
code matches, so a changed native dependency or config means one more
`eas build`; everything else is an update.

```bash
npx eas-cli@latest update --channel preview --environment preview --message "What changed"        # testers
npx eas-cli@latest update --channel production --environment production --message "What changed"  # store builds
npx eas-cli@latest update --channel development --environment development --message "..."         # dev builds (Extensions tab)
```

Pushes to `main` publish to the `preview` channel through
[`.github/workflows/update.yml`](.github/workflows/update.yml) once the
repository has an `EXPO_TOKEN` secret (expo.dev → Account settings → Access
tokens). Release builds fetch the update in the background and apply it on the
next launch.

## License

MIT, see [LICENSE](LICENSE).
