import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ViberDataManager } from './manager';
import { MockDataAdapter } from '../test-utils';
import type { Space, Artifact } from './types';

describe('ViberDataManager', () => {
  let manager: ViberDataManager;
  let adapter: MockDataAdapter;

  beforeEach(() => {
    adapter = new MockDataAdapter();
    manager = new ViberDataManager(adapter);
  });

  describe('Space Operations', () => {
    it('should get a space and cache it', async () => {
      const space: Space = { id: 'space-1', name: 'Test Space' };
      await adapter.saveSpace(space);

      // Spy on adapter to verify cache usage
      const spy = vi.spyOn(adapter, 'getSpace');

      // First call - should hit adapter
      const result1 = await manager.getSpace('space-1');
      expect(result1).toEqual(space);
      expect(spy).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      const result2 = await manager.getSpace('space-1');
      expect(result2).toEqual(space);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should list spaces with filters', async () => {
      const spaces: Space[] = [
        { id: 'space-1', name: 'Test Space 1', userId: 'user-1' },
        { id: 'space-2', name: 'Test Space 2', userId: 'user-2' },
      ];
      for (const s of spaces) await adapter.saveSpace(s);

      const result = await manager.listSpaces({ userId: 'user-1' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('space-1');
    });

    it('should create a space and invalidate cache', async () => {
      // Setup initial state to verify cache invalidation
      const spy = vi.spyOn(adapter, 'getSpace');
      const newSpaceData = { name: 'New Space' };

      const created = await manager.createSpace(newSpaceData);
      expect(created.name).toBe('New Space');
      expect(await adapter.getSpace(created.id)).toBeDefined();

      // Access it to cache it (if it wasn't already cached by create)
      // Actually createSpace sets cache, so let's verify it is cached

      // Invalidate cache by updating something else?
      // createSpace invalidates "spaces:" and "space:".

      // Let's test that listSpaces hits adapter after createSpace
      const listSpy = vi.spyOn(adapter, 'getSpaces');
      await manager.listSpaces();
      expect(listSpy).toHaveBeenCalledTimes(1);

      await manager.createSpace({ name: 'Another Space' });

      await manager.listSpaces();
      expect(listSpy).toHaveBeenCalledTimes(2); // Should be called again because cache was invalidated
    });
  });

  describe('Artifact Operations', () => {
    it('should get artifacts with filters', async () => {
      const artifacts: Artifact[] = [
        { id: 'art-1', spaceId: 'space-1', category: 'input', storageKey: 'k1', originalName: 'n1', mimeType: 'text/plain', sizeBytes: 10 },
        { id: 'art-2', spaceId: 'space-1', category: 'output', storageKey: 'k2', originalName: 'n2', mimeType: 'text/plain', sizeBytes: 10 },
      ];
      for (const a of artifacts) await adapter.saveArtifact(a);

      const result = await manager.getArtifacts('space-1', { category: 'input' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('art-1');
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should notify subscribers on update', async () => {
      const space: Space = { id: 'space-1', name: 'Old Name' };
      await adapter.saveSpace(space);

      const callback = vi.fn();

      // Subscribe
      const unsubscribe = manager.subscribeToSpace('space-1', callback);

      // Should receive initial value
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(callback).toHaveBeenCalledWith(space);

      // Update
      await manager.updateSpace('space-1', { name: 'New Name' });

      // Should receive update
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'New Name' }));

      unsubscribe();
    });
  });
});
