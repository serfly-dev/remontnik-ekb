const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const { chromium, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const question = { key: 'finish', question: 'Отделка стен', type: 'single', answers: [
  { label: 'Обои', pricing_type: 'per_m2', price: 100, quantity_source: 'area' },
  { label: 'Покраска', pricing_type: 'per_m2', price: 200, quantity_source: 'area' }
] };
const config = { scenarios: [
  { key: 'flat', name: 'Квартира', area_min: 10, area_max: 500, questions: [question] },
  { key: 'empty', name: 'Не заполнен в CMS', questions: [] }
] };
const sections = { success: true, data: [
  { key: 'hero', content: { title: 'Ремонт квартиры', subtitle: 'В Екатеринбурге', cta_primary: 'Оставить заявку', cta_primary_href: '#application', image: '/images/master-photo.jpg' } },
  { key: 'calculator', content: config },
  { key: 'gallery', content: { title: 'Примеры работ', items: Array.from({ length: 5 }, () => ({ name: 'Квартира', before: '/images/master-photo.jpg', after: '/images/master-photo.jpg' })) } },
  { key: 'clientVideo', content: { title: 'Видео', items: [
    { name: 'Ремонт', video: '/img/video/1792473407270-42654cdc-d754-4cc7-a85f-f655a5788b7f.mp4' },
    { name: 'Второе видео', video: '/img/video/renovation-mobile-v1.mp4' }
  ] } },
  { key: 'faq', content: { title: 'Вопросы', questions: [{ question: 'Как заказать?', answer: 'Оставьте заявку' }, { question: 'Как связаться?', answer: 'Позвоните' }] } }
] };

for (const [name, type] of Object.entries({ chromium, webkit })) {
  test(`${name}: first load, failure recovery and mobile controls`, async (t) => {
    const app = express();
    app.use(express.static(path.join(root, 'public')));
    app.use('/css', express.static(path.join(root, 'css')));
    app.use('/js', express.static(path.join(root, 'js')));
    app.get('/api/sections', (req, res) => {
      res.type('json');
      res.flushHeaders();
      res.write('{');
      req.on('close', () => res.end());
    });
    app.get('/', (_, res) => res.sendFile(path.join(root, 'index.html')));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const browser = await type.launch({ headless: true });
    t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); });
    const base = `http://127.0.0.1:${server.address().port}`;

    async function pageFor(handler, options = {}) {
      const context = await browser.newContext({ viewport: { width: options.width || 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: options.reducedMotion || 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      if (options.blockGsap) await page.route('**/js/vendor/*', r => r.abort());
      if (options.blockPricing) await page.route('**/js/calculator-pricing.js*', r => r.abort());
      if (options.blockStorage) await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage unavailable', 'SecurityError'); } }));
      await page.route('**/api/sections', handler);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      return { page, context, errors };
    }
    const good = route => route.fulfill({ json: sections });
    async function ready(page) { await page.waitForFunction(() => document.querySelector('#calculator').dataset.state === 'ready'); }
    async function fallback(page) {
      assert.match(await page.locator('#hero').innerText(), /Ремонт/);
      assert.ok(await page.locator('a[href="tel:+79502085138"]').count());
      await page.waitForFunction(() => document.querySelector('#calculator').dataset.state === 'error', null, { timeout: 22000 });
      assert.equal(await page.locator('#calcNext').isDisabled(), true);
      assert.match(await page.locator('#calcLoadStatus').innerText(), /Не удалось/);
      assert.equal(await page.locator('#calcQuestions .calc__field').count(), 0);
    }

    await t.test('API outage keeps content and shows an actionable error', async () => {
      const { page, context, errors } = await pageFor(r => r.abort());
      await fallback(page);
      assert.deepEqual(errors, []);
      await context.close();
    });
    await t.test('timeout also aborts an unfinished JSON body after two attempts', async () => {
      let requests = 0;
      const start = Date.now();
      const { page, context, errors } = await pageFor(r => { requests++; return r.continue(); });
      await fallback(page);
      assert.equal(requests, 2);
      assert.ok(Date.now() - start >= 16000);
      assert.ok(Date.now() - start < 22000);
      assert.deepEqual(errors, []);
      await context.close();
    });
    await t.test('slow data keeps controls disabled; helper failure gives an error', async () => {
      const { page, context, errors } = await pageFor(async r => { await new Promise(resolve => setTimeout(resolve, 1200)); await good(r); });
      assert.equal(await page.locator('#calcNext').isDisabled(), true);
      assert.match(await page.locator('#hero').innerText(), /Ремонт/);
      await ready(page);
      assert.deepEqual(errors, []);
      await context.close();
      const missing = await pageFor(good, { blockPricing: true });
      await fallback(missing.page);
      assert.deepEqual(missing.errors, []);
      await missing.context.close();
    });
    await t.test('ten fresh contexts initialise without a race', async () => {
      for (let i = 0; i < 10; i++) {
        const { page, context, errors } = await pageFor(good);
        await ready(page);
        assert.equal(await page.locator('#calcNext').isEnabled(), true);
        assert.ok(await page.locator('#calcQuestions input').count() > 0);
        assert.deepEqual(errors, []);
        await context.close();
      }
    });
    await t.test('500 retries once; manual recovery does not reset answers', async () => {
      let requests = 0;
      const { page, context, errors } = await pageFor(r => { requests++; return r.fulfill({ status: 500, body: 'failure' }); });
      await fallback(page);
      assert.equal(requests, 2);
      await page.unroute('**/api/sections');
      await page.route('**/api/sections', good);
      await page.locator('#calcRetry').click();
      await ready(page);
      await page.locator('#calcQuestions .calc__option').first().click();
      await page.evaluate(() => document.dispatchEvent(new CustomEvent('calculatorConfigLoaded', { detail: window.SECTION_CALCULATOR })));
      assert.equal(await page.locator('#calcQuestions input').first().isChecked(), true);
      assert.deepEqual(errors, []);
      await context.close();
    });
    await t.test('malformed JSON and absent configuration never invent prices', async () => {
      for (const response of [{ body: '{broken', contentType: 'application/json' }, { json: { success: true, data: [] } }, { json: { success: true, data: [{ key: 'calculator', content: {} }] } }]) {
        const { page, context, errors } = await pageFor(r => r.fulfill(response));
        await fallback(page);
        assert.deepEqual(errors, []);
        await context.close();
      }
    });
    await t.test('one malformed section does not stop calculator or fallback content', async () => {
      const damaged = { success: true, data: [null, { key: 'hero', content: {} },
        { key: 'services', content: { title: 'Услуги', items: [null] } },
        { key: 'calculator', content: config }] };
      const { page, context, errors } = await pageFor(r => r.fulfill({ json: damaged }));
      await ready(page);
      assert.match(await page.locator('#hero').innerText(), /Ремонт/);
      assert.match(await page.locator('#services').innerText(), /Чем могу помочь/);
      assert.deepEqual(errors, []);
      await context.close();
    });
    await t.test('missing motion libraries and denied storage keep controls working', async () => {
      for (const width of [320, 360, 390, 430, 768]) {
        const { page, context, errors } = await pageFor(good, { width, blockGsap: true, blockStorage: true });
        await ready(page);
        await page.locator('#burger').click();
        assert.equal(await page.locator('#burger').getAttribute('aria-expanded'), 'true');
        await page.locator('#mobileClose').click();
        assert.equal(await page.locator('#burger').getAttribute('aria-expanded'), 'false');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
        await page.locator('#accordion summary').nth(1).click();
        assert.equal(await page.locator('#accordion details').nth(1).getAttribute('open'), '');
        await page.locator('#gallery .gallery__toggle-button').click();
        assert.equal(await page.locator('#gallery-more').isVisible(), true);
        await page.locator('#clientVideo').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('.cv-item').first().getAttribute('data-active'), 'true');
        await page.locator('.video-carousel__arrow--next').click();
        assert.equal(await page.locator('.cv-item').nth(1).getAttribute('data-active'), 'true');
        assert.deepEqual(errors, []);
        await context.close();
      }
    });
    await t.test('calculator result, consent and application payload work on mobile', async () => {
      const { page, context, errors } = await pageFor(good);
      await ready(page);
      await page.locator('#cookieAcceptBtn').click();
      await page.locator('#calcQuestions .calc__option').first().click();
      await page.locator('#calcNext').click();
      await page.waitForFunction(() => !document.querySelector('#calcAreaField').hidden);
      await page.locator('#calcArea').fill('50');
      await page.locator('#calcNext').click();
      assert.match(await page.locator('#calcResultValue').innerText(), /5\s*000/);
      const snapshot = await page.locator('#formCalculatorData').inputValue();
      assert.equal(JSON.parse(snapshot).calculatedPrice, 5000);
      let payload;
      await page.route('**/api/applications', r => { payload = r.request().postDataJSON(); return r.fulfill({ status: 201, json: { success: true, data: { id: 1 } } }); });
      await page.locator('#applicationForm input[name="name"]').fill('Проверка');
      for (const phone of ['9991234567', '89991234567', '+7 (999) 123-45-67']) {
        await page.locator('#applicationForm input[name="phone"]').fill(phone);
        assert.equal(await page.locator('#applicationForm input[name="phone"]').inputValue(), '+7 (999) 123-45-67');
      }
      await page.locator('#applicationForm select').selectOption('anytime');
      await page.locator('#applicationForm input[name="agreePolicy"]').check({ force: true });
      await page.locator('#applicationForm button[type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('#formStatus').classList.contains('form__status--success'));
      assert.equal(payload.agree_policy, 1);
      assert.equal(payload.calculated_price, 5000);
      assert.deepEqual(errors, []);
      await context.close();
    });
    await t.test('video requests start on click and failed playback can be retried', async () => {
      let requests = 0;
      const { page, context, errors } = await pageFor(good);
      await page.route('**/*.mp4', r => { requests++; return r.abort(); });
      await ready(page);
      await page.locator('#cookieAcceptBtn').click();
      await page.locator('#clientVideo').scrollIntoViewIfNeeded();
      assert.equal(requests, 0);
      await page.locator('.cv-play').first().click();
      await page.locator('.cv-error').first().waitFor({ state: 'visible' });
      assert.ok(requests > 0);
      assert.equal(await page.locator('.cv-play').first().getAttribute('aria-pressed'), 'false');
      assert.deepEqual(errors, []);
      await context.close();
    });
  });
}
