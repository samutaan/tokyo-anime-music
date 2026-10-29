import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {mergeCatalog,sync,ARTIST_ID} from './sync-catalog.mjs';
const song={wrapperType:'track',kind:'song',artistId:ARTIST_ID,trackId:123,collectionId:122,trackName:'Test',collectionName:'Test - Single',trackCount:1,releaseDate:'2026-01-01T00:00:00Z',isStreamable:true,trackViewUrl:'https://music.apple.com/jp/album/test/122?i=123&uo=4'};
const payload=(tracks=[song])=>({resultCount:tracks.length+1,results:[{wrapperType:'artist',artistId:ARTIST_ID},...tracks]});
const row={id:'existing',title:'Test',artist:'Tokyo Anime Music',status:'pending',verified:false,releaseType:'unknown',hyperfollow:'https://distrokid.com/hyperfollow/tokyoanimemusic/test'};
test('merge preserves IDs and links; repeat is idempotent',()=>{const a=mergeCatalog([row],payload());assert.equal(a.catalog[0].id,'existing');assert.equal(a.catalog[0].hyperfollow,row.hyperfollow);assert.equal(a.report.verified,1);assert.equal(mergeCatalog(a.catalog,payload()).report.changes.length,0);assert.equal(row.status,'pending');});
test('new songs added and absent songs never deleted',()=>{const a=mergeCatalog([{...row,title:'Other'}],payload());assert.equal(a.catalog.length,2);assert.equal(a.catalog[1].id,'apple-123');});
test('ambiguous versions require review',()=>{const a=mergeCatalog([row],payload([song,{...song,trackId:456,trackViewUrl:'https://music.apple.com/jp/album/test/122?i=456'}]));assert.equal(a.report.review.length,2);assert.deepEqual(a.catalog,[row]);});
test('identity, malformed response, URL and duplicate ID rejected',()=>{for(const p of [{results:[]},payload([]),payload([{...song,artistId:1}]),payload([song,song]),payload([{...song,trackViewUrl:'https://evil.example/'}])])assert.throws(()=>mergeCatalog([row],p));});
test('future and unavailable songs do not become released',()=>{for(const s of [{...song,releaseDate:'2099-01-01T00:00:00Z'},{...song,isStreamable:false}])assert.equal(mergeCatalog([row],payload([s])).catalog[0].status,'pending');});
test('existing Apple album conflict requires review',()=>{assert.equal(mergeCatalog([{...row,appleMusic:'https://music.apple.com/jp/album/999'}],payload()).report.changes.length,0);});
test('network failure and dry run leave file byte-identical; apply backs up',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tam-sync-'));
 try{await fs.mkdir(path.join(root,'src/data'),{recursive:true});const file=path.join(root,'src/data/releases.json');const original=JSON.stringify([row]);await fs.writeFile(file,original);
 await assert.rejects(sync({root,apply:true,fetcher:async()=>{throw Error('offline')}}));assert.equal(await fs.readFile(file,'utf8'),original);
 const fetcher=async()=>({ok:true,text:async()=>JSON.stringify(payload())});await sync({root,fetcher});assert.equal(await fs.readFile(file,'utf8'),original);
 await sync({root,apply:true,fetcher});assert.equal(JSON.parse(await fs.readFile(file,'utf8'))[0].status,'released');assert.equal(await fs.readFile(path.join(root,'work/catalog-before-sync.json'),'utf8'),original);
 }finally{if(path.dirname(root)!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('tam-sync-'))throw Error('Unsafe temporary cleanup path');await fs.rm(root,{recursive:true,force:true});}
});
