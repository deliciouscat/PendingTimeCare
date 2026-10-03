import {readdir,readFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import {toString} from 'mdast-util-to-string';
import type {Nodes} from 'mdast';
import {columnMetadata,fallbackQuestion} from './column-metadata';

const parser=unified().use(remarkParse).use(remarkGfm,{singleTilde:false});
function semanticText(node:Nodes):string{
 if(node.type==='html'||node.type==='definition')return '';
 if(node.type==='list'||node.type==='listItem'||node.type==='blockquote'||node.type==='table'||node.type==='tableRow')return node.children.map(semanticText).filter(Boolean).join('\n');
 return toString(node,{includeHtml:false});
}
export function parseColumn(source:string,filename:string){
 const tree=parser.parse(source);
 const titleNode=tree.children[0];
 if(!titleNode||titleNode.type!=='heading'||titleNode.depth!==1)throw new Error(`COLUMN_TITLE_REQUIRED: ${filename}`);
 const title=toString(titleNode);
 // Keep original Markdown below the title; the UI already renders the title separately.
 const body=source.slice(titleNode.position!.end.offset!).trim();
 const text=tree.children.map(semanticText).filter(Boolean).join('\n\n').trim();
 if(!body||!text||text.length>20000)throw new Error(`INVALID_COLUMN_BODY: ${filename}`);
 const slug=basename(filename,'.md');
 const metadata=columnMetadata[slug]??{topic:'general',topics:['general'],n:[.5,.5,.5],m:[.5,.5,.5,.5,.5,.5]};
 return {id:`markdown-${slug}`,version:`md-${createHash('sha256').update(source).digest('hex').slice(0,16)}`,sourceFile:`content/columns/${filename}`,title,body,rerankText:text,topic:metadata.topic,topics:metadata.topics,status:'published',review:{scope:'user-provided-poc',reviewer:'local content selection',reviewedAt:'2026-10-03',note:'로컬 PoC에 선택된 칼럼. 임상 전문가 검수 아님.'},mockFeatures:{n:metadata.n,m:metadata.m},fallbackQuestion};
}
export async function loadColumns(directory=resolve(import.meta.dirname,'columns')){
 const filenames=(await readdir(directory,{withFileTypes:true})).filter(e=>e.isFile()&&e.name.endsWith('.md')).map(e=>e.name).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
 if(!filenames.length)throw new Error('NO_MARKDOWN_COLUMNS');
 const columns=await Promise.all(filenames.map(async name=>parseColumn(await readFile(resolve(directory,name),'utf8'),name)));
 if(new Set(columns.map(c=>c.id)).size!==columns.length)throw new Error('DUPLICATE_COLUMN_ID');
 return columns;
}
