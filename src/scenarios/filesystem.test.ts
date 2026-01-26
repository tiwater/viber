import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ViberDataManager } from '../data/manager';
import { LocalDataAdapter } from '../data/adapters/local';
import { configure } from '../config';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Filesystem Automation', () => {
    let tempDir: string;
    let manager: ViberDataManager;

    beforeEach(async () => {
        // Create a temporary directory for this test run
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'viber-test-'));

        // Configure Viber to use this directory as storage root
        configure({ storageRoot: tempDir });

        // Initialize manager with LocalDataAdapter
        // LocalDataAdapter will use getViberRoot() which now points to tempDir
        const adapter = new LocalDataAdapter();
        manager = new ViberDataManager(adapter);
    });

    afterEach(async () => {
        // Cleanup: remove temporary directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (e) {
            console.error('Failed to cleanup temp dir:', e);
        }
    });

    it('should create space and verify directory existence', async () => {
        const spaceData = { name: 'FS Space' };
        const space = await manager.createSpace(spaceData);

        expect(space.id).toBeDefined();

        // Verify space.json exists in the expected path
        // Structure: <root>/spaces/<spaceId>/space.json
        const spaceJsonPath = path.join(tempDir, 'spaces', space.id, 'space.json');

        // Check if file exists
        const stat = await fs.stat(spaceJsonPath);
        expect(stat.isFile()).toBe(true);

        // Check content
        const content = JSON.parse(await fs.readFile(spaceJsonPath, 'utf-8'));
        expect(content.name).toBe('FS Space');
    });

    it('should create artifact and store it', async () => {
        const space = await manager.createSpace({ name: 'Artifact Space' });

        // Create artifact metadata
        const artifactData = {
            originalName: 'test.txt',
            mimeType: 'text/plain',
            category: 'input' as const
        };

        const artifact = await manager.createArtifact(space.id, artifactData);
        expect(artifact.id).toBeDefined();

        // In LocalDataAdapter/SpaceStorage, artifacts are file entries in 'artifacts' folder
        // But createArtifact only saves metadata.
        // LocalDataAdapter doesn't save separate metadata file for artifact usually,
        // it relies on file presence.
        // Wait, checking manager.createArtifact logic:
        // It calls adapter.saveArtifact.
        // LocalDataAdapter.saveArtifact does NOTHING for metadata persistence in file system mode
        // (comment says "This is effectively a no-op for metadata persistence in pure local mode").

        // So checking for file existence of metadata might fail if it's not saved.
        // But let's check if we can upload a file.

        const fileContent = 'Hello World';
        const file = new Blob([fileContent], { type: 'text/plain' });

        // We need to verify uploadArtifactFile (which is on Manager)
        // But Manager.uploadArtifactFile takes File/Blob.
        // Node.js doesn't have File global by default in older versions, but we are in Vitest with jsdom (maybe?)
        // Or we can just pass a Blob.

        const storageKey = await manager.uploadArtifactFile(space.id, artifact.id, file, 'test.txt');

        // Verify file exists
        const filePath = path.join(tempDir, 'spaces', space.id, 'artifacts', artifact.id, 'test.txt');
        const stat = await fs.stat(filePath);
        expect(stat.isFile()).toBe(true);

        const storedContent = await fs.readFile(filePath, 'utf-8');
        expect(storedContent).toBe(fileContent);
    });
});
