import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await fs.readFile(path.join(root,'hosting.cloudflare.json'),'utf8'));
if(!/^[a-f0-9]{32}$/.test(config.accountId)||!/^[a-z0-9-]+$/.test(config.projectName))throw Error('Invalid Cloudflare project configuration');
const candidates=[path.join(os.homedir(),'AppData/Roaming/xdg.config/.wrangler/config/default.toml'),path.join(os.homedir(),'.wrangler/config/default.toml')];
let token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)for(const file of candidates){try{token=(await fs.readFile(file,'utf8')).match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];if(token)break;}catch{}}
if(!token)throw Error('Cloudflare 登录不可用，请先运行 wrangler login');
const base=`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/pages/projects/${config.projectName}`;
async function request(suffix='',method='GET',body){const response=await fetch(base+suffix,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok||!result.success)throw Error(JSON.stringify({status:response.status,errors:result.errors}));return result.result;}
const command=process.argv[2]||'status';
if(command==='status'){
  const [project,domains]=await Promise.all([request(),request('/domains')]);
  console.log(JSON.stringify({project:project.name,domains:domains.map(domain=>({id:domain.id,name:domain.name,status:domain.status,verificationStatus:domain.verification_data?.status,validation:domain.validation_data})),production:project.canonical_deployment?{id:project.canonical_deployment.id,url:project.canonical_deployment.url,stage:project.canonical_deployment.latest_stage}:null},null,2));
}else if(command==='add-domain'){
  const domains=await request('/domains');let domain=domains.find(item=>item.name===config.domain);
  if(!domain)domain=await request('/domains','POST',{name:config.domain});
  console.log(JSON.stringify({id:domain.id,name:domain.name,status:domain.status,verification:domain.verification_data,validation:domain.validation_data},null,2));
}else if(command==='remove-old-domain'){
  const domains=await request('/domains'),current=domains.find(domain=>domain.name===config.domain);
  if(current?.status!=='active')throw Error('新域名尚未 active，保留旧域名');
  const response=await fetch(`https://${config.domain}/`);const html=await response.text();
  if(!response.ok||!html.includes('/genshin/')||!html.includes('/honor-of-kings/'))throw Error('新门户尚未验证通过，保留旧域名');
  for(const name of config.retiredDomains){if(domains.some(domain=>domain.name===name)){await request('/domains/'+encodeURIComponent(name),'DELETE');console.log(JSON.stringify({removed:name}));}else console.log(JSON.stringify({alreadyRemoved:name}));}
}else throw Error('Unknown Cloudflare action');
