---
title: 博客搭起来了
date: 2026-06-30
description: 第一篇文章 —— 这个站怎么搭的、博客和文档为什么分开。
tags: [杂记, Astro]
---

第一篇，先记录一下这个站的构成。

## 技术栈

- **Astro**：站点框架，默认输出零 JS，性能和 SEO 好。
- **Starlight**：负责 `/docs` 文档区，左侧目录树。
- **React islands**：需要交互的地方按需加载。
- **Cloudflare Pages**：`git push` 自动部署。

## 博客 vs 文档

博客是时间流，记录单篇思考；[文档区](/docs/intro)是知识库，成体系地沉淀。两者视觉上分开，但搜索、渲染能力共享。

行内公式测试：$E = mc^2$。
