/**
 * Sections Inject — Loads section content from /api/sections and
 * renders full block HTML using innerHTML.
 * Each section's entire innerHTML is built from the API content JSON.
 */

(function () {
  'use strict';

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function formatPrice(value) {
    if (typeof value !== 'number') return '';
    return new Intl.NumberFormat('ru-RU').format(value);
  }

  // ---- HERO (id="hero") ----
  function renderHero(content) {
    const root = document.getElementById('hero');
    if (!root) return;

    const proofHtml = (Array.isArray(content.proof) ? content.proof : []).map(item => `
      <div class="hero__proof-item">
        <span class="hero__proof-num">${escapeHtml(item.num)}</span>
        <span class="hero__proof-label">${escapeHtml(item.label)}</span>
      </div>
    `).join('');

    const echoLayers = ['0.04em', '0.08em', '0.12em', '0.16em']
      .map((offset, i) => {
        return `<span class="echo__layer echo__layer--${i + 1}" aria-hidden="true" style="-webkit-text-stroke:${offset} var(--echo-${i + 1})">${escapeHtml(content.title)}</span>`;
      })
      .join('');

    root.innerHTML = `
      <div class="container">
        <div class="hero__grid">
          <div class="hero__copy">
            <p class="hero__eyebrow">${escapeHtml(content.eyebrow || '')}</p>
            <h1 class="hero__title" id="hero-title">
              <span class="echo">
                <span class="echo__base">${escapeHtml(content.title)}</span>
                ${echoLayers}
              </span>
            </h1>
            <p class="hero__sub">${escapeHtml(content.subtitle || '')}</p>
            <div class="hero__cta">
              <a href="${escapeHtml(content.cta_primary_href || '#')}" class="btn btn--primary">${escapeHtml(content.cta_primary || '')}</a>
              <a href="${escapeHtml(content.cta_secondary_href || '#')}" class="btn btn--ghost">${escapeHtml(content.cta_secondary || '')}</a>
            </div>
            <div class="hero__proof">
              ${proofHtml}
            </div>
          </div>
          <div class="hero__visual">
            <div class="hero__media" ${content.image ? `style="background-image:url('${escapeHtml(content.image)}')"` : ''}>
              <img src="${escapeHtml(content.image || '')}" alt="${escapeHtml(content.imageAlt || '')}" width="900" height="1100" loading="eager" decoding="async">
              <span class="hero__media__caption">${escapeHtml(content.imageCaption || '')}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ---- SERVICES (id="services") ----
  function renderServices(content) {
    const root = document.getElementById('services');
    if (!root) return;

    const itemsHtml = (Array.isArray(content.items) ? content.items : []).map(item => {
      const subItems = Array.isArray(item.items) ? item.items : [];
      return `
        <li class="service-row">
          <span class="service-row__num">${escapeHtml(item.num || '')}</span>
          <h3 class="service-row__title">${escapeHtml(item.title || '')}</h3>
          <p class="service-row__desc">${escapeHtml(item.desc || '')}</p>
          ${subItems.length > 0 ? `
            <ul class="service-row__items">
              ${subItems.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
            </ul>
          ` : ''}
          <span class="service-row__arrow" aria-hidden="true">→</span>
        </li>
      `;
    }).join('');

    root.innerHTML = `
      <div class="container">
        <div class="section-head">
          <h2 class="section-title" id="services-title">${escapeHtml(content.title || '')}</h2>
        </div>
        <ul class="services__index">
          ${itemsHtml}
        </ul>
      </div>
    `;
  }

  // ---- WORKS / PORTFOLIO (id="works") ----
  function renderPortfolio(content) {
    const root = document.getElementById('works');
    if (!root) return;

    const itemsHtml = (Array.isArray(content.items) ? content.items : []).map(item => {
      const tags = Array.isArray(item.tags) ? item.tags : [];
      return `
        <figure class="work work--${escapeHtml(item.type || 'std')}">
          <div class="work__media">
            <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.alt || item.title || '')}" width="600" height="750" loading="lazy" decoding="async">
          </div>
          <figcaption class="work__overlay">
            <div class="work__meta">${tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>
            <h3 class="work__title">${escapeHtml(item.title || '')}</h3>
          </figcaption>
        </figure>
      `;
    }).join('');

    const noteHtml = content.note ? `<p class="works__note">${escapeHtml(content.note)}</p>` : '';
    root.innerHTML = `
      <div class="container">
        <div class="section-head">
          <h2 class="section-title" id="works-title">${escapeHtml(content.title || '')}</h2>
          ${noteHtml}
        </div>
        <div class="works__grid">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  // ---- FORMATS / VARIANTS (id="formats") ----
  function renderVariants(content) {
    const root = document.getElementById('formats');
    if (!root) return;

    const o1 = content.option1 || {};
    const o2 = content.option2 || {};
    const compare = content.compare || {};

    const format1Html = `
      <div class="format">
        <span class="format__num">${escapeHtml(o1.num || '')}</span>
        <h3 class="format__title">${escapeHtml(o1.title || '')}</h3>
        <p class="format__desc">${escapeHtml(o1.desc || '')}</p>
        ${typeof o1.price === 'number' ? `<p class="format__price"><span class="format__price-num">${formatPrice(o1.price)}</span> <span class="format__price-cur">₽</span></p>` : ''}
        <ol class="format__steps">
          ${(Array.isArray(o1.steps) ? o1.steps : []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>
        <a href="${escapeHtml(o1.cta_href || '#')}" class="format__cta btn btn--ghost">${escapeHtml(o1.cta || '')}</a>
      </div>
    `;

    const isFeatured = o2.is_featured && o2.is_featured !== 'off';
    const format2Html = `
      <div class="format${isFeatured ? ' format--featured' : ''}">
        ${isFeatured && o2.num_badge ? `<span class="format__badge">${escapeHtml(o2.num_badge)}</span>` : ''}
        <span class="format__num">${escapeHtml(o2.num || '')}</span>
        <h3 class="format__title">${escapeHtml(o2.title || '')}</h3>
        <p class="format__desc">${escapeHtml(o2.desc || '')}</p>
        ${typeof o2.price === 'number' ? `<p class="format__price"><span class="format__price-num">${formatPrice(o2.price)}</span> <span class="format__price-cur">₽</span></p>` : ''}
        <ol class="format__steps">
          ${(Array.isArray(o2.steps) ? o2.steps : []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>
        <a href="${escapeHtml(o2.cta_href || '#')}" class="format__cta btn btn--primary">${escapeHtml(o2.cta || '')}</a>
      </div>
    `;

    const compareHtml = `
      <div class="formats__compare">
        <div class="formats__compare__col">
          <h4>${escapeHtml(compare.col1_title || '')}</h4>
          <p>${escapeHtml(compare.col1_text || '')}</p>
        </div>
        <div class="formats__compare__col">
          <h4>${escapeHtml(compare.col2_title || '')}</h4>
          <p>${escapeHtml(compare.col2_text || '')}</p>
        </div>
      </div>
    `;

    root.innerHTML = `
      <div class="container">
        <div class="section-head">
          <h2 class="section-title" id="formats-title">${escapeHtml(content.title || '')}</h2>
        </div>
        <div class="formats__grid">
          ${format1Html}
          ${format2Html}
        </div>
        ${compareHtml}
      </div>
    `;
  }

  // ---- CALCULATOR (id="calculator") ----
  // The calculator DOM is static HTML in index.html — script.js owns it.
  // We only expose the rates from API to window globals. Do NOT replace
  // innerHTML here, or we'd destroy script.js's initialization (race
  // condition: fetch is async, script.js already ran on DOMContentLoaded).
  function renderCalculator(content) {
    if (content.rates) window.SECTION_RATES = content.rates;
    if (content.coefficients) window.SECTION_COEFFICIENTS = content.coefficients;
    if (content.measurement_fee != null) window.SECTION_MEASUREMENT_FEE = content.measurement_fee;
  }

  // ---- CTA FINAL / CONTACTS (id="contacts") ----
  function renderCta(content) {
    const root = document.getElementById('contacts');
    if (!root) return;

    root.innerHTML = `
      <div class="container">
        <div class="cta-final__grid">
          <div class="cta-final__copy">
            <h2 class="cta-final__title" id="cta-final-title">${escapeHtml(content.title || '')}</h2>
            <p class="cta-final__lead">${escapeHtml(content.subtitle || '')}</p>
            <div class="cta-final__contacts">
              <a class="cta-final__contact" href="${escapeHtml(content.telegram_link || '#')}" target="_blank" rel="noopener">
                <span class="cta-final__contact__label">Telegram</span>
                <span class="cta-final__contact__value">${escapeHtml(content.telegram || '')}</span>
              </a>
              <a class="cta-final__contact" href="${escapeHtml(content.whatsapp_link || '#')}" target="_blank" rel="noopener">
                <span class="cta-final__contact__label">WhatsApp</span>
                <span class="cta-final__contact__value">${escapeHtml(content.whatsapp || '')}</span>
              </a>
            </div>
          </div>
          <div class="cta-final__cta">
            <a href="${escapeHtml(content.cta_primary_href || '#')}" class="btn btn--primary btn--lg">${escapeHtml(content.cta_primary || '')}</a>
            <a href="${escapeHtml(content.cta_secondary_href || '#')}" class="btn btn--ghost btn--lg">${escapeHtml(content.cta_secondary || '')}</a>
          </div>
        </div>
        <p class="cta-final__note">${escapeHtml(content.footer_note || '')}</p>
      </div>
    `;
  }

  // ---- FAQ (id="faq") ----
  function renderFaq(content) {
    const root = document.getElementById('faq');
    if (!root) return;

    const questions = Array.isArray(content.questions) ? content.questions : [];
    const itemsHtml = questions.map((item, i) => `
      <details class="accordion__item" ${i === 0 ? 'open' : ''}>
        <summary class="accordion__question">
          <span class="accordion__question-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="accordion__question-text">${escapeHtml(item.question || '')}</span>
          <span class="accordion__toggle" aria-hidden="true"></span>
        </summary>
        <div class="accordion__content">
          <div class="accordion__content__inner">${escapeHtml(item.answer || '')}</div>
        </div>
      </details>
    `).join('');

    root.innerHTML = `
      <div class="container">
        <div class="section-head">
          <h2 class="section-title" id="faq-title">${escapeHtml(content.title || '')}</h2>
        </div>
        <div class="faq__list" id="accordion">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  // ---- PROCESS (id="process") ----
  function renderProcess(content) {
    const root = document.getElementById('process');
    if (!root) return;

    const phases = Array.isArray(content.phases) ? content.phases : [];
    const phasesHtml = phases.map(phase => {
      const stepsHtml = (Array.isArray(phase.steps) ? phase.steps : []).map((s, i) =>
        `<li class="phase__item">${escapeHtml(s)}</li>`
      ).join('');
      return `
        <div class="phase">
          <p class="phase__num">${escapeHtml(phase.num || '')}</p>
          <h3 class="phase__title">${escapeHtml(phase.title || '')}</h3>
          <ol class="phase__list">
            ${stepsHtml}
          </ol>
        </div>
      `;
    }).join('');

    root.innerHTML = `
      <div class="container">
        <div class="process__head">
          <h2 class="section-title" id="process-title">${escapeHtml(content.title || '')}</h2>
        </div>
        <div class="process__phases">
          ${phasesHtml}
        </div>
      </div>
    `;
  }

  const RENDERERS = {
    hero: renderHero,
    services: renderServices,
    portfolio: renderPortfolio,
    variants: renderVariants,
    calculator: renderCalculator,
    cta: renderCta,
    faq: renderFaq,
    process: renderProcess
  };

  async function loadSections() {
    try {
      const res = await fetch('/api/sections', { credentials: 'omit' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !Array.isArray(data.data)) return;

      for (const section of data.data) {
        const renderer = RENDERERS[section.key];
        if (renderer && section.content) {
          try {
            renderer(section.content);
          } catch (err) {
            console.warn(`[sections-inject] Failed to render ${section.key}:`, err);
          }
        }
      }
    } catch (err) {
      console.warn('[sections-inject] Could not load sections:', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSections);
  } else {
    loadSections();
  }
})();
