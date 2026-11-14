import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Camera, { qualityOK, extractFeatures } from './Camera';
afterEach(cleanup);
describe('camera failure and quality paths', () => {
  it('allows manual continuation without requesting camera or microphone', () => {
    const skip = vi.fn();
    const media = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: media },
      configurable: true,
    });
    render(<Camera onCapture={vi.fn()} onSkip={skip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue without camera' }));
    expect(skip).toHaveBeenCalled();
    expect(media).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save facial measurements' })).toBeDisabled();
  });
  it('explains an unavailable webcam and keeps manual fallback available', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    render(<Camera onCapture={vi.fn()} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enable camera' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Webcam access is unavailable');
    expect(screen.getByRole('button', { name: 'Continue without camera' })).toBeEnabled();
  });
  it('rejects poor light, pose, motion, distance and insufficient frames', () => {
    const q = { brightness: 120, yaw: 0, roll: 0, face_size: 0.4, stability: 0.01, frames: 10 };
    expect(qualityOK(q)).toBe(true);
    for (const change of [
      { brightness: 15 },
      { yaw: 0.3 },
      { roll: 0.3 },
      { face_size: 0.1 },
      { stability: 0.1 },
      { frames: 3 },
    ])
      expect(qualityOK({ ...q, ...change })).toBe(false);
  });
  it('calculates geometric ratios from landmarks rather than identity', () => {
    const points = Array.from({ length: 478 }, (_, i) => ({
      x: (i % 17) / 17,
      y: (i % 13) / 13,
      z: 0,
      visibility: 1,
    }));
    const f = extractFeatures(points);
    expect(Object.keys(f)).toEqual([
      'left_eye',
      'right_eye',
      'mouth_tilt',
      'brow_height',
      'asymmetry',
    ]);
    expect(Object.values(f).every(Number.isFinite)).toBe(true);
  });
});
