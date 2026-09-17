# РемонтНик квартир — Design System

## 1. Назначение

Этот документ является главным источником правил визуального дизайна сайта бренда «РемонтНик квартир».

Claude Code должен соблюдать эту дизайн-систему при создании и изменении любых UI-компонентов, страниц, секций, форм, карточек, кнопок, навигации и адаптивных версий.

Главные характеристики интерфейса:

- доверительный
- премиальный
- современный
- аккуратный
- технологичный
- профессиональный
- спокойный
- ориентированный на качество ремонта
- ориентированный на конверсию

Сайт НЕ должен выглядеть как дешёвый строительный шаблон, типичный лендинг ремонтной бригады или перегруженный сайт строительной компании.

---

# 2. Brand Identity

## Название

РемонтНик квартир

## Основные фирменные цвета

Green:
#669933

Orange:
#FD851C

Фирменные цвета являются обязательными и должны использоваться как основные акцентные цвета интерфейса.

В брендбуке указаны:

Green:
HEX #669933
RGB 102, 153, 51
CMYK 60, 5, 98, 21

Orange:
HEX #FD851C
RGB 253, 133, 28
CMYK 0, 59, 100, 0

Логотип состоит из:

- оранжевого знака
- слова «Ремонт» зелёного цвета
- слова «Ник» оранжевого цвета
- подписи «квартир» зелёного цвета

Фирменный знак представляет стилизованный дом и строительный инструмент.

Логотип нельзя визуально деформировать, менять пропорции или произвольно изменять его цвета.

---

# 3. Design Direction

Основное направление:

## Premium Construction

Интерфейс должен сочетать:

Premium + Trust + Construction + Modern UI

Основная визуальная идея:

«Профессиональный ремонт без визуального шума».

Пользователь должен сразу ощущать:

- компанию можно доверять;
- компания профессиональная;
- ремонт выполняется качественно;
- компания работает системно;
- стоимость и процесс понятны;
- результат выглядит дорого.

---

# 4. Visual Language

Использовать:

- большое количество свободного пространства;
- крупную типографику;
- качественные фотографии интерьеров;
- мягкие скругления;
- минимальные тени;
- спокойные нейтральные поверхности;
- зелёный как основной brand color;
- оранжевый как CTA/accent color;
- крупные изображения;
- визуальную иерархию;
- тонкие разделители;
- аккуратные карточки;
- subtle motion.

Не использовать:

- кислотные градиенты;
- чрезмерный glassmorphism;
- неон;
- большое количество декоративных элементов;
- дешёвые строительные иконки;
- перегруженные карточки;
- чрезмерные тени;
- слишком маленький текст;
- множество цветов;
- визуальный шум;
- шаблонный дизайн строительных компаний.

---

# 5. Color System

Использовать CSS variables.

