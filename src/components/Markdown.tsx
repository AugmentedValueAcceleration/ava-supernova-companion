'use client';

/**
 * Lightweight markdown renderer for chat messages.
 * Handles: bold, italic, inline code, code blocks, links, lists, paragraphs.
 * No external dependencies — keeps the bundle small for mobile.
 */

interface Props {
  content: string;
  className?: string;
}

export function Markdown({ content, className = '' }: Props) {
  const html = markdownToHtml(content);
  return (
    <div
      className={`message-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let i = 0;
  let inList: 'ul' | 'ol' | null = null;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // skip closing ```
      if (inList) { result.push(`</${inList}>`); inList = null; }
      result.push(`<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // Empty line — close list if open
    if (!line.trim()) {
      if (inList) { result.push(`</${inList}>`); inList = null; }
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      if (inList) { result.push(`</${inList}>`); inList = null; }
      const level = headingMatch[1].length;
      result.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      if (inList !== 'ul') {
        if (inList) result.push(`</${inList}>`);
        result.push('<ul>');
        inList = 'ul';
      }
      result.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</li>`);
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (inList !== 'ol') {
        if (inList) result.push(`</${inList}>`);
        result.push('<ol>');
        inList = 'ol';
      }
      result.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      i++;
      continue;
    }

    // Regular paragraph
    if (inList) { result.push(`</${inList}>`); inList = null; }
    result.push(`<p>${inlineFormat(line)}</p>`);
    i++;
  }

  if (inList) result.push(`</${inList}>`);
  return result.join('');
}

function inlineFormat(text: string): string {
  let out = escapeHtml(text);
  // Inline code (must be before bold/italic to avoid conflicts)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Links
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return out;
}
