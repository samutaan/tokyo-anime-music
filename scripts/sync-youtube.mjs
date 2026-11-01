import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function durationSeconds(value) {
  const m=/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value??'');
  if(!m || !m.slice(1).some(Boolean)) throw Error('Invalid duration');
  const n=Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0);
  if(!Number.isSafeInteger(n)||n<=0) throw Error('Invalid duration');
  return n;
}
export function makeRanking(items,registry,now=new Date()) {
  const seen=new Set();
  const entries=[];
  for(const v of items) {
    if(!registry.videoIds.includes(v.id)||seen.has(v.id)||v.snippet?.channelId!==registry.channelId) throw Error('Video identity mismatch');
    seen.add(v.id);
    if(v.status?.privacyStatus!=='public'||v.snippet.liveBroadcastContent!=='none') continue;
    if(typeof v.snippet.title!=='string'||!v.snippet.title.trim()) throw Error('Missing title');
    if(/君の知らない物語|kimi[\s_-]*no[\s_-]*shiranai[\s_-]*monogatari/i.test(v.snippet.title.normalize('NFKC'))) continue;
    const seconds=durationSeconds(v.contentDetails?.duration);
    if(!/^\d+$/.test(v.statistics?.viewCount??'')) throw Error('Missing view count');
    const views=Number(v.statistics.viewCount);
    if(!Number.isSafeInteger(views)) throw Error('Invalid view count');
    const duration=[Math.floor(seconds/3600)?`${Math.floor(seconds/3600)} 時間`:'',Math.floor(seconds%3600/60)?`${Math.floor(seconds%3600/60)} 分`:'',seconds%60?`${seconds%60} 秒`:''].filter(Boolean).join(' ');
    entries.push({title:v.snippet.title,url:`https://www.youtube.com/watch?v=${v.id}`,duration,seconds,views});
  }
  // A partial response must never silently replace a complete ranking.
  if(seen.size!==registry.videoIds.length) throw Error('Incomplete API response; review removed or private videos');
  entries.sort((a,b)=>b.views-a.views||a.url.localeCompare(b.url,'en'));
  const groups=['long','short'].map(id=>({id,entries:entries.filter(e=>id==='long'?e.seconds>=600:e.seconds<600).slice(0,10).map((e,i)=>({...e,position:i+1}))}));
  if(groups.some(g=>!g.entries.length)) throw Error('Empty ranking category');
  return {observedAt:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),updatedAt:now.toISOString(),method:'youtube-api-view-count',source:'https://www.youtube.com/@TokyoAnimeMusic/videos',groups};
}
export async function fetchRanking(registry,key,fetcher=fetch) {
  if(!key) throw Error('YOUTUBE_API_KEY is not configured');
  if(!/^UC[\w-]{22}$/.test(registry.channelId)||!registry.videoIds.length||registry.videoIds.length>500||new Set(registry.videoIds).size!==registry.videoIds.length||registry.videoIds.some(id=>! /^[\w-]{11}$/.test(id))) throw Error('Invalid video registry');
  const items=[];
  for(let offset=0;offset<registry.videoIds.length;offset+=50) {
    const url=new URL('https://www.googleapis.com/youtube/v3/videos');
    url.search=new URLSearchParams({part:'snippet,contentDetails,statistics,status',id:registry.videoIds.slice(offset,offset+50).join(',')});
    let response;
    try {response=await fetcher(url,{headers:{'X-Goog-Api-Key':key},signal:AbortSignal.timeout(20000)});} catch {throw Error('YouTube request failed');}
    if(!response.ok) throw Error(`YouTube API returned HTTP ${response.status}`);
    let body;try {body=await response.json();}catch {throw Error('Invalid API JSON');}
    if(!Array.isArray(body.items)||body.error) throw Error('Invalid API response');
    items.push(...body.items);
  }
  return makeRanking(items,registry);
}
export async function sync({registryPath='src/data/youtube-videos.json',outputPath='src/data/video-rankings.json',key=process.env.YOUTUBE_API_KEY,fetcher=fetch}={}) {
  const registry=JSON.parse(await fs.readFile(registryPath,'utf8'));
  const next=await fetchRanking(registry,key,fetcher);
  const temporary=outputPath+'.tmp';
  await fs.writeFile(temporary,JSON.stringify(next,null,2)+'\n');
  await fs.rename(temporary,outputPath);
  return next;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {await sync();console.log('YouTube rankings updated successfully.');}
  catch(error) {console.error(`::warning::YouTube ranking retained: ${error.message}`);process.exitCode=1;}
}
