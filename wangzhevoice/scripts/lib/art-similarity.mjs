import sharp from 'sharp';

export async function artFingerprint(input){
  const [sample,gray]=await Promise.all([
    sharp(input).removeAlpha().resize(24,32,{fit:'fill'}).raw().toBuffer(),
    sharp(input).removeAlpha().grayscale().resize(9,8,{fit:'fill'}).raw().toBuffer()
  ]);
  let hash=0n;for(let y=0;y<8;y++)for(let x=0;x<8;x++)hash=(hash<<1n)|BigInt(gray[y*9+x]>gray[y*9+x+1]);
  return {hash:hash.toString(16).padStart(16,'0'),sample};
}

export function compareArt(a,b){
  let xor=BigInt('0x'+a.hash)^BigInt('0x'+b.hash),distance=0;while(xor){distance++;xor&=xor-1n;}
  let error=0;for(let i=0;i<a.sample.length;i++)error+=Math.abs(a.sample[i]-b.sample[i]);
  const difference=error/(a.sample.length*255);
  // The official Yao / Yun Zhong Jun files use slightly different crops of the
  // same painting. Exact hashes and overly strict dHash cutoffs miss that case.
  return {distance,difference,similar:distance<=16&&difference<.115};
}

export function findSimilarArt(records,sharedIdentityGroups=[]){
  const pairs=[];for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
    const a=records[i],b=records[j],comparison=compareArt(a.fingerprint,b.fingerprint);
    if(comparison.similar)pairs.push({heroes:[a.heroId,b.heroId],names:[a.name,b.name],distance:comparison.distance,difference:comparison.difference,intentional:sharedIdentityGroups.some(g=>g.heroIds.includes(a.heroId)&&g.heroIds.includes(b.heroId))});
  }return pairs;
}
