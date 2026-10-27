import { describe, expect, it } from '@jest/globals';

import { initialRoute } from '../initialRoute';

describe('initialRoute', () => {
  it('sends a first run to the welcome screen', () => {
    expect(initialRoute(false)).toBe('/welcome');
  });

  it('sends later runs straight to Home', () => {
    expect(initialRoute(true)).toBe('/(tabs)');
  });
});
