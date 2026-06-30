# 嵌入式笔记

个人技术博客 + 文档知识库，一个 Astro 项目里两种形态、视觉分开：

- **博客区** `/`、`/blog`、`/tags` —— 时间流 + 标签，自定义布局。
- **文档区** `/docs` —— Starlight 驱动，左侧目录树 + 内置搜索。

## 技术栈

Astro · Starlight（文档区）· React islands（交互）· MDX · Cloudflare Pages。

渲染能力：代码高亮、KaTeX 数学公式、Mermaid 流程/状态机、WaveDrom 总线时序/寄存器位域、可交互 React 演示。

## 本地开发

```bash
npm install      # 安装依赖
npm run dev      # 本地预览 http://localhost:4321
npm run build    # 构建到 dist/
npm run preview  # 预览构建产物
```

> 本机需要 Node ≥ 22（已通过 nvm 安装）。新开终端若 `node -v` 不是 22，执行 `nvm use 22`。

## 写文章

- **博客**：在 `src/content/blog/` 新建 `.md` 或 `.mdx`，frontmatter 需要 `title` / `date`，可选 `description` / `tags` / `draft`。
- **文档**：在 `src/content/docs/docs/` 新建文件，再到 `astro.config.mjs` 的 `sidebar` 登记。
- **插图**：VS Code 里截图后 `Ctrl+V`（建议装 “Paste Image” 类插件），图片自动入库。
- **交互组件**：在 `.mdx` 里 `import` `src/components/` 下的组件，例如 `<WaveDrom client:only="react" source={{...}} />`。

## 部署（Cloudflare Pages）

1. 把本仓库推到 GitHub。
2. Cloudflare Pages → 连接该仓库 → 构建命令 `npm run build`，输出目录 `dist`。
3. 自动部署，`git push` 即上线。绑定独立域名时记得改 `astro.config.mjs` 里的 `site`。
