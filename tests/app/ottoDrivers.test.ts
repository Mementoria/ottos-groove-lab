import { createOttoDrivers } from '../../src/app/ottoDrivers';
import type { AudioEngine } from '../../src/audio/engine';

function engineWith(opts: { playing: boolean; cycle?: number; analyser?: AnalyserNode | null }) {
  const engine: AudioEngine = {
    status: () => 'ready',
    onStatus: () => () => {},
    start: () => Promise.resolve(),
    play: () => Promise.resolve(null),
    update: () => Promise.resolve(null),
    stop: () => {},
    isPlaying: () => opts.playing,
    cyclePosition: () => opts.cycle ?? 0,
    analyser: () => opts.analyser ?? null,
  };
  return engine;
}

function fakeAnalyser(value: number) {
  const buffers: Float32Array[] = [];
  const node = {
    fftSize: 8,
    getFloatTimeDomainData(data: Float32Array) {
      buffers.push(data);
      data.fill(value);
    },
  };
  // Only the two members the drivers touch exist on this stand-in.
  return { node: node as unknown as AnalyserNode, buffers };
}

describe('createOttoDrivers', () => {
  it('follows the beat (four per cycle) while playing', () => {
    const drivers = createOttoDrivers(engineWith({ playing: true, cycle: 1.3 }));
    expect(drivers.beatPhase()).toBeCloseTo(0.2);
  });

  it('sways slowly on the clock when idle', () => {
    const drivers = createOttoDrivers(engineWith({ playing: false, cycle: 1.3 }), () => 3000);
    expect(drivers.beatPhase()).toBeCloseTo(0.5);
  });

  it('measures RMS loudness while playing, reusing one buffer', () => {
    const { node, buffers } = fakeAnalyser(0.5);
    const drivers = createOttoDrivers(engineWith({ playing: true, analyser: node }));
    expect(drivers.level()).toBeCloseTo(0.5);
    drivers.level();
    expect(buffers).toHaveLength(2);
    expect(buffers[0]).toBe(buffers[1]);
    expect(buffers[0]).toHaveLength(8);
  });

  it('is silent when stopped or without an analyser', () => {
    const { node } = fakeAnalyser(0.5);
    expect(createOttoDrivers(engineWith({ playing: false, analyser: node })).level()).toBe(0);
    expect(createOttoDrivers(engineWith({ playing: true })).level()).toBe(0);
  });
});
