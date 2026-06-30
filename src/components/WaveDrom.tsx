import { useEffect, useState } from 'react';
import * as wavedrom from 'wavedrom';

let counter = 0;

/**
 * WaveDrom 总线时序 / 寄存器位域图（嵌入式杀手锏）。
 * 用法（MDX）：
 *   <WaveDrom client:only="react" source={{ signal: [
 *     { name: 'clk', wave: 'p......' },
 *     { name: 'dat', wave: 'x.345x', data: ['a','b','c'] },
 *   ]}} />
 */
export default function WaveDrom({ source }: { source: unknown }) {
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    try {
      const w = wavedrom as any;
      const onml = w.onml;
      const idx = counter++;
      const rendered = w.renderAny(idx, source, w.waveSkin);
      setSvg(onml.stringify(rendered));
    } catch (e) {
      setErr(String(e));
    }
  }, [source]);

  if (err) return <pre style={{ color: 'crimson' }}>WaveDrom 渲染失败：{err}</pre>;
  return (
    <div
      style={{ textAlign: 'center', margin: '1.5rem 0', overflowX: 'auto' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
