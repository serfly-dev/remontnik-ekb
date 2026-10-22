const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const express = require('express');
const sharp = require('sharp');
const { chromium, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');

async function listen(app) {
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const sections = {
  success: true,
  data: [
    { key: 'hero', content: { title: 'Ремонт квартиры', subtitle: 'Екатеринбург', image: '/img/missing-hero.webp', imageAlt: 'Фото квартиры' } },
    { key: 'calculator', content: { scenarios: [{ key: 'flat', name: 'Квартира', questions: [{ key: 'finish', question: 'Отделка', type: 'single', answers: [{ label: 'Вариант', price: 100 }] }] }] } }
  ]
};

for (const [name, engine] of Object.entries({ chromium, webkit })) {
  test(`${name}: responsive regressions from the audit are fixed`, async t => {
    const app = express();
    app.use(express.static(path.join(root, 'public')));
    app.use('/css', express.static(path.join(root, 'css')));
    app.use('/js', express.static(path.join(root, 'js')));
    app.use('/admin/css', express.static(path.join(root, 'admin', 'css')));
    app.get('/api/sections', (_, res) => res.json(sections));
    app.get('/', (_, res) => res.sendFile(path.join(root, 'index.html')));
    const { server, base } = await listen(app);
    const browser = await engine.launch({ headless: true });
    t.after(async () => {
      await browser.close();
      await new Promise(resolve => server.close(resolve));
    });

    await t.test('a missing CMS hero image falls back to the bundled image', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#hero .hero__visual img').waitFor();
      await page.waitForTimeout(350);
      const image = await page.locator('#hero .hero__visual img').evaluate(img => ({ src: new URL(img.src).pathname, width: img.naturalWidth }));
      assert.ok(image.width > 0, 'hero image should decode after the CMS URL fails');
      assert.match(image.src, /hero-mobile-v1\.webp$/);
      await page.close();
    });

    await t.test('mobile menu keeps its CTA above the cookie banner', async () => {
      for (const [width, height] of [[320, 568], [390, 844]]) {
        const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.locator('#cookieBanner:not([hidden])').waitFor();
        await page.locator('#burger').click();
        await page.waitForTimeout(250);
        await page.locator('#mobileNavLinks').evaluate(el => { el.scrollTop = el.scrollHeight; });
        const boxes = await page.evaluate(() => {
          const rect = selector => {
            const { top, bottom } = document.querySelector(selector).getBoundingClientRect();
            return { top, bottom };
          };
          const nav = document.querySelector('#mobileNavLinks');
          return { cta: rect('.mobile-menu__cta'), cookie: rect('#cookieBanner'), menu: rect('#mobileMenu'), close: rect('#mobileClose'), navScrollTop: nav.scrollTop, navScrollHeight: nav.scrollHeight, navClientHeight: nav.clientHeight };
        });
        assert.ok(boxes.cta.bottom <= boxes.cookie.top + 1, `CTA overlaps cookie banner at ${width}px: ${JSON.stringify(boxes)}`);
        assert.ok(boxes.close.top >= boxes.menu.top && boxes.close.bottom <= boxes.menu.bottom, `close button left the menu viewport at ${width}px`);
        if (width === 320) assert.ok(boxes.navScrollTop > 0 && boxes.navScrollHeight > boxes.navClientHeight, 'mobile navigation should scroll inside its panel');
        await page.locator('#mobileClose').click();
        assert.equal(await page.locator('#burger').getAttribute('aria-expanded'), 'false');
        await page.close();
      }
    });

    await t.test('mobile menu close control meets the 44px touch target', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const size = await page.locator('#mobileClose').evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
      assert.ok(size.width >= 44 && size.height >= 44, `expected at least 44×44px, got ${size.width}×${size.height}`);
      await page.close();
    });

    await t.test('image upload field does not widen the admin at phone widths', async () => {
      for (const width of [320, 360, 390, 430]) {
        const page = await browser.newPage({ viewport: { width, height: 700 } });
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="/admin/css/admin.css"></head><body>
          <main class="container"><div class="section-editor" style="display:block"><div class="section-editor__image-row">
            <div class="section-editor__image-preview"></div><input type="hidden">
            <div class="section-editor__image-controls"><input class="section-editor__file-input" type="file"></div>
          </div></div></main></body></html>`);
        await page.waitForTimeout(100);
        const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
        assert.ok(size.document <= size.viewport, `document width ${size.document}px exceeds ${width}px viewport`);
        await page.close();
      }
    });
  });
}

test('versioned CSS receives long immutable caching; stable CSS stays short-lived', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nachatkin-cache-test-'));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, [path.join(root, 'server', 'server.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DB_PATH: path.join(directory, 'audit.sqlite'), SESSION_SECRET: 'test-only-session-secret', ADMIN_USERNAME: 'audit', ADMIN_PASSWORD: 'test-only-password', NODE_ENV: 'test' },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  t.after(async () => {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });

  let response;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/css/style.css?v=10`);
      break;
    } catch (_) {
      if (child.exitCode !== null) throw new Error(`server exited: ${stderr}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(response, `server did not start: ${stderr}`);
  assert.match(response.headers.get('cache-control') || '', /max-age=31536000.*immutable/, 'versioned CSS should be immutable for one year');
  const stable = await fetch(`http://127.0.0.1:${port}/css/style.css`);
  assert.match(stable.headers.get('cache-control') || '', /max-age=3600/, 'unversioned CSS should retain the short cache');
});

test('optimized logo keeps its alpha channel and replaces both PNG references', async () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const logoPath = path.join(root, 'public', 'images', 'logo_orange-green-v1.webp');
  const metadata = await sharp(logoPath).metadata();
  assert.equal(metadata.hasAlpha, true);
  assert.ok(metadata.width >= 280 && metadata.height >= 190, 'logo should remain sharp at high-density screens');
  assert.ok(fs.statSync(logoPath).size < fs.statSync(path.join(root, 'public', 'images', 'logo_orange-green.png')).size / 2);
  assert.equal((index.match(/logo_orange-green-v1\.webp/g) || []).length, 2, 'header and structured data should use the optimized logo');
});

test('admin title uses the correct Russian spelling', () => {
  const admin = fs.readFileSync(path.join(root, 'admin', 'index.html'), 'utf8');
  assert.match(admin, /<title>Панель управления — CMS<\/title>/);
});
