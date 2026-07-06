
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

  // 端点的「离开方向」（垂直于所贴的边）
  const SNAP = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
  const dirOf = (ep, self, other) => {
    const s = ep?.attached_object?.snap_to;
    if (s && SNAP[s]) return SNAP[s];
    // 无贴边信息：按到对端的主轴方向推断
    const dx = other.x - self.x, dy = other.y - self.y;
    return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
  };
  // 把一串点正交化（相邻两点不共轴时按当前方向插一个直角拐点）
  const orthoThrough = (arr, startDir) => {
    const out = [arr[0]];
    let dir = startDir;
    for (let i = 1; i < arr.length; i++) {
      const a = out[out.length - 1], b = arr[i];
      if (Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5) {
        out.push(b);
      } else {
        out.push(dir[0] !== 0 ? { x: b.x, y: a.y } : { x: a.x, y: b.y }, b);
      }
      const p = out[out.length - 2], q = out[out.length - 1];
      dir = Math.abs(q.x - p.x) > Math.abs(q.y - p.y) ? [Math.sign(q.x - p.x) || 1, 0] : [0, Math.sign(q.y - p.y) || 1];
    }
    return out;
  };
  // 忠实还原飞书连线：按 shape + 拐点（相对起点）+ 直/曲线
  const connectorGeom = (cn, s, e, ds, de) => {
    const f = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    if (cn.shape === 'curve') {
      const dist = Math.max(40, Math.hypot(e.x - s.x, e.y - s.y) * 0.4);
      const c1 = { x: s.x + ds[0] * dist, y: s.y + ds[1] * dist };
      const c2 = { x: e.x + de[0] * dist, y: e.y + de[1] * dist };
      return { d: `M${f(s)} C${f(c1)} ${f(c2)} ${f(e)}`, pts: [s, c1, c2, e] };
    }
    if (cn.shape === 'straight' || !cn.turning_points?.length) {
      return { d: `M${f(s)} L${f(e)}`, pts: [s, e] };
    }
    const tps = cn.turning_points.map((p) => ({ x: s.x + p.x, y: s.y + p.y }));
    const poly = orthoThrough([s, ...tps, e], ds);
    return { d: poly.map((p, i) => `${i ? 'L' : 'M'}${f(p)}`).join(' '), pts: poly };
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
      const cn = n.connector;
      const s = endpoint(cn.start), e = endpoint(cn.end);
      if (s && e) {
        const ds = dirOf(cn.start, s, e);
        const de = dirOf(cn.end, e, s);
        const geom = connectorGeom(cn, s, e, ds, de);
        conns.push({ n, d: geom.d, pts: geom.pts });
        geom.pts.forEach((p) => pts.push([p.x, p.y]));
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
  // 连线 + 箭头 + 标注（忠实还原飞书的走线、虚实线、箭头）
  for (const c of conns) {
    const s = c.n.style || {};
    const col = s.border_color || '#555';
    const sw = BW[s.border_width] || 1.4;
    const d = dash(s.border_style);
    const endArrow = /arrow/.test(c.n.connector.end?.arrow_style || '');
    const startArrow = /arrow/.test(c.n.connector.start?.arrow_style || '');
    body += `<path d="${c.d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round"${d ? ` stroke-dasharray="${d}"` : ''}${startArrow ? ' marker-start="url(#a)"' : ''}${endArrow ? ' marker-end="url(#a)"' : ''}/>\n`;
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

