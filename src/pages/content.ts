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
      "No. Everything runs in your browser and nothing is sent, saved or logged. The only outside request is the optional breach check, which sends five characters of a hash.",
  },
  {
    question: "How can I check that for myself?",
    answer:
      'Open developer tools, choose the Network tab, and use the tools: no requests appear. Or go offline after one visit; it keeps working. The <a href="/how-it-works#network">network counter</a> shows the same live.',
  },
  {
    question: "Does it work offline?",
    answer:
      "Yes, after your first visit. Only the breach check needs a connection.",
  },
  {
    question: "Is the breach check private?",
    answer:
      'Yes. Only the first five characters of the password\'s SHA-1 hash are sent, and your device finds the match itself. <a href="/how-it-works#breach">How it works</a>.',
  },
  {
    question: "What can't SecurePass protect against?",
    answer:
      "Anything already on your device or watching your screen: malicious extensions, malware, clipboard history or sync, or someone looking over your shoulder. That's why you can hide the password.",
  },
  {
    question: "Why does the checker rate a long password as weak?",
    answer:
      "Length only helps when it's unpredictable. Common words, names, dates, keyboard runs like qwerty and swaps like @ for a are tried first, so a long password made of them can fall in seconds.",
  },
  {
    question: "Should I use a password or a passphrase?",
    answer:
      "Both are strong when random. Passwords suit a password manager; six or more random words are easier to type and remember, like your password manager's own password.",
  },
  {
    question: "How random is it?",
    answer:
      "Every character comes from <code>crypto.getRandomValues</code>, the browser's cryptographic random generator, with no bias: every password is equally likely.",
  },
  {
    question: "Is it really free?",
    answer:
      'Yes. No ads, accounts or tracking, and the <a href="https://github.com/Moose-Ltd/securepass.dev">source code</a> is MIT licensed.',
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
      "Length matters most. Twenty characters from all four sets give about 131 bits: longer than the universe has existed to guess, even at three trillion tries a second.",
      "Use one per account, in a password manager. If a site rejects some symbols, leave them out rather than shortening it.",
    ],
  },
  passphrase: {
    heading: "Why random words work",
    body: [
      "Each word comes at random from the EFF's list of 7,776, adding about 12.9 bits. Six words give 77.5 bits; seven give 90.5.",
      "Let the generator choose. Words people pick are the first ones cracking tools try.",
    ],
  },
  pin: {
    heading: "When a PIN is enough",
    body: [
      "Six digits are only a million options, so use a PIN only where wrong guesses lock you out, like a phone or bank card.",
      "Skip birthdays, repeats and patterns like 123456: they're tried first.",
    ],
  },
  check: {
    heading: "How the strength check works",
    body: [
      "zxcvbn, the estimator first built at Dropbox, runs in your browser. It finds the patterns cracking tools try first and counts the guesses they take.",
      "Long, patternless runs count as random, so generated passwords get full credit and familiar ones don't.",
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
