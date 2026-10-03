import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadColumns} from '../content/load-columns';

const columns=await loadColumns();
if(process.argv.includes('--stdout'))process.stdout.write(JSON.stringify(columns));
else{
 const path=resolve(import.meta.dirname,'../content/columns.generated.ts');
 const source='// Generated from content/columns/*.md. Do not edit.\nexport default '+JSON.stringify(columns,null,2)+';\n';
 let old='';try{old=await readFile(path,'utf8')}catch{}
 if(old!==source)await writeFile(path,source);
 console.log(`Prepared ${columns.length} Markdown columns.`);
}
