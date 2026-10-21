import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { mascotArt, type MascotArtState } from '../art';
import { Mascot } from '../Mascot';

const STATES: MascotArtState[] = [
  'glowing',
  'happy',
  'meh',
  'fried',
  'zombie',
  'sleeping',
  'recovering',
  'ghost',
];

describe('Mascot', () => {
  it('has design-kit art for every health state and ghost', () => {
    for (const state of STATES) {
      expect(mascotArt[state]).toMatch(/^<svg [^>]*viewBox="0 0 200 200"/);
    }
  });

  it('announces the state and its line', async () => {
    await render(<Mascot state="fried" />);
    expect(screen.getByLabelText('Brainling is fried: I feel… crispy.')).toBeOnTheScreen();
  });

  it('grows 1% per level', async () => {
    await render(<Mascot state="happy" size={100} level={11} />);
    expect(screen.getByRole('image')).toHaveStyle({ width: 110, height: 110 });
  });

  it('caps the level bonus at +30%', async () => {
    await render(<Mascot state="happy" size={100} level={60} />);
    expect(screen.getByRole('image')).toHaveStyle({ width: 130 });
  });

  it('never renders below 24dp', async () => {
    await render(<Mascot state="meh" size={10} />);
    expect(screen.getByRole('image')).toHaveStyle({ width: 24 });
  });
});
