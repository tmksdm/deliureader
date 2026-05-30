// DeliuReader — Service Worker
// Назначение: офлайн-доступ к оболочке приложения + автообновление CSS/JS
// без ручного ?v=N. Меняешь файлы -> поднимаешь CACHE_VERSION на 1 -> старый
// кэш удаляется, браузер скачивает всё заново.

// ВАЖНО: при каждом обновлении CSS/JS увеличивай это число на 1.
const CACHE_VERSION = 10;
const CACHE_NAME = 'deliu-cache-v' + CACHE_VERSION;

// Базовый путь проекта на GitHub Pages.
const BASE = '/deliureader/';

// Оболочка приложения — то, что нужно для офлайн-старта.
const APP_SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'css/styles.css',
  BASE + 'js/tts.js',
  BASE + 'js/storage.js',
  BASE + 'js/api.js',
  BASE + 'js/prompts.js',
  BASE + 'js/app.js',
  BASE + 'data/models.json',
  BASE + 'data/required-books.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png'
];

// УСТАНОВКА: складываем оболочку в кэш.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll: если хоть один файл не скачался — установка падает целиком.
      // Поэтому в списке только реально существующие файлы.
      return cache.addAll(APP_SHELL);
    })
  );
  // Не ждём закрытия старых вкладок — новый SW активируется сразу.
  self.skipWaiting();
});

// АКТИВАЦИЯ: удаляем все старые кэши, кроме текущей версии.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name.startsWith('deliu-cache-v') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ПЕРЕХВАТ ЗАПРОСОВ.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Работаем только с GET. POST (запросы к OpenRouter) не трогаем —
  // они всегда идут в сеть напрямую.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Запросы к стороннему API (OpenRouter и пр.) не кэшируем вообще.
  if (url.origin !== self.location.origin) {
    return;
  }

  // КАРТИНКИ: сначала кэш, потом сеть (меняются редко).
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // ВСЁ ОСТАЛЬНОЕ (HTML/CSS/JS/JSON): сначала сеть, кэш — запасной.
  // Пока интернет есть, пользователь всегда видит свежий код.
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Свежую копию кладём в кэш на случай будущего офлайна.
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => {
        // Сети нет — отдаём из кэша. Если запрашивали страницу,
        // а её в кэше нет — отдаём index.html (точку входа PWA).
        return caches.match(request).then((cached) => {
          return cached || caches.match(BASE + 'index.html');
        });
      })
  );
});
