/** A plausible home for the demo hub, shaped exactly like the gateway's device list. */

import type { Device } from '../cube/types';

const ts = () => Date.now();

function dev(partial: Omit<Device, 'manufacturer' | 'firmware_version' | 'online' | 'protocol'> & Partial<Device>): Device {
  return { manufacturer: 'SONOFF', firmware_version: '1.0.0', online: true, protocol: 'zigbee', ...partial };
}

export const DEMO_DEVICES: Device[] = [
  dev({
    serial_number: 'demo-light-living',
    name: 'Living room light',
    model: 'B05-BL-A60',
    display_category: 'light',
    capabilities: [
      { capability: 'power', permission: '1100' },
      { capability: 'brightness', permission: '1100' },
      { capability: 'color-temperature', permission: '1100' },
    ],
    state: {
      power: { powerState: 'on', updated_at: ts() },
      brightness: { brightness: 70, updated_at: ts() },
      'color-temperature': { colorTemperature: 40, updated_at: ts() },
    },
    tags: { room: 'Living room', pinned: '1760000200' },
  }),
  dev({
    serial_number: 'demo-plug-kitchen',
    name: 'Coffee machine',
    model: 'S26R2ZB',
    display_category: 'plug',
    capabilities: [
      { capability: 'power', permission: '1100' },
      { capability: 'electric-power', permission: '0100' },
    ],
    state: { power: { powerState: 'off', updated_at: ts() }, 'electric-power': { 'electric-power': 0, updated_at: ts() } },
    tags: { room: 'Kitchen' },
  }),
  dev({
    serial_number: 'demo-switch-hall',
    name: 'Hall switches',
    model: 'ZBM5-2C',
    display_category: 'switch',
    capabilities: [{ capability: 'toggle', permission: '1100' }],
    state: { toggle: { '1': { toggleState: 'on' }, '2': { toggleState: 'off' } } },
    tags: { room: 'Hall', toggle: { '1': 'Ceiling', '2': 'Porch' } },
  }),
  dev({
    serial_number: 'demo-curtain-bedroom',
    name: 'Bedroom curtain',
    model: 'ZBCurtain',
    display_category: 'curtain',
    capabilities: [
      { capability: 'percentage', permission: '1100' },
      { capability: 'motor-control', permission: '1100' },
    ],
    state: { percentage: { percentage: 30, updated_at: ts() }, 'motor-control': { motorControl: 'stop' } },
    tags: { room: 'Bedroom' },
  }),
  dev({
    serial_number: 'demo-th-bedroom',
    name: 'Bedroom climate',
    model: 'SNZB-02D',
    display_category: 'temperatureAndHumiditySensor',
    capabilities: [
      { capability: 'temperature', permission: '0100' },
      { capability: 'humidity', permission: '0100' },
      { capability: 'battery', permission: '0100' },
    ],
    state: {
      temperature: { temperature: 21.4, updated_at: ts() },
      humidity: { humidity: 48, updated_at: ts() },
      battery: { battery: 92, updated_at: ts() },
    },
    tags: { room: 'Bedroom', pinned: '1760000100' },
  }),
  dev({
    serial_number: 'demo-door-front',
    name: 'Front door',
    model: 'SNZB-04',
    display_category: 'contactSensor',
    capabilities: [
      { capability: 'detect', permission: '0100' },
      { capability: 'battery', permission: '0100' },
    ],
    state: { detect: { detected: false, updated_at: ts() }, battery: { battery: 100, updated_at: ts() } },
    tags: { room: 'Hall' },
  }),
  dev({
    serial_number: 'demo-motion-hall',
    name: 'Hall motion',
    model: 'SNZB-03',
    display_category: 'motionSensor',
    capabilities: [
      { capability: 'detect', permission: '0100' },
      { capability: 'battery', permission: '0100' },
    ],
    state: { detect: { detected: false, updated_at: ts() }, battery: { battery: 77, updated_at: ts() } },
    tags: { room: 'Hall' },
  }),
  dev({
    serial_number: 'demo-ac-living',
    name: 'Living room AC',
    manufacturer: 'Midea',
    model: '00000Q19',
    protocol: undefined,
    display_category: 'airConditioner',
    capabilities: [
      { capability: 'power', permission: '1100' },
      { capability: 'mode', name: 'airConditionerMode', permission: '1100', settings: { supportedValues: { type: 'enum', permission: '01', values: ['cool', 'heat', 'auto', 'fan', 'dry'] } } },
      { capability: 'mode', name: 'fanLevel', permission: '1100', settings: { supportedValues: { type: 'enum', permission: '01', values: ['low', 'medium', 'high', 'auto'] } } },
      { capability: 'thermostat-target-setpoint', name: 'manual-mode', permission: '1110', settings: { temperatureRange: { type: 'numeric', permission: '01', min: 16, max: 30, step: 0.5 } } },
      { capability: 'temperature', permission: '0100' },
      { capability: 'humidity', permission: '0100' },
      { capability: 'vertical-swing', permission: '1100' },
      { capability: 'eco', permission: '1100' },
      { capability: 'electric-power', permission: '0100' },
    ],
    state: {
      power: { powerState: 'on' },
      mode: { airConditionerMode: { modeValue: 'cool' }, fanLevel: { modeValue: 'auto' } },
      'thermostat-target-setpoint': { 'manual-mode': { targetSetpoint: 24 } },
      temperature: { temperature: 25.1 },
      humidity: { humidity: 51 },
      'vertical-swing': { powerState: 'off' },
      eco: { powerState: 'off' },
      'electric-power': { 'electric-power': 62000 },
    },
    tags: { room: 'Living room', bridge: 'ihost-bridge' },
  }),
  dev({
    serial_number: 'demo-heatpump',
    name: 'Heat pump zone 1',
    manufacturer: 'Midea',
    model: '171H120F',
    protocol: undefined,
    display_category: 'thermostat',
    capabilities: [
      { capability: 'power', permission: '1100' },
      { capability: 'thermostat-target-setpoint', name: 'manual-mode', permission: '1110', settings: { temperatureRange: { type: 'numeric', permission: '01', min: 35, max: 65, step: 1 } } },
      { capability: 'temperature', permission: '0100' },
      { capability: 'eco', permission: '1100' },
    ],
    state: {
      power: { powerState: 'on' },
      'thermostat-target-setpoint': { 'manual-mode': { targetSetpoint: 36 } },
      temperature: { temperature: 34 },
      eco: { powerState: 'off' },
    },
    tags: { room: 'Utility', bridge: 'ihost-bridge' },
  }),
  dev({
    serial_number: 'demo-outdoor',
    name: 'Outdoor',
    manufacturer: 'Midea',
    model: '171H120F',
    protocol: undefined,
    display_category: 'temperatureSensor',
    capabilities: [{ capability: 'temperature', permission: '0100' }],
    state: { temperature: { temperature: 9.5 } },
    tags: { room: 'Outside' },
  }),
  dev({
    serial_number: 'demo-fan-fresh',
    name: 'Fresh air',
    manufacturer: 'Midea',
    model: '00000Q1A',
    protocol: undefined,
    display_category: 'fan',
    capabilities: [
      { capability: 'power', permission: '1100' },
      { capability: 'mode', name: 'fanLevel', permission: '1100', settings: { supportedValues: { type: 'enum', permission: '01', values: ['low', 'medium', 'high'] } } },
    ],
    state: { power: { powerState: 'on' }, mode: { fanLevel: { modeValue: 'low' } } },
    tags: { room: 'Bedroom' },
  }),
  dev({
    serial_number: 'demo-leak-bath',
    name: 'Under the sink',
    model: 'SNZB-05',
    display_category: 'waterLeakDetector',
    capabilities: [
      { capability: 'detect', permission: '0100' },
      { capability: 'battery', permission: '0100' },
    ],
    state: { detect: { detected: false }, battery: { battery: 64 } },
    tags: { room: 'Bathroom' },
    online: false,
  }),
];
