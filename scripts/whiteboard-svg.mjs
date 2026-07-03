
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BW = { extra_narrow: 1, narrow: 1.4, medium: 2, wide: 3, bold: 3 };
const dash = (st) => (st === 'dash' ? '7 5' : st === 'dot' ? '2 4' : null);

function textToLines(t) {
  if (!t) return [];
  if (t.rich_text?.paragraphs?.length) {
    return t.rich_text.paragraphs
      .map((p) => {
        const runs = (p.elements || [])
          .map((el) => {
            const te = el.text_element || {};
            const ts = te.text_style || {};
            return {
              text: te.text || '',
              size: ts.font_size || t.font_size || 14,
              color: ts.text_color || t.text_color || '#333',
              bold: (ts.font_weight || t.font_weight) === 'bold',
            };
          })
          .filter((r) => r.text !== '');
        return runs.length ? runs : null;
      })
      .filter(Boolean);
  }
  const raw = t.text || '';
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => [
      { text: line, size: t.font_size || 14, color: t.text_color || '#333', bold: t.font_weight === 'bold' },
    ]);
}

function renderText(box, t, valignCenter) {
  const lines = textToLines(t);
  if (!lines.length) return '';
  const align = t.horizontal_align || 'left';
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
  const tx = align === 'center' ? box.x + box.w / 2 : align === 'right' ? box.x + box.w : box.x;
  const lh = lines.map((runs) => Math.max(...runs.map((r) => r.size)) * 1.4);
  const total = lh.reduce((a, b) => a + b, 0);
  let cy = valignCenter ? box.y + (box.h - total) / 2 : box.y + 2;
  let out = '';
  lines.forEach((runs, i) => {
    const baseline = cy + lh[i] * 0.74;
    const tspans = runs
      .map(
        (r) =>
          `<tspan fill="${r.color}" font-size="${r.size}" font-weight="${r.bold ? 700 : 400}">${esc(r.text)}</tspan>`
      )
      .join('');
    out += `<text x="${tx.toFixed(1)}" y="${baseline.toFixed(1)}" text-anchor="${anchor}">${tspans}</text>\n`;
    cy += lh[i];
  });
  return out;
}

export function whiteboardToSVG(nodes) {
  const boxById = {};
  for (const n of nodes)
    if (typeof n.x === 'number' && typeof n.width === 'number')
      boxById[n.id] = { x: n.x, y: n.y, w: n.width, h: n.height };

  const endpoint = (ep) => {
    if (!ep) return null;
    if (ep.attached_object && boxById[ep.attached_object.id]) {
      const b = boxById[ep.attached_object.id];
      const p = ep.attached_object.position || { x: 0.5, y: 0.5 };
      return { x: b.x + p.x * b.w, y: b.y + p.y * b.h };
    }
    if (ep.position) return { x: ep.position.x, y: ep.position.y };
    return null;
  };

  const rects = [], texts = [], conns = [], pts = [];
  for (const n of nodes) {
    if (n.composite_shape?.type === 'rect') {
      rects.push(n);
      pts.push([n.x, n.y], [n.x + n.width, n.y + n.height]);
    } else if (n.type === 'text_shape') {
      texts.push(n);
      pts.push([n.x, n.y], [n.x + n.width, n.y + (n.height || 20)]);
    } else if (n.connector) {
      const s = endpoint(n.connector.start), e = endpoint(n.connector.end);
      if (s && e) {
        // 拐点坐标是相对「起点」的偏移，转成绝对坐标
        const mids = (n.connector.turning_points || []).map((p) => ({ x: s.x + p.x, y: s.y + p.y }));
        conns.push({ n, pts: [s, ...mids, e] });
        [s, e, ...mids].forEach((p) => pts.push([p.x, p.y]));
      }
    }
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const pad = 28;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const W = Math.max(...xs) + pad - minX, H = Math.max(...ys) + pad - minY;

  let body = '';
  // 矩形
  for (const n of rects) {
    const s = n.style || {};
    const fill = s.fill_color && s.fill_color_type !== 0 ? s.fill_color : 'none';
    const stroke = s.border_style !== 'none' ? s.border_color || '#888' : 'none';
    const sw = BW[s.border_width] || 1.4;
    const d = dash(s.border_style);
    body += `<rect x="${n.x.toFixed(1)}" y="${n.y.toFixed(1)}" width="${n.width.toFixed(1)}" height="${n.height.toFixed(1)}" rx="4" fill="${fill}" fill-opacity="${(s.fill_opacity ?? 100) / 100}" stroke="${stroke}" stroke-width="${sw}"${d ? ` stroke-dasharray="${d}"` : ''}/>\n`;
    body += renderText({ x: n.x, y: n.y, w: n.width, h: n.height }, n.text, true);
  }
  // 连线 + 箭头 + 标注
  for (const c of conns) {
    const s = c.n.style || {};
    const col = s.border_color || '#555';
    const sw = BW[s.border_width] || 1.4;
    const pth = c.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const endArrow = /arrow/.test(c.n.connector.end?.arrow_style || '');
    const startArrow = /arrow/.test(c.n.connector.start?.arrow_style || '');
    body += `<path d="${pth}" fill="none" stroke="${col}" stroke-width="${sw}"${startArrow ? ' marker-start="url(#a)"' : ''}${endArrow ? ' marker-end="url(#a)"' : ''}/>\n`;
    const cap = c.n.connector.captions?.data?.[0];
    if (cap?.text) {
      const m = c.pts[Math.floor(c.pts.length / 2)];
      const a = c.pts[0], b = c.pts[c.pts.length - 1];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      body += `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="middle" font-size="${cap.font_size || 13}" fill="${cap.text_color || '#333'}" paint-order="stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round">${esc(cap.text)}</text>\n`;
    }
  }
  // 独立文字
  for (const n of texts) {
    const vc = (n.text?.vertical_align || 'top') !== 'top';
    body += renderText({ x: n.x, y: n.y, w: n.width, h: n.height || 20 }, n.text, vc);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}" font-family="-apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif">
<defs><marker id="a" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 z" fill="context-stroke"/></marker></defs>
<rect x="${minX.toFixed(1)}" y="${minY.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="#ffffff"/>
${body}</svg>`;
}

