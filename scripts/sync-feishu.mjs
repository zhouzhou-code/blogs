#!/usr/bin/env node
// 飞书文档 → 博客文章 同步管线
//
// 用法：
//   node scripts/sync-feishu.mjs                 # 按 scripts/feishu-posts.json 同步全部
//   node scripts/sync-feishu.mjs <slug>          # 只同步某一篇
//   node scripts/sync-feishu.mjs --preview <dir> # 预览：写到指定目录，不动 src/
//
// 每篇做的事：拉正文 → 展开内嵌表格(<sheet>) → 下载图片改相对路径 →
// 归一标题层级 → 生成 frontmatter → 写 <slug>/index.md
//
// 依赖 lark-cli（已登录 user 身份）。

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get as httpsGet } from 'node:https';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'scripts', 'feishu-posts.json');

// ── CLI 参数 ─────────────────────────────────────────────
const argv = process.argv.slice(2);
let previewDir = null;
const pIdx = argv.indexOf('--preview');
if (pIdx !== -1) {
  previewDir = argv[pIdx + 1];
  argv.splice(pIdx, 2);
}
const force = argv.includes('--force');
const fIdx = argv.indexOf('--force');
if (fIdx !== -1) argv.splice(fIdx, 1);
const publish = argv.includes('--publish');
const pubIdx = argv.indexOf('--publish');
if (pubIdx !== -1) argv.splice(pubIdx, 1);
const onlySlug = argv[0] || null;

// ── 小工具 ──────────────────────────────────────────────
function lark(args) {
  // lark-cli 把 JSON 打到 stdout，警告打到 stderr
  const out = execFileSync('lark-cli', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    httpsGet(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        writeFileSync(dest, Buffer.concat(chunks));
        resolve();
      });
    }).on('error', reject);
  });
}

function extFromCT(ct = '') {
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('svg')) return 'svg';
  return 'png';
}

// 把飞书电子表格读成 Markdown 表格
function sheetToMarkdown(token, sheetId) {
  const res = lark([
    'sheets', '+read',
    '--spreadsheet-token', token,
    '--sheet-id', sheetId,
    '--value-render-option', 'ToString',
  ]);
  const values = res?.data?.valueRange?.values;
  if (!values || !values.length) return '';
  const cell = (v) =>
    String(v ?? '')
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, '<br/>')
      .trim();
  const [head, ...body] = values;
  const line = (row) => `| ${row.map(cell).join(' | ')} |`;
  const sep = `| ${head.map(() => '---').join(' | ')} |`;
  return [line(head), sep, ...body.map(line)].join('\n');
}

