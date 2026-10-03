'use client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ColumnMarkdown({body}:{body:string}){
 return <div className="column-markdown"><Markdown remarkPlugins={[[remarkGfm,{singleTilde:false}]]} skipHtml components={{a:({children,...props})=><a {...props} target="_blank" rel="noopener noreferrer">{children}</a>}}>{body}</Markdown></div>;
}
