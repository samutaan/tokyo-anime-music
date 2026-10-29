import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCatalog} from '../src/data/validate.ts';

export const ARTIST_ID=6782565755;
export const SOURCE=`https://itunes.apple.com/lookup?id=${ARTIST_ID}&entity=song&country=JP&limit=200&sort=recent`;
const norm=s=>s.normalize('NFKC').trim().toLowerCase();
const numeric=n=>Number.isSafeInteger(n)&&n>0;
const json=data=>JSON.stringify(data,null,2)+'\n';
function appleLink(value,trackId){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='music.apple.com'||url.username||url.password||url.searchParams.get('i')!==String(trackId))throw Error('Invalid Apple track URL');
 url.searchParams.delete('uo');return url.href;
}
export function mergeCatalog(existing,payload,today=new Date().toISOString().slice(0,10)){
 validateCatalog(existing);
 if(!payload||!Array.isArray(payload.results)||payload.resultCount!==payload.results.length||!payload.results.some(r=>r.wrapperType==='artist'&&r.artistId===ARTIST_ID))throw Error('Invalid response or missing artist identity');
 const tracks=payload.results.filter(r=>r.wrapperType==='track'&&r.kind==='song');
 if(!tracks.length)throw Error('No songs returned; keeping existing data');
 const ids=new Set();
 for(const t of tracks){
  if(t.artistId!==ARTIST_ID||!numeric(t.trackId)||!numeric(t.collectionId)||typeof t.trackName!=='string'||!t.trackName.trim()||ids.has(t.trackId))throw Error('Invalid artist, title or duplicate track ID');
  ids.add(t.trackId);appleLink(t.trackViewUrl,t.trackId);
  if(typeof t.releaseDate!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(t.releaseDate)||!Number.isFinite(Date.parse(t.releaseDate)))throw Error('Invalid release date');
 }
 const next=structuredClone(existing),review=[],changes=[];
 const bound=new Set();
 for(const r of existing){if(r.appleTrackId){if(bound.has(r.appleTrackId))throw Error('Duplicate local Apple track ID');bound.add(r.appleTrackId);}}
 for(const t of tracks){
  const date=t.releaseDate.slice(0,10);
  if(t.isStreamable!==true||date>today){review.push({trackId:t.trackId,title:t.trackName,reason:'not-currently-streamable'});continue;}
  let matches=next.filter(r=>r.appleTrackId===t.trackId || (r.appleMusic&&new URL(r.appleMusic).searchParams.get('i')===String(t.trackId)));
  if(!matches.length){
   const sameTitle=next.filter(r=>norm(r.title)===norm(t.trackName));
   const remoteSame=tracks.filter(x=>norm(x.trackName)===norm(t.trackName));
   if(sameTitle.length>1||remoteSame.length>1||sameTitle.some(r=>r.appleTrackId&&r.appleTrackId!==t.trackId)){
    review.push({trackId:t.trackId,title:t.trackName,reason:'ambiguous-title-or-version'});continue;
   }
   matches=sameTitle;
  }
  if(matches.length>1){review.push({trackId:t.trackId,title:t.trackName,reason:'multiple-local-matches'});continue;}
  let r=matches[0];
  if(r?.appleMusic){const u=new URL(r.appleMusic);const collection=u.pathname.split('/').filter(Boolean).at(-1);if(collection!==String(t.collectionId)){review.push({trackId:t.trackId,title:t.trackName,reason:'existing-link-conflict'});continue;}}
  const added=!r;
  if(!r){r={id:`apple-${t.trackId}`,title:t.trackName,artist:'Tokyo Anime Music',status:'pending',verified:false,releaseType:'unknown'};next.push(r);}
  const before=json(r);
  Object.assign(r,{status:'released',verified:true,metadataVerified:true,appleTrackId:t.trackId,appleArtistId:ARTIST_ID,appleMusic:appleLink(t.trackViewUrl,t.trackId),availabilitySource:'Apple iTunes Search API (JP)',availabilityScope:'Apple Music JP; other services not checked by this sync'});
  if(!r.releaseDate)r.releaseDate=date;
  if(r.releaseType==='unknown'&&t.trackCount===1&&t.collectionName?.endsWith(' - Single'))r.releaseType='single';
  if(before!==json(r)){r.appleVerifiedAt=today;changes.push({id:r.id,title:r.title,action:added?'added':'updated'});}
 }
 validateCatalog(next);
 return {catalog:next,report:{source:SOURCE,artistId:ARTIST_ID,received:tracks.length,possiblyTruncated:tracks.length>=200,changes,review,total:next.length,verified:next.filter(r=>r.status==='released'&&r.verified).length}};
}
export async function sync({root,apply=false,fetcher=fetch}){
 const target=path.join(root,'src/data/releases.json');
 const original=await fs.readFile(target,'utf8');
 const response=await fetcher(SOURCE,{signal:AbortSignal.timeout(30000),redirect:'error',headers:{Accept:'application/json'}});
 if(!response.ok)throw Error(`Apple API HTTP ${response.status}; no catalog changes`);
 const body=await response.text();if(body.length>3000000)throw Error('Response exceeds size limit');
 const {catalog,report}=mergeCatalog(JSON.parse(original),JSON.parse(body));
 const work=path.join(root,'work');await fs.mkdir(work,{recursive:true});
 await fs.writeFile(path.join(work,'sync-report.json'),json(report));
 await fs.writeFile(path.join(work,'catalog-proposed.json'),json(catalog));
 if(apply&&report.changes.length){
  const lock=await fs.open(path.join(work,'catalog-sync.lock'),'wx');
  const temp=target+'.sync-tmp';
  try{
   if(await fs.readFile(target,'utf8')!==original)throw Error('Catalog changed during sync; retry');
   await fs.writeFile(path.join(work,'catalog-before-sync.json'),original);
   await fs.writeFile(temp,json(catalog),{flag:'wx'});await fs.rename(temp,target);
  }finally{await fs.rm(temp,{force:true});await lock.close();await fs.rm(path.join(work,'catalog-sync.lock'),{force:true});}
 }
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.some(a=>!['--apply','--dry-run'].includes(a))||args.includes('--apply')&&args.includes('--dry-run'))throw Error('Usage: node scripts/sync-catalog.mjs [--dry-run|--apply]');
 try{const report=await sync({root:fileURLToPath(new URL('../',import.meta.url)),apply:args.includes('--apply')});console.log(json(report));}
 catch(error){console.error('SYNC FAILED: '+error.message);process.exitCode=1;}
}
