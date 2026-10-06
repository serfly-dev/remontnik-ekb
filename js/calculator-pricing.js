(function (root) {
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
      { value: 'finished', label: 'Есть ремонт' },
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
            price: hasRate && hasCoefficient && Number.isFinite(rate) && Number.isFinite(coefficient) && rate >= 0 && coefficient >= 0
              ? rate * coefficient
              : null
          });
        }
      }
    }

    const questions = [
      {
        question: 'Тип объекта, состояние квартиры и проект',
        type: 'single',
        answers
      }
    ];

    const finishQuestions = [
      ['Отделка стен', 'walls'],
      ['Отделка потолка', 'ceiling'],
      ['Отделка пола', 'floor']
    ];
    for (const [question, key] of finishQuestions) {
      if (!Array.isArray(config.finishes?.[key]) || !config.finishes[key].length) continue;
      questions.push({
        question,
        type: 'single',
        answers: config.finishes[key].map(option => ({
          label: option?.name || '',
          pricing_type: 'per_m2',
          price: option?.price_per_floor_m2 ?? null
        }))
      });
    }

    questions.push(
      {
        question: 'Когда хотите начать ремонт?',
        type: 'single',
        answers: ['Как можно скорее', 'В течение месяца', 'Через 1–3 месяца', 'Позже']
          .map(label => ({ label, pricing_type: 'none', price: null }))
      },
      {
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

  function calculate(questions, selections, rawArea) {
    const areaProvided = rawArea != null && String(rawArea).trim() !== '';
    const area = areaProvided ? Number(rawArea) : null;
    if (!Array.isArray(questions) || !questions.length || (areaProvided && (!Number.isFinite(area) || area < 10 || area > 500))) return null;

    let perM2 = 0;
    let fixedTotal = 0;
    let hasPricedSelection = false;
    const breakdown = [];

    for (const question of questions) {
      if (!['single', 'multiple'].includes(question.type)) continue;

      const selected = selections?.[question.id];
      const selectedIndexes = question.type === 'multiple'
        ? Array.isArray(selected) ? selected : []
        : selected == null || selected === '' ? [] : [selected];

      if (question.required !== false && question.required !== 'no' && selectedIndexes.length === 0) return null;

      for (const rawIndex of selectedIndexes) {
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index < 0 || !question.answers?.[index]) return null;

        const answer = question.answers[index];
        const pricingType = answer.pricing_type || answer.pricingType || 'none';
        if (pricingType === 'none') continue;
        if (!['per_m2', 'fixed'].includes(pricingType)) return null;

        const rawPrice = answer.price;
        if (rawPrice == null || String(rawPrice).trim() === '') return null;
        const price = Number(rawPrice);
        if (!Number.isFinite(price) || price < 0) return null;

        if (pricingType === 'per_m2' && area == null) return null;
        const amount = pricingType === 'per_m2' ? price * area : price;
        if (!Number.isFinite(amount)) return null;
        hasPricedSelection = true;
        if (pricingType === 'per_m2') perM2 += price;
        else fixedTotal += price;
        breakdown.push({
          question: question.question,
          answer: answer.label,
          pricingType,
          unitPrice: price,
          amount
        });
      }
    }

    const total = perM2 * (area ?? 0) + fixedTotal;
    if (!hasPricedSelection || !Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) return null;

    return {
      total: Math.round(total),
      perM2,
      fixedTotal,
      area,
      breakdown
    };
  }

  root.CalculatorPricing = { calculate, fromLegacyConfig };
})(globalThis);
