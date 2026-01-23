<script lang="ts">
  import { playgroundStore, type Artifact } from "$lib/stores/playground-store";
  import {
    FileText,
    Code,
    FileCode,
    Trash2,
    X,
    FolderOpen,
    Plus,
  } from "lucide-svelte";

  let selectedArtifact = $state<Artifact | null>(null);
  let isCollapsed = $state(false);

  const space = $derived($playgroundStore);

  function getIcon(type: Artifact["type"]) {
    switch (type) {
      case "code":
        return Code;
      case "markdown":
        return FileText;
      default:
        return FileCode;
    }
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleDelete(id: string, e: Event) {
    e.stopPropagation();
    playgroundStore.deleteArtifact(id);
    if (selectedArtifact?.id === id) {
      selectedArtifact = null;
    }
  }
</script>

<div class="space-panel" class:collapsed={isCollapsed}>
  <!-- Header -->
  <div class="panel-header">
    <button
      class="collapse-btn"
      onclick={() => (isCollapsed = !isCollapsed)}
      title={isCollapsed ? "Expand panel" : "Collapse panel"}
    >
      {#if isCollapsed}
        <FolderOpen size={18} />
      {:else}
        <X size={18} />
      {/if}
    </button>

    {#if !isCollapsed}
      <h3 class="panel-title">
        <FolderOpen size={16} />
        Workspace
      </h3>
      <span class="artifact-count">{space.artifacts.length} files</span>
    {/if}
  </div>

  {#if !isCollapsed}
    <!-- Artifact List -->
    <div class="artifact-list">
      {#if space.artifacts.length === 0}
        <div class="empty-state">
          <FileText size={32} class="empty-icon" />
          <p>No artifacts yet</p>
          <p class="hint">Files created during chat will appear here</p>
        </div>
      {:else}
        {#each space.artifacts as artifact (artifact.id)}
          {@const Icon = getIcon(artifact.type)}
          <div
            class="artifact-item"
            class:selected={selectedArtifact?.id === artifact.id}
            onclick={() => (selectedArtifact = artifact)}
            role="button"
            tabindex="0"
            onkeydown={(e) =>
              e.key === "Enter" && (selectedArtifact = artifact)}
          >
            <Icon size={14} class="artifact-icon" />
            <span class="artifact-name">{artifact.name}</span>
            <span class="artifact-time">{formatDate(artifact.createdAt)}</span>
            <button
              class="delete-btn"
              onclick={(e) => handleDelete(artifact.id, e)}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Preview -->
    {#if selectedArtifact}
      <div class="preview-section">
        <div class="preview-header">
          <span class="preview-title">{selectedArtifact.name}</span>
          <button
            class="close-preview"
            onclick={() => (selectedArtifact = null)}
          >
            <X size={14} />
          </button>
        </div>
        <pre class="preview-content">{selectedArtifact.content}</pre>
      </div>
    {/if}
  {/if}
</div>

<style>
  .space-panel {
    display: flex;
    flex-direction: column;
    width: 320px;
    min-width: 320px;
    height: 100%;
    border-left: 1px solid var(--sl-color-hairline);
    background: var(--sl-color-bg);
    transition:
      width 0.2s ease,
      min-width 0.2s ease;
  }

  .space-panel.collapsed {
    width: 48px;
    min-width: 48px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--sl-color-hairline);
    background: var(--sl-color-bg-nav);
  }

  .collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--sl-color-text);
    border-radius: 0.375rem;
    cursor: pointer;
    opacity: 0.7;
  }

  .collapse-btn:hover {
    background: var(--sl-color-gray-5);
    opacity: 1;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sl-color-text);
    margin: 0;
  }

  .artifact-count {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--sl-color-gray-3);
  }

  .artifact-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--sl-color-gray-3);
    padding: 2rem;
  }

  .empty-state :global(.empty-icon) {
    opacity: 0.3;
    margin-bottom: 1rem;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .empty-state .hint {
    font-size: 0.75rem;
    opacity: 0.7;
    margin-top: 0.25rem;
  }

  .artifact-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 0.5rem;
    cursor: pointer;
    text-align: left;
    color: var(--sl-color-text);
    transition: all 0.15s ease;
  }

  .artifact-item:hover {
    background: var(--sl-color-gray-6);
  }

  .artifact-item.selected {
    background: var(--sl-color-gray-5);
    border-color: var(--sl-color-accent);
  }

  .artifact-item :global(.artifact-icon) {
    flex-shrink: 0;
    color: var(--sl-color-accent);
  }

  .artifact-name {
    flex: 1;
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .artifact-time {
    font-size: 0.6875rem;
    color: var(--sl-color-gray-3);
  }

  .delete-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: var(--sl-color-gray-3);
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .artifact-item:hover .delete-btn {
    display: flex;
  }

  .delete-btn:hover {
    background: oklch(0.577 0.245 27.325 / 0.2);
    color: oklch(0.577 0.245 27.325);
  }

  .preview-section {
    border-top: 1px solid var(--sl-color-hairline);
    max-height: 40%;
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--sl-color-bg-nav);
    border-bottom: 1px solid var(--sl-color-hairline);
  }

  .preview-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sl-color-text);
  }

  .close-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: var(--sl-color-gray-3);
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .close-preview:hover {
    background: var(--sl-color-gray-5);
    color: var(--sl-color-text);
  }

  .preview-content {
    flex: 1;
    overflow: auto;
    margin: 0;
    padding: 0.75rem;
    font-size: 0.75rem;
    line-height: 1.5;
    font-family: var(--sl-font-mono);
    background: var(--sl-color-bg);
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
