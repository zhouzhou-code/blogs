# 嵌入式笔记

个人技术博客 + 文档知识库，一个 Astro 项目、两种形态、视觉分开：

- **博客区** `/`、`/blog`、`/tags` —— 时间流 + 标签，自定义布局。
- **文档区** `/docs` —— Starlight 驱动，左侧目录树 + 内置搜索。

---

## 目录结构 ↔ 网页的对应关系

> 记住一条核心规则：**`src/content/` 放"写的内容"，`src/pages/` 放"页面骨架/路由"，`src/components/` 放交互组件。**

| 文件 / 目录 | 对应的网址 | 说明 |
| --- | --- | --- |
| `src/content/blog/xxx.md` | `/blog/xxx` | **无图的文章**：单个文件即可。文件名就是网址结尾。支持 `.md` / `.mdx` |
| `src/content/blog/xxx/index.md` | `/blog/xxx` | **有图的文章**：建一个文件夹，`index.md` 是正文，图片放同目录（见下方「图片怎么管理」） |
| `src/content/docs/docs/yyy.md` | `/docs/yyy` | **每写一篇文档 = 这里加一个文件**。写完还要去 `astro.config.mjs` 的 `sidebar` 登记，左侧目录才出现 |
| `src/pages/index.astro` | `/` | 博客首页（自动列出所有文章，按日期倒序） |
| `src/pages/blog/[...slug].astro` | `/blog/*` | 文章页模板（自动为每篇 blog 生成，一般不用动） |
| `src/pages/tags/index.astro` | `/tags` | 标签总览页 |
| `src/pages/tags/[tag].astro` | `/tags/*` | 单个标签页（自动生成） |
| `src/pages/rss.xml.js` | `/rss.xml` | RSS 订阅源 |
| `astro.config.mjs` | —— | 全站配置：站点地址、文档区左侧目录 `sidebar`、插件 |
| `src/components/*.tsx` | —— | 交互组件（Mermaid / WaveDrom / RcDemo），在 `.mdx` 里 import 使用 |
| `src/layouts/BlogLayout.astro` | —— | 博客区的"外壳"（顶栏、页脚、导航） |
| `src/styles/global.css` | —— | 博客区样式；`docs.css` 是文档区配色 |
| `public/xxx` | `/xxx` | 静态资源（favicon、图片等）原样对外，不处理 |

一句话：**想加一篇博客，只需在 `src/content/blog/` 丢一个 `.md`，网址自动出现在 `/blog/文件名`，首页和标签页自动更新，什么都不用改。**

### 一篇文章的头部（frontmatter）

```markdown
---
title: 文章标题        # 必填
date: 2026-06-30      # 必填（决定排序）
description: 一句话摘要  # 可选，用于 SEO 和列表
tags: [模拟电路, DSP]   # 可选，扁平标签
draft: false          # 可选，true = 只在本地可见、不发布
---

正文用 Markdown 写……
```

### 图片怎么管理

**不要**把文章图片丢进全局 `public/`。用「一篇文章一个文件夹」，图片和正文放一起：

```
src/content/blog/
├── hello.md              ← 无图，单文件
└── led-blink/            ← 有图 = 一个文件夹（网址仍是 /blog/led-blink）
    ├── index.md          ← 正文
    ├── wiring.png        ← 图片就在旁边
    └── scope.png
```

正文里用**相对路径**引用：

```markdown
![接线示意](./wiring.png)
```

Astro 会自动优化这些图片（压缩、转 WebP、加 hash 文件名、懒加载、防布局抖动）。好处：图片跟着文章走，删文章连图一起删，不会散落。

> `public/` 只放**真正全局**的静态文件（favicon、默认分享图等），文章图片一律走上面的方式。VS Code 里截图 `Ctrl+V` 时，把粘贴插件的目标目录设成"当前文件同级"，就能自动落到文章文件夹里。

---

## 用飞书写、一键发布（推荐工作流）

在**飞书文档**里写文章（所见即所得、表格图片随便插），同步管线把它拉下来转成博客文章并发布。**博客 = 飞书文档的 1:1 镜像**：想让博客长什么样，就在飞书里排成什么样。

**三步：**

1. 在飞书里写好文章。
2. 把它登记到 `scripts/feishu-posts.json`（飞书 URL + slug + 标签 + 日期）：
   ```json
   [
     { "url": "https://xxx.feishu.cn/wiki/xxxx", "slug": "my-post",
       "date": "2026-07-03", "tags": ["RISC-V", "杂记"], "draft": false }
   ]
   ```
