// =========================================================================
// NIKITA NACHATKIN — EDITORIAL ARCHITECTURE
// Vanilla JS • No frameworks • CSS-first motion via IntersectionObserver
// CLAUDE.md: vanilla HTML/CSS/JS, no React/Next/Vue/Angular/Svelte
// =========================================================================

// Always start at hero on page load. The browser auto-scrolls to a hash
// in the URL BEFORE JS runs, so we strip it here.
if (window.location.hash) {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
// Force page to top on load, overriding browser scroll restoration
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

document.addEventListener('DOMContentLoaded', () => {
  // Cookie banner
  const cookieBanner = document.getElementById('cookieBanner');
  const cookieAcceptBtn = document.getElementById('cookieAcceptBtn');
  if (cookieBanner && cookieAcceptBtn) {
    function updateCookieBanner() {
      if (localStorage.getItem('cookieAccepted') !== 'true') {
        cookieBanner.hidden = false;
        document.body.style.paddingBottom = cookieBanner.offsetHeight + 'px';
      }
    }
    updateCookieBanner();
    window.addEventListener('resize', updateCookieBanner);
    cookieAcceptBtn.addEventListener('click', () => {
      localStorage.setItem('cookieAccepted', 'true');
      cookieBanner.hidden = true;
      document.body.style.paddingBottom = '';
    });
  }

  // Reduced motion detection
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ============================================================
  // MOBILE MENU
  // ============================================================
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileClose = document.getElementById('mobileClose');

  if (burger && mobileMenu) {
    function setMenu(open) {
      mobileMenu.classList.toggle('mobile-menu--open', open);
      burger.classList.toggle('active', open);
      burger.setAttribute('aria-expanded', String(open));
      mobileMenu.setAttribute('aria-hidden', String(!open));
      document.body.style.overflow = open ? 'hidden' : '';
    }

    burger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.contains('mobile-menu--open');
      setMenu(!isOpen);
    });

    if (mobileClose) {
      mobileClose.addEventListener('click', () => {
        setMenu(false);
      });
    }

    // Close menu when clicking a nav link
    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenu(false));
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('mobile-menu--open')) {
        setMenu(false);
        burger.focus();
      }
    });
  }

  // ============================================================
  // HEADER SCROLL EFFECT
  // ============================================================
  const header = document.getElementById('header');

  if (header) {
    function updateHeader() {
      const scrollY = window.pageYOffset;
      if (scrollY > 100) {
        header.classList.add('header--scrolled');
      } else {
        header.classList.remove('header--scrolled');
      }
    }

    window.addEventListener('scroll', updateHeader, { passive: true });
    // Initial check
    updateHeader();
  }

  // ============================================================
  // SCROLL PROGRESS BAR
  // ============================================================
  const scrollProgress = document.getElementById('scrollProgress');
  if (scrollProgress) {
    function updateScrollProgress() {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = Math.max(0, Math.min(100, (scrollTop / docHeight) * 100));
      if (prefersReducedMotion.matches) {
        scrollProgress.style.width = scrollPercent + '%';
      } else {
        scrollProgress.style.width = scrollPercent + '%';
      }
    }
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    updateScrollProgress();
  }

  // ============================================================
  // CALCULATOR — 6-step state machine
  // ============================================================
  const calculatorData = {
    propertyType: null,
    condition: null,
    address: '',
    startDate: null,
    hasProject: null,
    measurement: null,
    area: null
  };

  const calcSteps = document.querySelectorAll('.calc__field');
  const calcNextBtn = document.getElementById('calcNext');
  const calcBackBtn = document.getElementById('calcBack');
  const calcProgressBar = document.querySelector('.calc__progress__bar');
  const calcStepCurrent = document.getElementById('calcStepCurrent');
  const calcStepLabel = document.getElementById('calcStepLabel');
  const calcHint = document.querySelector('.calc__hint');
  const calcArea = document.getElementById('calcArea');
  const calcError = document.getElementById('calcError');
  const calcResultValue = document.getElementById('calcResultValue');
  const calcResultApprox = document.querySelector('.calc__result__approx');
  const calcResult = document.getElementById('calcResult');
  const calcMeta = document.getElementById('calcMeta');
  const calcBody = document.getElementById('calcBody');
  const calcFooter = document.getElementById('calcFooter');
  const calcParams = {
    property: document.getElementById('param-property'),
    condition: document.getElementById('param-condition'),
    area: document.getElementById('param-area'),
    project: document.getElementById('param-project')
  };

  let currentStep = 1;
  const totalSteps = 6;

  // Clear calculator error when the user edits the area field
  if (calcArea) {
    calcArea.addEventListener('input', () => {
      if (calcError && !calcError.classList.contains('hidden')) {
        calcError.classList.add('hidden');
        calcArea.classList.remove('invalid');
      }
    });
  }

  // Step labels and hints
  const stepLabels = {
    1: { label: 'Тип объекта', hint: '' },
    2: { label: 'Состояние квартиры', hint: 'Квартира подготовлена, но без чистовой отделки.' },
    3: { label: 'Площадь квартиры', hint: 'Введите площадь в м²' },
    4: { label: 'Когда хотите начать ремонт?', hint: '' },
    5: { label: 'Есть ли готовый проект?', hint: '' },
    6: { label: 'Нужен ли замер', hint: '' }
  };

  // Update UI for current step
  function updateStepUI(options = {}) {
    const { focus = true, preventScroll = true } = options;
    const step = stepLabels[currentStep];
    calcStepCurrent.textContent = `${currentStep} / ${totalSteps}`;
    calcStepLabel.textContent = step.label;
    calcHint.textContent = step.hint;

    // Show/hide fields
    calcSteps.forEach((stepEl) => {
      const stepNum = parseInt(stepEl.dataset.step);
      if (stepNum === currentStep) {
        stepEl.hidden = false;
        // Focus first interactive element only when user navigates, not on initial load
        if (focus) {
          const firstInput = stepEl.querySelector('input, select, textarea');
          if (firstInput) {
            firstInput.focus({ preventScroll });
          }
        }
      } else {
        stepEl.hidden = true;
      }
    });

    // Update progress bar width
    const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;
    calcProgressBar.style.width = progressPercent + '%';

    // Update back button visibility
    calcBackBtn.hidden = currentStep === 1;

    // Update next button text (preserve icon span)
    const nextText = calcNextBtn.querySelector('.calc__next-text');
    if (nextText) {
      nextText.textContent = currentStep === totalSteps ? 'Получить результат' : 'Далее';
    }

    // Hide "Next" button on radio steps (auto-advance on select);
    // keep it only on the area input step (step 3) and on result.
    const currentField = document.querySelector(`.calc__field[data-step="${currentStep}"]`);
    const hasRadios = currentField && currentField.querySelector('input[type="radio"]');
    if (hasRadios && currentStep !== 3) {
      calcNextBtn.hidden = true;
    } else {
      calcNextBtn.hidden = false;
    }
  }

  // Validate current step
  function validateStep() {
    // Clear previous calculator error
    if (calcError) {
      calcError.textContent = '';
      calcError.classList.add('hidden');
      calcArea.classList.remove('invalid');
    }

    const currentField = document.querySelector(`.calc__field[data-step="${currentStep}"]`);
    if (!currentField) return true;

    // Check required radio buttons
    const radioGroups = currentField.querySelectorAll('input[type="radio"]');
    let allRadiosChecked = true;
    radioGroups.forEach(radioGroup => {
      // Group by name
      const groupName = radioGroup.name;
      const checked = currentField.querySelector(`input[name="${groupName}"]:checked`);
      if (!checked) allRadiosChecked = false;
    });
    if (!allRadiosChecked) return false;

    // Additional validation
    if (currentStep === 3) { // Area step
      const areaVal = parseFloat(calcArea.value);
      if (isNaN(areaVal)) {
        // Empty or non-numeric input
        if (calcArea.value.trim() === '') {
          showCalcError('Пожалуйста, введите площадь квартиры');
        } else {
          showCalcError('Площадь должна быть числом');
        }
        calcArea.classList.add('invalid');
        return false;
      }
      if (areaVal < 10) {
        showCalcError('Площадь не может быть меньше 10 м²');
        calcArea.classList.add('invalid');
        return false;
      }
      if (areaVal > 500) {
        showCalcError('Площадь не может быть больше 500 м²');
        calcArea.classList.add('invalid');
        return false;
      }
      // Clear error if valid
      if (calcArea.classList.contains('invalid')) {
        calcError.classList.add('hidden');
        calcArea.classList.remove('invalid');
      }
    }

    if (currentStep === 6) { // Measurement step
      const checked = currentField.querySelector('input[name="measurement"]:checked');
      if (!checked) return false;
    }

    return true;
  }

  // Show calculator error message
  function showCalcError(message) {
    if (!calcError) return;
    calcError.textContent = message;
    calcError.classList.remove('hidden');
  }

  // Collect data from current step into calculatorData
  function collectStepData() {
    const currentField = document.querySelector(`.calc__field[data-step="${currentStep}"]`);
    if (!currentField) return;

    const inputs = currentField.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.type === 'radio' && input.checked) {
        calculatorData[input.name] = input.value;
      } else if (input.type !== 'checkbox' && input.type !== 'submit' && input.type !== 'radio') {
        calculatorData[input.name] = input.value.trim();
      } else if (input.type === 'checkbox') {
        calculatorData[input.name] = input.checked;
      }
    });
  }

  // Calculate price
  function calculatePrice() {
    if (!calculatorData.propertyType || !calculatorData.condition || !calculatorData.area) return null;

    // Rates loaded from /api/sections (calculator section) or fallback to /api/prices
    const rates = window.SECTION_RATES || {
      newBuilding: { finished: 4500, unfinished: 5500, whiteBox: 5000 },
      secondary: { finished: 5000, unfinished: 6000, whiteBox: 5500 }
    };

    const baseRate = rates[calculatorData.propertyType]?.[calculatorData.condition];
    if (!baseRate) return null;

    const basePrice = baseRate * parseFloat(calculatorData.area);

    // Project coefficient
    const projectCoeffs = window.SECTION_COEFFICIENTS || {
      hasProject: 1.0,
      needsChanges: 1.3,
      noProject: 1.5
    };
    let totalPrice = basePrice * projectCoeffs[calculatorData.hasProject];

    // Add measurement fee if needed
    const measurementFee = window.SECTION_MEASUREMENT_FEE ?? 3000;
    if (calculatorData.measurement === 'yes') {
      totalPrice += measurementFee;
    }

    return Math.round(totalPrice);
  }

  // Format number with spaces
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Show result step — replace questions with result
  function showResult() {
    const price = calculatePrice();
    if (price) {
      // Действующие расценки носят ориентировочный характер — показываем
      // диапазон ±10 %, а не ложную точную цифру. Точная сумма — после
      // замера и подготовки сметы.
      const lo = Math.round(price * 0.9);
      const hi = Math.round(price * 1.1);
      calcResultValue.textContent = `${formatNumber(lo)} – ${formatNumber(hi)} ₽`;
      if (calcResultApprox) {
        calcResultApprox.textContent = 'Ориентировочный диапазон на основе действующих расценок. Точная стоимость — после замера и подготовки сметы.';
      }
    } else {
      calcResultValue.textContent = '— ₽';
    }

    // Update params display
    calcParams.property.textContent =
      calculatorData.propertyType === 'newBuilding' ? 'Новостройка' : 'Вторичное жильё';
    calcParams.condition.textContent =
      calculatorData.condition === 'finished' ? 'Есть ремонт' :
      calculatorData.condition === 'unfinished' ? 'Без отделки' : 'White Box';
    calcParams.area.textContent = `${calculatorData.area} м²`;
    calcParams.project.textContent =
      calculatorData.hasProject === 'hasProject' ? 'Есть проект' :
      calculatorData.hasProject === 'needsChanges' ? 'Есть проект, нужны правки' : 'Нет проекта';

    // Replace questions area with result — only the result stays visible
    calcSteps.forEach(step => {
      step.hidden = true;
      step.classList.remove('step-out', 'step-in');
    });
    calcMeta.hidden = true;
    calcBody.hidden = true;
    calcFooter.hidden = true;
    calcResult.hidden = false;
    calcResult.classList.add('step-in');
    calcBackBtn.hidden = false;
    calcBackBtn.textContent = 'Начать заново';
    calcNextBtn.hidden = true;
  }

  // Reset calculator
  function resetCalculator() {
    // Reset data
    Object.keys(calculatorData).forEach(key => calculatorData[key] = null);
    calculatorData.address = '';

    // Reset UI
    currentStep = 1;
    calcSteps.forEach(step => {
      step.hidden = false;
      step.classList.remove('step-out', 'step-in');
    });
    calcMeta.hidden = false;
    calcBody.hidden = false;
    calcFooter.hidden = false;
    calcResult.classList.remove('step-in');
    calcResult.hidden = true;
    calcNextBtn.hidden = false;
    calcNextBtn.textContent = 'Далее';
    calcBackBtn.hidden = true;
    calcBackBtn.textContent = 'Назад';

    // Clear inputs
    calcSteps.forEach(step => {
      const inputs = step.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        if (input.type === 'radio' || input.type === 'checkbox') {
          input.checked = false;
        } else {
          input.value = '';
        }
      });
    });

    // Reset progress
    calcProgressBar.style.width = '0%';
    updateStepUI({ focus: false });

    // Focus first input
    setTimeout(() => {
      const firstInput = calcSteps[0].querySelector('input[type="radio"]');
      if (firstInput) firstInput.focus({ preventScroll: true });
    }, 100);
  }

  // Event listeners
  calcNextBtn.addEventListener('click', () => {
    if (currentStep === totalSteps) {
      // On final step, show result if valid
      if (validateStep()) {
        collectStepData();
        showResult();
      }
    } else {
      // Normal navigation
      if (validateStep()) {
        collectStepData();
        currentStep++;
        if (currentStep > totalSteps) {
          showResult();
        } else {
          updateStepUI();
        }
      }
    }
  });

  calcBackBtn.addEventListener('click', () => {
    if (currentStep === totalSteps || calcBackBtn.textContent === 'Начать заново') {
      // Reset from result screen
      resetCalculator();
    } else if (currentStep > 1) {
      // Normal back
      currentStep--;
      updateStepUI();
    }
  });

  // Initialize (no focus, no scroll on page load)
  updateStepUI({ focus: false });

  // ============================================================
  // AUTO-ADVANCE on radio select
  // ============================================================
  // When user picks a radio option, automatically advance to next step.
  // No auto-advance for text/number inputs — user must click "Далее".
  // Each question fades out and the next fades in — no page scroll.
  const allRadios = document.querySelectorAll('.calc__field input[type="radio"]');
  allRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      setTimeout(() => {
        collectStepData();
        // Fade out current question
        const currentField = document.querySelector(`.calc__field[data-step="${currentStep}"]`);
        if (currentField) currentField.classList.add('step-out');

        setTimeout(() => {
          currentStep++;
          if (currentStep <= totalSteps) {
            updateStepUI();
            // Fade in next question
            const nextField = document.querySelector(`.calc__field[data-step="${currentStep}"]`);
            if (nextField) {
              nextField.classList.remove('step-out');
              nextField.classList.add('step-in');
            }
          } else {
            // All steps done — show result with fade
            const result = document.getElementById('calcResult');
            if (result) {
              result.classList.add('step-in');
              showResult();
            }
          }
        }, 300);
      }, 200);
    });
  });

  // Transfer calculator data to form hidden field when navigating from calculator
  const calculatorNextBtn = document.getElementById('calcNext');
  const calculatorResult = document.getElementById('calcResult');
  const formCalculatorData = document.getElementById('formCalculatorData');

  // When user goes from calculator to application form, transfer data
  const calcToApplicationLinks = document.querySelectorAll('a[href="#application"]');
  calcToApplicationLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (calculatorResult && !calculatorResult.hidden) {
        const price = calculatePrice();
        const area = calculatorData.area || '—';
        const property = calculatorData.propertyType === 'newBuilding' ? 'Новостройка' : 'Вторичное жильё';
        const condition = calculatorData.condition === 'finished' ? 'Есть ремонт' :
                          calculatorData.condition === 'unfinished' ? 'Без отделки' : 'White Box';
        const project = calculatorData.hasProject === 'hasProject' ? 'Есть проект' :
                          calculatorData.hasProject === 'needsChanges' ? 'Есть проект, нужны правки' : 'Нет проекта';
        let params = '';
        if (price) {
          params = `Тип объекта: ${property}\nСостояние: ${condition}\nПлощадь: ${area} м²\nПроект: ${project}\nПредварительный расчёт: ${formatNumber(price)} ₽\nОриентировочный расчёт. Цены не final.`;
        }
        if (formCalculatorData) {
          formCalculatorData.value = params || '';
        }
      }
    });
  });

  // ============================================================
  // APPLICATION FORM
  // ============================================================
  const applicationForm = document.getElementById('applicationForm');
  const formStatus = document.getElementById('formStatus');

  if (applicationForm) {
    applicationForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Simple validation
      const nameInput = applicationForm.elements['name'];
      const phoneInput = applicationForm.elements['phone'];

      let isValid = true;
      formStatus.textContent = '';
      formStatus.classList.remove('form__status--success', 'form__status--error');

      if (!nameInput.value.trim()) {
        nameInput.classList.add('invalid');
        isValid = false;
      } else {
        nameInput.classList.remove('invalid');
      }

      // Phone validation: +7 (___) ___-__-__
      const phonePattern = /^\+7\s*\(\d{3}\)\s*\d{3}[-\s]*\d{2}[-\s]*\d{2}$/;
      if (!phonePattern.test(phoneInput.value)) {
        phoneInput.classList.add('invalid');
        isValid = false;
      } else {
        phoneInput.classList.remove('invalid');
      }

      // Consent to personal data processing
      const agreeInput = applicationForm.elements['agreePolicy'];
      const consentLabel = applicationForm.querySelector('.form__consent');
      const consentError = document.getElementById('formConsentError');

      if (agreeInput && !agreeInput.checked) {
        consentLabel?.classList.add('invalid');
        if (consentError) consentError.textContent = 'Пожалуйста, подтвердите согласие на обработку персональных данных';
        isValid = false;
      } else if (agreeInput) {
        consentLabel?.classList.remove('invalid');
        if (consentError) consentError.textContent = '';
      }

      if (!isValid) {
        formStatus.textContent = 'Пожалуйста, заполните все обязательные поля';
        formStatus.classList.add('form__status--error', 'form__status--visible');
        return;
      }

      // Build payload — include calculator data if present
      const payload = {
        name: nameInput.value.trim(),
        phone: phoneInput.value,
        preferred_time: applicationForm.elements['contactTime']?.value || '',
        comment: applicationForm.elements['comment']?.value || '',
        agree_policy: agreeInput?.checked ? 1 : 0
      };

      // Attach calculator data from hidden field or live state
      const hiddenData = document.getElementById('formCalculatorData')?.value;
      if (hiddenData) {
        try {
          payload.calculator_data = JSON.parse(hiddenData);
        } catch (err) {
          payload.calculator_data = { raw: hiddenData };
        }
      }

      // Submit to backend
      const submitBtn = applicationForm.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка…';
      }

      try {
        const response = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'Ошибка при отправке');
        }

        // Success
        formStatus.textContent = 'Заявка отправлена';
        formStatus.classList.add('form__status--success', 'form__status--visible');

        applicationForm.reset();

        setTimeout(() => {
          formStatus.classList.remove('form__status--visible');
        }, 5000);

        applicationForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        formStatus.textContent = err.message || 'Не удалось отправить заявку';
        formStatus.classList.add('form__status--error', 'form__status--visible');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = !agreeInput?.checked;
          submitBtn.textContent = originalText;
        }
      }
    });

    // Real-time validation - remove invalid class on input
    applicationForm.querySelectorAll('input, select, textarea').forEach((field) => {
      field.addEventListener('input', () => {
        if (field.classList.contains('invalid')) {
          field.classList.remove('invalid');
          formStatus.classList.remove('form__status--visible');
        }
      });
    });

    // Consent checkbox: clear error on change and unlock submit button
    const agreeCheckbox = applicationForm.elements['agreePolicy'];
    const consentLabel = applicationForm.querySelector('.form__consent');
    const consentError = document.getElementById('formConsentError');
    const submitBtn = applicationForm.querySelector('.form__submit') ||
                      applicationForm.querySelector('button[type="submit"]');

    if (agreeCheckbox && submitBtn) {
      agreeCheckbox.addEventListener('change', () => {
        submitBtn.disabled = !agreeCheckbox.checked;
        consentLabel?.classList.remove('invalid');
        if (consentError) consentError.textContent = '';
        if (agreeCheckbox.checked) formStatus.classList.remove('form__status--visible');
      });
    }

    // Phone input mask: +7 (___) ___-__-__
    const phoneInput = applicationForm.elements['phone'];
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.slice(0, 11);
        let masked = '+7';
        if (val.length > 1) {
          masked += ' (' + val.slice(1, 4);
        }
        if (val.length > 4) {
          masked += ') ' + val.slice(4, 7);
        }
        if (val.length > 7) {
          masked += '-' + val.slice(7, 9);
        }
        if (val.length > 9) {
          masked += '-' + val.slice(9, 11);
        }
        e.target.value = masked;
      });
    }
  }

  // ============================================================
  // ACCORDION (FAQ) — GSAP motion for native <details>/<summary>
  // ============================================================
  // The <details> element stays native (a11y + keyboard). GSAP layers
  // motion on top: scroll-reveal of the list, content slide/fade on
  // open, and a spring "pop" of the +/× icon.
  // FAQ is re-rendered from server data by sections-inject.js shortly
  // after load, so bind motion on 'sectionsRendered' (same idiom as the
  // portfolio). The fallback covers the case where no FAQ section exists
  // in the DB and the static markup stays.
  function initFaqMotion() {
    const faqItems = gsap.utils.toArray('#accordion .accordion__item');
    if (faqItems.length === 0) return;
    const motion = !prefersReducedMotion.matches;

    if (motion) {
      gsap.registerPlugin(ScrollTrigger);
      gsap.from(faqItems, {
        autoAlpha: 0,
        y: 28,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: '#accordion',
          start: 'top 82%',
          once: true
        }
      });
    }

    faqItems.forEach((item) => {
      if (item.dataset.faqMotion) return;
      item.dataset.faqMotion = '1';

      const wrapper = item.querySelector('.accordion__content');
      const content = item.querySelector('.accordion__content__inner');
      const toggle = item.querySelector('.accordion__toggle');

      // Native <details> reveals the answer instantly, so the wrapper height is
      // animated here (CSS grid-template-rows cannot animate the first open and
      // Safari does not interpolate it). Closed items get an explicit collapse.
      if (wrapper && !item.open) {
        gsap.set(wrapper, { height: 0 });
      }

      item.addEventListener('toggle', () => {
        const open = item.open;

        if (wrapper) {
          if (open) {
            if (motion) {
              gsap.fromTo(wrapper, { height: 0 }, {
                height: wrapper.scrollHeight,
                duration: 0.5,
                ease: 'power3.out',
                overwrite: 'auto',
                onComplete: () => gsap.set(wrapper, { height: 'auto' })
              });
            } else {
              gsap.set(wrapper, { height: 'auto' });
            }
          } else if (motion) {
            gsap.set(wrapper, { height: wrapper.scrollHeight });
            gsap.to(wrapper, {
              height: 0,
              duration: 0.3,
              ease: 'power2.in',
              overwrite: 'auto'
            });
          } else {
            gsap.set(wrapper, { height: 0 });
          }
        }

        if (!motion) return;

        if (content) {
          if (open) {
            gsap.fromTo(content, { autoAlpha: 0, y: 12 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.5,
              ease: 'power3.out',
              overwrite: 'auto'
            });
          } else {
            gsap.to(content, {
              autoAlpha: 0,
              y: -6,
              duration: 0.28,
              ease: 'power2.in',
              overwrite: 'auto'
            });
          }
        }

        if (toggle) {
          gsap.fromTo(toggle, { scale: 1 }, {
            scale: 1.15,
            duration: 0.13,
            ease: 'power3.out',
            overwrite: 'auto',
            onComplete: () => {
              gsap.to(toggle, {
                scale: 1,
                duration: 0.32,
                ease: 'back.out(3)',
                overwrite: 'auto'
              });
            }
          });
        }
      });
    });
  }

  document.addEventListener('sectionsRendered', initFaqMotion);
  if (document.querySelector('#accordion .accordion__item')) {
    initFaqMotion();
  }

  // ============================================================
  // REVEAL ANIMATIONS (IntersectionObserver)
  // ============================================================
  const revealElements = document.querySelectorAll('.reveal');

  function checkReveal() {
    const windowBottom = window.innerHeight + window.pageYOffset;

    revealElements.forEach((el) => {
      const revealTop = el.getBoundingClientRect().top + window.pageYOffset;
      const revealPoint = 150;

      if (revealTop < windowBottom - revealPoint) {
        el.classList.add('visible');
      }
    });
  }

  // Initial check on load
  checkReveal();
  // Check on scroll
  window.addEventListener('scroll', checkReveal);

  // ============================================================
  // SMOOTH SCROLL for anchor links
  // ============================================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      const headerOffset = 80; // Height of fixed header
      const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: targetPosition,
        behavior: prefersReducedMotion.matches ? 'auto' : 'smooth'
      });
    });
  });

  // ============================================================
  // YEAR IN FOOTER
  // ============================================================
  const yearEl = document.querySelector('.footer__bottom span');
  if (yearEl && yearEl.textContent.includes('2026')) {
    yearEl.textContent = '© ' + new Date().getFullYear() + ' Ремонт квартиры — Никита Начаткин';
  }

  // ============================================================
  // PONYTAIL MODE ACTIVE — level: full
  // Summary: Native DOM APIs, IntersectionObserver for reveals,
  // calculator with 6-step state machine, form validation, mobile menu.
  // GSAP: scroll reveals for gallery (before/after) + client video
  // carousel. Initialized on 'sectionsRendered' because section DOM is
  // built asynchronously by sections-inject.js.
  // =========================================================================

  // ============================================================
  // GSAP — portfolio motion (gallery + client video)
  // ============================================================
  gsap.registerPlugin(ScrollTrigger);

  function initPortfolioMotion() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gate = reduceMotion ? { duration: 0 } : { duration: 0.9, ease: 'expo.out' };

    gsap.utils.toArray('.ba-pair').forEach((pair) => {
      const panels = pair.querySelectorAll('.ba-panel');
      const arrow = pair.querySelector('.ba-pair__arrow');
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pair,
          start: 'top 86%',
          onEnter: () => console.log('[QA-ST] gallery enter'),
          onLeave: () => console.log('[QA-ST] gallery leave')
        },
        defaults: gate
      });
      tl.fromTo(
        panels,
        { clipPath: 'inset(10% 8% 10% 8% round 24px)', y: 40, autoAlpha: 0 },
        { clipPath: 'inset(0% 0% 0% 0% round 24px)', y: 0, autoAlpha: 1, stagger: 0.16 }
      );
      if (arrow) {
        tl.fromTo(
          arrow,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' },
          '-=0.25'
        );
      }
    });

    const videoSection = document.querySelector('.client-video');
    if (videoSection) {
      gsap.fromTo(
        videoSection,
        { autoAlpha: 0, y: 40 },
        { autoAlpha: 1, y: 0, ...gate, scrollTrigger: { trigger: videoSection, start: 'top 82%', onEnter: () => console.log('[QA-ST] video enter'), onLeave: () => console.log('[QA-ST] video leave') } }
      );
    }
  }

  document.addEventListener('sectionsRendered', initPortfolioMotion);
  // Sections may already be rendered if this handler runs after
  // sections-inject.js finished; otherwise the event covers it.
  if (document.querySelector('.ba-pair') || document.querySelector('.client-video')) {
    initPortfolioMotion();
  }
});
