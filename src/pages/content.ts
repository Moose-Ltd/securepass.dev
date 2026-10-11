// Prose that appears on the pages and, for the FAQ, in the structured data. Values here are trusted,
// author-written HTML fragments (links and emphasis only); the renderer escapes everything else.

import type { Mode } from "./routes.ts";

export interface FaqItem {
  question: string;
  /** HTML fragment. Its text (tags stripped) becomes the FAQPage answer. */
  answer: string;
}

export const FAQ: readonly FaqItem[] = [
  {
    question: "Does SecurePass send or store my passwords?",
    answer:
      "No. Passwords are generated and analysed by code running in your browser, and they are never sent, saved or logged. The page's security policy only allows network requests to SecurePass itself and, if you press the button, the breach-check service. Even then only five characters of a hash leave your device.",
  },
  {
    question: "How can I check that for myself?",
    answer:
      'Open your browser\'s developer tools, choose the Network tab, and use the generator and strength checker. No requests appear. You can also turn on airplane mode after your first visit: SecurePass keeps working because it runs entirely on your device. The <a href="#network">network counter</a> on this page shows the same thing live.',
  },
  {
    question: "Does it work offline?",
    answer:
      "Yes. After your first visit a service worker keeps a copy of every page, script and wordlist on your device, so SecurePass loads and works without a connection. Only the optional breach check needs the internet.",
  },
  {
    question: "Is the breach check private?",
    answer:
      'Yes. It uses k-anonymity: your device hashes the password with SHA-1 and sends only the first five of its forty characters to Have I Been Pwned. The reply lists every breached hash that starts with those characters, padded with decoys, and your device looks for a match itself. <a href="#breach">See how it works</a>.',
  },
  {
    question: "What can't SecurePass protect against?",
    answer:
      "Anything that already has access to your device or screen. A malicious browser extension can read any page you open. Malware can read your keyboard and clipboard. Clipboard history and sync features, such as Windows clipboard history or Apple's Universal Clipboard, may keep or share a copy of anything you copy. And someone looking over your shoulder can read your screen, which is why you can hide the generated password.",
  },
  {
    question: "Why does the checker rate a long password as weak?",
    answer:
      "Length only helps if the characters are unpredictable. The strength checker looks for the patterns that cracking tools try first: common passwords, dictionary words, names, dates, keyboard runs like qwerty, repeats and predictable substitutions like @ for a. A long password built from those patterns can fall in seconds.",
  },
  {
    question: "Should I use a password or a passphrase?",
    answer:
      "Both are strong when they are random and long enough. A random password packs more strength into fewer characters, which suits a password manager. A passphrase of six or more random words is far easier to type and remember, which suits the few passwords you type by hand, like your password manager's own.",
  },
  {
    question: "How random is it?",
    answer:
      "Every character and word comes from <code>crypto.getRandomValues</code>, your browser's cryptographically secure random number generator, the same source browsers use for encryption keys. SecurePass discards any random number that would make some characters more likely than others, so every possible password is equally likely.",
  },
  {
    question: "Is it really free?",
    answer:
      'Yes, with no ads, accounts or tracking. SecurePass is a set of static files, which cost nothing to serve, and the <a href="https://github.com/Moose-Ltd/securepass.dev">source code</a> is open under the MIT license.',
  },
];

export interface Guide {
  heading: string;
  /** HTML paragraphs. */
  body: readonly string[];
}

/** One short page-specific guide below each tool, so every URL carries its own useful content. */
export const GUIDES: Record<Mode, Guide> = {
  password: {
    heading: "What makes a generated password strong",
    body: [
      "Strength comes from how many passwords your settings could have produced, and that grows fastest with length. Twenty characters from all four character sets give about 131 bits of entropy. Guessing that at three trillion attempts a second would take far longer than the universe has existed.",
      "Use a different password for every account and keep them in a password manager. If a site limits which symbols it accepts, leave those characters out rather than shortening the password.",
    ],
  },
  passphrase: {
    heading: "Why random words work",
    body: [
      "Each word is picked at random from the Electronic Frontier Foundation's list of 7,776 short, distinct words, so every word adds about 12.9 bits of entropy. Six words give about 77.5 bits, and seven give about 90.5.",
      "The words must be chosen by a random generator, not by you. People pick predictable words and phrases, and cracking tools are built around exactly those choices.",
    ],
  },
  pin: {
    heading: "When a PIN is enough",
    body: [
      "A six-digit PIN has only a million possibilities, so it is safe only where the device or service locks or slows down after a few wrong guesses, like a phone, a bank card or a door keypad.",
      "Avoid PINs you might choose yourself, like birthdays, repeated digits or patterns such as 123456. Those are the first ones an attacker tries.",
    ],
  },
  check: {
    heading: "How the strength check works",
    body: [
      "The checker runs zxcvbn, the open-source estimator first built at Dropbox, entirely in your browser. It breaks your password into the patterns cracking tools try first and estimates how many guesses an attacker would need.",
      "Long runs of characters with no recognisable pattern are priced as truly random, so a password from a generator is rated as strong as it is. Short or familiar strings get no such credit.",
    ],
  },
};

export const CREDITS: readonly { label: string; html: string }[] = [
  {
    label: "Icon",
    html: '<a href="https://www.flaticon.com/free-icons/security" title="security icons">Security icons created by Vectors Tank - Flaticon</a>',
  },
  {
    label: "Wordlist",
    html: '<a href="https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases">EFF Long Wordlist</a> by the Electronic Frontier Foundation, <a href="https://creativecommons.org/licenses/by/3.0/us/">CC BY 3.0 US</a>',
  },
  { label: "Breach data", html: '<a href="https://haveibeenpwned.com/Passwords">Have I Been Pwned</a> Pwned Passwords' },
  { label: "Strength estimates", html: '<a href="https://github.com/zxcvbn-ts/zxcvbn">zxcvbn-ts</a> (MIT)' },
  {
    label: "Fonts",
    html: '<a href="https://github.com/Instrument/instrument-sans">Instrument Sans</a> and <a href="https://www.jetbrains.com/lp/mono/">JetBrains Mono</a> (SIL OFL)',
  },
];