```css
:root {
  --color-brand-green: #669933;
  --color-brand-orange: #FD851C;

  --color-black: #171717;
  --color-dark: #242424;
  --color-gray-900: #303030;
  --color-gray-700: #555555;
  --color-gray-500: #777777;
  --color-gray-300: #D6D6D6;
  --color-gray-200: #E8E8E8;
  --color-gray-100: #F4F4F1;

  --color-white: #FFFFFF;
  --color-background: #F8F8F5;

  --color-success: #669933;
  --color-error: #D64545;
  --color-warning: #FD851C;
}

Color hierarchy
Green:
Использовать для:
- brand identity;
- secondary CTA;
- selected states;
- positive indicators;
- links;
- декоративных акцентов;
- отдельных элементов интерфейса.
Orange:
Использовать преимущественно для:
- primary CTA;
- важных действий;
- активных элементов;
- акцентных деталей;
- важных numerical highlights.
Orange не должен занимать большую часть интерфейса.
Основная поверхность сайта должна оставаться нейтральной.
6. Backgrounds
Основной background:
background: #F8F8F5;

Белые секции:
background: #FFFFFF;

Dark sections:
background: #171717;

Фирменные цвета не должны использоваться как основной фон всего сайта.
Особенно важно:
НЕ делать весь сайт зелёным.
НЕ делать весь сайт оранжевым.
Brand colors должны работать как акценты.
7. Typography
Основной принцип:
Современная grotesk typography.
Предпочтительно использовать:
Inter
или
Manrope
или
Geist
При выборе шрифта приоритет:
1. читаемость;
2. современный внешний вид;
3. хорошая кириллица;
4. аккуратные цифры;
5. хороший внешний вид в крупных заголовках.
8. Typography Scale
Desktop:
--font-display: clamp(48px, 6vw, 88px);
--font-h1: clamp(42px, 5vw, 72px);
--font-h2: clamp(34px, 4vw, 52px);
--font-h3: clamp(26px, 3vw, 36px);

--font-body-large: 20px;
--font-body: 17px;
--font-body-small: 15px;

--font-caption: 13px;

Mobile:
--font-display: 42px;
--font-h1: 38px;
--font-h2: 32px;
--font-h3: 24px;

--font-body-large: 18px;
--font-body: 16px;
--font-body-small: 14px;

--font-caption: 12px;

9. Typography Rules
Заголовки:
- bold / semibold;
- tight line-height;
- короткие смысловые блоки;
- максимум 2–3 строки для hero heading.
Body:
- regular;
- комфортная ширина строки;
- line-height 1.5–1.7.
Не использовать:
- CAPS LOCK для больших текстовых блоков;
- слишком тонкие шрифты;
- декоративные шрифты;
- больше 2 шрифтов одновременно.
10. Layout
Использовать современную responsive grid system.
Desktop:
max-width: 1440px;
margin: 0 auto;
padding: 0 32px;

Large desktop:
padding: 0 48px;

Tablet:
padding: 0 24px;

Mobile:
padding: 0 16px;

Основная сетка:
12 columns desktop.
8 columns tablet.
4 columns mobile.
11. Spacing
Использовать spacing scale:
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 32px;
--space-8: 40px;
--space-9: 48px;
--space-10: 64px;
--space-11: 80px;
--space-12: 96px;
--space-13: 120px;
--space-14: 160px;

Большие секции должны иметь много воздуха.
Предпочтение:
large whitespace > декоративные элементы.
12. Border Radius
Основной стиль — soft rounded.
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 18px;
--radius-xl: 24px;
--radius-2xl: 32px;
--radius-pill: 999px;

Использовать:
18–24px для крупных карточек.
12–16px для обычных UI элементов.
999px для pills и некоторых CTA.
Не использовать одновременно множество разных радиусов без причины.
13. Shadows
Тени должны быть очень мягкими.
--shadow-sm:
  0 2px 8px rgba(0, 0, 0, 0.05);

--shadow-md:
  0 8px 24px rgba(0, 0, 0, 0.08);

--shadow-lg:
  0 20px 50px rgba(0, 0, 0, 0.10);

Не использовать тяжёлые чёрные тени.
Карточки могут вообще обходиться без shadow.
Предпочтительно:
border + background + whitespace
вместо сильной тени.
14. Borders
Основной border:
border: 1px solid #E8E8E8;

Hover:
border-color: #D6D6D6;

Brand border использовать только там, где это действительно необходимо.
15. Buttons
Primary Button
Primary CTA — orange.
background: #FD851C;
color: #FFFFFF;

Пример:
«Рассчитать стоимость»
«Получить консультацию»
«Оставить заявку»
Стиль:
- height 52–58px;
- padding 0 24–28px;
- radius 12–16px;
- font-weight 600.
Hover:
кнопка должна слегка темнеть или становиться визуально плотнее.
Не использовать резкие эффекты.
Secondary Button
White / neutral.
background: #FFFFFF;
color: #171717;
border: 1px solid #D6D6D6;

Green Button
Использовать ограниченно.
background: #669933;
color: #FFFFFF;

Green button используется для secondary actions.
16. Header
Header должен выглядеть дорого и спокойно.
Структура:
Logo
Navigation
Phone / contact
CTA
На desktop:
- sticky;
- height около 72–84px;
- background white / slightly transparent;
- subtle bottom border.
Navigation:
- небольшой font-size;
- medium weight;
- никаких огромных меню.
CTA:
«Рассчитать стоимость»
17. Hero Section
Hero должен быть главным эмоциональным блоком сайта.
Структура:
Left:
- eyebrow;
- большой headline;
- description;
- CTA;
- secondary action.
Right:
large premium interior photograph.
Возможный визуальный принцип:
-----------------------------------------
|                                       |
|  Ремонт квартир                       |
|  под ключ                             |
|                                       |
|  Сделаем пространство,                |
|  в котором хочется жить.              |
|                                       |
|  [ Рассчитать стоимость ]             |
|                                       |
|                         [ PHOTO ]      |
|                         [ PHOTO ]      |
-----------------------------------------

Hero image должна быть большой.
Не использовать много текста.
18. Trust Elements
Доверие является одним из главных UX-принципов.
Использовать:
- количество выполненных объектов;
- опыт;
- гарантию;
- сроки;
- реальные отзывы;
- реальные фотографии;
- этапы работы;
- прозрачную стоимость;
- информацию о компании;
- документы при необходимости.
Не использовать выдуманные цифры.
19. Services
Услуги должны выглядеть как premium cards.
Каждая карточка:
- номер;
- название;
- краткое описание;
- image;
- price/from price при наличии;
- CTA.
Карточки могут использовать large image + text overlay.
Hover:
- image scale 1.02–1.04;
- subtle movement;
- CTA появляется/усиливается.
Не использовать чрезмерные hover animations.
20. Portfolio
Portfolio является одним из важнейших блоков.
Использовать большие фотографии интерьеров.
Предпочтительно:
asymmetric grid.
Например:
┌───────────────┬─────────┐
│               │         │
│    LARGE      │ SMALL   │
│    PROJECT    │ PROJECT │
│               │         │
├───────────────┤         │
│               │         │
│    PROJECT    │         │
│               │         │
└───────────────┴─────────┘

Фотографии должны быть главным визуальным элементом.
21. Process
Показать процесс ремонта в понятной последовательности.
Например:
01
Заявка
02
Замер
03
Смета
04
Дизайн / планирование
05
Ремонт
06
Сдача объекта
Использовать numbered system.
Номера могут использовать фирменный orange.
22. Reviews
Отзывы должны выглядеть максимально естественно.
Card:
- avatar;
- имя;
- объект;
- rating;
- текст;
- optionally project photo.
Не делать огромные декоративные quotation marks.
23. Pricing
Цена должна быть максимально понятной.
Не перегружать таблицами.
Использовать:
- starting price;
- package cards;
- price calculator;
- CTA.
Если точная цена зависит от объекта:
«Рассчитать стоимость»
вместо искусственной фиксированной цены.
24. Forms
Формы должны быть короткими.
Предпочтительно:
Имя
Телефон
Тип ремонта
Комментарий — optional
CTA
Не создавать длинные формы без необходимости.
Input:
height: 54px;
border-radius: 12px;
border: 1px solid #D6D6D6;
background: #FFFFFF;

Focus:
border-color: #669933;

25. Cards
Карточки должны быть минималистичными.
Использовать:
- white background;
- subtle border;
- 18–24px radius;
- adequate padding;
- strong typography.
Card hierarchy:
Title
Description
Supporting information
Action
26. Icons
Использовать единый icon set.
Предпочтительно:
Lucide Icons.
Иконки:
- 20px;
- 24px;
- stroke 1.8–2px.
Не использовать разношерстные SVG из разных наборов.
Не использовать иконки ради декоративности.
Каждая иконка должна иметь функциональный смысл.
27. Photography
Фотографии — важнейшая часть дизайна.
Стиль:
- современные квартиры;
- premium interiors;
- натуральный свет;
- дерево;
- камень;
- текстиль;
- спокойные нейтральные цвета;
- реальные строительные процессы;
- реальные специалисты.
Избегать:
- стоковых фотографий с постановочными улыбками;
- слишком ярких интерьеров;
- дешёвого ремонта;
- фотографий низкого качества;
- визуально перегруженных помещений.
Фотографии должны создавать ощущение:
«Вот такой результат я хочу получить».
28. Brand Color Usage
Пример пропорции:
70–80% — neutral colors
10–15% — green
5–10% — orange
Это не жёсткое математическое правило, а визуальный ориентир.
Orange должен оставаться визуально ценным акцентом.
29. Decorative Elements
Можно использовать фирменный знак как:
- subtle background element;
- watermark;
- section decoration;
- small icon;
- transition element.
Но знак нельзя повторять настолько часто, чтобы он стал визуальным шумом.
30. Modern UI Trends
Разрешено использовать современные UI-подходы:
- large typography;
- editorial layouts;
- asymmetric grids;
- rounded containers;
- sticky navigation;
- subtle glass effects;
- scroll animations;
- image reveal;
- hover interactions;
- micro-interactions;
- sticky CTA;
- progressive disclosure;
- horizontal project galleries;
- interactive price calculator.
Но каждый тренд должен использоваться только тогда, когда он улучшает UX.
Не использовать тренды ради трендов.
31. Glassmorphism
Использовать крайне ограниченно.
Допустимо:
- floating header;
- small overlay controls;
- image overlays.
Не использовать glassmorphism для всего интерфейса.
32. Motion
Motion должен быть спокойным и premium.
Основные параметры:
--transition-fast: 160ms;
--transition-normal: 240ms;
--transition-slow: 400ms;

Использовать:
- opacity;
- transform;
- scale;
- clip-path;
- image reveal.
Предпочтительные easing:
cubic-bezier(0.22, 1, 0.36, 1)

Не использовать:
- резкие bouncing animations;
- чрезмерные rotations;
- постоянное движение;
- flashy effects.
33. Scroll Animations
Секции могут появляться при scroll:
- fade;
- translateY;
- image reveal.
Animation duration:
300–700ms.
Animations должны быть subtle.
34. Mobile
Mobile-first behaviour.
На мобильном:
- navigation превращается в menu;
- CTA остаётся легко доступным;
- карточки становятся вертикальными;
- grid превращается в 1 column;
- hero image остаётся крупной;
- typography уменьшается;
- spacing уменьшается;
- формы становятся full width.
Mobile CTA:
может использовать sticky bottom CTA.
Например:
«Рассчитать стоимость»
35. Accessibility
Обязательно:
- contrast;
- visible focus;
- keyboard navigation;
- aria labels;
- semantic HTML;
- правильная структура headings;
- touch targets минимум около 44px;
- reduced motion support.
Для пользователей с prefers-reduced-motion отключать сложные animations.
36. UX Principles
Главный принцип:
Пользователь должен понимать сайт за несколько секунд.
На первом экране должны быть понятны:
1. Кто вы?
2. Что вы делаете?
3. Почему вам можно доверять?
4. Что пользователь может сделать дальше?
CTA должен быть очевидным.
37. Conversion Strategy
Основной CTA:
«Рассчитать стоимость»
Secondary CTA:
«Получить консультацию»
CTA необходимо повторять в ключевых местах:
- Hero;
- Services;
- Portfolio;
- Pricing;
- после Process;
- Footer.
Не использовать 5–10 разных CTA с разными формулировками без необходимости.
38. Footer
Footer должен быть большим и информативным.
Содержать:
- logo;
- navigation;
- services;
- contacts;
- legal information;
- social links;
- CTA.
Dark footer допустим.
Использовать:
background: #171717;
color: #FFFFFF;

Green / orange использовать как акценты.
39. UI States
Все интерактивные элементы должны иметь:
Default
Hover
Focus
Active
Disabled
Loading
Error
Success
Пример:
Button
├── Default
├── Hover
├── Active
├── Focus
├── Disabled
└── Loading

40. Components
Основной UI должен строиться из переиспользуемых компонентов.
Минимальный набор:
- Header
- Navigation
- Button
- Link
- Container
- Section
- Badge
- Card
- ServiceCard
- ProjectCard
- ReviewCard
- Input
- Select
- Textarea
- Modal
- Form
- Accordion
- Tabs
- PriceCard
- ProcessStep
- Footer
- MobileMenu
- StickyCTA
Не создавать отдельный уникальный UI для каждого места, если можно использовать существующий компонент.
41. Component Consistency
Если компонент уже существует, сначала использовать его.
Не создавать:
ButtonA
ButtonB
ButtonC
ButtonD

если различия можно решить через props/variants.
Предпочтительно:
<Button variant="primary" />
<Button variant="secondary" />
<Button variant="green" />

42. Design Tokens
Все основные параметры должны быть централизованы.
Не писать большое количество случайных значений:
margin: 37px;
border-radius: 13px;
padding: 29px;

если они не нужны.
Использовать design tokens.
43. Code + Design Relationship
UI должен быть:
- predictable;
- reusable;
- responsive;
- accessible;
- maintainable.
Не жертвовать архитектурой ради визуального эффекта.
Не менять существующую архитектуру проекта без необходимости.
Если задача касается только визуала — менять только визуал.
44. Important Claude Rules
Claude Code должен:
1. Всегда соблюдать этот Design System.
2. Не менять фирменные цвета без явного запроса.
3. Не добавлять случайные цвета.
4. Не использовать случайные шрифты.
5. Не создавать визуальный шум.
6. Не использовать чрезмерные animations.
7. Не превращать сайт в типичный строительный шаблон.
8. Сохранять premium visual language.
9. Использовать реальные UI patterns.
10. Использовать переиспользуемые компоненты.
11. Сначала использовать существующие компоненты.
12. Не менять архитектуру проекта без необходимости.
13. Не удалять существующий функционал ради дизайна.
14. Не добавлять функциональность, которую не просили.
15. Не изменять бизнес-логику при выполнении чисто визуальной задачи.
16. Всегда учитывать mobile.
17. Всегда учитывать accessibility.
18. Сохранять визуальную иерархию.
19. Использовать orange преимущественно как CTA/accent.
20. Использовать green как основной brand/supporting color.
21. Делать интерфейс визуально дорогим за счёт typography, spacing, photography и composition, а не за счёт большого количества эффектов.
45. Final Visual Test
Перед завершением UI-задачи Claude должен проверить:
- Сохраняется ли фирменный стиль?
- Используются ли #669933 и #FD851C корректно?
- Не слишком ли много orange?
- Не выглядит ли сайт как шаблон?
- Есть ли достаточно whitespace?
- Хорошая ли типографика?
- Понятен ли CTA?
- Хорошо ли выглядит mobile?
- Нет ли лишних shadows?
- Нет ли лишних animations?
- Все ли компоненты визуально согласованы?
- Не изменена ли существующая архитектура без необходимости?
Главный критерий:
РемонтНик квартир должен восприниматься как профессиональная, надёжная и современная компания, которой можно доверить дорогой ремонт квартиры.

По самому брендбуку здесь важно сохранить именно его основу: фирменный зелёный `#669933` и оранжевый `#FD851C`; визуально логотип уже строится на сочетании зелёного и оранжевого, а знак объединяет образ дома и строительного инструмента. fileciteturn0file0L4-L12

Я бы для этого бренда делал дизайн именно в направлении **«premium renovation / editorial architecture»**, а не стандартного «строительного сайта»: большие фотографии интерьеров, крупная типографика, много воздуха, нейтральный фон, зелёный для бренда и доверия, оранжевый только для действий. Это лучше соответствует и самому логотипу, и фотографии применения бренда в интерьере из брендбука. fileciteturn0file0L13-L15