// 归一标题层级：让正文里最浅的标题变成 ##
function normalizeHeadings(md) {
  const depths = [...md.matchAll(/^(#{1,6})\s+/gm)].map((m) => m[1].length);
  if (!depths.length) return md;
  const min = Math.min(...depths);
  const shift = 2 - min; // 最浅标题 → 2 级
  if (shift === 0) return md;
  return md.replace(/^(#{1,6})(\s+)/gm, (_, h, sp) => {
    let d = h.length + shift;
    d = Math.max(1, Math.min(6, d));
    return '#'.repeat(d) + sp;
  });
}

// ── 同步一篇 ────────────────────────────────────────────
async function syncOne(post) {
  const { url, slug } = post;
  console.log(`\n▶ ${slug}  ←  ${url}`);

  const res = lark(['docs', '+fetch', '--api-version', 'v2', '--doc', url, '--doc-format', 'markdown']);
  let md = res?.data?.document?.content;
  if (!md) throw new Error('拿不到文档内容');

  // 标题：首个 # 行 → frontmatter，从正文移除
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const title = post.title || (titleMatch ? titleMatch[1].trim() : slug);
  if (titleMatch) md = md.replace(titleMatch[0], '').replace(/^\s+/, '');

  // 展开内嵌表格 <sheet sheet-id=".." token="..">
  const sheetRe = /<sheet[^>]*\bsheet-id="([^"]+)"[^>]*\btoken="([^"]+)"[^>]*>\s*<\/sheet>|<sheet[^>]*\btoken="([^"]+)"[^>]*\bsheet-id="([^"]+)"[^>]*>\s*<\/sheet>/g;
  md = md.replace(sheetRe, (_, s1, t1, t2, s2) => {
    const token = t1 || t2;
    const sheetId = s1 || s2;
    try {
      const table = sheetToMarkdown(token, sheetId);
      console.log(`  · 展开表格 ${sheetId}`);
      return table ? `\n${table}\n` : '';
    } catch (e) {
      console.warn(`  ! 表格 ${sheetId} 读取失败：${e.message}`);
      return `\n> ⚠️ 内嵌表格 ${sheetId} 未能同步\n`;
    }
  });

  // 目标目录
  const outBase = previewDir ? previewDir : join(ROOT, 'src', 'content', 'blog');
  const dir = join(outBase, slug);
  // 保护：已有手调的 index.mdx 时默认不覆盖（除非 --force）
  if (!previewDir && existsSync(join(dir, 'index.mdx')) && !force) {
    console.warn(`  ⚠ 跳过：${slug}/ 下已有手调的 index.mdx。要让飞书接管请先删除它、或加 --force`);
    return;
  }
  mkdirSync(dir, { recursive: true });

  // 图片：<img ... url=".."/> 和 ![](http..) → 下载到本地、改相对路径
  let imgN = 0;
  const jobs = [];
  const rewriteImg = (rawUrl) => {
    imgN += 1;
    const name = `img-${String(imgN).padStart(2, '0')}`;
    const rel = `./${name}`;
    jobs.push(
      (async () => {
        // 先探测扩展名
        let ext = 'png';
        try {
          ext = await new Promise((resolve, reject) => {
            httpsGet(rawUrl, (r) => {
              resolve(extFromCT(r.headers['content-type']));
              r.destroy();
            }).on('error', reject);
          });
        } catch {}
        const file = `${name}.${ext}`;
        await download(rawUrl, join(dir, file));
        console.log(`  · 下载图片 ${file}`);
        // 回填真实扩展名
        replacements.push([rel, `./${file}`]);
      })()
    );
    return rel;
  };
  const replacements = [];
  md = md.replace(/<img[^>]*\burl="([^"]+)"[^>]*\/?>/g, (_, u) => `![](${rewriteImg(u)})`);
  md = md.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, (_, alt, u) => `![${alt}](${rewriteImg(u)})`);
  await Promise.all(jobs);
  for (const [from, to] of replacements) md = md.split(from + ')').join(to + ')');

  md = normalizeHeadings(md).trim();

  // frontmatter
  const esc = (s) => String(s).replace(/"/g, '\\"');
  const fm = ['---'];
  fm.push(`title: "${esc(title)}"`);
  fm.push(`date: ${post.date || new Date().toISOString().slice(0, 10)}`);
  if (post.description) fm.push(`description: "${esc(post.description)}"`);
  if (post.tags?.length) fm.push(`tags: [${post.tags.join(', ')}]`);
  if (post.draft) fm.push(`draft: true`);
  fm.push(`# 来源：${url}（由 scripts/sync-feishu.mjs 从飞书同步，勿手改，改飞书原文后重跑）`);
  fm.push('---', '');

  writeFileSync(join(dir, 'index.md'), fm.join('\n') + '\n' + md + '\n');
  console.log(`  ✓ 写入 ${join(dir, 'index.md').replace(ROOT + '/', '')}`);
}

// ── 主流程 ──────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const posts = onlySlug ? manifest.filter((p) => p.slug === onlySlug) : manifest;
if (!posts.length) {
  console.error(onlySlug ? `manifest 里没有 slug=${onlySlug}` : 'manifest 为空');
  process.exit(1);
}
let ok = 0;
for (const p of posts) {
  try {
    await syncOne(p);
    ok += 1;
  } catch (e) {
    console.error(`  ✗ ${p.slug} 失败：${e.message}`);
  }
}
console.log('\n同步完成。');

// --publish：同步后自动提交并推送
if (publish && !previewDir) {
  const git = (args) => execFileSync('git', args, { cwd: ROOT, stdio: 'inherit' });
  try {
    git(['add', 'src/content/blog', 'public/uploads']);
    const changed =
      execFileSync('git', ['status', '--porcelain', 'src/content/blog', 'public/uploads'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim();
    if (!changed) {
      console.log('无内容变化，跳过提交。');
    } else {
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      git(['commit', '-m', `content: 从飞书同步 (${stamp})`]);
      git(['push', 'origin', 'main']);
      console.log('\n已提交并推送，Cloudflare 将自动部署。');
    }
  } catch (e) {
    console.error(`\n发布步骤失败：${e.message}`);
    process.exit(1);
  }
}
