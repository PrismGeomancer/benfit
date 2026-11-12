import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '..', '..');
import { config } from '../../src/config';
export const dataPath = (...p: string[]) => resolve(root, 'data', config.dataDir, ...p);

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

export async function getJson<T>(url: string, init?: RequestInit, tries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { ...init, headers: { accept: 'application/json', ...(init?.headers ?? {}) } });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && i < tries - 1) {
      await sleep(5000 * (i + 1));
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function env(name: string, required = false): string {
  const v = process.env[name] ?? '';
  if (required && !v) throw new Error(`Missing env ${name}`);
  return v;
}
