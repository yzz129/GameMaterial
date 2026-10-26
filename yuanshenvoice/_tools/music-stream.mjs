import config from '../game.config.json' with {type:'json'};
import {serveMusicStream as serveSharedMusic} from '../../engine/node/music-stream.mjs';
export const serveMusicStream=(request,tracks,fetchUpstream=fetch)=>serveSharedMusic(request,tracks,fetchUpstream,config.music.proxySources||[]);
