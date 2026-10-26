'use strict';
const path=require('node:path');
import('../../engine/prepare.mjs').then(({prepareGame})=>prepareGame(path.resolve(__dirname,'..'))).then(console.log).catch(error=>{console.error(error);process.exitCode=1});
