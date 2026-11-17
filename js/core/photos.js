/* The photos: Wikimedia Commons and Flickr photos, shown straight from where they live, credited to their
 * photographers. No page code: the browser's fetch and storage are handed in, so the unit tests run it against
 * recorded answers.
 *
 * A breed whose photos have been checked by eye has them in the data (photos: [{ k, by, lic, own }]), with their
 * credits, and the page asks nothing for it. A photo's key k is a Commons file name, or "flickr:<server>/<id>_<secret>"
 * (own: the Flickr account, for the link to the photo's page). Every other breed has one photo in the data (its
 * Wikidata image), and in the visitor's browser the page adds the lead photo of its Wikipedia article, from two public
 * Wikimedia APIs (anonymous, read-only, CORS with origin=*):
 *   1. Wikipedia: the lead photo of the breed's article                               (50 breeds a request)
 *   2. Wikimedia Commons: each photo's author and licence, for the credit line         (50 photos a request)
 * Answers are kept in the browser for 30 days. If Wikimedia can't be reached, the photo in the data is all there is.
 */
export const WIKI_API = 'https://en.wikipedia.org/w/api.php';
export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
export const CACHE_KEY = 'dog-breeds.wiki.v2';
export const CACHE_DAYS = 30;
export const MAX_PHOTOS = 2; // a breed not yet checked: its stored photo and its article's
export const FLICKR = 'flickr:';
export const BATCH = 50;

const under = (f) => f.replace(/ /g, '_');
export const spaced = (f) => String(f).replace(/^File:/i, '').replace(/_/g, ' ');
/** A photo, scaled by Wikimedia to about this width (it is never scaled up). */
export const fileUrl = (file, width) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(under(file))}?width=${width}`;
/** The photo's page on Commons, which has its full licence. */
export const filePage = (file) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(under(file))}`;
/** A photo by its key, about this wide: Flickr has fixed sizes (640 and 1024 pixels on the long side). */
export const photoUrl = (key, width) => (key.startsWith(FLICKR) ? `https://live.staticflickr.com/${key.slice(FLICKR.length)}_${width <= 400 ? 'z' : 'b'}.jpg` : fileUrl(key, width));
/** The photo's own page (with its licence): on Commons, or on Flickr in its photographer's account. */
export const photoPage = (key, own) => (key.startsWith(FLICKR) ? `https://www.flickr.com/photos/${own}/${key.split('/').pop().split('_')[0]}` : filePage(key));
export const fromFlickr = (key) => key.startsWith(FLICKR);
/** A breed's article: a title on English Wikipedia, or "de:Title" on another language's. */
export const articleOf = (wiki) => {
	const m = /^([a-z]{2,3}):(.+)$/.exec(wiki || '');
	return m ? { lang: m[1], title: m[2] } : { lang: 'en', title: wiki };
};
export const articleUrl = (wiki) => {
	const { lang, title } = articleOf(wiki);
	return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(under(title))}`;
};

const query = (base, params) => base + '?' + new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params });

/** A photo file worth showing: a JPEG, PNG or WebP that isn't a map, logo, drawing or skeleton. */
export function goodFile(name) {
	const n = spaced(name).toLowerCase();
	if (!/\.(jpe?g|png|webp)$/.test(n)) return false;
	return !/\b(map|logo|icon|flag|coat of arms|drawing|painting|illustration|engraving|stamp|coin|statue|sculpture|skull|skeleton|diagram|chart|sign|postcard)\b/.test(n);
}
/* ---------------------------------------------------------------- 1. lead photos of Wikipedia articles */
export const leadsUrl = (titles, lang = 'en') => query(lang === 'en' ? WIKI_API : `https://${lang}.wikipedia.org/w/api.php`, { titles: titles.join('|'), redirects: '1', prop: 'pageimages|pageprops', piprop: 'name', pilicense: 'free', ppprop: 'wikibase_item|disambiguation' });
/**
 * What each asked-for title led to: { file, qid } (either may be null), or null when the title leads nowhere useful:
 * missing, a disambiguation page, a list, or a redirect to a section of another article (a cross with no article of
 * its own redirects to its row in the list of crossbreeds).
 */
