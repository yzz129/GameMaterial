import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const context=vm.createContext({});
vm.runInContext(await fs.readFile(new URL('../engine/client/audio-autoplay.js',import.meta.url),'utf8'),context);
const {createAutoplayGate}=context.ArchiveAudio;

function harness() {
  const listeners=new Map();
  let visible=true,plays=0;
  const target={
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    emit(type,props={}){for(const fn of [...(listeners.get(type)||[])])fn({type,isTrusted:true,...props});}
  };
  const gate=createAutoplayGate({target,play:()=>plays++,canStart:()=>visible,ignore:event=>event.control===true});
  return {target,gate,get plays(){return plays;},get listeners(){return [...listeners.values()].reduce((n,set)=>n+set.size,0);},set visible(value){visible=value;}};
}

test('audible autoplay tries immediately and retries a policy block inside the first real touch',()=>{
  const h=harness();
  h.gate.start();assert.equal(h.plays,1);assert.equal(h.listeners,0);
  h.gate.blocked();assert.equal(h.gate.pending,true);
  h.target.emit('touchend',{isTrusted:false});assert.equal(h.plays,1);
  h.target.emit('touchend');assert.equal(h.plays,2);assert.equal(h.gate.pending,false);
  h.target.emit('click');assert.equal(h.plays,2);assert.equal(h.listeners,0);
});

test('explicit music controls and a manual pause cannot trigger a pending automatic restart',()=>{
  const h=harness();h.gate.blocked();
  h.target.emit('pointerup',{control:true});
  h.target.emit('keydown',{key:'Tab'});
  h.target.emit('click',{defaultPrevented:true});
  assert.equal(h.plays,0);assert.equal(h.gate.pending,true);
  h.gate.cancel();h.target.emit('pointerup');h.target.emit('click');
  assert.equal(h.plays,0);assert.equal(h.listeners,0);
});

test('hidden pages defer autoplay and suspended or disposed pages release gesture listeners',()=>{
  const h=harness();h.visible=false;h.gate.start();
  h.target.emit('click');assert.equal(h.plays,0);
  h.visible=true;h.target.emit('visibilitychange');assert.equal(h.plays,1);
  h.gate.blocked();h.gate.suspend();assert.equal(h.listeners,0);
  h.target.emit('click');assert.equal(h.plays,1);
  h.gate.resume();assert.equal(h.plays,2);
  h.gate.blocked();h.gate.dispose();h.gate.resume();h.gate.start();h.target.emit('click');
  assert.equal(h.plays,2);assert.equal(h.listeners,0);
});
