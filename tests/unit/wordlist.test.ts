import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORDLIST_SIZE, loadWordlist } from "../../src/core/wordlist.ts";

const SOURCE = "src/data/eff_large_wordlist.txt";
const SHA256 = "addd35536511597a02fa0a9ff1e5284677b8883b83e986e43f15a3db996b903e";

describe("EFF large wordlist", () => {
  const bytes = readFileSync(SOURCE);
  const text = bytes.toString("utf8");

  it("is the verbatim EFF file", () => {
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(SHA256);
    expect(text).not.toContain("\r");
    const lines = text.split("\n");
    expect(lines.pop()).toBe("");
    expect(lines).toHaveLength(7776);
    for (const line of lines) expect(line).toMatch(/^[1-6]{5}\t[a-z-]+$/);
  });

  it("ships exactly the file's 7,776 unique words, in order, without dice indices", async () => {
    const expected = text
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => line.split("\t")[1]);
    const words = await loadWordlist();
    expect(WORDLIST_SIZE).toBe(7776);
    expect(words).toHaveLength(7776);
    expect(new Set(words).size).toBe(7776);
    expect([...words]).toEqual(expected);
    expect(words[0]).toBe("abacus");
    expect(words.at(-1)).toBe("zoom");
    expect(words.filter((word) => word.includes("-"))).toEqual(["drop-down", "felt-tip", "t-shirt", "yo-yo"]);
    for (const word of words) expect(word).not.toMatch(/[0-9\t]/);
  });

  it("loads once and hands back a frozen list", async () => {
    const first = await loadWordlist();
    expect(await loadWordlist()).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
  });
});
