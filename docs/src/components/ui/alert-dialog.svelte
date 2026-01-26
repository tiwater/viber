<script lang="ts">
  import { X } from "lucide-svelte";

  interface Props {
    open: boolean;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
    onConfirm: () => void;
    onCancel: () => void;
  }

  let {
    open = $bindable(false),
    title = "Are you sure?",
    description = "",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "default",
    onConfirm,
    onCancel,
  }: Props = $props();

  function handleConfirm() {
    onConfirm();
    open = false;
  }

  function handleCancel() {
    onCancel?.();
    open = false;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      handleCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="backdrop"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby="alert-title"
  >
    <div class="dialog">
      <div class="header">
        <h2 id="alert-title" class="title">{title}</h2>
        <button class="close-btn" onclick={handleCancel}>
          <X size={16} />
        </button>
      </div>

      {#if description}
        <p class="description">{description}</p>
      {/if}

      <div class="actions">
        <button class="btn cancel" onclick={handleCancel}>
          {cancelLabel}
        </button>
        <button
          class="btn confirm"
          class:destructive={variant === "destructive"}
          onclick={handleConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .dialog {
    width: 100%;
    max-width: 400px;
    margin: 1rem;
    padding: 1.5rem;
    background: var(--sl-color-bg);
    border: 1px solid var(--sl-color-hairline);
    border-radius: 0.75rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    animation: scaleIn 0.15s ease;
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sl-color-text);
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--sl-color-gray-3);
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .close-btn:hover {
    background: var(--sl-color-gray-5);
    color: var(--sl-color-text);
  }

  .description {
    font-size: 0.875rem;
    color: var(--sl-color-gray-2);
    margin: 0 0 1.5rem;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn.cancel {
    background: transparent;
    border: 1px solid var(--sl-color-hairline);
    color: var(--sl-color-text);
  }

  .btn.cancel:hover {
    background: var(--sl-color-gray-6);
  }

  .btn.confirm {
    background: var(--sl-color-accent);
    border: none;
    color: white;
  }

  .btn.confirm:hover {
    filter: brightness(1.1);
  }

  .btn.confirm.destructive {
    background: oklch(0.577 0.245 27.325);
  }
</style>