export function parseLeads(json, titles) {
	const q = (json && json.query) || {};
	const norm = new Map((q.normalized || []).map((x) => [x.from, x.to]));
	const redir = new Map((q.redirects || []).map((x) => [x.from, x]));
	const pages = new Map((q.pages || []).map((p) => [p.title, p]));
	const out = new Map();
	for (const t of titles) {
		let title = norm.get(t) || t;
		const r = redir.get(title);
		if (r) {
			if (r.tofragment) {
				out.set(t, null);
				continue;
			}
			title = r.to;
		}
		const p = pages.get(title);
		if (!p || p.missing || p.invalid || /^List of /.test(p.title) || (p.pageprops && 'disambiguation' in p.pageprops)) {
			out.set(t, null);
			continue;
		}
		const file = p.pageimage && goodFile(p.pageimage) ? spaced(p.pageimage) : null;
		out.set(t, { file, qid: (p.pageprops && p.pageprops.wikibase_item) || null, page: p.title });
	}
	return out;
}

/* ---------------------------------------------------------------- 2. credits */
export const creditsUrl = (files) => query(COMMONS_API, { titles: files.map((f) => 'File:' + spaced(f)).join('|'), prop: 'imageinfo', iiprop: 'extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|AttributionRequired' });
/** HTML (an Artist field) to plain text. */
export function plain(html) {
	return String(html || '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
		.replace(/\s+/g, ' ')
		.trim();
}
/** file -> { author, licence, licenceUrl }, for each file the answer has. */
export function parseCredits(json) {
	const q = (json && json.query) || {};
	const out = new Map();
	for (const p of q.pages || []) {
		const meta = p.imageinfo && p.imageinfo[0] && p.imageinfo[0].extmetadata;
		if (!meta) continue;
		const v = (k) => (meta[k] ? plain(meta[k].value) : '');
		let author = v('Artist');
		if (author.length > 80) author = author.slice(0, 77).trimEnd() + '…';
		out.set(spaced(p.title), { author, licence: v('LicenseShortName'), licenceUrl: v('LicenseUrl') });
	}
	return out;
}

/* ---------------------------------------------------------------- the store */
/**
 * The photos of every breed, growing as the APIs answer.
 *   fetchJson(url) -> Promise of the parsed answer (rejects on failure)
 *   storage: { getItem, setItem } or null
 *   items: the breeds and crosses: { id, name, aka, wiki, photo, photos, not (files judged wrong for it) }
 */
export function createPhotos({ fetchJson, storage, items, now = () => Date.now() }) {
	const fresh = (t) => t && now() - t < CACHE_DAYS * 864e5;
	let cache = { leads: {}, credits: {} };
	try {
		const saved = storage && JSON.parse(storage.getItem(CACHE_KEY) || 'null');
		if (saved && saved.leads && saved.credits) cache = saved;
	} catch (e) {
		/* a broken cache is an empty one */
	}
	let saveTimer = null;
	const save = () => {
		if (!storage || saveTimer) return;
		saveTimer = setTimeout(() => {
			saveTimer = null;
			try {
				storage.setItem(CACHE_KEY, JSON.stringify(cache));
			} catch (e) {
				/* full or blocked: the cache just doesn't last */
			}
		}, 400);
	};
	const byId = new Map(items.map((b) => [b.id, b]));
	// checked photos come with their credits
	const given = new Map();
	for (const b of items) for (const p of b.photos || []) given.set(p.k, { author: p.by || '', licence: p.lic || '', own: p.own || null });
	const checked = (b) => b && b.photos && b.photos.length > 0;
	// an article shared by several breeds (the four Belgian Shepherds have one) can't say which breed its photos show
	const perArticle = new Map();
	for (const b of items) if (b.wiki) perArticle.set(b.wiki, (perArticle.get(b.wiki) || 0) + 1);
	const ownArticle = (b) => b && b.wiki && perArticle.get(b.wiki) === 1;
	// and two titles can lead to one article (English Wikipedia redirects the Belgian Griffon to the Brussels Griffon):
	// then its photos are left out for both
	let landing = null;
	const sharedLanding = (lead) => {
		if (!landing) {
			landing = new Map();
			for (const [k, x] of Object.entries(cache.leads)) if (x.v && x.v.page) landing.set(articleOf(k).lang + ':' + x.v.page, (landing.get(articleOf(k).lang + ':' + x.v.page) || 0) + 1);
		}
		return lead.v.page && landing.get(lead.k) > 1;
	};
	const listeners = new Set();
	const changed = (id) => listeners.forEach((fn) => fn(id));
	const failed = new Set(); // files that wouldn't load in this visit, and photos judged wrong for their breed
	for (const b of items) for (const f of b.not || []) failed.add(f);

	function list(id) {
		const b = byId.get(id);
		if (!b) return [];
		if (checked(b)) return b.photos.map((p) => p.k).filter((k) => !failed.has(k));
		const out = [];
		const add = (f) => f && !out.includes(f) && !failed.has(f) && out.length < MAX_PHOTOS && out.push(f);
		add(b.photo);
		if (!ownArticle(b)) return out;
		const lead = cache.leads[b.wiki];
		if (lead && lead.v && sharedLanding({ v: lead.v, k: articleOf(b.wiki).lang + ':' + lead.v.page })) return out;
		if (lead && lead.v) add(lead.v.file);
		return out;
	}

	const inflight = new Map();
	function once(key, run) {
		if (!inflight.has(key)) inflight.set(key, run().finally(() => inflight.delete(key)));
		return inflight.get(key);
	}

	/** Look up the lead photos of these breeds' articles (not for breeds with checked photos). Resolves when done; never rejects. */
	async function resolveLeads(ids) {
		const wikis = [...new Set(ids.map((id) => byId.get(id)).filter((b) => !checked(b) && ownArticle(b) && !fresh(cache.leads[b.wiki] && cache.leads[b.wiki].t)).map((b) => b.wiki))];
		// one batch of 50 titles at a time, per Wikipedia (almost all are English)
		const byLang = new Map();
		for (const w of wikis) {
			const { lang } = articleOf(w);
			byLang.set(lang, [...(byLang.get(lang) || []), w]);
		}
		for (const [lang, list] of byLang) {
			for (let i = 0; i < list.length; i += BATCH) {
				const part = list.slice(i, i + BATCH);
				const titles = part.map((w) => articleOf(w).title);
				try {
					const res = parseLeads(await once('leads:' + part.join('|'), () => fetchJson(leadsUrl(titles, lang))), titles);
					part.forEach((w, k) => (cache.leads[w] = { v: res.get(titles[k]) || null, t: now() }));
					landing = null;
					save();
					for (const b of items) if (part.includes(b.wiki)) changed(b.id);
				} catch (e) {
					return; // offline or refused: try again on the next visit
				}
			}
		}
	}
	const want = new Set();
	let creditTimer = null;
	/** The credit for a photo, if known: { author, licence }. */
	function credit(key) {
		if (given.has(key)) return given.get(key);
		const c = cache.credits[key];
		return c && c.v ? c.v : null;
	}
	/** Ask for credits; onUpdate listeners hear about each file (with id null) when they arrive. */
	function requestCredits(files) {
		for (const f of files) if (f && !given.has(f) && !fromFlickr(f) && !fresh(cache.credits[f] && cache.credits[f].t)) want.add(f);
		if (!want.size || creditTimer) return;
		creditTimer = setTimeout(async () => {
			creditTimer = null;
			const batch = [...want].slice(0, BATCH);
			batch.forEach((f) => want.delete(f));
			try {
				const res = parseCredits(await fetchJson(creditsUrl(batch)));
				for (const f of batch) cache.credits[f] = { v: res.get(f) || null, t: now() };
				save();
				changed(null);
			} catch (e) {
				/* the credit line keeps its link to Commons */
			}
			if (want.size) requestCredits([]);
		}, 40);
	}

	return {
		list,
		resolveLeads,
		credit,
		/** The photo's own page, for the credit line's link. */
		page: (key) => photoPage(key, given.has(key) ? given.get(key).own : null),
		requestCredits,
		/** A file that failed to load: leave it out for the rest of the visit. */
		drop(file) {
			failed.add(file);
		},
		onUpdate(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		/** For the checks: what is cached. */
		_cache: () => cache,
	};
}
