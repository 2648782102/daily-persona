import http from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadCatalog } from './catalog.js';
import { resolveForDate, zonedDate } from './resolve.js';
import { PROTOCOL_VERSION, handleMcpRequest } from './mcp.js';

const MAX_BODY_BYTES = 64 * 1024;
const HOST = process.env.DAILY_PERSONA_HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.DAILY_PERSONA_PORT || '3399', 10);
const ORIGIN_ALLOWLIST = (process.env.DAILY_PERSONA_ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function jsonResult(status, payload, headers = {}) {
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
    body,
  };
}

function emptyResult(status, headers = {}) {
  return { status, headers, body: '' };
}

function headerValue(headers, name) {
  const key = name.toLowerCase();
  for (const [headerName, value] of Object.entries(headers)) {
    if (headerName.toLowerCase() === key) {
      return value;
    }
  }
  return undefined;
}

function normalizedHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function etag(payload) {
  return `"${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24)}"`;
}

function conditionalJson(request, status, payload, ttlSeconds) {
  const tag = etag(payload);
  const headers = {
    ETag: tag,
    'Cache-Control': ttlSeconds === 0 ? 'no-store' : `public, max-age=${ttlSeconds}`,
  };
  if (headerValue(request.headers, 'if-none-match') === tag) {
    return emptyResult(304, headers);
  }
  return jsonResult(status, payload, headers);
}

function secondsUntilTomorrow(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const elapsed = Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second);
  return Math.max(1, 86_400 - elapsed);
}

function checkOrigin(request) {
  const origin = headerValue(request.headers, 'origin');
  if (!origin) {
    return true;
  }
  if (ORIGIN_ALLOWLIST.length === 0) {
    return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
  }
  return ORIGIN_ALLOWLIST.includes(origin);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function protocolHttpStatus(error) {
  if (error?.code === -32022 || error?.code === -32020 || error?.code === -32602) {
    return 400;
  }
  if (error?.code === -32601) {
    return 404;
  }
  return 200;
}

function restResult(request, url, catalog, now) {
  const date = url.searchParams.get('date') ?? undefined;
  const timezone = url.searchParams.get('timezone') ?? catalog.timezone;

  if (url.pathname === '/health') {
    return conditionalJson(request, 200, {
      ok: true,
      service: 'daily-persona',
      protocolVersion: PROTOCOL_VERSION,
      date: zonedDate(now, catalog.timezone),
    }, 0);
  }

  if (url.pathname === '/v1/catalog.json') {
    const payload = {
      version: catalog.version,
      digest: catalog.digest,
      seed: catalog.seed,
      timezone: catalog.timezone,
      rotation: catalog.rotation,
      contract: catalog.contract,
      personas: catalog.personas.map(({ id, label, summary, focus, forbidden }) => ({
        id,
        label,
        summary,
        focus,
        forbidden,
      })),
    };
    return conditionalJson(request, 200, payload, 3600);
  }

  if (url.pathname === '/v1/today.json') {
    const payload = resolveForDate(catalog, { date, timezone, now });
    const ttl = date ? 3600 : secondsUntilTomorrow(now, timezone);
    return conditionalJson(request, 200, payload, ttl);
  }

  if (url.pathname === '/v1/resolve') {
    if (!date) {
      return jsonResult(400, { error: 'date query parameter is required' });
    }
    const payload = resolveForDate(catalog, {
      date,
      timezone,
      seed: url.searchParams.get('seed') ?? undefined,
      version: url.searchParams.get('version') ?? undefined,
    });
    return conditionalJson(request, 200, payload, 3600);
  }

  return jsonResult(404, { error: 'not found' });
}

async function mcpResult(request, body, catalog) {
  if (!checkOrigin(request)) {
    return jsonResult(403, {
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Forbidden origin' },
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return jsonResult(400, {
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' },
    });
  }

  if (parsed.id === undefined) {
    return emptyResult(202);
  }

  const result = await handleMcpRequest(parsed, {
    catalogPath: catalog.source,
    httpHeaders: normalizedHeaders(request.headers),
  });
  return jsonResult(result.error ? protocolHttpStatus(result.error) : 200, result);
}

export async function handleHttpRequest(request, options = {}) {
  const catalog = options.catalog ?? await loadCatalog();
  const url = new URL(request.url, `http://${headerValue(request.headers, 'host') || 'localhost'}`);
  const now = options.now ?? new Date();
  const body = typeof request.body === 'string' ? request.body : '';

  if (request.method === 'GET' && url.pathname !== '/mcp') {
    return restResult(request, url, catalog, now);
  }

  if (request.method === 'POST' && url.pathname === '/mcp') {
    return mcpResult(request, body, catalog);
  }

  return jsonResult(405, { error: 'method not allowed' }, { Allow: 'GET, POST' });
}

function sendHttpResult(response, result) {
  response.writeHead(result.status, result.headers);
  response.end(result.body);
}

export function createHttpServer() {
  return http.createServer(async (request, response) => {
    try {
      const catalog = await loadCatalog();
      const body = request.method === 'POST' ? await readBody(request) : '';
      const result = await handleHttpRequest({
        method: request.method,
        url: request.url,
        headers: normalizedHeaders(request.headers),
        body,
      }, { catalog });
      sendHttpResult(response, result);
    } catch (error) {
      if (!response.headersSent) {
        sendHttpResult(response, jsonResult(400, { error: error.message }));
      }
    }
  });
}

const server = createHttpServer();
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  server.listen(PORT, HOST, () => {
    process.stderr.write(`daily-persona listening on http://${HOST}:${PORT}\n`);
  });
}

export { server };
