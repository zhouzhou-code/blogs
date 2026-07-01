// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import cloudflare from '@astrojs/cloudflare';

// 站点地址：现在用免费的 pages.dev 占位，绑定独立域名后改这里即可。
const SITE = 'https://blog.pages.dev';

export default defineConfig({
  site: SITE,

  integrations: [
    // ── 文档区：Starlight 掌管 /docs/**（左侧目录树 + 内置搜索，OpenAMP 同款气质）
    starlight({
      title: 'zz的blogs~',
      defaultLocale: 'root',
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
      },
      // Starlight 的标题点击回到 "/"（博客首页），天然成为「文档→博客」的回跳入口
      sidebar: [
        {
          label: '开始',
          items: [{ label: '介绍', slug: 'docs/intro' }],
        },
        {
          label: '示例',
          items: [{ label: '渲染能力演示', slug: 'docs/showcase' }],
        },
      ],
      // KaTeX 样式 + 文档区自定义样式
      customCss: ['katex/dist/katex.min.css', './src/styles/docs.css'],
      pagination: false,
    }),
    react(),
    mdx(),
    sitemap(),
  ],

  // 全站 Markdown 管线：数学公式（KaTeX）对博客区和文档区同时生效
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },

  adapter: cloudflare(),
});