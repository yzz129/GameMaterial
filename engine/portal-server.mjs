import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {Readable} from 'node:stream';
import crypto from 'node:crypto';

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.mp4':'video/mp4','.mp3':'audio/mpeg','.flac':'audio/flac','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
export async function createPortalServer(directory){
  const root=path.resolve(directory),source=await fsp.readFile(path.join(root,'_worker.js'),'utf8');
  const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
  async function assetFetch(request){
    const error=(status,text)=>new Response(request.method==='HEAD'?null:text,{status,headers:{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'}});
    if(!['GET','HEAD'].includes(request.method))return error(405,'Method not allowed');
    let relative;try{relative=decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');}catch{return error(400,'Invalid URL');}
    if(relative.includes('\\')||relative.includes('\0'))return error(400,'Invalid path');
    if(relative.split('/').some(part=>part.startsWith('.')||['_worker.js','_routes.json','_headers'].includes(part)))return error(404,'Not found');
    let file=path.resolve(root,relative||'index.html');const boundary=path.relative(root,file);
    if(boundary.startsWith('..')||path.isAbsolute(boundary))return error(403,'Forbidden');
    let stat;
    try{stat=await fsp.stat(file);if(stat.isDirectory()){file=path.join(file,'index.html');stat=await fsp.stat(file);}}
    catch{if(!path.extname(file))try{file+='.html';stat=await fsp.stat(file);}catch{} }
    if(!stat?.isFile())return error(404,'Not found');
    const etag=`W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`,headers=new Headers({'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':String(stat.size),'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','ETag':etag,'Cache-Control':'no-cache','Last-Modified':stat.mtime.toUTCString()});
    if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});
    let start=0,end=stat.size-1,status=200;
    const range=request.headers.get('range'),ifRange=request.headers.get('if-range');
    if(range&&(!ifRange||ifRange===etag||Date.parse(ifRange)>=stat.mtimeMs)){
      const match=/^bytes=(\d*)-(\d*)$/.exec(range);
      if(!match||!match[1]&&!match[2])return new Response(null,{status:416,headers:{'Content-Range':`bytes */${stat.size}`}});
      if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}else{const length=Number(match[2]);if(!length)return new Response(null,{status:416});start=Math.max(0,stat.size-length);}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${stat.size}`}});
      status=206;headers.set('Content-Range',`bytes ${start}-${end}/${stat.size}`);headers.set('Content-Length',String(end-start+1));
    }
    return new Response(request.method==='HEAD'||!stat.size?null:Readable.toWeb(fs.createReadStream(file,{start,end})),{status,headers});
  }
  return http.createServer(async(req,res)=>{
    const abort=new AbortController();req.on('aborted',()=>abort.abort());
    try{
      const request=new Request(new URL(req.url,'http://localhost'),{method:req.method,headers:req.headers,signal:abort.signal});
      const response=await worker.fetch(request,{ASSETS:{fetch:assetFetch}});
      res.writeHead(response.status,Object.fromEntries(response.headers));
      if(!response.body||req.method==='HEAD')return res.end();
      const stream=Readable.fromWeb(response.body);stream.on('error',()=>res.destroy());res.on('close',()=>{abort.abort();stream.destroy()});stream.pipe(res);
    }catch(error){if(!res.headersSent){res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('Unable to serve portal');}else res.destroy();}
  });
}
