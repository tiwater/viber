<script lang="ts">
  interface Feature {
    title: string;
    description: string;
  }

  interface Props {
    title: string;
    subtitle?: string;
    features: Feature[];
    variant?: "indigo-purple" | "blue-purple";
    cta?: {
      title: string;
      subtitle: string;
    };
  }

  let {
    title,
    subtitle,
    features,
    variant = "indigo-purple",
    cta,
  }: Props = $props();

  const gradientStyles: Record<string, string> = {
    "blue-purple": "linear-gradient(to right, #3b82f6, #a855f7)",
    "indigo-purple": "linear-gradient(135deg, #6366f1, #9333ea)",
  };
</script>

<div class="conclusion-section" style="background: {gradientStyles[variant]};">
  <div class="conclusion-title">
    {title}
  </div>
  {#if subtitle}
    <div class="conclusion-subtitle">
      {subtitle}
    </div>
  {/if}

  <div class="features-grid">
    {#each features as feature}
      <div class="feature-item">
        <div class="feature-title">{feature.title}</div>
        <div class="feature-desc">{feature.description}</div>
      </div>
    {/each}
  </div>

  {#if cta}
    <div class="cta-box">
      <div class="cta-title">
        {cta.title}
      </div>
      <div class="cta-subtitle">
        {cta.subtitle}
      </div>
    </div>
  {/if}
</div>

<style>
  .conclusion-section {
    color: white;
    padding: 4rem 2rem;
    text-align: center;
    border-radius: 1rem;
    margin: 2rem 0;
  }
  .conclusion-title {
    font-size: 2.25rem;
    font-weight: 700;
    margin-bottom: 2rem;
    line-height: 1.4;
  }
  .conclusion-subtitle {
    font-size: 1.125rem;
    max-width: 48rem;
    margin: 0 auto 2rem;
    opacity: 0.95;
  }
  .features-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 2rem;
    max-width: 48rem;
    margin: 2rem auto;
  }
  @media (min-width: 768px) {
    .features-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .feature-item {
    text-align: center;
  }
  .feature-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  .feature-desc {
    opacity: 0.9;
  }
  .cta-box {
    margin-top: 3rem;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(4px);
    border-radius: 0.5rem;
  }
  .cta-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    line-height: 1.6;
  }
  .cta-subtitle {
    font-size: 1.25rem;
    font-weight: 700;
  }
</style>
