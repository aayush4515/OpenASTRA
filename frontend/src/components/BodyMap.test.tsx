import { it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BodyMap from '../features/BodyMap';
it('makes body regions keyboard-selectable and shows relevant indicators', () => {
  render(
    <BodyMap
      metrics={[
        {
          metric: 'heart_rate',
          value: 70,
          unit: 'bpm',
          baseline: 67,
          score: 1,
          delta: 3,
          trend: 0,
          count: 21,
          domain: 'body',
          source: 'simulated_wearable',
          simulated: true,
        },
      ]}
    />,
  );
  expect(screen.getByText('Heart Rate')).toBeInTheDocument();
  fireEvent.keyDown(screen.getAllByRole('button', { name: 'Head & eyes' })[0], { key: 'Enter' });
  expect(screen.getByText(/cannot establish eye disease/)).toBeInTheDocument();
  expect(screen.queryByText('Heart Rate')).not.toBeInTheDocument();
});
