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
