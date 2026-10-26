'use strict';
const {createGameServer}=require('../engine/node/server.cjs');
const createStaticServer=(directory=__dirname)=>createGameServer(directory);
module.exports={createStaticServer};
if(require.main===module)import('../engine/start.mjs').then(({startGame})=>startGame(__dirname)).catch(error=>{console.error(error);process.exitCode=1});
