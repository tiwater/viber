import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as actions from './actions';
import { ViberDataManager } from '../data/manager';
import { MockDataAdapter } from '../test-utils';
import type { Space, Artifact, Task } from '../data/types';

// We need to define manager and adapter outside to access them in the mock factory
// But vitest mock factory is hoisted, so it can't access variables from outer scope.
// So we will just mock the module and use a getter or re-import.

// Actually, we can use a simpler approach: mock the implementation to return a singleton we control.
let testAdapter: MockDataAdapter;
let testManager: ViberDataManager;

vi.mock('../data/manager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/manager')>();
  return {
    ...actual,
    getViberDataManagerServer: () => testManager,
  };
});

describe('Server Actions', () => {
  beforeEach(() => {
    testAdapter = new MockDataAdapter();
    testManager = new ViberDataManager(testAdapter);
  });

  describe('Space Actions', () => {
    it('getSpace should retrieve space from manager', async () => {
      const space: Space = { id: 'space-1', name: 'Test' };
      await testAdapter.saveSpace(space);

      const result = await actions.getSpace('space-1');
      expect(result).toEqual(space);
    });

    it('createSpace should persist space via manager', async () => {
      const input = { name: 'New Space' };

      const result = await actions.createSpace(input);
      expect(result.name).toBe(input.name);

      const inStore = await testAdapter.getSpace(result.id);
      expect(inStore).toBeDefined();
    });

    it('listSpaces should return all spaces', async () => {
      await testAdapter.saveSpace({ id: 's1', name: 'S1' });
      await testAdapter.saveSpace({ id: 's2', name: 'S2' });

      const result = await actions.listSpaces();
      expect(result).toHaveLength(2);
    });

    it('updateSpace should update space', async () => {
      await testAdapter.saveSpace({ id: 's1', name: 'Old' });
      await actions.updateSpace('s1', { name: 'New' });
      const updated = await testAdapter.getSpace('s1');
      expect(updated?.name).toBe('New');
    });

    it('deleteSpace should remove space', async () => {
      await testAdapter.saveSpace({ id: 's1', name: 'S1' });
      await actions.deleteSpace('s1');
      const deleted = await testAdapter.getSpace('s1');
      expect(deleted).toBeNull();
    });
  });

  describe('Artifact Actions', () => {
    it('getArtifacts should respect filters', async () => {
      await testAdapter.saveArtifact({ id: 'a1', spaceId: 's1', category: 'input' } as Artifact);
      await testAdapter.saveArtifact({ id: 'a2', spaceId: 's1', category: 'output' } as Artifact);

      const result = await actions.getArtifacts('s1', { category: 'input' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });

    it('createArtifact should persist artifact', async () => {
      const result = await actions.createArtifact('s1', { originalName: 'test.txt' });
      expect(result.spaceId).toBe('s1');
      expect(await testAdapter.getArtifact(result.id)).toBeDefined();
    });
  });

  describe('Task Actions', () => {
    it('createTask should persist task', async () => {
      const result = await actions.createTask('s1', { title: 'New Task' });
      expect(result.spaceId).toBe('s1');
      expect(await testAdapter.getTask(result.id)).toBeDefined();
    });

    it('getTasks should return tasks for space', async () => {
      await testAdapter.saveTask({ id: 't1', spaceId: 's1' } as Task);
      await testAdapter.saveTask({ id: 't2', spaceId: 's2' } as Task);

      const result = await actions.getTasks('s1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t1');
    });
  });
});
