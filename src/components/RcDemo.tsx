import { useMemo, useState } from 'react';

/**
 * 可交互演示：RC 低通滤波器。
 * 拖动 R / C，实时看截止频率与幅频响应曲线变化。
 * 用法（MDX）： <RcDemo client:visible />
 */
export default function RcDemo() {
  const [r, setR] = useState(10_000); // Ω
  const [c, setC] = useState(100); // nF

  const fc = useMemo(() => 1 / (2 * Math.PI * r * (c * 1e-9)), [r, c]);

  // 生成幅频响应曲线点（对数频率 10Hz..1MHz）
  const path = useMemo(() => {
    const pts: string[] = [];
    const W = 460,
      H = 140;
    for (let i = 0; i <= 100; i++) {
      const f = 10 * Math.pow(10, (i / 100) * 5); // 10^1 .. 10^6
      const mag = 1 / Math.sqrt(1 + Math.pow(f / fc, 2));
      const db = 20 * Math.log10(mag); // 0 .. -100
      const x = (i / 100) * W;
      const y = (-db / 60) * H; // 0dB 顶部, -60dB 底部
      pts.push(`${x.toFixed(1)},${Math.min(H, Math.max(0, y)).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }, [fc]);

  const labelStyle = { display: 'block', margin: '0.6rem 0 0.2rem', fontSize: '0.9rem' };

  return (
    <div
      style={{
        border: '1px solid var(--border, #ccc)',
        borderRadius: 10,
        padding: '1.1rem 1.2rem',
        margin: '1.5rem 0',
        background: 'var(--card, #fff)',
      }}
    >
      <strong>RC 低通滤波器 · 交互演示</strong>

      <label style={labelStyle}>
        R = {r.toLocaleString()} Ω
      </label>
      <input
        type="range"
        min={100}
        max={100_000}
        step={100}
        value={r}
        onChange={(e) => setR(Number(e.target.value))}
        style={{ width: '100%' }}
      />

      <label style={labelStyle}>C = {c} nF</label>
      <input
        type="range"
        min={1}
        max={1000}
        step={1}
        value={c}
        onChange={(e) => setC(Number(e.target.value))}
        style={{ width: '100%' }}
      />

      <p style={{ margin: '0.8rem 0' }}>
        截止频率 <code>fc</code> ≈ <strong>{fc.toFixed(1)} Hz</strong>
      </p>

      <svg viewBox="0 0 460 140" style={{ width: '100%', height: 'auto' }}>
        <line x1="0" y1="0" x2="460" y2="0" stroke="#8884" />
        <line x1="0" y1="70" x2="460" y2="70" stroke="#8884" strokeDasharray="4" />
        <path d={path} fill="none" stroke="var(--accent, #b4541e)" strokeWidth="2" />
      </svg>
      <div style={{ fontSize: '0.78rem', color: 'var(--muted, #888)' }}>
        幅频响应（10 Hz → 1 MHz，对数横轴；虚线为 −60 dB 一半处）
      </div>
    </div>
  );
}
