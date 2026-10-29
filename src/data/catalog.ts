import raw from './releases.json';
import {validateCatalog} from './validate';
export {validateCatalog} from './validate';
export type {Release} from './validate';
const catalog=validateCatalog(raw);
export const releases=catalog.filter(r=>r.verified&&r.status==='released');
export const pendingReleases=catalog.filter(r=>r.status==='pending');
