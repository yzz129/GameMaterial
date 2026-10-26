'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const {publicPolicy} = require('./public.cjs');
const mime = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.webp':'image/webp', '.mp4':'video/mp4', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg', '.flac':'audio/flac', '.woff':'font/woff', '.woff2':'font/woff2', '.ico':'image/x-icon' };
mime['.m4a']='audio/mp4';
function createGameServer(directory) {
  const root = path.resolve(directory);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'game.config.json'), 'utf8'));
  const {allowed:isPublic, aliases} = publicPolicy(root);
  let musicSources;
  return http.createServer(async (req,res) => {
    const fail = (status,text,headers={}) => { res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8',...headers});res.end(req.method==='HEAD'?undefined:text); };
    if(!['GET','HEAD'].includes(req.method))return fail(405,'Method not allowed',{'Allow':'GET, HEAD'});
    let pathname;
    try { pathname=decodeURIComponent(req.url.split('?')[0]); } catch { return fail(400,'Invalid URL encoding'); }
    if (pathname === '/api/music-stream') {
      if (!config.music.proxy) return fail(404,'Not found');
      try {
      const controller=new AbortController();
      res.on('close',()=>controller.abort());
      const {serveMusicStream}=await import('./music-stream.mjs');
      musicSources ||= Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,config.data.music),'utf8')).tracks.map(track=>[track.id,track.streamUrl]));
      const headers=new Headers();
      for(const key of ['range','if-range','if-none-match'])if(req.headers[key])headers.set(key,req.headers[key]);
      const response=await serveMusicStream(new Request(new URL(req.url,'http://localhost'),{method:req.method,headers,signal:controller.signal}),musicSources,fetch,config.music.proxySources || []);
      if(res.destroyed){await response.body?.cancel();return;}
      res.writeHead(response.status,Object.fromEntries(response.headers));
      if(!response.body)return res.end();
      const stream=Readable.fromWeb(response.body);
      stream.on('error',()=>res.destroy());
      res.on('close',()=>stream.destroy());
      return stream.pipe(res);
      } catch { if(!res.headersSent)return fail(502,'Soundtrack connection failed',{'Cache-Control':'no-store'});res.destroy();return; }
    }
    if(pathname.includes('\0')||pathname.includes('\\'))return fail(400,'Invalid path');
    let relative=pathname.replace(/^\/+/, '') || 'index.html';
    if(aliases[relative])relative=aliases[relative];
    if(relative==='favicon.ico')relative=config.assets.favicon || config.assets.logo;
    const filename=path.resolve(root,relative), boundary=path.relative(root,filename);
    if(boundary.startsWith('..')||path.isAbsolute(boundary))return fail(403,'Forbidden');
    if(!isPublic(relative))return fail(404,'Not found');
    try {
      const stats=await fs.promises.stat(filename);if(!stats.isFile())return fail(404,'Not found');
      const extension=path.extname(filename), text=/^\.(?:html|css|js|json|svg)$/.test(extension);
      const headers={'Content-Type':mime[extension]||'application/octet-stream','Cache-Control':relative.startsWith('assets/')?'public, max-age=86400, must-revalidate':'no-cache','Last-Modified':stats.mtime.toUTCString(),'X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
      let servedFile=filename,servedStats=stats,encoding='identity';
      if(text){
        headers.Vary='Accept-Encoding';
        if(!req.headers.range){
          const accepted=(req.headers['accept-encoding']||'').split(',').map(part=>{const [name,...params]=part.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));return{name:name.toLowerCase(),q:q?Number(q.trim().slice(2)):1}});
          const choices=['br','gzip'].map(name=>({name,q:(accepted.find(a=>a.name===name)||accepted.find(a=>a.name==='*'))?.q||0})).filter(a=>Number.isFinite(a.q)&&a.q>0&&a.q<=1).sort((a,b)=>b.q-a.q);
          for(const {name:candidate} of choices){try{const file=filename+(candidate==='br'?'.br':'.gz'),s=await fs.promises.stat(file);if(s.mtimeMs>=stats.mtimeMs&&s.size<stats.size){servedFile=file;servedStats=s;encoding=candidate;headers['Content-Encoding']=candidate;break}}catch{}}
        }
      }
      headers.ETag=`W/"${stats.size.toString(16)}-${Math.trunc(stats.mtimeMs).toString(16)}-${encoding}"`;
      if(req.headers['if-none-match']?.split(',').some(v=>v.trim()==='*'||v.trim().replace(/^W\//,'')===headers.ETag.replace(/^W\//,''))){res.writeHead(304,headers);return res.end()}
      let status=200,start=0,end=servedStats.size-1;
      const ifRange=req.headers['if-range'];
      const rangeAllowed=!ifRange||(!ifRange.startsWith('W/')&&ifRange===headers.ETag)||Date.parse(ifRange)>=Date.parse(headers['Last-Modified']);
      if(req.headers.range&&rangeAllowed){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||(!match[1]&&!match[2]))return fail(416,'Invalid range',{'Content-Range':`bytes */${stats.size}`});if(!match[1])start=Math.max(0,stats.size-Number(match[2]));else start=Number(match[1]);end=match[1]&&match[2]?Math.min(Number(match[2]),stats.size-1):stats.size-1;if(start>end||start>=stats.size)return fail(416,'Unsatisfiable range',{'Content-Range':`bytes */${stats.size}`});status=206;headers['Content-Range']=`bytes ${start}-${end}/${stats.size}`;}
      headers['Content-Length']=end-start+1;res.writeHead(status,headers);
      if(req.method==='HEAD'||servedStats.size===0)return res.end();
      const stream=fs.createReadStream(servedFile,{start,end});
      stream.on('error',()=>res.destroy());
      res.on('error',()=>stream.destroy());
      res.on('close',()=>stream.destroy());
      stream.pipe(res);
    }catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')return fail(404,'Not found');return fail(500,'Unable to read file')}
  });
}
module.exports = { createGameServer };
