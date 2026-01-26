<script lang="ts">
  interface Props {
    title: string;
    subtitle?: string;
    variant?: "blue-purple" | "amber-orange" | "indigo-purple";
  }

  let { title, subtitle, variant = "blue-purple" }: Props = $props();

  const gradientStyles: Record<string, string> = {
    "blue-purple": "linear-gradient(to right, #3b82f6, #a855f7)",
    "amber-orange": "linear-gradient(to right, #fbbf24, #f97316)",
    "indigo-purple": "linear-gradient(135deg, #6366f1, #9333ea)",
  };
</script>

<div class="hero-banner" style="background: {gradientStyles[variant]};">
  <div class="hero-title">
    {title}
  </div>
  {#if subtitle}
    <div class="hero-subtitle">
      {subtitle}
    </div>
  {/if}
</div>

<style>
  .hero-banner {
    color: white;
    padding: 4rem 2rem;
    text-align: center;
    border-radius: 1rem;
    margin: 2rem 0;
  }
  .hero-title {
    font-size: 1.875rem;
    font-weight: 700;
    margin-bottom: 1rem;
    line-height: 1.4;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  .hero-subtitle {
    font-size: 1.25rem;
    max-width: 48rem;
    margin: 0 auto;
    opacity: 0.95;
  }
</style>
