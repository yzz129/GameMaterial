'use strict';
const path=require('node:path');
(async()=>{const {prepareGame}=await import('../../engine/prepare.mjs');const {buildGame}=await import('../../engine/build.mjs');const root=path.resolve(__dirname,'..');await prepareGame(root);console.log(await buildGame(root));})().catch(error=>{console.error(error);process.exitCode=1});
