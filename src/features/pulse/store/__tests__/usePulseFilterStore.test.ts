import { beforeEach, describe, expect, it } from 'vitest';
import { usePulseFilterStore } from '../usePulseModalFilterStore';

describe('usePulseFilterStore', () => {
  beforeEach(() => {
    usePulseFilterStore.getState().resetFilters();
  });

  it('keeps applied filters untouched until applyFilters is called', () => {
    const store = usePulseFilterStore.getState();

    store.setSection('new-pairs', 'includeKeywords', 'alpha');

    expect(store.appliedSections['new-pairs'].includeKeywords).toBe('');

    store.applyFilters();

    expect(usePulseFilterStore.getState().appliedSections['new-pairs'].includeKeywords).toBe(
      'alpha',
    );
  });

  it('increments filtersVersion and copies sections on apply', () => {
    const initialVersion = usePulseFilterStore.getState().filtersVersion;
    const store = usePulseFilterStore.getState();

    store.setSection('migrated', 'chainIds', ['solana:solana', 'evm:8453']);
    store.applyFilters();

    const nextState = usePulseFilterStore.getState();
    expect(nextState.filtersVersion).toBe(initialVersion + 1);
    expect(nextState.appliedSections.migrated.chainIds).toEqual([
      'solana:solana',
      'evm:8453',
    ]);
  });
});


