import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJSON,writeJSON,localPath} from './config.mjs';
import {prepareGame} from './prepare.mjs';

const engine=path.dirname(fileURLToPath(import.meta.url));
export async function addGame(workspace,{id,name,port}) {
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(id||'')) throw new Error('请指定游戏 id，例如：npm run game:add -- xingqiong --name 星穹铁道');
  const registry=await readJSON(path.join(workspace,'games.json'));
  if (registry.games.some(game=>game.id===id)) throw new Error(`游戏已经存在：${id}`);
  const usedPorts=[];
  for (const game of registry.games) usedPorts.push((await readJSON(localPath(workspace,game.directory+'/game.config.json'))).server.port);
  if (port===undefined) {port=8082;while(usedPorts.includes(port))port++;}
  if (!Number.isInteger(port)||port<1024||port>65535||usedPorts.includes(port)) throw new Error('端口无效或已被其他游戏使用');
  const directory=id+'voice',root=localPath(workspace,directory);
  try {await fs.mkdir(root);} catch(error){if(error.code==='EEXIST')throw new Error(`目录已存在，不会覆盖：${directory}`);throw error;}
  const config=await readJSON(path.join(engine,'../templates/game.config.json'));
  config.id=id;config.brand.title=`${name} · 声音档案`;config.brand.shortName=name;config.brand.world=name;
  config.storage={namespace:id.replaceAll('-','_'),favorites:id+'_fav_quotes_v2'};config.server.port=port;
  for(const child of ['data/characters','assets/icons','assets/fonts'])await fs.mkdir(path.join(root,child),{recursive:true});
  for(const [from,to]of[['placeholder.svg','assets/placeholder.svg'],['ui.svg','assets/icons/ui.svg'],['font.woff','assets/fonts/archive.woff']])await fs.copyFile(path.join(engine,'assets',from),path.join(root,to));
  const character={id:1,name:'示例角色',enName:'EXAMPLE',title:'声音的旅人',description:'等待属于这个世界的故事。',element:'探索者',roles:['探索者'],region:name,rarity:5,weapon:'未分类',birthday:'',constellation:'',cv:{},avatarImg:'assets/placeholder.svg',cardArt:'assets/placeholder.svg',splashArt:'assets/placeholder.svg',fullArt:'assets/placeholder.svg',fullArtWidth:1200,fullArtHeight:800,quoteCount:0,preview:'',metadataSearch:'示例角色 example 探索者',skins:[]};
  await writeJSON(path.join(root,'game.config.json'),config);
  await writeJSON(path.join(root,'data/catalog.json'),[character]);
  await writeJSON(path.join(root,'data/characters/1.json'),{...character,friendLines:[],actionLines:[]});
  await writeJSON(path.join(root,'data/music.json'),{tracks:[]});
  await fs.writeFile(path.join(root,'theme.css'),'/* 在 game.config.json 设置品牌、主题变量和素材；在这里补充布局样式。 */\n');
  await writeJSON(path.join(root,'package.json'),{name:id+'-voice-archive',private:true,scripts:{start:`node ../tools/game.mjs start --game ${id}`,build:`node ../tools/game.mjs build --game ${id}`,prepare:`node ../tools/game.mjs prepare --game ${id}`,validate:`node ../tools/game.mjs validate --game ${id}`}});
  await fs.writeFile(path.join(root,'README.md'),`# ${name}\n\n运行 \`npm start\`，访问 http://localhost:${port} 。\n\n修改 \`game.config.json\` 的品牌、分类、主题与素材路径，替换 \`assets/\` 与 \`data/\` 内容，执行 \`npm run prepare\`。\`app.js\`、\`styles.css\` 等由共享引擎生成，请编辑上一级的 \`engine/\`。完整数据格式见 [接入指南](../docs/ADDING_A_GAME.md)。\n\n\`npm run build\` 生成独立静态站点 \`dist/\`，只上传该目录。示例角色没有音频，可以删除并换成真实资料。\n`);
  await prepareGame(root);
  registry.games.push({id,slug:id,directory});await writeJSON(path.join(workspace,'games.json'),registry);
  return {id,directory,port};
}
