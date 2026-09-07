/**
 * Seed script — populates the sections table with initial content
 * matching the current index.html layout.
 *
 * Run: node server/database/seed-sections.js
 */

import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '../..');
const dbPath = process.env.DB_PATH || join(rootDir, 'server', 'database', 'database.sqlite');

// Load prices from data/prices.json
function loadPrices() {
  const path = join(rootDir, 'data', 'prices.json');
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  return null;
}

// Initial sections data — mirrors current index.html content
const SECTIONS = [
  {
    key: 'hero',
    title: 'Hero — Главный экран',
    content: {
      eyebrow: 'Ремонт квартиры в Екатеринбурге',
      title: 'Ремонт квартиры\nбез лишних переплат\nи иллюзий',
      subtitle: 'Более 10 лет в строительстве. Опыт крупных объектов и ремонт по дизайн-проекту. Прозрачная смета и понятный процесс от замера до результата.',
      cta_primary: 'Забронировать замер',
      cta_primary_href: '#formats',
      cta_secondary: 'Рассчитать стоимость',
      cta_secondary_href: '#calculator',
      image: 'public/images/hero-interior.jpg',
      imageAlt: 'Фото отремонтированной квартиры',
      imageCaption: 'Пример работы — гостиная',
      proof: [
        { num: '10+', label: 'лет в строительстве' },
        { num: 'Clever Park', label: 'крупный проект' },
        { num: 'Пермь', label: 'аэропорт' },
        { num: '@nikitanachatkin', label: 'Telegram' }
      ]
    },
    order_index: 1
  },
  {
    key: 'services',
    title: 'Услуги',
    content: {
      eyebrow: 'Услуги',
      eyebrow_num: '2',
      title: 'Чем могу помочь',
      items: [
        {
          num: '01',
          title: 'Ремонт новостройки',
          desc: 'Комплексный ремонт от черновой отделки до готовности к жизни.',
          items: ['Подготовка стен и полов', 'Электропроводка и сантехника', 'Чистовая отделка', 'Установка дверей и плинтусов']
        },
        {
          num: '02',
          title: 'Ремонт вторичного жилья',
          desc: 'Обновление квартиры с учётом существующих коммуникаций.',
          items: ['Демонтаж старых покрытий', 'Замена коммуникаций', 'Выравнивание поверхностей', 'Чистовая отделка']
        },
        {
          num: '03',
          title: 'Ремонт по дизайн-проекту',
          desc: 'Реализация проекта с точным соблюдением всех решений.',
          items: ['Работа по проекту', 'Подбор и закупка материалов', 'Сложные конструкции', 'Премиальная отделка']
        },
        {
          num: '04',
          title: 'Ремонт ванной',
          desc: 'Отдельный ремонт санузла — от плитки до сантехники.',
          items: ['Гидроизоляция', 'Плиточные работы', 'Установка сантехники', 'Освещение и вентиляция']
        },
        {
          num: '05',
          title: 'Отделочные работы',
          desc: 'Покраска, обои, плитка, полы — часть ремонта или отдельно.',
          items: ['Малярные работы', 'Укладка плитки', 'Монтаж полов', 'Поклейка обоев']
        }
      ]
    },
    order_index: 2
  },
  {
    key: 'portfolio',
    title: 'Портфолио',
    content: {
      eyebrow: 'Портфолио',
      eyebrow_num: '3',
      title: 'Примеры работ',
      note: 'Реальные фотографии работ будут добавлены после согласования с клиентами.',
      items: [
        { image: 'public/images/work-1.jpg', alt: 'Пример ремонта квартиры — гостиная', tags: ['Квартира', 'Новостройка'], title: 'Ремонт трёхкомнатной квартиры', type: 'feature' },
        { image: 'public/images/work-2.jpg', alt: 'Пример отделки интерьера', tags: ['Интерьер'], title: 'Современный интерьер', type: 'wide' },
        { image: 'public/images/work-3.jpg', alt: 'Пример ремонта ванной', tags: ['Санузел'], title: 'Ремонт ванной комнаты', type: 'std' },
        { image: 'public/images/work-4.jpg', alt: 'Пример ремонта гостиной', tags: ['Гостиная'], title: 'Гостиная с панорамным окном', type: 'tall' },
        { image: 'public/images/work-5.jpg', alt: 'Пример отделки спальни', tags: ['Спальня'], title: 'Спальня в скандинавском стиле', type: 'std' },
        { image: 'public/images/work-6.jpg', alt: 'Пример кухни', tags: ['Кухня'], title: 'Кухня-гостиная', type: 'wide' }
      ]
    },
    order_index: 3
  },
  {
    key: 'variants',
    title: 'Варианты сотрудничества',
    content: {
      eyebrow: 'Варианты сотрудничества',
      eyebrow_num: '4',
      title: 'Выберите формат работы',
      option1: {
        num: '01',
        title: 'Замер + смета на работы',
        price: 3000,
        desc: 'Подходит тем, кто хочет получить понятную стоимость работ и самостоятельно заниматься закупкой материалов.',
        steps: ['Выезд на объект и замер', 'Смета на работы', 'Согласование сметы', 'Подписание договора', 'Выбор даты начала'],
        cta: 'Выбрать вариант',
        cta_href: '#calculator'
      },
      option2: {
        num: '02',
        num_badge: 'Для полного понимания бюджета',
        title: 'Замер + смета на работы и материалы',
        price: 10000,
        desc: 'Подходит тем, кто хочет заранее понимать практически весь бюджет ремонта.',
        steps: ['Выезд на объект и замер', 'Смета на работы и материалы', 'Согласование сметы', 'Подписание договора', 'Выбор даты начала'],
        cta: 'Выбрать вариант',
        cta_href: '#calculator',
        is_featured: true
      },
      compare: {
        col1_title: 'Вариант 1',
        col1_text: 'Подходит тем, кто хочет получить понятную стоимость работ и самостоятельно заниматься закупкой материалов.',
        col2_title: 'Вариант 2',
        col2_text: 'Во втором варианте мы считаем не только стоимость работ, но и материалы — от черновых до чистовых. В итоге у вас появляется понятная картина бюджета всего ремонта. Вы заранее понимаете, на какие расходы рассчитывать, можете планировать свои деньги и спокойно двигаться к новоселью.'
      }
    },
    order_index: 4
  },
  {
    key: 'calculator',
    title: 'Калькулятор',
    content: {
      eyebrow: 'Калькулятор',
      eyebrow_num: '5',
      title: 'Ориентировочная стоимость ремонта',
      rates: {
        newBuilding: { finished: 4500, unfinished: 5500, whiteBox: 5000 },
        secondary: { finished: 5000, unfinished: 6000, whiteBox: 5500 }
      },
      coefficients: {
        hasProject: 1.0,
        needsChanges: 1.3,
        noProject: 1.5
      },
      measurement_fee: 3000
    },
    order_index: 5
  },
  {
    key: 'cta',
    title: 'Финальный CTA',
    content: {
      eyebrow: null,
      eyebrow_num: null,
      title: 'Готовы\nобсудить\nремонт?',
      subtitle: 'Расскажите о вашей квартире, и мы обсудим, с чего лучше начать.',
      cta_primary: 'Забронировать дату замера',
      cta_primary_href: '#application',
      cta_secondary: 'Рассчитать стоимость',
      cta_secondary_href: '#calculator',
      telegram: '@nikitanachatkin',
      telegram_link: 'https://t.me/nikitanachatkin',
      whatsapp: '+7 950 208 5138',
      whatsapp_link: 'https://wa.me/79502085138',
      footer_note: 'Ремонт квартир — Никита Начаткин'
    },
    order_index: 6
  },
  {
    key: 'faq',
    title: 'FAQ',
    content: {
      eyebrow: 'Частые вопросы',
      eyebrow_num: '6',
      title: 'Что спрашивают клиенты',
      questions: [
        {
          question: 'Сколько стоит замер квартиры?',
          answer: 'Замер — это отдельная услуга. Подробности и стоимость уточняются при согласовании.'
        },
        {
          question: 'Можно ли получить смету до начала работ?',
          answer: 'Да. После выезда на объект и замера я готовлю смету — на работы (вариант 1) или на работы и материалы (вариант 2).'
        },
        {
          question: 'Какие материалы используются?',
          answer: 'Материалы подбираются под бюджет и задачу — от черновых до чистовых. При варианте 2 смета включает полную картину закупок.'
        },
        {
          question: 'Работаете ли вы по дизайн-проекту?',
          answer: 'Да, есть опыт ремонта по дизайн-проектам. Работаю точно по решению, соблюдая все технические детали.'
        },
        {
          question: 'Сколько длится ремонт?',
          answer: 'Сроки зависят от площади, состояния квартиры и объёма работ. Точные сроки фиксируются в договоре.'
        },
        {
          question: 'Договор — это официально?',
          answer: 'Да, по каждому объекту заключается договор с описанием работ, сметы и графика.'
        }
      ]
    },
    order_index: 7
  },
  {
    key: 'process',
    title: 'Процесс',
    content: {
      eyebrow: 'Как это работает',
      eyebrow_num: '8',
      title: 'Путь от заявки до результата',
      phases: [
        {
          num: 'Этап 01–02',
          title: 'Заявка и обсуждение',
          steps: ['Оставляете заявку', 'Обсуждаем задачу']
        },
        {
          num: 'Этап 03–05',
          title: 'Выезд и замер',
          steps: ['Выезд на объект', 'Замер квартиры', 'Подготовка сметы']
        },
        {
          num: 'Этап 06–08',
          title: 'Согласование и договор',
          steps: ['Согласование сметы', 'Подписание договора', 'Выбор даты начала']
        },
        {
          num: 'Этап 09–10',
          title: 'Ремонт и результат',
          steps: ['Выполнение работ', 'Сдача объекта']
        }
      ]
    },
    order_index: 8
  }
];

async function seed() {
  console.log('🔧 Seeding sections...\n');

  const db = new sqlite3.Database(dbPath);
  db.run('PRAGMA journal_mode = WAL');

  for (const section of SECTIONS) {
    await new Promise((resolve, reject) => {
      const contentJson = JSON.stringify(section.content);
      db.run(
        `INSERT OR REPLACE INTO sections (key, title, content, order_index, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [section.key, section.title, contentJson, section.order_index],
        function (err) {
          if (err) {
            reject(err);
          } else {
            console.log(`  ✅ ${section.key} (${section.order_index})`);
            resolve();
          }
        }
      );
    });
  }

  db.close();
  console.log('\n✨ Seed complete!');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});