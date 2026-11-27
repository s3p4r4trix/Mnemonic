import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseArgs(argv) {
  let url = null;
  let screenshotsDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) url = argv[++i];
    else if (argv[i] === '--screenshots-dir' && argv[i + 1]) screenshotsDir = argv[++i];
  }
  return { url, screenshotsDir };
}

export function findChromeBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const candidates = [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ];
  for (const bin of candidates) {
    if (spawnSync('which', [bin], { stdio: 'ignore' }).status === 0) {
      return bin;
    }
  }
  return candidates[0];
}

export function startStaticServer(rootDir) {
  if (!existsSync(join(rootDir, 'index.html'))) {
    throw new Error(`Built app not found at ${rootDir}. Run "npm run build" first or pass --url.`);
  }
  return new Promise((resolveServer, reject) => {
    const server = createServer((req, res) => {
      const cleanPath = (req.url || '/').split('?')[0];
      const relPath = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
      const fullPath = resolve(rootDir, relPath);
      if (!fullPath.startsWith(rootDir) || !existsSync(fullPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = extname(fullPath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(readFileSync(fullPath));
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolveServer({ server, url: `http://127.0.0.1:${addr.port}/` });
    });
  });
}

export async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export async function waitForCdp(port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Chrome DevTools Protocol did not open on port ${port}`);
}

export async function pickFreePort() {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolvePort(port));
    });
  });
}

export class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.networkRequests = [];
    this.failedRequests = [];
    this.requestsById = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push(msg.params.exceptionDetails.text);
      } else if (msg.method === 'Network.requestWillBeSent') {
        const url = msg.params.request?.url || '';
        this.networkRequests.push(url);
        this.requestsById.set(msg.params.requestId, url);
      } else if (msg.method === 'Network.responseReceived') {
        const status = msg.params.response?.status ?? 0;
        const url = msg.params.response?.url || this.requestsById.get(msg.params.requestId) || '';
        if (status >= 400) {
          this.failedRequests.push({ url, status });
        }
      } else if (msg.method === 'Network.loadingFailed') {
        const url = this.requestsById.get(msg.params.requestId) || '';
        this.failedRequests.push({
          url,
          errorText: msg.params.errorText || 'loadingFailed',
        });
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression, { userGesture = false } = {}) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Runtime evaluation error');
    }
    return res.result.value;
  }

  async screenshot(dir, filename) {
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(dir, filename), Buffer.from(data, 'base64'));
  }
}

export async function waitForMessage(cdp, expectedSubstring, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const msg = await cdp.eval(`document.querySelector('.message')?.textContent?.trim() || ''`);
    if (msg.includes(expectedSubstring)) return msg;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for status message containing "${expectedSubstring}"`);
}

export async function setViewport(cdp, width, height, mobile) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
  });
  await sleep(120);
}
