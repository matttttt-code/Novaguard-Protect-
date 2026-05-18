import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../../data/global-word-blacklist.json");

let words: string[] = [];

function load() {
  try {
    if (fs.existsSync(DATA_PATH)) words = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  } catch { words = []; }
}

function save() {
  try {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(words, null, 2));
  } catch { /* ignore */ }
}

load();

export function getGlobalWordBlacklist(): string[] { return [...words]; }

export function addGlobalWord(word: string): boolean {
  const w = word.toLowerCase().trim();
  if (!w || words.includes(w)) return false;
  words.push(w);
  save();
  return true;
}

export function removeGlobalWord(word: string): boolean {
  const w = word.toLowerCase().trim();
  const idx = words.indexOf(w);
  if (idx === -1) return false;
  words.splice(idx, 1);
  save();
  return true;
}

export function isGloballyBlacklistedWord(text: string): boolean {
  if (words.length === 0) return false;
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w));
}
