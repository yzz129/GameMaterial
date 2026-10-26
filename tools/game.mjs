import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJSON, localPath, inspectGame, writeJSON} from '../engine/config.mjs';
import {prepareGame} from '../engine/prepare.mjs';
import {createRequire} from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const args = process.argv.slice(2), command = args.shift() || 'start';
const option = (flag, fallback) => { const at=args.indexOf(flag); return at >= 0 ? args[at+1] : fallback; };
const servers = [];
try {
  const registry = await readJSON(path.join(root, 'games.json'));
  if (command === 'add') {
    const {addGame} = await import('../engine/scaffold.mjs');
    const id = args.find(arg => !arg.startsWith('--'));
    const created = await addGame(root, {id, name: option('--name', id), port: option('--port') === undefined ? undefined : Number(option('--port'))});
    console.log(`已创建 ${created.directory}。编辑 game.config.json、theme.css 和 data/、assets/ 后运行 npm run start:game -- --game ${id}`);
  } else {
    const selected = option('--game', registry.games[0]?.id);
    const games = args.includes('--all') && !args.includes('--game') ? registry.games : registry.games.filter(game => game.id === selected);
    if (!games.length) throw new Error(`未找到游戏：${selected}`);
    if (!['prepare','validate','build','start'].includes(command)) throw new Error(`未知命令：${command}`);
    if (games.length > 1 && args.includes('--port')) throw new Error('指定 --port 时请同时用 --game 选择一个游戏');
    for (const game of games) {
      const directory = localPath(root, game.directory);
      if (command === 'validate') {
        const data = await inspectGame(directory);
        console.log(`${game.id}: ${data.catalog.length} 个角色，${data.voices} 条语音，${data.music.tracks.length} 首音乐；数据与素材检查通过`);
        continue;
      }
      const prepared = await prepareGame(directory);
      if (command === 'prepare') { console.log(JSON.stringify(prepared)); continue; }
      if (command === 'build') {
        const {buildGame} = await import('../engine/build.mjs');
        console.log(JSON.stringify(await buildGame(directory)));
        continue;
      }
      const config = await readJSON(path.join(directory, 'game.config.json'));
      const {createGameServer} = require('../engine/node/server.cjs');
      const server = createGameServer(directory);
      const port = Number(option('--port', process.env.PORT || config.server.port));
      await new Promise((resolve,reject) => {server.once('error',reject);server.listen(port, config.server.host || '127.0.0.1', resolve);});
      servers.push(server);
      console.log(`${config.brand.shortName} http://localhost:${port}`);
    }
    if (servers.length) for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { for (const server of servers) server.close(); });
  }
} catch (error) { for (const server of servers) {server.closeAllConnections();server.close();} console.error(error.message); process.exitCode = 1; }
