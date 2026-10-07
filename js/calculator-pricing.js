(function (root) {
  const VARIABLE_PRICING_TYPES = ['per_m2', 'per_linear_m', 'per_piece', 'per_set'];

  function fromLegacyConfig(config = {}) {
    const rates = config.rates || {
      newBuilding: { finished: 4500, unfinished: 5500, whiteBox: 5000 },
      secondary: { finished: 5000, unfinished: 6000, whiteBox: 5500 }
    };
    const coefficients = config.coefficients || {
      hasProject: 1,
      needsChanges: 1.3,
      noProject: 1.5
    };
    const propertyTypes = [
      { value: 'newBuilding', label: 'Новостройка' },
      { value: 'secondary', label: 'Вторичное жильё' }
    ];
    const conditions = [
      { value: 'finished', label: 'С отделкой' },
      { value: 'unfinished', label: 'Без отделки' },
      { value: 'whiteBox', label: 'White Box' }
    ];
    const projects = [
      { value: 'hasProject', label: 'Есть дизайн-проект' },
      { value: 'needsChanges', label: 'Проект нужно доработать' },
      { value: 'noProject', label: 'Нет проекта' }
    ];
    const answers = [];

    for (const property of propertyTypes) {
      for (const condition of conditions) {
        for (const project of projects) {
          const rate = Number(rates[property.value]?.[condition.value]);
          const coefficient = Number(coefficients[project.value]);
          const hasRate = rates[property.value]?.[condition.value] != null && String(rates[property.value][condition.value]).trim() !== '';
          const hasCoefficient = coefficients[project.value] != null && String(coefficients[project.value]).trim() !== '';
          answers.push({
            label: `${property.label} · ${condition.label} · ${project.label}`,
            pricing_type: 'per_m2',
            quantity_source: 'area',
            price: hasRate && hasCoefficient && Number.isFinite(rate) && Number.isFinite(coefficient) && rate >= 0 && coefficient >= 0
              ? rate * coefficient
              : null
          });
        }
      }
    }

    const questions = [{ key: 'legacy-base-rate', question: 'Тип объекта, состояние квартиры и проект', type: 'single', answers }];
    const finishQuestions = [
      ['Отделка стен', 'walls'],
      ['Отделка потолка', 'ceiling'],
      ['Отделка пола', 'floor']
    ];
    for (const [question, key] of finishQuestions) {
      if (!Array.isArray(config.finishes?.[key]) || !config.finishes[key].length) continue;
      questions.push({
        key: `legacy-${key}`,
        question,
        type: 'single',
        answers: config.finishes[key].map(option => ({
          label: option?.name || '',
          pricing_type: 'per_m2',
          quantity_source: 'area',
          price: option?.price_per_floor_m2 ?? null
        }))
      });
    }

    questions.push(
      {
        key: 'legacy-start-date',
        question: 'Когда хотите начать ремонт?',
        type: 'single',
        answers: ['Как можно скорее', 'В течение месяца', 'Через 1–3 месяца', 'Позже']
          .map(label => ({ label, pricing_type: 'none', price: null }))
      },
      {
        key: 'legacy-measurement',
        question: 'Нужен ли замер и подготовка сметы?',
        type: 'single',
        answers: [
          { label: 'Да', pricing_type: 'fixed', price: config.measurement_fee ?? 3000 },
          { label: 'Нет', pricing_type: 'none', price: null }
        ]
      }
    );

    return questions;
  }

  function normalizeScenarios(config = {}) {
    if (Array.isArray(config.scenarios) && config.scenarios.length) {
      return config.scenarios.filter(scenario => scenario && String(scenario.name || '').trim()).map((scenario, index) => ({
        ...scenario,
        key: String(scenario.key || `scenario-${index + 1}`),
        name: String(scenario.name).trim(),
        area_question: scenario.area_question || config.area_question || 'Площадь помещения',
        area_position: scenario.area_position === 'start' ? 'start' : 'end',
        area_min: scenario.area_min == null ? 1 : Number(scenario.area_min),
        area_max: scenario.area_max == null ? 500 : Number(scenario.area_max),
        area_required: scenario.area_required === false || scenario.area_required === 'no' ? false : true,
        questions: Array.isArray(scenario.questions) ? scenario.questions : []
      }));
    }

    const legacyQuestions = Array.isArray(config.questions) ? config.questions : fromLegacyConfig(config);
    return [{
      key: 'whole-apartment',
      name: 'Вся квартира',
      area_question: config.area_question || 'Площадь квартиры по полу',
      area_position: 'end',
      area_min: 10,
      area_max: 500,
      area_required: false,
      questions: legacyQuestions
    }];
  }

  function calculate(questions, selections, rawArea, options = {}) {
    const areaProvided = rawArea != null && String(rawArea).trim() !== '';
    const area = areaProvided ? Number(rawArea) : null;
    const areaMin = Number.isFinite(Number(options.areaMin)) ? Number(options.areaMin) : 10;
    const areaMax = Number.isFinite(Number(options.areaMax)) ? Number(options.areaMax) : 500;
    if (!Array.isArray(questions) || !questions.length) return null;
    if (areaProvided && (!Number.isFinite(area) || area < areaMin || area > areaMax)) return null;

    let perM2 = 0;
    let fixedTotal = 0;
    let total = 0;
    let hasPricedSelection = false;
    const breakdown = [];

    for (const [questionIndex, question] of questions.entries()) {
      if (!['single', 'multiple', 'text', 'number'].includes(question.type)) continue;
      const questionId = String(question.key || question.id || `question-${questionIndex}`);
      const selected = selections?.[questionId];

      if (question.type === 'number' || question.type === 'text') {
        if (selected == null || selected === '') {
          if (question.required !== false && question.required !== 'no') return null;
          continue;
        }
        if (question.type === 'number') {
          const quantity = Number(selected);
          if (!Number.isFinite(quantity) || quantity < 0) return null;
          if (question.min != null && quantity < Number(question.min)) return null;
          if (question.max != null && quantity > Number(question.max)) return null;
        }
        continue;
      }

      const enabledAnswers = (question.answers || []).filter(answer => answer?.enabled !== false && answer?.enabled !== 'no' && answer?.enabled !== 'off');
      if (!enabledAnswers.length) continue;
      const selectedIndexes = question.type === 'multiple'
        ? Array.isArray(selected) ? selected : []
        : selected == null || selected === '' ? [] : [selected];
      if (question.required !== false && question.required !== 'no' && selectedIndexes.length === 0) return null;
      if (question.type === 'single' && selectedIndexes.length > 1) return null;

      for (const rawIndex of selectedIndexes) {
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index < 0 || !question.answers?.[index]) return null;

        const answer = question.answers[index];
        if (answer.enabled === false || answer.enabled === 'no' || answer.enabled === 'off') return null;
        const pricingType = answer.pricing_type || answer.pricingType || 'none';
        if (pricingType === 'none') continue;
        if (!VARIABLE_PRICING_TYPES.includes(pricingType) && pricingType !== 'fixed') return null;

        const rawPrice = answer.price;
        if (rawPrice == null || String(rawPrice).trim() === '') return null;
        const unitPrice = Number(rawPrice);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;

        let quantity = 1;
        let quantitySource = null;
        let quantityUnit = null;
        if (VARIABLE_PRICING_TYPES.includes(pricingType)) {
          quantitySource = String(answer.quantity_source || answer.quantitySource || (pricingType === 'per_m2' ? 'area' : '')).trim();
          if (!quantitySource) return null;
          const rawQuantity = quantitySource === 'area' ? area : selections?.[quantitySource];
          if (rawQuantity == null || String(rawQuantity).trim() === '') return null;
          quantity = Number(rawQuantity);
          if (!Number.isFinite(quantity) || quantity < 0) return null;
          const quantityQuestion = questions.find((item, sourceIndex) => String(item.key || item.id || `question-${sourceIndex}`) === quantitySource);
          quantityUnit = quantitySource === 'area' ? 'м²' : String(quantityQuestion?.unit || 'ед.');
        }

        const amount = pricingType === 'fixed' ? unitPrice : unitPrice * quantity;
        if (!Number.isFinite(amount)) return null;
        hasPricedSelection = true;
        total += amount;
        if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) return null;
        if (pricingType === 'per_m2') perM2 += unitPrice;
        if (pricingType === 'fixed') fixedTotal += unitPrice;
        breakdown.push({
          questionId,
          question: question.question,
          answer: answer.label,
          answerIndex: index,
          pricingType,
          quantitySource,
          quantityUnit,
          quantity,
          unitPrice,
          amount
        });
      }
    }

    if (!hasPricedSelection || !Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) return null;
    return { total: Math.round(total), perM2, fixedTotal, area, breakdown };
  }

  root.CalculatorPricing = { calculate, fromLegacyConfig, normalizeScenarios, VARIABLE_PRICING_TYPES };
})(globalThis);
