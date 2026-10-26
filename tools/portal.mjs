import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {buildPortal} from '../engine/portal.mjs';
import {createPortalServer} from '../engine/portal-server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),command=args[0]||'start';
try{
  const config=JSON.parse(await fs.readFile(path.join(root,'portal.config.json'),'utf8'));
  if(!['start','build','deploy'].includes(command))throw Error('命令必须为 start、build 或 deploy');
  const result=await buildPortal(root,{onProgress:console.log});console.log(JSON.stringify(result,null,2));
  if(command==='start'){
    const portIndex=args.indexOf('--port'),port=Number(portIndex>=0?args[portIndex+1]:process.env.PORT||config.port);
    const server=await createPortalServer(result.output);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
    console.log(`游藏门户 http://localhost:${port}`);
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.closeAllConnections();server.close()});
  }else if(command==='deploy'){
    const hosting=JSON.parse(await fs.readFile(path.join(root,'hosting.cloudflare.json'),'utf8'));
    if(!/^[a-z0-9-]+$/.test(hosting.projectName)||!/^[\w.-]+$/.test(hosting.productionBranch))throw Error('部署配置无效');
    const child=spawn(process.platform==='win32'?'npx.cmd':'npx',['--yes','wrangler@4.152.0','pages','deploy',result.output,'--project-name='+hosting.projectName,'--branch='+hosting.productionBranch],{cwd:root,stdio:'inherit',shell:process.platform==='win32',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:hosting.accountId}});
    process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1))});
  }
}catch(error){console.error(error.stack||error.message);process.exitCode=1;}
