# Third-party notices

SecurePass's own code is MIT licensed (see [LICENSE](LICENSE)). It includes or depends on the following works, each under its own license.

## Vault icon

- **Work:** "Security" icon by Vectors Tank
- **Source:** <https://www.flaticon.com/free-icon/security_10192506>
- **License:** [Flaticon license](https://www.flaticon.com/legal), free with attribution
- **Attribution on the site:** "Security icons created by Vectors Tank - Flaticon", linked to <https://www.flaticon.com/free-icons/security>
- **Files:**
  - `src/assets/brand/vault-512.png`
  - the favicons, app icons, logo and preview images in `public/`, which are rendered from that file

The icon is not covered by the MIT license.

## EFF Long Wordlist

- **Work:** EFF Long Wordlist by the Electronic Frontier Foundation
- **Source:** <https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases>
- **License:** [Creative Commons Attribution 3.0 United States](https://creativecommons.org/licenses/by/3.0/us/)
- **Files:** `src/data/eff_large_wordlist.txt` is included without modification. Its SHA-256 is `addd35536511597a02fa0a9ff1e5284677b8883b83e986e43f15a3db996b903e`.
- **Changes:** the build strips the dice-roll numbers and ships only the words.

## zxcvbn-ts

- **Packages:** `@zxcvbn-ts/core`, `@zxcvbn-ts/language-common` and `@zxcvbn-ts/language-en`
- **Source:** <https://github.com/zxcvbn-ts/zxcvbn>
- **License:** MIT, copyright the zxcvbn-ts contributors. The original zxcvbn is copyright Dropbox, Inc.
- **Bundled data:**
  - the `passwords`, `adjacencyGraphs` and `diceware` dictionaries;
  - the English `commonWords` and `firstnames` dictionaries and translations.

## Fonts

- **Instrument Sans:** copyright 2022 The Instrument Sans Project Authors. [SIL Open Font License 1.1](src/assets/fonts/OFL-instrument-sans.txt).
- **JetBrains Mono:** copyright 2020 The JetBrains Mono Project Authors. [SIL Open Font License 1.1](src/assets/fonts/OFL-jetbrains-mono.txt).
- **Files:** only the Latin variable-weight subsets in `src/assets/fonts/` are included.

## Have I Been Pwned

The optional breach check queries the [Pwned Passwords](https://haveibeenpwned.com/Passwords) range API by Troy Hunt. It has no licensing or attribution requirements, and SecurePass credits it on the site anyway.
