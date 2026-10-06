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

  // Allow only safe URL schemes for href/src attributes. Everything else
  // (javascript:, data:, vbscript:, ...) falls back to '#'.
  function sanitizeUrl(url) {
    if (url == null) return '#';
    const value = String(url).trim();
    if (/^(https?:|mailto:|tel:)/i.test(value)) return escapeHtml(value);
    if (value.startsWith('/') || value.startsWith('#') || value.startsWith('./') || value.startsWith('../')) return escapeHtml(value);
    return '#';
  }

  function formatPrice(value) {
    if (typeof value !== 'number') return '';
    return new Intl.NumberFormat('ru-RU').format(value);
  }

  // ---- HERO (id="hero") ----
  // The admin-set hero photo (content.image) always wins. The «До → После»
  // comparison from the gallery is only a fallback when no hero photo is set.
  function buildHeroVisual(content, all) {
    const pair = !content.image && (all && all.gallery && Array.isArray(all.gallery.items))
      ? all.gallery.items.find(item => item && item.before && item.after)
      : null;

    if (pair) {
      const name = pair.name || '';
      return `
        <figure class="hero__ba">
          <div class="hero__ba__panels">
            <div class="hero__ba__panel">
              <img src="${sanitizeUrl(pair.before)}" alt="${escapeHtml(name ? 'До: ' + name : 'До')}" width="600" height="800" loading="eager" decoding="async" fetchpriority="high" draggable="false">
              <span class="hero__ba__label">До</span>
            </div>
            <span class="hero__ba__arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12h15"/><path d="M13 6l6 6-6 6"/></svg>
            </span>
            <div class="hero__ba__panel">
              <img src="${sanitizeUrl(pair.after)}" alt="${escapeHtml(name ? 'После: ' + name : 'После')}" width="600" height="800" loading="eager" decoding="async" fetchpriority="high" draggable="false">
              <span class="hero__ba__label">После</span>
            </div>
          </div>
          ${content.imageCaption ? `<figcaption class="hero__ba__caption">${escapeHtml(content.imageCaption)}</figcaption>` : ''}
        </figure>
      `;
    }

    return `
      <div class="hero__media" ${content.image ? `style="background-image:url('${sanitizeUrl(content.image)}')"` : ''}>
        <img src="${sanitizeUrl(content.image || '')}" alt="${escapeHtml(content.imageAlt || '')}" width="900" height="1100" loading="eager" decoding="async" fetchpriority="high">
        <span class="hero__media__caption">${escapeHtml(content.imageCaption || '')}</span>
      </div>
    `;
  }

  function renderHero(content, all) {
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
            <h1 class="hero__title" id="hero-title">
              <span class="echo">
                <span class="echo__base">${escapeHtml(content.title)}</span>
                ${echoLayers}
              </span>
            </h1>
            <p class="hero__sub">${escapeHtml(content.subtitle || '')}</p>
            <div class="hero__cta">
              <a href="${sanitizeUrl(content.cta_primary_href || '#')}" class="btn btn--primary">${escapeHtml(content.cta_primary || '')}</a>
              <a href="${sanitizeUrl(content.cta_secondary_href || '#')}" class="btn btn--ghost">${escapeHtml(content.cta_secondary || '')}</a>
            </div>
            <div class="hero__proof">
              ${proofHtml}
            </div>
          </div>
          <div class="hero__visual">
            ${buildHeroVisual(content, all)}
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
          <h3 class="service-row__title">${escapeHtml(item.title || '')}</h3>
          <p class="service-row__desc">${escapeHtml(item.desc || '')}</p>
          ${subItems.length > 0 ? `
            <ul class="service-row__items">
              ${subItems.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
            </ul>
          ` : ''}
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
        ${content.footer_note ? `<p class="services__note">${escapeHtml(content.footer_note)}</p>` : ''}
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
        ${Array.isArray(o1.include) && o1.include.length ? `
        <ul class="format__include">
          ${o1.include.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
        </ul>
        ` : ''}
        <ol class="format__steps">
          ${(Array.isArray(o1.steps) ? o1.steps : []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>
        <a href="${sanitizeUrl(o1.cta_href || '#')}" class="format__cta btn btn--ghost">${escapeHtml(o1.cta || '')}</a>
      </div>
    `;

    const isFeatured = o2.is_featured && o2.is_featured !== 'off';
    const format2Html = `
      <div class="format${isFeatured ? ' format--featured' : ''}">
        <span class="format__num">${escapeHtml(o2.num || '')}</span>
        <h3 class="format__title">${escapeHtml(o2.title || '')}</h3>
        <p class="format__desc">${escapeHtml(o2.desc || '')}</p>
        ${typeof o2.price === 'number' ? `<p class="format__price"><span class="format__price-num">${formatPrice(o2.price)}</span> <span class="format__price-cur">₽</span></p>` : ''}
        ${Array.isArray(o2.include) && o2.include.length ? `
        <ul class="format__include">
          ${o2.include.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
        </ul>
        ` : ''}
        <ol class="format__steps">
          ${(Array.isArray(o2.steps) ? o2.steps : []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>
        <a href="${sanitizeUrl(o2.cta_href || '#')}" class="format__cta btn btn--primary">${escapeHtml(o2.cta || '')}</a>
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

  // ---- GALLERY (id="gallery") — «До → После» side-by-side pairs ----
  // First pair spans the full viewport width, the rest stack below in a
  // centered column. Before is always on the left, after on the right,
  // with an arrow pointing from До to После.
  function renderGallery(content) {
    const root = document.getElementById('gallery');
    if (!root) return;

    const items = Array.isArray(content.items) ? content.items : [];
    if (!items.length) {
      root.innerHTML = '';
      return;
    }

    const MAX_VISIBLE_PAIRS = 4;
    const visibleItems = items.slice(0, MAX_VISIBLE_PAIRS);
    const hiddenItems = items.slice(MAX_VISIBLE_PAIRS);

    const pairHtml = (item, index) => `
      <article class="ba-pair ${index === 0 ? 'ba-pair--featured' : 'ba-pair--stacked'}" data-ba-pair>
        <div class="ba-pair__layout">
          <figure class="ba-panel ba-panel--before">
            <img class="ba-panel__img" src="${sanitizeUrl(item.before || '')}"
              alt="${escapeHtml(item.name ? 'До: ' + item.name : 'До')}" loading="lazy" decoding="async" draggable="false">
            <figcaption class="ba-panel__label" aria-hidden="true">До</figcaption>
          </figure>
          <div class="ba-pair__arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4.5 12h15"/><path d="M13 6l6 6-6 6"/>
            </svg>
          </div>
          <figure class="ba-panel ba-panel--after">
            <img class="ba-panel__img" src="${sanitizeUrl(item.after || '')}"
              alt="${escapeHtml(item.name ? 'После: ' + item.name : 'После')}" loading="lazy" decoding="async" draggable="false">
            <figcaption class="ba-panel__label" aria-hidden="true">После</figcaption>
          </figure>
        </div>
        <div class="ba-pair__copy">
          ${item.name ? `<h3 class="gallery__name">${escapeHtml(item.name)}</h3>` : ''}
          ${item.description ? `<p class="gallery__description">${escapeHtml(item.description)}</p>` : ''}
        </div>
      </article>
    `;

    const itemsHtml = visibleItems.map(pairHtml).join('');
    const hiddenItemsHtml = hiddenItems.map(pairHtml).join('');

    root.innerHTML = `
      <div class="container">
        <div class="section-head">
          <h2 class="section-title" id="gallery-title">${escapeHtml(content.title || '')}</h2>
        </div>
      </div>
      <div class="gallery__grid">
        ${itemsHtml}
      </div>
      ${hiddenItemsHtml ? `
        <div class="gallery__more" id="gallery-more" hidden>
          ${hiddenItemsHtml}
        </div>
      ` : ''}
      ${hiddenItemsHtml ? `
        <div class="gallery__toggle">
          <button class="btn btn--ghost gallery__toggle-button" type="button" aria-controls="gallery-more" aria-expanded="false">
            Показать все
          </button>
        </div>
      ` : ''}
    `;

    const toggleButton = root.querySelector('.gallery__toggle-button');
    const moreItems = root.querySelector('#gallery-more');
    if (toggleButton && moreItems) {
      toggleButton.addEventListener('click', () => {
        const isExpanded = moreItems.hidden;
        moreItems.hidden = !isExpanded;
        toggleButton.setAttribute('aria-expanded', String(isExpanded));
        toggleButton.textContent = isExpanded ? 'Скрыть' : 'Показать все';
      });
    }

    // Preserve each uploaded photo's native aspect ratio on its panel.
    root.querySelectorAll('.ba-panel').forEach((panel) => {
      const img = panel.querySelector('.ba-panel__img');
      if (!img) return;
      const apply = () => {
        if (img.naturalWidth && img.naturalHeight) {
          panel.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
        }
      };
      if (img.complete && img.naturalWidth) apply();
      else img.addEventListener('load', apply, { once: true });
    });
  }

  // ---- CLIENT VIDEO (id="clientVideo") ----
  function renderClientVideo(content) {
    const root = document.getElementById('clientVideo');
    if (!root) return;

    const items = Array.isArray(content.items) ? content.items : [];
    if (!items.length) {
      root.innerHTML = '';
      return;
    }

    const pad = (n) => String(n).padStart(2, '0');
    const itemsHtml = items.map((item, i) => `
      <div class="cv-item" data-index="${i}" data-active="${i === 0 ? 'true' : 'false'}" aria-hidden="${i === 0 ? 'false' : 'true'}" style="opacity:0">
        <div class="cv-media">
          <video class="cv-video" preload="metadata" playsinline muted aria-label="${escapeHtml(item.name || 'Видео клиента')}">
            <source src="${sanitizeUrl(item.video || '')}" type="video/mp4">
          </video>
          <button class="cv-play" type="button" aria-label="Воспроизвести видео" aria-pressed="false">
            <svg class="cv-play__icon cv-play__icon--play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <svg class="cv-play__icon cv-play__icon--pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>
          </button>
        </div>
        ${item.name ? `<p class="cv-name">${escapeHtml(item.name)}</p>` : ''}
        ${item.description ? `<p class="cv-desc">${escapeHtml(item.description)}</p>` : ''}
      </div>
    `).join('');

    root.innerHTML = `
      <div class="section-head">
        <h2 class="section-title" id="clientVideo-title">${escapeHtml(content.title || '')}</h2>
      </div>
      <div class="video-carousel" role="region" aria-roledescription="карусель" aria-label="Видео клиентов">
        <div class="video-carousel__viewport" tabindex="0" role="group" aria-label="Листайте видео стрелками клавиатуры или свайпом">
          <div class="video-carousel__stage">
            ${itemsHtml}
          </div>
        </div>
        <button class="video-carousel__arrow video-carousel__arrow--prev" type="button" aria-label="Предыдущее видео">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <button class="video-carousel__arrow video-carousel__arrow--next" type="button" aria-label="Следующее видео">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
        </button>
        <div class="video-carousel__meta">
          <span class="video-carousel__counter" aria-live="polite">${pad(1)} / ${pad(items.length)}</span>
          <div class="video-carousel__dots">
            ${items.map((_, i) => `<button type="button" class="video-carousel__dot" data-dot="${i}" aria-label="Видео ${i + 1}" aria-selected="${i === 0 ? 'true' : 'false'}"></button>`).join('')}
          </div>
        </div>
      </div>
    `;

    attachVideoCarousel(root);
  }

  function attachVideoCarousel(root) {
    const carousel = root.querySelector('.video-carousel');
    const viewport = carousel?.querySelector('.video-carousel__viewport');
    const stage = carousel?.querySelector('.video-carousel__stage');
    const prevBtn = carousel?.querySelector('.video-carousel__arrow--prev');
    const nextBtn = carousel?.querySelector('.video-carousel__arrow--next');
    const counter = carousel?.querySelector('.video-carousel__counter');
    const dots = carousel ? Array.from(carousel.querySelectorAll('.video-carousel__dot')) : [];
    if (!stage || !viewport || !prevBtn || !nextBtn) return;

    const items = Array.from(stage.querySelectorAll('.cv-item'));
    if (!items.length) return;

    let activeIndex = 0;
    let xPercentReady = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DUR = reducedMotion ? 0 : 0.7;
    const GAP = 44;
    const hasGsap = typeof window.gsap !== 'undefined';
    const setVars = (el, vars) => hasGsap ? gsap.set(el, vars) : Object.assign(el.style, vars);

    if (!hasGsap) {
      console.warn('[sections-inject] GSAP not loaded, carousel falls back to instant layout.');
    }

    // Stash each track item so width measurements are cheap and stable.
    const mediaEls = items.map((it) => it.querySelector('.cv-media'));
    const videos = items.map((it) => it.querySelector('.cv-video'));
    const playBtns = items.map((it) => it.querySelector('.cv-play'));
    const aspectRatios = items.map(() => null);

    videos.forEach((video, i) => {
      if (!video) return;
      if (video.readyState >= 1 && video.videoWidth) {
        rememberAspect(i);
      } else {
        video.addEventListener('loadedmetadata', () => rememberAspect(i), { once: true });
      }
    });

    function rememberAspect(i) {
      const video = videos[i];
      if (!video || !video.videoWidth || !video.videoHeight) return;
      aspectRatios[i] = video.videoWidth / video.videoHeight;
      setVars(items[i], { '--ar': aspectRatios[i] });
      setVars(mediaEls[i], { '--ar': aspectRatios[i] });
      layout(true);
    }

    // Cyclic distance: the track wraps, so every slide always has a
    // neighbour on both sides — the carousel never shows a beginning or an end.
    function cyclicDist(i) {
      const d = (i - activeIndex + items.length) % items.length;
      return d > items.length / 2 ? d - items.length : d;
    }

    function offsetFor(i) {
      const dist = cyclicDist(i);
      if (dist === 0) return 0;
      const dir = dist > 0 ? 1 : -1;
      const wI = mediaEls[i] ? mediaEls[i].getBoundingClientRect().width : 0;
      const wA = mediaEls[activeIndex] ? mediaEls[activeIndex].getBoundingClientRect().width : 0;
      let off = dir * (wA / 2 + wI / 2 + GAP);
      const kMax = Math.abs(dist);
      for (let k = 1; k < kMax; k++) {
        off += dir * ((mediaEls[(i - dir * k + items.length) % items.length]?.getBoundingClientRect().width || 0) + GAP);
      }
      return off;
    }

    function layout(animate) {
      if (!hasGsap) {
        items.forEach((it) => { it.style.opacity = '1'; });
        viewport.style.height = 'auto';
        return;
      }

      if (!xPercentReady) {
        gsap.set(items, { xPercent: -50, y: 0, transformOrigin: '50% 50%' });
        xPercentReady = true;
      }

      // Viewport height fits the tallest item (media + caption).
      const maxH = Math.max(...items.map((it) => it.offsetHeight || 0));
      viewport.style.height = maxH + 'px';

      items.forEach((it, i) => {
        const dist = cyclicDist(i);
        const isActive = i === activeIndex;
        const target = {
          x: offsetFor(i),
          scale: dist === 0 ? 1 : 0.88,
          opacity: dist === 0 ? 1 : Math.abs(dist) === 1 ? 0.45 : 0,
          zIndex: dist === 0 ? 3 : Math.abs(dist) === 1 ? 2 : 1,
          duration: animate ? DUR : 0,
          ease: reducedMotion ? 'none' : 'expo.inOut',
          overwrite: 'auto'
        };
        if (animate) {
          gsap.to(it, target);
        } else {
          gsap.set(it, target);
        }
        it.setAttribute('data-active', isActive ? 'true' : 'false');
        it.setAttribute('aria-hidden', String(!isActive));
        if (playBtns[i]) playBtns[i].tabIndex = isActive ? 0 : -1;
        // Manual playback state belongs to the centered slide only.
        if (!isActive && it.classList.contains('is-playing')) {
          it.classList.remove('is-playing');
          if (playBtns[i]) playBtns[i].setAttribute('aria-pressed', 'false');
        }
      });

      counter.textContent = String(activeIndex + 1).padStart(2, '0') + ' / ' + String(items.length).padStart(2, '0');
      dots.forEach((dot, i) => {
        dot.setAttribute('aria-selected', String(i === activeIndex));
      });

      // Play only the visible slide (muted autoplay), pause the rest.
      // Slides in manual playback (is-playing) keep their sound state.
      videos.forEach((video, i) => {
        if (!video) return;
        if (i === activeIndex) {
          if (video.paused && !items[i].classList.contains('is-playing')) {
            const p = video.play();
            if (p && p.catch) p.catch(() => {});
          }
        } else {
          video.pause();
          video.muted = true; // restoration to muted autoplay when it returns to center
        }
      });
    }

    function goTo(index, animate) {
      const n = items.length;
      activeIndex = ((index % n) + n) % n;
      layout(animate);
    }

    prevBtn.addEventListener('click', () => goTo(activeIndex - 1, true));
    nextBtn.addEventListener('click', () => goTo(activeIndex + 1, true));

    // Keyboard navigation.
    viewport.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(activeIndex - 1, true); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(activeIndex + 1, true); }
    });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => goTo(i, true));
    });

    // Pointer swipe with follow-the-finger drag (Apple-style snap).
    let startX = 0;
    let dragX = 0;
    let isDragging = false;

    viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('button, video')) return;
      isDragging = true;
      startX = e.clientX;
      dragX = 0;
      viewport.setPointerCapture(e.pointerId);
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      dragX = e.clientX - startX;
      if (hasGsap) {
        const active = items[activeIndex];
        gsap.set(active, { x: offsetFor(activeIndex) + dragX, scale: 0.96, duration: 0 });
      }
    });

    const endSwipe = (e) => {
      if (!isDragging) return;
      isDragging = false;
      const diff = e.clientX - startX;
      if (items.length > 1 && Math.abs(diff) > 64) {
        goTo(activeIndex + (diff < 0 ? 1 : -1), true);
      } else {
        layout(true); // snap back
      }
    };
    viewport.addEventListener('pointerup', endSwipe);
    viewport.addEventListener('pointercancel', endSwipe);

    // Single click plays from the very beginning with sound; the same
    // control (button or the video itself) pauses when already playing.
    function togglePlay(i) {
      const video = videos[i];
      const button = playBtns[i];
      if (!video) return;
      // Only the centered slide is playable.
      if (i !== activeIndex) return;
      const manualSession = items[i].classList.contains('is-playing');
      if (manualSession && !video.paused) {
        video.pause();
        if (button) button.setAttribute('aria-pressed', 'false');
        items[i].classList.remove('is-playing');
      } else {
        video.currentTime = 0; // always start from the beginning
        video.muted = false;
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
        if (button) button.setAttribute('aria-pressed', 'true');
        items[i].classList.add('is-playing');
      }
    }
    playBtns.forEach((button, i) => {
      button.addEventListener('click', () => togglePlay(i));
    });
    videos.forEach((video, i) => {
      video.addEventListener('click', () => togglePlay(i));
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (entered) layout(true); }, 120);
    });

    // Start the carousel (and thus the active video download) only when the
    // section approaches the viewport — below-fold videos must not load on
    // initial page load. Playback pauses again once the section scrolls away.
    // The section shell is empty (zero-height) before rendering, and
    // zero-area targets never intersect an observer, so a distance fallback
    // mirroring the page's own reveal-scroll pattern is kept alongside IO.
    let entered = false;
    let sectionVisible = false;
    const section = document.getElementById('clientVideo');
    const startCarousel = () => {
      if (entered) return;
      entered = true;
      layout(hasGsap); // initial entrance (animated) or instant fallback
    };
    const pauseAll = () => {
      videos.forEach((v) => { if (v) { v.pause(); v.muted = true; } });
      items.forEach((it) => it.classList.remove('is-playing'));
      playBtns.forEach((b) => b && b.setAttribute('aria-pressed', 'false'));
    };

    if (section && typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          startCarousel();
        } else if (entered) {
          pauseAll();
        }
      }, { rootMargin: '1000px 0px' });
      io.observe(section);

      const fallback = () => {
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const visible = rect.top < window.innerHeight && rect.bottom > 0;
        sectionVisible = visible;
        if (visible) startCarousel();
        else if (entered) pauseAll();
      };
      window.addEventListener('scroll', fallback, { passive: true });
      window.addEventListener('resize', fallback, { passive: true });
      fallback();
    } else {
      startCarousel();
    }
  }

  // ---- CALCULATOR (id="calculator") ----
  // script.js owns the calculator DOM and renders its fields from this config.
  // Do not replace the calculator section's innerHTML here.
  function renderCalculator(content) {
    const title = content.title || 'Ориентировочная стоимость ремонта';
    const titleElement = document.getElementById('calculator-title');
    if (titleElement) titleElement.textContent = title;
    window.SECTION_CALCULATOR = {
      title,
      areaQuestion: content.area_question || 'Площадь квартиры по полу',
      callbackLabel: content.callback_label || 'Хочу оставить только заявку на звонок — без расчёта',
      questions: Array.isArray(content.questions) ? content.questions : window.CalculatorPricing.fromLegacyConfig(content)
    };
    document.dispatchEvent(new CustomEvent('calculatorConfigLoaded', {
      detail: window.SECTION_CALCULATOR
    }));
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
              <a class="cta-final__contact" href="${sanitizeUrl(content.telegram_link || '#')}" target="_blank" rel="noopener">
                <span class="cta-final__contact__label">Telegram</span>
                <span class="cta-final__contact__value">${escapeHtml(content.telegram || '')}</span>
              </a>
              <a class="cta-final__contact" href="${sanitizeUrl(content.whatsapp_link || '#')}" target="_blank" rel="noopener">
                <span class="cta-final__contact__label">WhatsApp</span>
                <span class="cta-final__contact__value">${escapeHtml(content.whatsapp || '')}</span>
              </a>
            </div>
          </div>
          <div class="cta-final__cta">
            <a href="${sanitizeUrl(content.cta_primary_href || '#')}" class="btn btn--primary btn--lg">${escapeHtml(content.cta_primary || '')}</a>
            <a href="${sanitizeUrl(content.cta_secondary_href || '#')}" class="btn btn--ghost btn--lg">${escapeHtml(content.cta_secondary || '')}</a>
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
    const itemsHtml = questions.map((item, i) => {
      const answers = [item.answer, item.answer2, item.answer3, item.answer4]
        .flatMap(answer => Array.isArray(answer) ? answer : [answer])
        .map(answer => answer == null ? '' : String(answer).trim())
        .filter(Boolean);
      return `
        <details class="accordion__item" ${i === 0 ? 'open' : ''}>
          <summary class="accordion__question">
            <span class="accordion__question-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="accordion__question-text">${escapeHtml(item.question || '')}</span>
            <span class="accordion__toggle" aria-hidden="true"></span>
          </summary>
          <div class="accordion__content">
            <div class="accordion__content__inner">${answers.map(answer => `<p>${escapeHtml(answer)}</p>`).join('')}</div>
          </div>
        </details>
      `;
    }).join('');

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
    variants: renderVariants,
    gallery: renderGallery,
    clientVideo: renderClientVideo,
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

      const byKey = {};
      for (const section of data.data) {
        if (section && section.key && section.content) byKey[section.key] = section.content;
      }
      for (const section of data.data) {
        const renderer = RENDERERS[section.key];
        if (renderer && section.content) {
          try {
            renderer(section.content, byKey);
          } catch (err) {
            console.warn(`[sections-inject] Failed to render ${section.key}:`, err);
          }
        }
      }
      document.dispatchEvent(new CustomEvent('sectionsRendered'));
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
