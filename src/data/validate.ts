export interface Release { id:string; title:string; artist:string; status:'pending'|'released'; verified:boolean; releaseDate?:string; cover?:string; isrc?:string; releaseType:'single'|'album'|'ep'|'unknown'; hyperfollow?:string; spotify?:string; appleMusic?:string; youtube?:string; }
const seen=new Set<string>();
const codes=new Set<string>();
const hosts:Record<string,string[]>={hyperfollow:['distrokid.com'],spotify:['open.spotify.com'],appleMusic:['music.apple.com'],youtube:['www.youtube.com','youtube.com','youtu.be']};
export function validateCatalog(data:unknown):Release[]{
 if(!Array.isArray(data))throw new Error('Catalog must be an array');
 seen.clear();codes.clear();
 for(const item of data){
  if(!item || typeof item!=='object')throw new Error('Invalid release');
  const r=item as Record<string,unknown>;
  if(typeof r.id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.id)||seen.has(r.id))throw new Error('Invalid or duplicate release id');
  seen.add(r.id);
  if(typeof r.title!=='string'||!r.title.trim()||r.artist!=='Tokyo Anime Music')throw new Error('Title or artist invalid: '+r.id);
  if(!['pending','released'].includes(String(r.status))||typeof r.verified!=='boolean'||!['single','album','ep','unknown'].includes(String(r.releaseType)))throw new Error('Invalid release status/type: '+r.id);
  if(r.releaseDate!==undefined&&(typeof r.releaseDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate)||Number.isNaN(Date.parse(r.releaseDate))||new Date(r.releaseDate).toISOString().slice(0,10)!==r.releaseDate))throw new Error('Invalid release date: '+r.id);
  if(r.cover!==undefined&&(typeof r.cover!=='string'||!/^\/images\/[a-zA-Z0-9_/-]+\.(jpg|jpeg|png|webp)$/.test(r.cover)||r.cover.includes('..')))throw new Error('Use a local cover under /images/: '+r.id);
  if(r.isrc!==undefined){if(typeof r.isrc!=='string'||!/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(String(r.isrc))||codes.has(String(r.isrc)))throw new Error('Invalid or duplicate ISRC: '+r.id);codes.add(String(r.isrc));}
  for(const [field,allowed] of Object.entries(hosts)){if(r[field]!==undefined){if(typeof r[field]!=='string')throw new Error('Invalid URL: '+r.id);const u=new URL(r[field]);if(u.protocol!=='https:'||!allowed.includes(u.hostname)||u.username||u.password)throw new Error('Invalid service URL: '+r.id);}}
  if(r.verified&&r.status==='released'&&!Object.keys(hosts).some(k=>r[k]))throw new Error('Verified releases need a listening link: '+r.id);
 }
 return data as Release[];
}
