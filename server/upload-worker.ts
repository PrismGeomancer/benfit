// Launch metadata upload, as a Cloudflare Worker (free tier is enough).
//
// POST /upload  multipart: image (PNG/JPG/GIF, <= 2 MB), name, symbol, description
// -> pins the image and the token metadata JSON to IPFS via Pinata, returns { uri }.
//
// Deploy:
//   npx wrangler deploy server/upload-worker.ts --name benfit-upload --compatibility-date 2025-01-01
//   npx wrangler secret put PINATA_JWT --name benfit-upload        (Pinata: API keys -> JWT)
//   npx wrangler secret put ALLOWED_ORIGIN --name benfit-upload    (e.g. https://you.github.io)
// Then set metadata_upload_url for mainnet in src/config.ts to https://benfit-upload.<you>.workers.dev/upload
//
// The JWT stays in the Worker's secrets. It is never in the repo or the site.

interface Env {
  PINATA_JWT: string;
  ALLOWED_ORIGIN?: string;
  GATEWAY?: string; // defaults to https://gateway.pinata.cloud/ipfs/
}

const MAX = 2 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/gif'];

function cors(env: Env, origin: string | null) {
  const allow = !env.ALLOWED_ORIGIN || env.ALLOWED_ORIGIN === origin ? (origin ?? '*') : env.ALLOWED_ORIGIN;
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } });

async function pin(env: Env, file: Blob, name: string): Promise<string> {
  const fd = new FormData();
  fd.set('file', file, name);
  fd.set('pinataMetadata', JSON.stringify({ name }));
  const r = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.PINATA_JWT}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`pinata ${r.status}`);
  const { IpfsHash } = (await r.json()) as { IpfsHash: string };
  return (env.GATEWAY ?? 'https://gateway.pinata.cloud/ipfs/') + IpfsHash;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env, req.headers.get('origin'));
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    if (req.method !== 'POST' || url.pathname !== '/upload') return json({ error: 'not found' }, 404, h);
    if (env.ALLOWED_ORIGIN && req.headers.get('origin') !== env.ALLOWED_ORIGIN) return json({ error: 'origin' }, 403, h);

    let fd: FormData;
    try {
      fd = await req.formData();
    } catch {
      return json({ error: 'bad form' }, 400, h);
    }
    const image = fd.get('image');
    const name = String(fd.get('name') ?? '').trim().slice(0, 32);
    const symbol = String(fd.get('symbol') ?? '').trim().toUpperCase();
    const description = String(fd.get('description') ?? '').slice(0, 500);
    if (!(image instanceof File) || !TYPES.includes(image.type) || image.size > MAX) return json({ error: 'image' }, 400, h);
    if (!name || !/^[A-Z0-9]{2,10}$/.test(symbol)) return json({ error: 'fields' }, 400, h);

    try {
      const imageUrl = await pin(env, image, `${symbol}-image`);
      const meta = new Blob([JSON.stringify({ name, symbol, description, image: imageUrl })], { type: 'application/json' });
      const uri = await pin(env, meta, `${symbol}-metadata.json`);
      return json({ uri, image: imageUrl }, 200, h);
    } catch (e) {
      return json({ error: (e as Error).message }, 502, h);
    }
  },
};
