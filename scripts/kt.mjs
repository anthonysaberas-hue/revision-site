import katex from 'katex';
import fs from 'fs';
const s=fs.readFileSync(process.argv[2],'utf8');
const re=/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g; let m; let bad=0;
while((m=re.exec(s))){ const t=m[1]??m[2]; try{katex.renderToString(t,{throwOnError:true,strict:'ignore'});}catch(e){bad++;console.log('BAD:',t.slice(0,120),'->',e.message.slice(0,100));}}
console.log('bad',bad);
