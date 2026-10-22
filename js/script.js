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
    let consentAccepted = false;
  if (cookieBanner && cookieAcceptBtn) {
    function updateCookieBanner() {
      let accepted = consentAccepted;
      try { accepted = accepted || localStorage.getItem('cookieAccepted') === 'true'; } catch (_) { /* Storage can be unavailable in private browsing. */ }
      if (!accepted) {
        cookieBanner.hidden = false;
        document.body.style.paddingBottom = cookieBanner.offsetHeight + 'px';
        document.documentElement.style.setProperty('--cookie-banner-height', `${cookieBanner.offsetHeight}px`);
      } else {
        cookieBanner.hidden = true;
        document.body.style.paddingBottom = '';
        document.documentElement.style.removeProperty('--cookie-banner-height');
      }
    }
    updateCookieBanner();
    window.addEventListener('resize', updateCookieBanner);
    cookieAcceptBtn.addEventListener('click', () => {
      consentAccepted = true;
      try { localStorage.setItem('cookieAccepted', 'true'); } catch (_) { /* Consent still closes the banner for this visit. */ }
      updateCookieBanner();
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

    // Delegation keeps dynamically loaded navigation links functional.
    mobileMenu.addEventListener('click', (event) => {
      if (event.target.closest('a')) setMenu(false);
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
  // CALCULATOR — questions, answers and rates are configured in the CMS
  // ============================================================
  const calculatorData = {
    selections: {},
    responses: [],
    area: null,
    callbackOnly: false,
    calculatedPrice: null
  };

  const calcQuestionsContainer = document.getElementById('calcQuestions');
  const calcAreaField = document.getElementById('calcAreaField');
  const calcCallbackToggle = document.getElementById('calcCallbackToggle');
  const calcNextBtn = document.getElementById('calcNext');
  const calcBackBtn = document.getElementById('calcBack');
  const calcProgressBar = document.querySelector('.calc__progress__bar');
  const calcStepCurrent = document.getElementById('calcStepCurrent');
  const calcStepLabel = document.getElementById('calcStepLabel');
  const calcHint = document.querySelector('.calc__hint');
  const calcArea = document.getElementById('calcArea');
  const calcCallbackOnly = document.getElementById('calcCallbackOnly');
  const calcError = document.getElementById('calcError');
  const calcResultValue = document.getElementById('calcResultValue');
  const calcResultApprox = document.querySelector('.calc__result__approx');
  const calcResult = document.getElementById('calcResult');
  const calcMeta = document.getElementById('calcMeta');
  const calcBody = document.getElementById('calcBody');
  const calcFooter = document.getElementById('calcFooter');
  const calcResultParams = document.getElementById('calcResultParams');
  const calcAreaQuestion = document.getElementById('calcAreaQuestion');
  const calcSidebarContent = document.getElementById('calcSidebarContent');
  const calculator = document.getElementById('calculator');
  const calcLoadStatus = document.getElementById('calcLoadStatus');
  const calcLoadMessage = document.getElementById('calcLoadMessage');
  const calcRetry = document.getElementById('calcRetry');
  let calculatorReady = false;

  function setCalculatorLoadState(state) {
    if (calculatorReady) return;
    calculator.dataset.state = state;
    calculator.setAttribute('aria-busy', String(state === 'loading'));
    calcNextBtn.disabled = true;
    calcBackBtn.disabled = true;
    calcMeta.hidden = calcBody.hidden = calcFooter.hidden = true;
    calcLoadStatus.hidden = false;
    calcRetry.hidden = state !== 'error';
    calcLoadMessage.textContent = state === 'error'
      ? 'Не удалось загрузить калькулятор. Повторите попытку или оставьте заявку — мы поможем с расчётом.'
      : 'Загружаем вопросы калькулятора…';
  }

  let currentStep = 1;
  let activeQuestions = [];
  let areaStep = 1;
  let lastStep = 1;
  let calculatorConfig = {};
  let activeScenario = null;
  let availableScenarios = [];
  let hasScenarioSelector = false;

  function getCalcSteps() {
    return [...calcQuestionsContainer.querySelectorAll('.calc__field'), calcAreaField]
      .sort((left, right) => Number(left.dataset.step) - Number(right.dataset.step));
  }

  // Clear calculator error when the user edits the area field
  if (calcArea) {
    calcArea.addEventListener('input', () => {
      if (calcError) {
        calcError.hidden = true;
        calcError.textContent = '';
      }
      calcArea.classList.remove('invalid');
    });
  }

  calcCallbackOnly?.addEventListener('change', () => {
    calculatorData.callbackOnly = calcCallbackOnly.checked;
    updateStepUI({ focus: false });
  });

  function getAnswerPriceLabel(answer) {
    const pricingType = answer.pricing_type || answer.pricingType || 'none';
    if (pricingType === 'none') return '';
    const price = answer.price == null || String(answer.price).trim() === '' ? null : Number(answer.price);
    if (price == null || !Number.isFinite(price) || price < 0) {
      return pricingType === 'fixed' ? 'Фиксированная цена не настроена' : 'Цена за единицу не настроена';
    }
    const unitLabels = {
      per_m2: 'м²',
      per_linear_m: 'п.м.',
      per_piece: 'шт.',
      per_set: 'компл.'
    };
    return pricingType === 'fixed'
      ? `${formatNumber(price)} ₽ фиксированно`
      : `${formatNumber(price)} ₽ / ${unitLabels[pricingType] || 'ед.'}`;
  }

  function normalizeScenarioQuestions(scenario) {
    return (Array.isArray(scenario?.questions) ? scenario.questions : []).map((question, index) => ({
      ...question,
      id: String(question?.key || question?.id || `question-${index + 1}`),
      question: String(question?.question ?? '').trim(),
      type: ['single', 'multiple', 'text', 'number'].includes(question?.type) ? question.type : 'single',
      unit: String(question?.unit || '').trim(),
      min: question?.min == null || question.min === '' ? null : Number(question.min),
      max: question?.max == null || question.max === '' ? null : Number(question.max),
      required: question?.required === false || question?.required === 'no' ? false : true,
      answers: Array.isArray(question?.answers)
        ? question.answers.map(answer => ({
            ...(answer || {}),
            label: String(answer?.label ?? '').trim(),
            enabled: answer?.enabled === false || answer?.enabled === 'no' || answer?.enabled === 'off' ? false : true
          }))
        : []
      })).filter(question => question.question && (
        question.type === 'text' || question.type === 'number' ||
        question.answers.some(answer => typeof answer?.label === 'string' && answer.label.trim() && answer.enabled)
      ));
  }

  function createQuestionField(question, questionIndex, firstStep) {
      const field = document.createElement('div');
      field.className = 'calc__field';
      field.dataset.step = String(firstStep + questionIndex);
      field.dataset.questionId = question.id;
      field.dataset.questionType = question.type;

      const title = document.createElement('p');
      title.className = 'calc__question';
      title.textContent = question.question;
      field.appendChild(title);

      if (question.type === 'single' || question.type === 'multiple') {
        const options = document.createElement('div');
        options.className = 'calc__options';
        const inputType = question.type === 'multiple' ? 'checkbox' : 'radio';
        question.answers.forEach((answer, answerIndex) => {
          if (typeof answer?.label !== 'string' || !answer.label.trim() || answer.enabled === false) return;
          const label = document.createElement('label');
          label.className = 'calc__option';

          const input = document.createElement('input');
          input.type = inputType;
          input.name = `answer-${question.id}`;
          input.value = String(answerIndex);
          input.setAttribute('aria-label', answer.label.trim());

          const mark = document.createElement('span');
          mark.className = 'calc__option__mark';
          mark.setAttribute('aria-hidden', 'true');

          const answerLabel = document.createElement('span');
          answerLabel.className = 'calc__option__label';
          answerLabel.textContent = answer.label.trim();
          label.append(input, mark, answerLabel);

          const priceLabel = getAnswerPriceLabel(answer);
          if (priceLabel) {
            const price = document.createElement('span');
            price.className = 'calc__option__sub';
            price.textContent = priceLabel;
            label.appendChild(price);
          }
          options.appendChild(label);
        });
        field.appendChild(options);
      } else {
        const input = document.createElement('input');
        input.type = question.type;
        input.name = `answer-${question.id}`;
        input.className = 'calc__input';
        input.placeholder = question.type === 'number' ? 'Введите число' : 'Введите ответ';
        if (question.type === 'number') {
          input.step = 'any';
          if (question.min != null) input.min = String(question.min);
          if (question.max != null) input.max = String(question.max);
          if (question.unit) input.dataset.unit = question.unit;
        }
        input.setAttribute('aria-label', question.question);
        field.appendChild(input);
      }

      const error = document.createElement('p');
      error.className = 'calc__error';
      error.setAttribute('role', 'alert');
      error.hidden = true;
      field.appendChild(error);
      return field;
  }

  function renderActiveScenario(scenarioIndex) {
    activeScenario = availableScenarios[scenarioIndex] || availableScenarios[0];
    if (!activeScenario) return;
    calculatorData.scenarioId = String(activeScenario.key || `scenario-${scenarioIndex + 1}`);
    calculatorData.scenarioName = activeScenario.name;
    calculatorData.scenarioType = activeScenario.type || 'custom';
    activeQuestions = normalizeScenarioQuestions(activeScenario);

    calcQuestionsContainer.querySelectorAll('.calc__field:not([data-scenario-selector])').forEach(field => field.remove());
    const offset = hasScenarioSelector ? 1 : 0;
    const areaAtStart = activeScenario.area_position === 'start';
    let firstQuestionStep = offset + 1;
    if (areaAtStart) firstQuestionStep++;
    activeQuestions.forEach((question, questionIndex) => {
      calcQuestionsContainer.appendChild(createQuestionField(question, questionIndex, firstQuestionStep));
    });

    areaStep = areaAtStart ? offset + 1 : offset + activeQuestions.length + 1;
    calcAreaField.dataset.step = String(areaStep);
    calcAreaField.dataset.min = String(activeScenario.area_min ?? 1);
    calcAreaField.dataset.max = String(activeScenario.area_max ?? 500);
    calcAreaField.dataset.required = String(activeScenario.area_required !== false && activeScenario.area_required !== 'no');
    calcAreaQuestion.textContent = activeScenario.area_question || calculatorConfig.areaQuestion || 'Площадь помещения';
    calcArea.placeholder = `${calcAreaQuestion.textContent}; ${calcAreaField.dataset.min}–${calcAreaField.dataset.max} м²`;
    calcArea.min = calcAreaField.dataset.min;
    calcArea.max = calcAreaField.dataset.max;
    calcArea.setAttribute('aria-label', calcAreaQuestion.textContent);
    lastStep = Math.max(areaStep, offset + activeQuestions.length + (areaAtStart ? 1 : 0));
  }

  function activateScenario(scenarioIndex) {
    const nextScenario = availableScenarios[scenarioIndex] || availableScenarios[0];
    if (!nextScenario) return;
    if (calculatorData.scenarioId && calculatorData.scenarioId !== String(nextScenario.key)) {
      calculatorData.selections = {};
      calculatorData.responses = [];
      calculatorData.area = null;
      if (calcArea) calcArea.value = '';
    }
    calculatorData.scenarioIndex = scenarioIndex;
    renderActiveScenario(scenarioIndex);
  }

  function renderCalculatorSidebar(config) {
    if (!calcSidebarContent) return;
    calcSidebarContent.replaceChildren();
    const type = config.sidebarContentType || 'none';
    if (type === 'text' && config.sidebarText) {
      const paragraph = document.createElement('p');
      paragraph.className = 'calc__sidebar-text';
      paragraph.textContent = config.sidebarText;
      calcSidebarContent.appendChild(paragraph);
    } else if (type === 'image' && config.sidebarImage) {
      const image = document.createElement('img');
      image.className = 'calc__sidebar-image';
      image.src = config.sidebarImage;
      image.alt = 'Изображение к калькулятору';
      image.loading = 'lazy';
      calcSidebarContent.appendChild(image);
    }
    calcSidebarContent.hidden = !calcSidebarContent.childElementCount;
  }

  function renderQuestions(config = {}) {
    calculatorConfig = config;
    availableScenarios = window.CalculatorPricing.normalizeScenarios(config)
      .filter(scenario => normalizeScenarioQuestions(scenario).length);
    hasScenarioSelector = availableScenarios.length > 1;
    activeScenario = null;
    calculatorData.scenarioId = null;
    calcQuestionsContainer.replaceChildren();
    if (hasScenarioSelector) {
      const scenarioQuestion = {
        id: '__scenario',
        question: config.scenario_question || 'Что будем рассчитывать?',
        type: 'single',
        required: true,
        answers: availableScenarios.map(scenario => ({ label: scenario.name, pricing_type: 'none' }))
      };
      const scenarioField = createQuestionField(scenarioQuestion, 0, 1);
      scenarioField.dataset.scenarioSelector = 'true';
      calcQuestionsContainer.appendChild(scenarioField);
    }

    activateScenario(0);
    renderCalculatorSidebar(config);
    calcCallbackToggle.querySelector('span').textContent = config.callbackLabel || 'Хочу оставить только заявку на звонок — без расчёта';
    calculatorData.selections = {};
    calculatorData.responses = [];
    calculatorData.area = null;
    calculatorData.scenarioIndex = 0;
    calculatorData.pricingBreakdown = [];
    calculatorData.calculatedPrice = null;
    if (calcCallbackOnly) calcCallbackOnly.checked = false;
    currentStep = 1;
    updateStepUI({ focus: false });
  }

  function initialiseCalculator(config) {
    if (calculatorReady) return;
    try {
      if (!config || !window.CalculatorPricing || (!Array.isArray(config.questions) && !Array.isArray(config.scenarios))) {
        throw new Error('Calculator configuration unavailable');
      }
      const scenarios = window.CalculatorPricing.normalizeScenarios(config);
      if (!scenarios.some(scenario => normalizeScenarioQuestions(scenario).length)) {
        throw new Error('Calculator questions unavailable');
      }
      renderQuestions(config);
      calculatorReady = true;
      calculator.dataset.state = 'ready';
      calculator.setAttribute('aria-busy', 'false');
      calcLoadStatus.hidden = true;
      calcNextBtn.disabled = false;
      calcBackBtn.disabled = false;
      calcMeta.hidden = calcBody.hidden = calcFooter.hidden = false;
    } catch (error) {
      calcQuestionsContainer.replaceChildren();
      console.warn('[calculator] Configuration error:', error.message);
      setCalculatorLoadState('error');
    }
  }
  document.addEventListener('calculatorConfigLoaded', event => initialiseCalculator(event.detail));
  document.addEventListener('calculatorLoadState', event => setCalculatorLoadState(event.detail));
  setCalculatorLoadState(window.CALCULATOR_LOAD_STATE || 'loading');
  if (window.SECTION_CALCULATOR) initialiseCalculator(window.SECTION_CALCULATOR);

  function isCallbackOnlyFlow() {
    return Boolean(calcCallbackOnly?.checked);
  }

  function getFlowSteps() {
    if (isCallbackOnlyFlow()) return [...new Set([1, areaStep])];
    return Array.from({ length: lastStep }, (_, index) => index + 1);
  }

  function getCurrentField() {
    return getCalcSteps().find(step => Number(step.dataset.step) === currentStep);
  }

  function hasSelectedAreaRate() {
    return activeQuestions.some(question => {
      if (!['single', 'multiple'].includes(question.type)) return false;
      const selected = calculatorData.selections[question.id];
      const indexes = question.type === 'multiple'
        ? Array.isArray(selected) ? selected : []
        : selected == null || selected === '' ? [] : [selected];
      return indexes.some(index => {
        const answer = question.answers[Number(index)];
        const pricingType = answer?.pricing_type || answer?.pricingType;
        const quantitySource = answer?.quantity_source || answer?.quantitySource || (pricingType === 'per_m2' ? 'area' : '');
        return window.CalculatorPricing.VARIABLE_PRICING_TYPES.includes(pricingType) && quantitySource === 'area';
      });
    });
  }

  function getRequiredQuantitySources() {
    const sources = new Set();
    activeQuestions.forEach(question => {
      if (!['single', 'multiple'].includes(question.type)) return;
      const selected = calculatorData.selections[question.id];
      const indexes = question.type === 'multiple'
        ? Array.isArray(selected) ? selected : []
        : selected == null || selected === '' ? [] : [selected];
      indexes.forEach(index => {
        const answer = question.answers[Number(index)];
        const pricingType = answer?.pricing_type || answer?.pricingType;
        if (!window.CalculatorPricing.VARIABLE_PRICING_TYPES.includes(pricingType)) return;
        const source = answer?.quantity_source || answer?.quantitySource || (pricingType === 'per_m2' ? 'area' : '');
        if (source) sources.add(String(source));
      });
    });
    return sources;
  }

  // Update UI for current step
  function updateStepUI(options = {}) {
    const { focus = true, preventScroll = true } = options;
    const flowSteps = getFlowSteps();
    const flowPosition = Math.max(0, flowSteps.indexOf(currentStep)) + 1;
    const currentField = getCurrentField();
    calcStepCurrent.textContent = `${flowPosition} / ${flowSteps.length}`;
    calcStepLabel.textContent = currentField?.querySelector('.calc__question')?.textContent || '';
    calcHint.textContent = currentStep === areaStep
      ? isCallbackOnlyFlow()
        ? 'Стоимость обсудим по телефону — расчёт не выполняется.'
        : 'Укажите количество; оно будет использовано в тарифах, где выбрана эта единица измерения.'
      : '';

    // Show/hide fields
    getCalcSteps().forEach((stepEl) => {
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
    calcCallbackToggle.hidden = currentStep !== 1;

    // Update progress bar width
    const progressPercent = flowSteps.length > 1 ? ((flowPosition - 1) / (flowSteps.length - 1)) * 100 : 100;
    calcProgressBar.style.width = progressPercent + '%';

    // Update back button visibility
    calcBackBtn.hidden = currentStep === 1;

    // Hide "Next" on radio steps; step 1 stays manual to expose the short path.
    const isSingleChoice = currentField?.dataset.questionType === 'single';
    const currentQuestion = activeQuestions.find(question => question.id === currentField?.dataset.questionId);
    const questionRequired = currentQuestion?.required !== false && currentQuestion?.required !== 'no';
    if (isSingleChoice && questionRequired && currentStep !== 1 && !isCallbackOnlyFlow() && !currentField.querySelector('input[type="radio"]:checked')) {
      calcNextBtn.hidden = true;
    } else {
      calcNextBtn.hidden = false;
    }

    const nextText = calcNextBtn.querySelector('.calc__next-text');
    if (nextText) {
      nextText.textContent = isCallbackOnlyFlow() && currentStep === 1 && areaStep !== 1
        ? 'Указать площадь'
        : currentStep === flowSteps[flowSteps.length - 1]
          ? isCallbackOnlyFlow() ? 'Попросить перезвонить' : 'Получить результат'
          : 'Далее';
    }
  }

  // Validate current step
  function validateStep() {
    const currentField = getCurrentField();
    if (!currentField) return true;
    const currentError = currentField.querySelector('.calc__error');
    if (currentError) {
      currentError.textContent = '';
      currentError.hidden = true;
    }
    if (currentField === calcAreaField) calcArea.classList.remove('invalid');

    if (currentField === calcAreaField) {
      const areaRequired = calcAreaField.dataset.required === 'true' || isCallbackOnlyFlow() || hasSelectedAreaRate();
      if (!calcArea.value.trim() && !areaRequired) return true;
      const area = Number(calcArea.value);
      if (!calcArea.value.trim() || !Number.isFinite(area)) {
        showCalcError(calcArea.value.trim() ? 'Введите корректное число' : `Пожалуйста, введите значение: ${calcAreaQuestion.textContent.toLowerCase()}`);
        calcArea.classList.add('invalid');
        return false;
      }
      const min = Number(calcAreaField.dataset.min || 1);
      const max = Number(calcAreaField.dataset.max || 500);
      if (area < min || area > max) {
        showCalcError(area < min ? `Значение не может быть меньше ${min}` : `Значение не может быть больше ${max}`);
        calcArea.classList.add('invalid');
        return false;
      }
      return true;
    }

    if (currentField.dataset.scenarioSelector) {
      if (!currentField.querySelector('input[type="radio"]:checked')) {
        showCalcError('Выберите, что нужно рассчитать');
        return false;
      }
      return true;
    }

    if (isCallbackOnlyFlow() && currentStep !== areaStep) return true;

    const question = activeQuestions.find(item => item.id === currentField.dataset.questionId);
    if (!question) return true;
    const inputs = [...currentField.querySelectorAll(`input[name="answer-${question.id}"]`)];
    const hasAnswer = question.type === 'multiple'
      ? inputs.some(input => input.checked)
      : question.type === 'single'
          ? inputs.some(input => input.checked)
          : question.type === 'number'
            ? inputs[0]?.value.trim() !== '' && Number.isFinite(Number(inputs[0].value))
            : inputs[0]?.value.trim() !== '';
    const quantityRequired = question.type === 'number' && getRequiredQuantitySources().has(question.id);
    if (!hasAnswer && (question.required === false || question.required === 'no') && !quantityRequired) return true;
    if (hasAnswer) {
      if (question.type === 'number' && inputs[0]?.value.trim()) {
        const value = Number(inputs[0].value);
        if (value < 0 || (question.min != null && value < question.min) || (question.max != null && value > question.max)) {
          showCalcError(question.min != null && value < question.min
            ? `Значение не может быть меньше ${question.min}`
            : question.max != null && value > question.max
              ? `Значение не может быть больше ${question.max}`
              : 'Значение не может быть отрицательным');
          return false;
        }
      }
      return true;
    }

    const message = question.type === 'multiple' || question.type === 'single'
      ? 'Выберите ответ'
      : question.type === 'number' ? 'Введите число' : 'Введите ответ';
    showCalcError(message);
    return false;
  }

  function validatePricingQuantities() {
    const requiredSources = getRequiredQuantitySources();
    if (requiredSources.has('area') && (calculatorData.area == null || calculatorData.area === '')) {
      currentStep = areaStep;
      updateStepUI();
      showCalcError(`Пожалуйста, укажите значение: ${calcAreaQuestion.textContent.toLowerCase()}`);
      calcArea.classList.add('invalid');
      return false;
    }

    for (const question of activeQuestions) {
      if (question.type !== 'number' || !requiredSources.has(question.id)) continue;
      const value = calculatorData.selections[question.id];
      if (value != null && value !== '' && Number.isFinite(Number(value))) continue;
      const field = calcQuestionsContainer.querySelector(`.calc__field[data-question-id="${CSS.escape(question.id)}"]`);
      if (!field) continue;
      currentStep = Number(field.dataset.step);
      updateStepUI();
      showCalcError('Введите количество для выбранного тарифа');
      return false;
    }
    return true;
  }

  // Show calculator error message
  function showCalcError(message) {
    const error = getCurrentField()?.querySelector('.calc__error');
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  // Collect data from current step into calculatorData
  function collectStepData() {
    const currentField = getCurrentField();
    if (!currentField) return;
    if (currentField === calcAreaField) {
      calculatorData.area = calcArea.value.trim() ? Number(calcArea.value) : null;
      return;
    }

    if (currentField.dataset.scenarioSelector) {
      const checked = currentField.querySelector('input[type="radio"]:checked');
      if (checked) calculatorData.scenarioIndex = Number(checked.value);
      return;
    }

    const question = activeQuestions.find(item => item.id === currentField.dataset.questionId);
    if (!question) return;
    const inputs = [...currentField.querySelectorAll(`input[name="answer-${question.id}"]`)];
    if (question.type === 'single') {
      calculatorData.selections[question.id] = inputs.find(input => input.checked)?.value ?? null;
    } else if (question.type === 'multiple') {
      calculatorData.selections[question.id] = inputs.filter(input => input.checked).map(input => input.value);
    } else if (question.type === 'number') {
      calculatorData.selections[question.id] = inputs[0]?.value.trim() ? Number(inputs[0].value) : '';
    } else {
      calculatorData.selections[question.id] = inputs[0]?.value.trim() || '';
    }
  }

  function getCalculatorResponses() {
    return activeQuestions.map(question => {
      const selected = calculatorData.selections[question.id];
      if (question.type === 'text' || question.type === 'number') {
        return selected === '' || selected == null
          ? null
          : { questionId: question.id, question: question.question, type: question.type, unit: question.unit, answer: selected };
      }
      const indexes = question.type === 'multiple'
        ? Array.isArray(selected) ? selected : []
        : selected == null || selected === '' ? [] : [selected];
      const answers = indexes.map(value => question.answers[Number(value)]).filter(Boolean).map(answer => ({
        index: question.answers.indexOf(answer),
        label: answer.label,
        pricingType: answer.pricing_type || answer.pricingType || 'none',
        price: answer.price ?? null,
        quantitySource: answer.quantity_source || answer.quantitySource || null
      }));
      return answers.length ? { questionId: question.id, question: question.question, type: question.type, answers } : null;
    }).filter(Boolean);
  }

  // Calculate price
  function calculatePrice() {
    if (calculatorData.callbackOnly) return null;
    return window.CalculatorPricing?.calculate(activeQuestions, calculatorData.selections, calculatorData.area, {
      areaMin: activeScenario?.area_min ?? 1,
      areaMax: activeScenario?.area_max ?? 500
    }) || null;
  }

  // Format number with spaces
  function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(num));
  }

  function formatResponseValue(response, pricingByAnswer) {
    if (!response.answers) {
      if (response.type !== 'number') return response.answer;
      const unit = response.unit ? ` ${response.unit}` : '';
      return `${formatNumber(response.answer)}${unit}`;
    }

    const unitLabels = { per_m2: 'м²', per_linear_m: 'п.м.', per_piece: 'шт.', per_set: 'компл.' };
    return response.answers.map(answer => {
      const item = pricingByAnswer.get(JSON.stringify([response.questionId, answer.index]));
      if (!item) return answer.label;
      if (item.pricingType === 'fixed') return `${answer.label} — ${formatNumber(item.amount)} ₽ фиксированно`;
      const quantityUnit = item.quantitySource === 'area'
        ? item.quantityUnit || 'м²'
        : activeQuestions.find(question => question.id === item.quantitySource)?.unit || 'ед.';
      const rateUnit = unitLabels[item.pricingType] || quantityUnit;
      return `${answer.label} — ${formatNumber(item.unitPrice)} ₽/${rateUnit} × ${formatNumber(item.quantity)} ${quantityUnit} = ${formatNumber(item.amount)} ₽`;
    }).join(', ');
  }

  function syncCalculatorDataToForm(calculation) {
    const price = calculation?.total ?? null;
    calculatorData.responses = getCalculatorResponses();
    calculatorData.pricingBreakdown = calculation?.breakdown || [];
    calculatorData.calculatedPrice = price;

    if (formCalculatorData) {
      formCalculatorData.value = JSON.stringify({
        ...calculatorData,
        requestType: calculatorData.callbackOnly || price == null ? 'callback' : 'estimate'
      });
    }

    return price;
  }

  // Show the result for whichever questions and tariffs are configured.
  function showResult() {
    const calculation = calculatePrice();
    const callbackOnly = calculatorData.callbackOnly;
    const price = syncCalculatorDataToForm(calculation);

    calcResultValue.textContent = callbackOnly
      ? 'Заявка на звонок'
      : price == null
        ? 'Нужна консультация'
        : `${formatNumber(price)} ₽`;
    if (calcResultApprox) {
      calcResultApprox.textContent = callbackOnly
        ? 'Оставьте контакты — мастер перезвонит и обсудит ремонт. Расчёт не выполнялся.'
        : price == null
          ? 'Для выбранных вариантов не настроена цена. Оставьте заявку — мастер уточнит стоимость по телефону.'
          : 'Предварительная смета рассчитана по выбранным вариантам. Итог уточняется после замера.';
    }

    calcResultParams.replaceChildren();
    const addResultRow = (label, value) => {
      if (value == null || value === '') return;
      const row = document.createElement('div');
      row.className = 'calc__result__params__row';
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = String(value);
      row.append(term, description);
      calcResultParams.appendChild(row);
    };
    if (calculatorData.area != null && calculatorData.area !== '') {
      addResultRow(activeScenario?.area_question || 'Площадь', `${formatNumber(calculatorData.area)} м²`);
    }
    const pricingByAnswer = new Map();
    calculatorData.pricingBreakdown.forEach(item => {
      pricingByAnswer.set(JSON.stringify([item.questionId, item.answerIndex]), item);
    });
    if (calculatorData.scenarioName) {
      addResultRow('Расчёт', calculatorData.scenarioName);
    }
    calculatorData.responses.forEach(response => {
      addResultRow(response.question, formatResponseValue(response, pricingByAnswer));
    });

    const applicationLink = calcResult.querySelector('.calc__result__cta a[href="#application"]');
    if (applicationLink) {
      applicationLink.textContent = callbackOnly || price == null
        ? 'Оставить заявку на звонок'
        : 'Оставить заявку';
    }

    // Replace questions area with result — only the result stays visible
    getCalcSteps().forEach(step => {
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
    Object.assign(calculatorData, {
      selections: {},
      responses: [],
      pricingBreakdown: [],
      area: null,
      scenarioId: null,
      scenarioName: null,
      scenarioType: null,
      scenarioIndex: 0,
      callbackOnly: false,
      calculatedPrice: null
    });
    activateScenario(0);

    // Reset UI
    currentStep = 1;
    getCalcSteps().forEach(step => {
      step.hidden = false;
      step.classList.remove('step-out', 'step-in');
    });
    calcCallbackOnly.checked = false;
    calcResultParams.replaceChildren();
    calcMeta.hidden = false;
    calcBody.hidden = false;
    calcFooter.hidden = false;
    calcResult.classList.remove('step-in');
    calcResult.hidden = true;
    calcNextBtn.hidden = false;
    calcBackBtn.hidden = true;
    calcBackBtn.textContent = 'Назад';

    // Clear inputs
    getCalcSteps().forEach(step => {
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
    const formCalculatorData = document.getElementById('formCalculatorData');
    if (formCalculatorData) formCalculatorData.value = '';

    // Focus first input
    setTimeout(() => {
      const firstInput = getCurrentField()?.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus({ preventScroll: true });
    }, 100);
  }

  // Event listeners
  calcNextBtn.addEventListener('click', () => {
    if (!validateStep()) return;
    collectStepData();

    if (hasScenarioSelector && currentStep === 1) {
      activateScenario(calculatorData.scenarioIndex ?? 0);
      currentStep = isCallbackOnlyFlow() ? areaStep : 2;
      updateStepUI();
      return;
    }

    if (isCallbackOnlyFlow()) {
      if (currentStep !== areaStep) {
        currentStep = areaStep;
        updateStepUI();
      } else {
        showResult();
      }
      return;
    }

    if (currentStep >= lastStep) {
      if (!validatePricingQuantities()) return;
      showResult();
      return;
    }

    currentStep++;
    updateStepUI();
  });

  calcBackBtn.addEventListener('click', () => {
    if (calcBackBtn.textContent === 'Начать заново') {
      // Reset from result screen
      resetCalculator();
    } else if (currentStep > 1) {
      // Normal back
      currentStep = currentStep === areaStep && isCallbackOnlyFlow() ? 1 : currentStep - 1;
      updateStepUI();
    }
  });

  // Initialize (no focus, no scroll on page load)
  updateStepUI({ focus: false });

  // ============================================================
  // AUTO-ADVANCE on radio select
  // ============================================================
  // When user picks a radio option, automatically advance to next step.
  // Multiple-choice and free-text answers require the explicit next button.
  // Each question fades out and the next fades in — no page scroll.
  calcBody.addEventListener('change', event => {
    const radio = event.target;
    if (!radio.matches('.calc__field input[type="radio"]') || currentStep === 1 || currentStep >= lastStep || isCallbackOnlyFlow()) return;
    const selectedStep = currentStep;
    const currentField = getCurrentField();
    if (!currentField?.contains(radio)) return;

    setTimeout(() => {
      if (currentStep !== selectedStep || !currentField.contains(radio)) return;
      collectStepData();
      currentField.classList.add('step-out');

      setTimeout(() => {
        if (currentStep !== selectedStep) return;
        currentStep++;
        updateStepUI();
        const nextField = getCurrentField();
        nextField?.classList.remove('step-out');
        nextField?.classList.add('step-in');
      }, 300);
    }, 200);
  });

  // Transfer calculator data to form hidden field when navigating from calculator
  const calculatorResult = document.getElementById('calcResult');
  const formCalculatorData = document.getElementById('formCalculatorData');

  // When user goes from calculator to application form, transfer data
  const calcToApplicationLinks = document.querySelectorAll('a[href="#application"]');
  calcToApplicationLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (calculatorResult && !calculatorResult.hidden) {
        syncCalculatorDataToForm(calculatePrice());
      }
    });
  });

  calcBody.addEventListener('input', event => {
    const field = event.target.closest('.calc__field');
    const error = field?.querySelector('.calc__error');
    if (error) error.hidden = true;
    if (event.target === calcArea) calcArea.classList.remove('invalid');
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
          const calculatedPrice = payload.calculator_data.calculatedPrice;
          payload.calculated_price = Number.isFinite(calculatedPrice) ? calculatedPrice : null;
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
        if (val && !/^[78]/.test(val)) val = '7' + val;
        if (val.startsWith('8')) val = '7' + val.slice(1);
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
    if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(max-width: 767px), (prefers-reduced-motion: reduce)').matches) return;
    const faqItems = gsap.utils.toArray('#accordion .accordion__item');
    if (faqItems.length === 0) return;
    const motion = !prefersReducedMotion.matches;

    if (motion) {
      gsap.registerPlugin(ScrollTrigger);
      gsap.from(faqItems, {
        immediateRender: false,
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
  function initPortfolioMotion() {
    // Content stays visible if optional motion dependencies fail.
    if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(max-width: 767px), (prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger);
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
        { immediateRender: false, clipPath: 'inset(0% 0% 0% 0% round 24px)', y: 0, autoAlpha: 1, stagger: 0.16 }
      );
      if (arrow) {
        tl.fromTo(
          arrow,
          { scale: 0, opacity: 0 },
          { immediateRender: false, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' },
          '-=0.25'
        );
      }
    });

    const videoSection = document.querySelector('.client-video');
    if (videoSection) {
      gsap.fromTo(
        videoSection,
        { autoAlpha: 0, y: 40 },
        { immediateRender: false, autoAlpha: 1, y: 0, ...gate, scrollTrigger: { trigger: videoSection, start: 'top 82%', onEnter: () => console.log('[QA-ST] video enter'), onLeave: () => console.log('[QA-ST] video leave') } }
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
