# Open API notes

What a spike against a real iHost (eWeLink CUBE 2.9.0) established, using the same
client the app uses (`src/lib/cube/`).

Confirmed:


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


Also learned while building the MVP:

- The gateway only shows its "Get eWeLink CUBE access token" dialog to console
  pages while token requests keep arriving. If the phone app is suspended (for
  example because the user switched to Safari), the dialog disappears. Butter
  opens the console inside the app so polling continues.
- Plain eWeLink Wi-Fi devices in LAN mode advertise the same `_ewelink._tcp`
  mDNS service as the gateway. Only a gateway answers `GET /bridge`, so discovery
  probes every result and lists gateways only.
- `PUT /devices/{serial}` answers `{"error":0}` as soon as the gateway accepts the
  command; for devices that live behind an add-on, the state change arrives later
  over the event stream.
