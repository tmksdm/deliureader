# DeliuReader — дневник разработки

## Этап 1. Скелет репозитория и GitHub Pages
- Создан репозиторий `tmksdm/deliureader`.
- Локальная папка `D:\Pr\deliureader` инициализирована через `git init`, привязана к origin.
- Создан минимальный `index.html` со словом «Hello».
- Включён GitHub Pages (branch `main`, root). Сайт доступен по адресу
  https://tmksdm.github.io/deliureader/

## Этап 2. Главный экран
- Папка `css/`, файл `css/styles.css` с базовыми стилями (бежевый фон, скруглённые поля,
  чёрная кнопка во всю ширину).
- `index.html` переписан: заголовок DeliuReader, подзаголовок «10-минутный аудиопересказ книги»,
  одно универсальное поле ввода `#query` («Автор и название»), кнопка `#generate-btn`
  «Получить пересказ».
- Решение по UX: одно поле вместо двух (автор + название) — пользователь вводит всё одной
  строкой, разбор оставляем LLM.
- Решение по неймингу: продуктовое название — **DeliuReader**. Внутреннее имя из ТЗ
  (AudioBookBriefs) в UI и коде не используется.


## Этап 3. PWA: manifest и иконки
- Папка `icons/`: исходник `icon-source.svg` (тёмно-синий фон #1a2a4a, белая «Д»
  с засечками), сгенерированы `icon-192.png` и `icon-512.png` через CloudConvert.
- Создан `manifest.json` в корне: name/short_name = «DeliuReader», `display: standalone`,
  `start_url` и `scope` = `/deliureader/`, theme_color #1a2a4a, background_color #f5f3ee,
  три записи в icons (192 any, 512 any, 512 maskable).
- `index.html`: исправлен `<title>` (был «AudioBookBriefs»), добавлены `<meta name="theme-color">`,
  `<link rel="manifest">`, `<link rel="icon">`, `<link rel="apple-touch-icon">`,
  `<meta name="description">`.
- Проверки: Chrome DevTools → Application → Manifest — без ошибок, иконки отображаются.
  PWA устанавливается на телефон, открывается в standalone-режиме без адресной строки.
- TODO про замену «AudioBookBriefs» в UI — закрыт.


## Этап 4. Заглушка генерации
- Создан `js/app.js`: константа `FAKE_SUMMARY` (три абзаца тестового текста),
  обработчик `click` на `#generate-btn`, валидация пустого поля (alert),
  заполнение `#result-title` введённым запросом и `#result-text` фиктивным
  пересказом, `scrollIntoView` к карточке.
- `index.html`: добавлен `<section id="result" hidden>` с дочерними
  `#result-title` (h2) и `#result-text` (article); подключён скрипт
  `<script src="js/app.js" defer>`.
- `css/styles.css`: блок `.result` (белая карточка, скругление 16px,
  бордер #e5e0d5, лёгкая тень), `.result__title` (#1a2a4a, 1.15rem),
  `.result__text` с `white-space: pre-wrap` для сохранения абзацев из
  шаблонной строки JS.
- Решение по архитектуре: заглушка живёт прямо в `app.js` константой,
  а не в отдельном модуле. На этапе 10 строка заменяется вызовом
  `api.js`, остальной DOM-код остаётся как есть.
- Проверки на проде: пустой запрос → alert; заполненный → карточка
  с заголовком-запросом и тремя абзацами; повторный клик меняет
  заголовок.
