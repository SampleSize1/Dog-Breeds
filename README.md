# Dog Breeds

Learn to recognise every dog breed from real photos.

**Use it here: [samplesize1.com/tools/dog-breeds](https://samplesize1.com/tools/dog-breeds/)**

**In beta.** Made by [@samplesize_1](https://www.instagram.com/samplesize_1/).

## What it does

- 387 breeds: every FCI breed and every AKC breed, plus seven well-known breeds only the United Kennel Club recognises (the American Pit Bull Terrier, American Bully, American Bulldog...)
- Three sets, smallest first: **Popular** (60), **AKC** (206) and **Every breed** (387), in ten groups of breeds bred for the same job (herding dogs, terriers, sighthounds...)
- **Study**: every breed's photos, what to look for, its facts (group, size, origin, FCI number, AKC rank), and the breeds it's easily mixed up with, with how to tell them apart
- **Practice**: name the breed in a photo by picking from four or by typing. The wrong choices are its look-alikes first, misses come back a few questions later, and typing has hints (what kind of dog it is, then the first letters)
- **Test**: every breed in your selection once, timed, no help, with your best score saved
- **Designer crosses** (27) as their own set: the question is the two parent breeds ("What two breeds make a Cavapoo?")
- Typed names are lenient where they should be: other names count (Alsatian, Westie, Frenchie...), accents and case don't matter, and a small slip in a long name still counts
- About 1,800 photos, each checked by eye and credited to its photographer
- Progress and best scores stay in your browser: no account, nothing is sent anywhere

## Run it yourself

It's a plain web page with no build step. Its scripts are JavaScript modules, so serve the folder with any static file server rather than opening the file directly:

```sh
git clone https://github.com/SampleSize1/Dog-Breeds.git
cd Dog-Breeds
python3 -m http.server 8000
```

Then open http://localhost:8000. The photos load from Wikimedia Commons and Flickr, so it needs an internet connection.

| File | What it is |
| --- | --- |
| `index.html` | The page: markup and styles |
| `js/app.js` | The page's behaviour: what is on screen, the buttons, the scores |
| `js/core/quiz.js` | The questions: which breeds, the wrong choices, the order of practice, misses coming back |
| `js/core/answers.js` | Checking a typed name: other names, spelling slips, family words such as "corgi" |
| `js/core/photos.js` | Which photos a breed shows, and their credits |
| `js/text.js` | Every word the page shows, in English |
| `data/breeds.js` | The breeds, groups, look-alikes and crosses: names, notes, facts, and each breed's checked photos with their credits |
| `language.js` | Languages: picks one (a `?lang=` link, the one picked before, the browser's), the menu, and the text in it |
| `progress.js` | Saves progress in the browser (localStorage) |

## Licences and credits

- **Code**: MIT, see [LICENSE](LICENSE). The breed notes and the look-alike tells were written for this tool and are under the same licence.
- **Photos** are not in this repository: each one is shown straight from Wikimedia Commons or Flickr, under its own free licence (mostly CC BY and CC BY-SA, some CC0 or public domain), and credited to its author on the page. The author, licence and page of every photo are in `data/breeds.js`.
- **FCI numbers**: [paiv/fci-breeds](https://github.com/paiv/fci-breeds) (MIT), see [licenses/fci-breeds.txt](licenses/fci-breeds.txt). **Each breed's Wikidata photo**: the [dog-breeds](https://www.npmjs.com/package/dog-breeds) package (MIT), see [licenses/dog-breeds.txt](licenses/dog-breeds.txt). **AKC ranks**: the AKC's 2025 popularity ranking (akc.org).

## Updates and feedback

This repository is copied automatically from [samplesize1.com](https://samplesize1.com/tools/) whenever the tool changes, so edits made directly here would be overwritten. Spotted a wrong photo, a missing breed or a bug? [Open an issue](https://github.com/SampleSize1/Dog-Breeds/issues).
