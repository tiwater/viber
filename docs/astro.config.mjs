import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'Viber',
      logo: {
        src: './src/assets/logo.png',
      },
      favicon: '/favicon.png',
      description: 'Multi-agent collaboration framework for vibe working',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/tiwater/viber' },
      ],
      customCss: [
        './src/styles/global.css',
        './src/styles/starlight-overrides.css',
      ],
      head: [],
      components: {
        Header: './src/components/header.astro',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
          ],
        },
        {
          label: 'Design',
          items: [
            { label: 'Philosophy', slug: 'design/philosophy' },
            { label: 'Architecture', slug: 'design/architecture' },
            { label: 'Framework Comparison', slug: 'design/framework-comparison' },
            { label: 'Communication', slug: 'design/communication' },
            { label: 'Memory', slug: 'design/memory' },
            { label: 'Message Parts', slug: 'design/message-parts' },
            { label: 'Package Structure', slug: 'design/package-structure' },
            { label: 'Security', slug: 'design/security' },
            { label: 'Task Lifecycle', slug: 'design/task-lifecycle' },
            { label: 'Tool Execution', slug: 'design/tool-execution' },
          ],
        },
        {
          label: 'Tutorials',
          items: [
            { label: 'First Agent', slug: 'tutorials/1-first-agent' },
            { label: 'Multi-Agent', slug: 'tutorials/2-multi-agent' },
            { label: 'Custom Tools', slug: 'tutorials/3-custom-tools' },
            { label: 'Configuration', slug: 'tutorials/4-configuration' },
            { label: 'Complex Systems', slug: 'tutorials/91-comprehensive-systems' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Agents', slug: 'guides/agents' },
            { label: 'Tools', slug: 'guides/tools' },
            { label: 'Spaces', slug: 'guides/spaces' },
            { label: 'Streaming', slug: 'guides/streaming' },
            { label: 'State Management', slug: 'guides/state' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Overview', slug: 'api' },
            { label: 'Types', slug: 'api/types' },
            { label: 'Glossary', slug: 'reference/glossary' },
          ],
        },

      ],

    }),
    svelte(),
  ],
  adapter: node({
    mode: 'standalone',
  }),
  output: 'server',
  server: {
    port: 6006,
    host: true,
  },
  vite: {
    ssr: {
      noExternal: ['viber', 'nanoid'],
    },
    plugins: [
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // 'viber/svelte': path.resolve(__dirname, '../src/svelte/index.ts'),
        // 'viber': path.resolve(__dirname, '../src/index.ts'),
        '$lib': path.resolve(__dirname, './src/lib'),
      },
    },
    build: {
      rollupOptions: {
        external: ['path'],
      },
    },
  },
});
