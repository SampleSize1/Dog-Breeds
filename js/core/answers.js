/* Checking a typed breed name. No page code: the unit tests import this directly.
 *
 * check(text, answerId, index) says what a typed answer means:
 *   { verdict: 'right' }                          the breed's name or one of its other names (accents, case, spaces,
 *                                                 hyphens and a trailing "dog" don't matter; one slip in a long name is fine)
 *   { verdict: 'right', spelled: 'Name' }         right, but spelled differently enough to show the spelling
 *   { verdict: 'other', id }                      the name of another breed
 *   { verdict: 'vague', ids }                     a word for several breeds ("corgi") that includes the answer: try again
 *   { verdict: 'wrong' }                          nothing we know
 */

/** Lower case, no accents, letters and digits only, single spaces; "the" in front and "dog" at the end dropped. */
export function norm(s) {
	return String(s || '')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/ß/g, 'ss')
		.replace(/ø/g, 'o')
		.replace(/æ/g, 'ae')
		.replace(/[ł]/g, 'l')
		.toLowerCase()
		.replace(/\((dog|dog breed)\)/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/^the /, '')
		.replace(/ dogs?$/, '')
		.replace(/\s+/g, '');
}

// Names people use for more than one breed. Typed for one of them, it counts: the AKC's "Cocker Spaniel" is the
// American Cocker and The Kennel Club's is the English Cocker; the AKC's "Collie" is both coats.
export const SHARED = {
	'Cocker Spaniel': ['american-cocker', 'english-cocker'],
	Cocker: ['american-cocker', 'english-cocker'],
	Collie: ['rough-collie', 'smooth-collie'],
	// the FCI's name for the Standard Schnauzer (for the other two it is too vague: see VAGUE)
	Schnauzer: ['standard-schnauzer'],
};
// Words for a family of breeds: typed for one of them, the page asks which one instead of marking it wrong.
export const VAGUE = {
	Corgi: ['pembroke-corgi', 'cardigan-corgi'],
	'Welsh Corgi': ['pembroke-corgi', 'cardigan-corgi'],
	'Belgian Shepherd': ['groenendael', 'tervuren', 'malinois', 'laekenois'],
	Schnauzer: ['miniature-schnauzer', 'giant-schnauzer'],
	Spitz: ['german-spitz', 'japanese-spitz', 'pomeranian', 'keeshond', 'finnish-spitz', 'volpino', 'american-eskimo'],
	Laika: ['east-siberian-laika', 'west-siberian-laika', 'russo-european-laika', 'yakutian-laika'],
	Elkhound: ['norwegian-elkhound', 'black-norwegian-elkhound', 'jamthund'],
	'Fox Terrier': ['smooth-fox-terrier', 'wire-fox-terrier', 'toy-fox-terrier'],
	Foxhound: ['english-foxhound', 'american-foxhound'],
	Coonhound: ['black-and-tan-coonhound', 'bluetick-coonhound', 'redbone-coonhound', 'american-english-coonhound', 'treeing-walker'],
	Pinscher: ['german-pinscher', 'miniature-pinscher', 'austrian-pinscher'],
	Setter: ['english-setter', 'irish-setter', 'gordon-setter', 'irish-red-white-setter'],
	Griffon: ['brussels-griffon', 'griffon-belge', 'wirehaired-pointing-griffon'],
	Münsterländer: ['large-munsterlander', 'small-munsterlander'],
	'Water Spaniel': ['irish-water-spaniel', 'american-water-spaniel'],
	'Water Dog': ['portuguese-water-dog', 'spanish-water-dog'],
	'Mountain Dog': ['bernese', 'greater-swiss', 'entlebucher', 'estrela-mountain-dog', 'pyrenean-mountain-dog'],
};

/** Damerau-Levenshtein distance (optimal string alignment), stopping early once it passes max. */
export function distance(a, b, max = 3) {
	if (Math.abs(a.length - b.length) > max) return max + 1;
	const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
	for (let j = 1; j <= b.length; j++) d[0][j] = j;
	for (let i = 1; i <= a.length; i++) {
		let best = Infinity;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
			best = Math.min(best, d[i][j]);
		}
		if (best > max) return max + 1;
	}
	return d[a.length][b.length];
}
/** How many slips a name of this length allows: none up to 4 letters, one up to 8, two after that. */
export const slack = (n) => (n <= 4 ? 0 : n <= 8 ? 1 : 2);

/**
 * An index of every name: build it once from the breed list (and the crosses, which have names too).
 * Throws if one name counts for two breeds, which the build's checks rule out.
 */
export function makeIndex(breeds) {
	const exact = new Map(); // normalised name -> breed id
	const shown = new Map(); // normalised name -> how it is written
	for (const b of breeds) {
		for (const n of [b.name, ...(b.aka || [])]) {
			const k = norm(n);
			if (!k) continue;
			if (exact.has(k) && exact.get(k) !== b.id) throw new Error(`"${n}" names both ${exact.get(k)} and ${b.id}`);
			exact.set(k, b.id);
			if (!shown.has(k)) shown.set(k, n);
		}
	}
	const shared = new Map(Object.entries(SHARED).map(([k, ids]) => [norm(k), ids]));
	const vague = new Map(Object.entries(VAGUE).map(([k, ids]) => [norm(k), ids]));
	return { exact, shown, shared, vague, names: [...exact.keys()] };
}

export function check(text, answerId, index) {
	const k = norm(text);
	if (!k) return { verdict: 'wrong' };
	const hit = index.exact.get(k);
	if (hit) return hit === answerId ? { verdict: 'right' } : { verdict: 'other', id: hit };
	const shared = index.shared.get(k);
	if (shared && shared.includes(answerId)) return { verdict: 'right' };
	const vague = index.vague.get(k);
	if (vague && vague.includes(answerId)) return { verdict: 'vague', ids: vague };
	if (shared) return { verdict: 'other', id: shared[0] };
	// a slip: the one closest name, if it is close enough for its length and no other name is as close
	let best = null;
	let bestD = Infinity;
	let tie = false;
	for (const name of index.names) {
		const allow = slack(Math.min(name.length, k.length));
		if (!allow) continue;
		const dd = distance(k, name, allow);
		if (dd > allow) continue;
		if (dd < bestD) (best = name), (bestD = dd), (tie = false);
		else if (dd === bestD && index.exact.get(name) !== index.exact.get(best)) tie = true;
	}
	if (best && !tie) {
		const id = index.exact.get(best);
		if (id === answerId) return { verdict: 'right', spelled: index.shown.get(best) };
		return { verdict: 'other', id };
	}
	return { verdict: 'wrong' };
}
