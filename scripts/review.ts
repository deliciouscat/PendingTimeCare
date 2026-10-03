import {spawnSync} from 'node:child_process';
function call(name:string,args:unknown){const r=spawnSync('npx',['convex','run',name,JSON.stringify(args)],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return JSON.parse(r.stdout||'null')}
const args=process.argv.slice(2);
if(args.includes('--list')){
 const data=call('admin:inspect',{});
 console.log(JSON.stringify(data.questions.filter((q:any)=>q.status==='draft').map((q:any)=>({id:q._id,columnId:q.columnId,version:q.version,question:q.question,model:q.model})),null,2));
}else{
 const id=args[args.indexOf('--question')+1],reviewer=args[args.indexOf('--reviewer')+1];
 if(!args.includes('--question')||!args.includes('--reviewer')||!reviewer||(!args.includes('--approve')&&!args.includes('--reject')))throw new Error('Use --list, or --question ID --reviewer NAME --approve/--reject. Read the complete draft before approval.');
 call('admin:reviewQuestion',{questionId:id,reviewer,decision:args.includes('--approve')?'reviewed':'rejected'});console.log('Review recorded. Applies to newly created care schedules.');
}
