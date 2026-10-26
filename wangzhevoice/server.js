import path from 'node:path';
import {fileURLToPath} from 'node:url';
import server from '../engine/node/server.cjs';
const root=path.dirname(fileURLToPath(import.meta.url));
export const createServer=(directory=root)=>server.createGameServer(directory);
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))import('../engine/start.mjs').then(({startGame})=>startGame(root)).catch(error=>{console.error(error);process.exitCode=1});
