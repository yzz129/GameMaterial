import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareGame} from '../../engine/prepare.mjs';
import {buildGame} from '../../engine/build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await prepareGame(root);console.log(await buildGame(root));
