import {describe,it,expect} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadColumns,parseColumn} from '../content/load-columns';
import ColumnMarkdown from '../apps/web/ui/ColumnMarkdown';

describe('Markdown is the article source',()=>{
 it('loads all supplied files without substituting the old JSON articles',async()=>{
  const sourceFiles=(await readdir('content/columns')).filter(name=>name.endsWith('.md'));
  const columns=await loadColumns();expect(columns).toHaveLength(sourceFiles.length);
  expect(new Set(columns.map(c=>c.sourceFile))).toEqual(new Set(sourceFiles.map(name=>`content/columns/${name}`)));
  for(const c of columns){
   const original=await readFile(c.sourceFile,'utf8');
   expect(c.body).toBe(original.slice(original.indexOf('\n')).trim());
   expect(c.rerankText).toContain(c.title);
   expect(c.rerankText).not.toMatch(/^#{1,6} /m);
   expect(c.sourceFile).toMatch(/^content\/columns\/\d\.md$/);
  }
 });
 it('extracts semantic text and changes content version while retaining stable ID',()=>{
  const markdown='# **제목**\n\n## 소제목\n\n- 첫 항목\n- [둘째 항목](https://example.test)\n\n> 인용\n\n<script>alert(1)</script>';
  const a=parseColumn(markdown,'example.md'),b=parseColumn(markdown+'\n추가 내용','example.md');
  expect(a.title).toBe('제목');expect(a.rerankText).toContain('소제목');expect(a.rerankText).toContain('첫 항목\n둘째 항목');expect(a.rerankText).not.toContain('https://');expect(a.rerankText).not.toContain('<script>');expect(a.rerankText).not.toContain('alert(1)');
  expect(a.id).toBe(b.id);expect(a.version).not.toBe(b.version);
  expect(()=>parseColumn('제목이 없는 본문','invalid.md')).toThrow('COLUMN_TITLE_REQUIRED');
 });
 it('renders headings, lists and emphasis while disabling raw HTML and unsafe links',()=>{
  const html=renderToStaticMarkup(createElement(ColumnMarkdown,{body:'## 소제목\n\n**강조**\n\n- 항목\n\n<script>alert(1)</script>\n\n[링크](javascript:alert(1))'}));
  expect(html).toContain('<h2>소제목</h2>');expect(html).toContain('<strong>강조</strong>');expect(html).toContain('<li>항목</li>');expect(html).not.toContain('<script>');expect(html).not.toContain('javascript:');
 });
 it('preserves Korean age ranges instead of treating a single tilde as strikethrough',()=>{
  const source='# 제목\n\n25~48개월부터 유치원~초등학교까지';
  const c=parseColumn(source,'ranges.md');
  expect(c.rerankText).toContain('25~48개월');
  const html=renderToStaticMarkup(createElement(ColumnMarkdown,{body:c.body}));
  expect(html).toContain('25~48개월');expect(html).not.toContain('<del>');
 });
});
