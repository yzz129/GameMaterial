// Compatibility command: normalize source data, then prepare the shared engine.
import './prepare-data.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareGame} from '../../engine/prepare.mjs';
console.log(await prepareGame(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')));
