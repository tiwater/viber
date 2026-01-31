<script lang="ts">
  import { Info, Lightbulb, AlertTriangle, AlertCircle } from "@lucide/svelte";

  interface Props {
    type?: "note" | "tip" | "caution" | "danger";
    title?: string;
    children?: any;
  }

  let { type = "note", title, children }: Props = $props();

  const icons = {
    note: Info,
    tip: Lightbulb,
    caution: AlertTriangle,
    danger: AlertCircle,
  };

  const colors = {
    note: "border-blue-500 bg-blue-500/10",
    tip: "border-green-500 bg-green-500/10",
    caution: "border-yellow-500 bg-yellow-500/10",
    danger: "border-red-500 bg-red-500/10",
  };

  const iconColors = {
    note: "text-blue-500",
    tip: "text-green-500",
    caution: "text-yellow-500",
    danger: "text-red-500",
  };

  const Icon = icons[type];
  const defaultTitles = {
    note: "Note",
    tip: "Tip",
    caution: "Caution",
    danger: "Danger",
  };
</script>

<aside class="my-4 rounded-lg border-l-4 p-4 {colors[type]}">
  <div class="flex items-center gap-2 font-semibold mb-2">
    <Icon class="size-5 {iconColors[type]}" />
    <span>{title || defaultTitles[type]}</span>
  </div>
  <div class="text-sm">
    {@render children?.()}
  </div>
</aside>
