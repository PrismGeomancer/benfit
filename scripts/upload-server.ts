// Local stand-in for server/upload-worker.ts, for the local test chain only.
// Same contract: POST /upload (image, name, symbol, description) -> { uri }.
// Files are stored in .localnet/uploads and served from http://127.0.0.1:8787.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { root } from './lib/io';

const PORT = Number(process.env.UPLOAD_PORT ?? 8787);
const dir = resolve(root, '.localnet', 'uploads');
mkdirSync(dir, { recursive: true });
const base = `http://127.0.0.1:${PORT}`;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'application/json': 'json' };

createServer(async (req, res) => {
  const send = (status: number, body: string | Buffer, type = 'application/json') => {
    res.writeHead(status, { ...CORS, 'content-type': type });
    res.end(body);
  };
  if (req.method === 'OPTIONS') return send(204, '');
  const path = (req.url ?? '/').split('?')[0];
  if (req.method === 'GET') {
    const file = resolve(dir, basename(path));
    if (!existsSync(file)) return send(404, '{}');
    const ext = file.split('.').pop()!;
    const type = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
    return send(200, readFileSync(file), type);
  }
  if (req.method !== 'POST' || path !== '/upload') return send(404, '{}');
  try {
    const r = new Request(base + path, {
      method: 'POST',
      headers: req.headers as Record<string, string>,
      body: Readable.toWeb(req) as unknown as BodyInit,
      duplex: 'half',
    } as RequestInit);
    const fd = await r.formData();
    const image = fd.get('image') as File | null;
    if (!image || !EXT[image.type] || image.size > 2 * 1024 * 1024) return send(400, '{"error":"image"}');
    const id = randomBytes(6).toString('hex');
    const imgName = `${id}.${EXT[image.type]}`;
    writeFileSync(resolve(dir, imgName), Buffer.from(await image.arrayBuffer()));
    const meta = {
      name: String(fd.get('name') ?? ''),
      symbol: String(fd.get('symbol') ?? ''),
      description: String(fd.get('description') ?? ''),
      image: `${base}/${imgName}`,
    };
    writeFileSync(resolve(dir, `${id}.json`), JSON.stringify(meta));
    send(200, JSON.stringify({ uri: `${base}/${id}.json`, image: meta.image }));
  } catch (e) {
    send(500, JSON.stringify({ error: (e as Error).message }));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`upload server on ${base}`));
