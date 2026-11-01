import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {durationSeconds,makeRanking,fetchRanking,sync} from './sync-youtube.mjs';
const channelId='UCcjBs2_cBEMTGLjicpGqbAg';
const video=(id,seconds,views,title='Original')=>({id,snippet:{title,channelId,liveBroadcastContent:'none'},status:{privacyStatus:'public'},contentDetails:{duration:`PT${seconds}S`},statistics:{viewCount:String(views)}});
const items=[video('aaaaaaaaaaa',599,20),video('bbbbbbbbbbb',600,10),video('ccccccccccc',601,50),video('ddddddddddd',200,100,'君の知らない物語 cover')];
const registry={channelId,videoIds:items.map(v=>v.id)};
test('600 second boundary, descending views, exclusions and Tokyo date',()=>{
 const r=makeRanking(items,registry,new Date('2026-11-01T20:00:00Z'));
 assert.equal(r.observedAt,'2026-11-02');assert.deepEqual(r.groups.map(g=>g.entries.map(e=>e.seconds)),[[601,600],[599]]);
 assert.equal(r.groups[0].entries[0].position,1);
 assert.equal(durationSeconds('PT1H2M3S'),3723);
});
test('reject incomplete, wrong artist, missing views and duplicates',()=>{
 assert.throws(()=>makeRanking(items.slice(1),registry));
 const bad=structuredClone(items);bad[0].snippet.channelId='other';assert.throws(()=>makeRanking(bad,registry));
 const noViews=structuredClone(items);delete noViews[0].statistics.viewCount;assert.throws(()=>makeRanking(noViews,registry));
 assert.throws(()=>makeRanking([...items,items[0]],registry));
});
test('caps each category at 10 with deterministic ties',()=>{
 const many=Array.from({length:30},(_,i)=>video(String(i).padStart(11,'0'),i%2?600:599,20));
 const r=makeRanking(many,{channelId,videoIds:many.map(v=>v.id)});
 assert.deepEqual(r.groups.map(g=>g.entries.length),[10,10]);
 assert.deepEqual(r.groups,makeRanking([...many].reverse(),{channelId,videoIds:many.map(v=>v.id)}).groups);
});
test('quota failure keeps existing file unchanged and does not retry',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'youtube-sync-'));const outputPath=path.join(dir,'ranking.json'),registryPath=path.join(dir,'registry.json');
 try {await fs.writeFile(outputPath,'original');await fs.writeFile(registryPath,JSON.stringify(registry));let calls=0;
 await assert.rejects(sync({outputPath,registryPath,key:'test',fetcher:async()=>{calls++;return {ok:false,status:403}}}));
 assert.equal(calls,1);assert.equal(await fs.readFile(outputPath,'utf8'),'original');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('missing key does not issue requests',async()=>{await assert.rejects(fetchRanking(registry,'',()=>{assert.fail('must not fetch')}));});
