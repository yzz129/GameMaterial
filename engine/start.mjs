import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {prepareGame} from './prepare.mjs';
const require=createRequire(import.meta.url);
const {createGameServer}=require('./node/server.cjs');
export async function startGame(directory) {
  await prepareGame(directory);
  const config=JSON.parse(await fs.readFile(path.join(directory,'game.config.json'),'utf8'));
  const port=Number(process.env.PORT)||config.server.port;
  const server=createGameServer(directory);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,config.server.host,resolve)});
  console.log(`${config.brand.shortName} http://localhost:${port}`);
  return server;
}
