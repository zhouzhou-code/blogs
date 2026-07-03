// remark 插件：把 ```mermaid / ```wavedrom / ```reg 代码块
// 换成占位 <div class="fence-render">，源码 base64 塞进 data-src，
// 由客户端 FenceRenderer 渲染成活图。
//
// 在语法高亮(Shiki)之前运行，所以这些代码块不会被当普通代码高亮。
// 好处：飞书里写一个带语言标签的代码块，同步过来就是活图，无需改同步脚本。

const TYPES = new Set(['mermaid', 'wavedrom', 'reg']);

export default function remarkDiagramFences() {
  return (tree) => {
    const walk = (node) => {
      if (!node || !Array.isArray(node.children)) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'code' && child.lang && TYPES.has(child.lang)) {
          const b64 = Buffer.from(child.value ?? '', 'utf8').toString('base64');
          node.children[i] = {
            type: 'html',
            value: `<div class="fence-render" data-render="${child.lang}" data-src="${b64}"></div>`,
          };
        } else {
          walk(child);
        }
      }
    };
    walk(tree);
  };
}
