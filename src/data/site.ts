export const hyperfollow = 'https://distrokid.com/hyperfollow/tokyoanimemusic/0WyGoJ4jDFf';
export const pages = ['home', 'music', 'videos', 'streaming', 'about', 'contact'] as const;
export type Page = typeof pages[number];
export type Lang = 'en' | 'ja';
export const labels = {en: ['Home', 'Music', 'Videos', 'Streaming', 'About', 'Contact'],ja: ['ホーム', '楽曲', '動画', '配信リンク', 'プロフィール', 'お問い合わせ']};
export function href(lang: Lang, page: Page) { return (lang === 'ja' ? '/ja/' : '/') + (page === 'home' ? '' : page + '/'); }
