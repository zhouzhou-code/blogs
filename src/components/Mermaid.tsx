import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });

/**
 * Mermaid 流程图 / 状态机 / 时序图。
 * 用法（MDX）：
 *   <Mermaid client:only="react" code={`stateDiagram-v2
 *     [*] --> Idle
 *     Idle --> Running: start()`} />
 */
export default function Mermaid({ code }: { code: string }) {
  const id = 'mmd-' + useId().replace(/:/g, '');
  const [svg, setSvg] = useState<string>('');
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    mermaid
      .render(id, code.trim())
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (err) return <pre style={{ color: 'crimson' }}>Mermaid 渲染失败：{err}</pre>;
  return (
    <div
      style={{ textAlign: 'center', margin: '1.5rem 0' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
