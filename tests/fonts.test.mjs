import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {inflateSync} from 'node:zlib';

// Check the shipped WOFF cmap, rather than trusting the coverage manifest.
function woffHasGlyph(bytes,codepoint){
  assert.equal(bytes.toString('ascii',0,4),'wOFF');
  let cmap;
  for(let i=0;i<bytes.readUInt16BE(12);i++){
    const row=44+i*20;if(bytes.toString('ascii',row,row+4)!=='cmap')continue;
    const data=bytes.subarray(bytes.readUInt32BE(row+4),bytes.readUInt32BE(row+4)+bytes.readUInt32BE(row+8));
    cmap=data.length===bytes.readUInt32BE(row+12)?data:inflateSync(data);break;
  }
  assert(cmap,'WOFF must contain a cmap');
  for(let i=0;i<cmap.readUInt16BE(2);i++){
    const offset=cmap.readUInt32BE(8+i*8),table=cmap.subarray(offset),format=table.readUInt16BE(0);
    if(format===4&&codepoint<=0xffff){
      const count=table.readUInt16BE(6)/2,starts=16+count*2,deltas=starts+count*2,ranges=deltas+count*2;
      for(let seg=0;seg<count;seg++){
        const start=table.readUInt16BE(starts+seg*2),end=table.readUInt16BE(14+seg*2);
        if(codepoint<start||codepoint>end)continue;
        const delta=table.readInt16BE(deltas+seg*2),range=table.readUInt16BE(ranges+seg*2);
        if(!range)return ((codepoint+delta)&0xffff)!==0;
        const glyph=table.readUInt16BE(ranges+seg*2+range+(codepoint-start)*2);
        return glyph!==0&&((glyph+delta)&0xffff)!==0;
      }
    }else if(format===12){
      for(let group=0;group<table.readUInt32BE(12);group++){
        const row=16+group*12,start=table.readUInt32BE(row),end=table.readUInt32BE(row+4);
        if(codepoint>=start&&codepoint<=end)return table.readUInt32BE(row+8)+codepoint-start!==0;
      }
    }
  }
  return false;
}

test('Honor heading uses vector glyphs and its critical UI font works without the large WOFF2 fallback',async()=>{
  const game=new URL('../wangzhevoice/',import.meta.url);
  const config=JSON.parse(await fs.readFile(new URL('game.config.json',game),'utf8'));
  const patch=await fs.readFile(new URL(config.assets.fontPatch.src,game));
  assert(patch.length<100*1024,'visible UI must not wait for a multi-megabyte font');
  for(const char of '循熟换停筛秒')assert(woffHasGlyph(patch,char.codePointAt(0)),`missing actual glyph: ${char}`);
  for(const point of config.assets.fontPatch.codepoints)assert(woffHasGlyph(patch,point));
  for(const file of [config.home.titleArt.still,config.home.titleArt.intro]){
    const art=await fs.readFile(new URL(file,game),'utf8');
    assert.match(art,/<path\b/);assert.doesNotMatch(art,/<text\b|font-family|@font-face|<image\b/);
    assert.match(art,/viewBox="0 0 1480 500"/);
  }
  const theme=await fs.readFile(new URL('theme.generated.css',game),'utf8');
  assert(theme.includes(config.assets.fontPatch.src));assert.match(theme,/unicode-range:U\+/);
  assert.doesNotMatch(theme,/font-weight:\d+\s+\d+/,'legacy WebViews need individual weight declarations');
});
