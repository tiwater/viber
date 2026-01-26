import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useViberStore } from './store';
import { ViberDataManager } from '../data/manager';
import { MockDataAdapter } from '../test-utils';
import type { Space, Artifact, Task } from '../data/types';

let testAdapter: MockDataAdapter;
let testManager: ViberDataManager;

// Mock the data manager to return our test instance
vi.mock('../data/manager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/manager')>();
  return {
    ...actual,
    getViberDataManager: () => testManager,
  };
});

describe('useViberStore', () => {
  beforeEach(() => {
    testAdapter = new MockDataAdapter();
    testManager = new ViberDataManager(testAdapter);

    // Reset store state
    useViberStore.setState({
      spaces: new Map(),
      currentSpaceId: null,
      artifacts: new Map(),
      tasks: new Map(),
      agents: [],
      tools: [],
      loading: {
        spaces: false,
        artifacts: {},
        tasks: {},
        agents: false,
        tools: false,
      },
      errors: {
        spaces: null,
        artifacts: {},
        tasks: {},
        agents: null,
        tools: null,
      },
    });
  });

  describe('Synchronous Actions', () => {
    it('should set and get spaces', () => {
      const space: Space = { id: 's1', name: 'S1' };
      useViberStore.getState().setSpaces([space]);
      expect(useViberStore.getState().spaces.get('s1')).toEqual(space);
    });

    it('should set current space id', () => {
      useViberStore.getState().setCurrentSpaceId('s1');
      expect(useViberStore.getState().currentSpaceId).toBe('s1');
    });

    it('should add and remove artifact', () => {
      const artifact: Artifact = { id: 'a1', storageKey: 'k1', originalName: 'n1', mimeType: 't', sizeBytes: 1 };
      useViberStore.getState().addArtifact('s1', artifact);

      let artifacts = useViberStore.getState().artifacts.get('s1');
      expect(artifacts).toHaveLength(1);
      expect(artifacts?.[0].id).toBe('a1');

      useViberStore.getState().removeArtifact('s1', 'a1');
      artifacts = useViberStore.getState().artifacts.get('s1');
      expect(artifacts).toHaveLength(0);
    });
  });

  describe('Async Sync Actions', () => {
    it('should sync spaces from manager', async () => {
      const space: Space = { id: 's1', name: 'Synced Space' };
      await testAdapter.saveSpace(space);

      expect(useViberStore.getState().loading.spaces).toBe(false);

      const promise = useViberStore.getState().syncSpaces();
      expect(useViberStore.getState().loading.spaces).toBe(true);

      await promise;
      expect(useViberStore.getState().loading.spaces).toBe(false);
      expect(useViberStore.getState().spaces.get('s1')).toEqual(space);
    });

    it('should handle errors during sync', async () => {
      vi.spyOn(testManager, 'listSpaces').mockRejectedValue(new Error('Fetch failed'));

      await useViberStore.getState().syncSpaces();

      expect(useViberStore.getState().errors.spaces).toBeInstanceOf(Error);
      expect(useViberStore.getState().loading.spaces).toBe(false);
    });

    it('should sync artifacts for space', async () => {
      await testAdapter.saveArtifact({ id: 'a1', spaceId: 's1' } as Artifact);

      await useViberStore.getState().syncArtifacts('s1');

      const artifacts = useViberStore.getState().artifacts.get('s1');
      expect(artifacts).toHaveLength(1);
      expect(artifacts?.[0].id).toBe('a1');
    });
  });
});