3. 一条命令同步并发布：
   ```bash
   npm run publish:feishu            # 同步全部 + 自动 commit + push（触发部署）
   npm run publish:feishu -- my-post # 只发某一篇
   npm run sync:feishu               # 只同步、不提交（想先本地看看）
   ```

**管线自动做的事**：拉正文、把飞书**内嵌表格（sheet）转成 Markdown 表格**、下载图片改相对路径、归一标题层级、生成 frontmatter。

**规则与注意**：

- 归飞书管的文章**别在本地手改**，重跑会覆盖。
- 已有手调 `.mdx` 的文章，脚本**默认跳过保护**，不会误伤；确要让飞书接管，先删掉那个 `.mdx` 再加 `--force`。
- 首次同步别人的飞书文档若报权限，按提示 `lark-cli auth login --scope "..."` 授权即可。

---

## 常用命令

在本项目目录（`~/blog`）下执行：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动本地预览，改文件自动刷新 → http://localhost:4321 |
| `npm run build` | 构建静态站到 `dist/`（部署前跑一次确认没报错） |
| `npm run preview` | 预览 `build` 出来的成品 |
| `npm install` | 安装 / 补齐依赖（换机器或删了 node_modules 后用） |

Git（发布流程）：

| 命令 | 作用 |
| --- | --- |
| `git add -A && git commit -m "写了新文章"` | 保存一次改动 |
| `git push` | 推到 GitHub（配好远程后，会触发 Cloudflare 自动部署） |
| `git status` | 看当前改了哪些文件 |

环境（本机为 WSL2，已配好，一般不用管）：

| 命令 | 作用 |
| --- | --- |
| `node -v` | 应显示 v22.x；若不是，执行 `nvm use 22` |
| `proxon` / `proxoff` | 手动开 / 关命令行代理（走 Windows 上的 Clash） |

---

## 写作与插图

- 用 **VS Code** 编辑 `.md` / `.mdx`；截图后 `Ctrl+V` 直接粘贴（建议装 “Paste Image” 类插件），图片自动入库并插好链接。
- 需要交互演示时，写 `.mdx` 文件，在顶部 `import` 组件，例如：
  ```mdx
  import WaveDrom from '../../components/WaveDrom';

  <WaveDrom client:only="react" source={{ signal: [
    { name: 'clk', wave: 'p....' },
  ]}} />
  ```

---

## 部署（Cloudflare Pages）

1. 在 GitHub 新建一个空仓库，把本项目推上去。
2. Cloudflare Pages → 连接该仓库 → 构建命令 `npm run build`，输出目录 `dist`。
3. 之后 `git push` 即自动部署上线。
4. 绑定独立域名时，记得把 `astro.config.mjs` 里的 `site` 改成新域名。

---

## 换电脑 / 在新机器上继续

这个项目**不依赖任何一台特定电脑**——源码全在 GitHub。换机器只需重建"运行环境"。

### 通用 3 步（任何有网的电脑）

```bash
# 1. 装 Node ≥ 22（推荐 nvm；或去 nodejs.org 直接装）
#    nvm 装法：
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm install 22

# 2. 克隆仓库
git clone git@github.com:zhouzhou-code/blogs.git
cd blogs

# 3. 装依赖，跑起来
npm install
npm run dev        # → http://localhost:4321
```

就这样，博客就在新机器上跑起来了。

### 关于 GitHub 授权（clone / push 要用）

新机器要能拉取/推送，二选一：

- **SSH（推荐）**：在新机器上生成密钥 `ssh-keygen -t ed25519`，把 `~/.ssh/id_ed25519.pub` 加到 https://github.com/settings/keys 。
- **HTTPS**：clone 用 `https://github.com/zhouzhou-code/blogs.git`，push 时输入 GitHub 用户名 + Personal Access Token（在 https://github.com/settings/tokens 生成）。

### 只有当新机器也是「WSL + Windows 代理」时才需要

普通电脑（Mac / 原生 Linux / 直连网络的 Windows）**跳过这段**。若新机器同样是 WSL2 且靠 Windows 上的 Clash 上网，命令行默认连不上外网，需要：

1. 把本机 `~/.bashrc` 末尾的 `# >>> wsl-clash-proxy >>>` 那段拷过去（自动读网关设代理，带 `proxon`/`proxoff` 开关）。
2. 把 `~/.ssh/wsl-proxy-connect.sh` 和 `~/.ssh/config` 里的 `Host github.com` 块拷过去（让 SSH 走代理）。
3. Clash 需开启「Allow LAN」。

> 一句话：博客代码是干净、可移植的；代理那套只是**某台 WSL 机器的上网补丁**，跟着机器走、不跟着项目走。
