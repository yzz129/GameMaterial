import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {brotliCompressSync, gzipSync, constants} from 'node:zlib';
import {readJSON, localPath, writeJSON} from './config.mjs';

const require = createRequire(import.meta.url);
const {publicPolicy} = require('./node/public.cjs');
const engine = path.dirname(fileURLToPath(import.meta.url));
const mediaType = file => ({'.mp4':'video/mp4','.flac':'audio/flac','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4'})[path.extname(file).toLowerCase()];

export async function buildGame(root, {generatedRoot = root, outputRoot, target: buildTarget, statePath, embedded = false} = {}) {
  const config = await readJSON(path.join(root, 'game.config.json'));
  const name = config.build?.directory || 'dist';
  if (!/^[a-z][a-z0-9-]*$/.test(name) || ['assets','data','engine','tools'].includes(name)) throw new Error('构建目录必须是独立的 dist 类目录');
  const output = outputRoot ? path.resolve(outputRoot) : localPath(root, name), marker = statePath || path.join(output, '.archive-build.json');
  const target = buildTarget || config.build.target;
  if (output === path.parse(output).root || output === path.resolve(root) || output === path.resolve(generatedRoot)) throw new Error('构建目录不能覆盖源文件');
  await fs.mkdir(output, {recursive:true});
  let previous = {files:[]};
  try { previous = await readJSON(marker); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const manifest = await readJSON(path.join(generatedRoot, 'site-public.json'));
  const {allowed} = publicPolicy(root, manifest);
  const generated = new Set(manifest.generated || []);
  const sourceFiles = new Set(manifest.files), written = new Set(), media = {};
  let bytes = 0;
  async function walk(directory, relative) {
    for (const entry of await fs.readdir(directory, {withFileTypes:true})) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.') || entry.name === 'masters') continue;
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(path.join(directory,entry.name), file);
      else if (allowed(file)) sourceFiles.add(file);
    }
  }
  for (const directory of ['assets', manifest.characters]) await walk(localPath(root,directory), directory);
  const put = async (relative, data) => {
    const target = localPath(output,relative);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.writeFile(target,data);written.add(relative);bytes+=Buffer.byteLength(data);
  };
  for (const file of [...sourceFiles].sort()) {
    if (!allowed(file)) throw new Error(`非公开文件不可发布：${file}`);
    const source = localPath(generated.has(file) ? generatedRoot : root,file), stat = await fs.stat(source);
    if (!stat.isFile()) throw new Error(`公开入口必须是文件：${file}`);
    if (target === 'cloudflare' && stat.size > 25*1024*1024) {
      const type = mediaType(file);
      if (!type) throw new Error(`文件超过 Cloudflare 单文件限制：${file}`);
      const buffer = await fs.readFile(source), sha256 = crypto.createHash('sha256').update(buffer).digest('hex'), parts=[];
      for (let start=0,index=0;start<buffer.length;start+=24*1024*1024,index++) {
        const chunk=buffer.subarray(start,Math.min(start+24*1024*1024,buffer.length));
        const relative=`assets/${type==='video/mp4'?'video':'audio/music'}/chunks/${sha256}.${index}.bin`;
        await put(relative,chunk);parts.push({path:'/'+relative,start,bytes:chunk.length});
      }
      media['/'+file]={bytes:buffer.length,sha256,contentType:type,parts};
    } else {
      const target=localPath(output,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);written.add(file);bytes+=stat.size;
      if (/\.(?:html|js|css|json|svg)$/.test(file)) {
        const buffer=await fs.readFile(source);
        if (buffer.length>512) {await put(file+'.br',brotliCompressSync(buffer,{params:{[constants.BROTLI_PARAM_QUALITY]:6}}));await put(file+'.gz',gzipSync(buffer));}
      }
    }
  }
  if (target === 'cloudflare' && (Object.keys(media).length || config.music.proxy)) {
    const videoHandler=await fs.readFile(path.join(engine,'node/video-response.mjs'),'utf8');
    const musicHandler=await fs.readFile(path.join(engine,'node/music-stream.mjs'),'utf8');
    const music=await readJSON(localPath(root,config.data.music));
    const sources=Object.fromEntries(music.tracks.filter(track=>track.streamUrl).map(track=>[track.id,track.streamUrl]));
    const worker=`${videoHandler}\n${musicHandler}\nconst media=${JSON.stringify(media)};\nconst sources=${JSON.stringify(sources)};\nconst policy=${JSON.stringify(config.music.proxySources||[])};\nexport default {async fetch(request,env){const pathname=new URL(request.url).pathname;if(pathname==='/api/music-stream'&&${Boolean(config.music.proxy)})return serveMusicStream(request,sources,fetch,policy);const asset=media[pathname];if(!asset)return env.ASSETS.fetch(request);return serveVideo(request,asset,(relative,headers)=>env.ASSETS.fetch(new Request(new URL(relative,request.url),{headers,signal:request.signal})));}};\n`;
    if (!embedded) {
      await put('_worker.js',worker);
      await put('_routes.json',JSON.stringify({version:1,include:[...Object.keys(media),...(config.music.proxy?['/api/music-stream']:[])],exclude:[]}));
    }
    await put('assets/media-index.json',JSON.stringify(media));
    await put('assets/video/media-index.json',JSON.stringify(Object.fromEntries(Object.entries(media).filter(([,asset])=>asset.contentType==='video/mp4'))));
  }
  if (!embedded) await put('_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: no-cache\n/assets/*\n  Cache-Control: public, max-age=86400, must-revalidate\n');
  // Only remove files recorded by this builder, and only inside its output.
  for (const file of previous.files || []) if (!written.has(file)) await fs.unlink(localPath(output,file)).catch(error=>{if(error.code!=='ENOENT')throw error;});
  await writeJSON(marker,{schemaVersion:1,id:config.id,files:[...written].sort()});
  return {id:config.id,files:written.size,bytes,output};
}
