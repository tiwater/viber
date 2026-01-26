import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from './api';
import { ViberDataManager } from '../data/manager';
import { MockDataAdapter } from '../test-utils';
import type { Space, Artifact, Task } from '../data/types';

// Mock the manager getter
let testAdapter: MockDataAdapter;
let testManager: ViberDataManager;

vi.mock('../data/manager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/manager')>();
  return {
    ...actual,
    getViberDataManagerServer: () => testManager,
  };
});

describe('Server API', () => {
  beforeEach(() => {
    testAdapter = new MockDataAdapter();
    testManager = new ViberDataManager(testAdapter);
    vi.clearAllMocks();
  });

  describe('Space Operations', () => {
    it('getSpace should retrieve space from manager', async () => {
      const space: Space = { id: 'space-1', name: 'Test Space' };
      await testAdapter.saveSpace(space);

      const result = await api.getSpace('space-1');
      expect(result).toEqual(space);
    });

    it('createSpace should persist space', async () => {
      const input = { name: 'New Space' };
      const result = await api.createSpace(input);

      expect(result.name).toBe(input.name);
      const inStore = await testAdapter.getSpace(result.id);
      expect(inStore).toBeDefined();
    });

    it('listSpaces should return all spaces', async () => {
      await testAdapter.saveSpace({ id: 's1', name: 'S1' });
      await testAdapter.saveSpace({ id: 's2', name: 'S2' });

      const result = await api.listSpaces();
      expect(result).toHaveLength(2);
    });

    it('updateSpace should update space', async () => {
      await testAdapter.saveSpace({ id: 's1', name: 'Old' });
      await api.updateSpace('s1', { name: 'New' });
      const updated = await testAdapter.getSpace('s1');
      expect(updated?.name).toBe('New');
    });

    it('deleteSpace should remove space', async () => {
      await testAdapter.saveSpace({ id: 's1', name: 'S1' });
      await api.deleteSpace('s1');
      const deleted = await testAdapter.getSpace('s1');
      expect(deleted).toBeNull();
    });
  });

  describe('Artifact Operations', () => {
    it('getArtifacts should respect filters', async () => {
      await testAdapter.saveArtifact({ id: 'a1', spaceId: 's1', category: 'input' } as Artifact);
      await testAdapter.saveArtifact({ id: 'a2', spaceId: 's1', category: 'output' } as Artifact);

      const result = await api.getArtifacts('s1', { category: 'input' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });

    it('createArtifact should persist artifact', async () => {
      const result = await api.createArtifact('s1', { originalName: 'test.txt' });
      expect(result.spaceId).toBe('s1');
      expect(await testAdapter.getArtifact(result.id)).toBeDefined();
    });

    it('updateArtifact should update artifact', async () => {
       await testAdapter.saveArtifact({ id: 'a1', spaceId: 's1', originalName: 'old.txt' } as Artifact);
       await api.updateArtifact('a1', 's1', { originalName: 'new.txt' });
       const updated = await testAdapter.getArtifact('a1');
       expect(updated?.originalName).toBe('new.txt');
    });

    it('deleteArtifact should remove artifact', async () => {
        await testAdapter.saveArtifact({ id: 'a1', spaceId: 's1' } as Artifact);
        await api.deleteArtifact('a1', 's1');
        const deleted = await testAdapter.getArtifact('a1');
        expect(deleted).toBeNull();
    });
  });

  describe('Task Operations', () => {
    it('createTask should persist task', async () => {
      const result = await api.createTask('s1', { title: 'New Task' });
      expect(result.spaceId).toBe('s1');
      expect(await testAdapter.getTask(result.id)).toBeDefined();
    });

    it('getTasks should return tasks for space', async () => {
      await testAdapter.saveTask({ id: 't1', spaceId: 's1' } as Task);
      await testAdapter.saveTask({ id: 't2', spaceId: 's2' } as Task);

      const result = await api.getTasks('s1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t1');
    });

    it('updateTask should update task', async () => {
        await testAdapter.saveTask({ id: 't1', spaceId: 's1', title: 'Old' } as Task);
        await api.updateTask('t1', { title: 'New' });
        const updated = await testAdapter.getTask('t1');
        expect(updated?.title).toBe('New');
    });

    it('deleteTask should remove task', async () => {
        await testAdapter.saveTask({ id: 't1', spaceId: 's1' } as Task);
        await api.deleteTask('t1', 's1');
        const deleted = await testAdapter.getTask('t1');
        expect(deleted).toBeNull();
    });
  });
});
