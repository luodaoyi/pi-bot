import React, { useMemo } from 'react';
import { marked, Renderer } from 'marked';
import hljs from 'highlight.js/lib/common';

const renderer = new Renderer();
const highlightCode = (code: string, infostring?: string) => {
  const lang = (infostring || '').split(/\s+/)[0];
  const language = lang && hljs.getLanguage(lang) ? lang : undefined;
  const html = language
    ? hljs.highlight(code, { language }).value
    : hljs.highlightAuto(code).value;
  const cls = language ? `hljs language-${language}` : 'hljs';
  return `<pre><code class="${cls}">${html}</code></pre>`;
};
// marked 12 的 renderer.code 在类型上仍是 (code, lang, escaped)
renderer.code = ((code: string, infostring?: string) => highlightCode(code, infostring)) as typeof renderer.code;

marked.setOptions({
  gfm: true,
  breaks: true,
  renderer,
});

export const MarkdownView: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const html = useMemo(() => marked.parse(text || '') as string, [text]);
  return (
    <div
      className={`markdown-body ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
