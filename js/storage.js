// js/storage.js
// Модуль хранения настроек DeliuReader в памяти браузера (localStorage).
// Этап 7: API-ключ OpenRouter + выбранная модель.
// Этап 11: история пересказов (сохранение, чтение, удаление).
// Этап 14: загрузка списка книг ВГИК для автоподсказок.

// Ключи, под которыми храним данные в localStorage.
// Префикс "deliu." — чтобы не пересекаться с чужими записями.
const STORAGE_KEYS = {
  apiKey: 'deliu.apiKey',
  modelId: 'deliu.modelId',
  history: 'deliu.history'
};

// Сколько пересказов максимум храним. Старые сверх лимита выкидываются.
const HISTORY_LIMIT = 50;

// --- API-ключ ---

// Прочитать сохранённый ключ. Если ничего не сохранено — вернёт пустую строку.
function getApiKey() {
  return localStorage.getItem(STORAGE_KEYS.apiKey) || '';
}

// Сохранить ключ. Лишние пробелы по краям обрезаем.
function setApiKey(key) {
  localStorage.setItem(STORAGE_KEYS.apiKey, (key || '').trim());
}

// Есть ли вообще сохранённый ключ (непустой).
function hasApiKey() {
  return getApiKey() !== '';
}

// Проверка формата ключа OpenRouter: начинается с "sk-or-v1-".
// Это не гарантия рабочести (рабочесть проверим запросом на этапе 8),
// а защита от опечаток и случайно вставленного не того текста.
function isValidApiKeyFormat(key) {
  return /^sk-or-v1-/.test((key || '').trim());
}

// --- Выбранная модель ---

// Прочитать сохранённый id модели. Если не выбрана — пустая строка.
function getModelId() {
  return localStorage.getItem(STORAGE_KEYS.modelId) || '';
}

// Сохранить выбранную модель.
function setModelId(id) {
  localStorage.setItem(STORAGE_KEYS.modelId, (id || '').trim());
}

// --- Список доступных моделей (из data/models.json) ---

// Загрузить список бесплатных моделей из файла репозитория.
// Возвращает массив объектов {id, name, note}. При ошибке — пустой массив.
async function loadModels() {
  try {
    const response = await fetch('data/models.json', { cache: 'no-store' });
    if (!response.ok) {
      console.error('STORAGE: не удалось загрузить models.json, статус', response.status);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data.models) ? data.models : [];
  } catch (err) {
    console.error('STORAGE: ошибка чтения models.json', err);
    return [];
  }
}

// --- Список книг ВГИК (из data/required-books.json) для автоподсказок (этап 14) ---

// Загрузить список приоритетных произведений ВГИК из файла репозитория.
// Возвращает массив объектов {author, title}. При ошибке — пустой массив
// (подсказки просто не появятся, на остальную работу приложения это не влияет).
async function loadRequiredBooks() {
  try {
    const response = await fetch('data/required-books.json', { cache: 'no-store' });
    if (!response.ok) {
      console.error('STORAGE: не удалось загрузить required-books.json, статус', response.status);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data.books) ? data.books : [];
  } catch (err) {
    console.error('STORAGE: ошибка чтения required-books.json', err);
    return [];
  }
}

// --- История пересказов (этап 11) ---
//
// Каждая запись истории — объект:
//   { id: '...', query: 'Достоевский Идиот', text: '<полный текст>', createdAt: 1716000000000 }
// id — уникальная строка, query — запрос пользователя, text — текст пересказа,
// createdAt — время создания в миллисекундах (для сортировки и показа даты).
//
// Весь список лежит одной JSON-строкой в localStorage под ключом deliu.history.
// Новые записи кладём в начало списка, чтобы свежее было сверху.

// Прочитать всю историю. Возвращает массив записей (новые — первыми).
// Если ничего не сохранено или данные битые — вернёт пустой массив.
function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('STORAGE: история повреждена, возвращаю пустой список', err);
    return [];
  }
}

// Внутренний помощник: записать массив истории обратно в localStorage.
function saveHistoryArray(items) {
  try {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(items));
  } catch (err) {
    // Самая вероятная причина — переполнение localStorage.
    console.error('STORAGE: не удалось сохранить историю', err);
  }
}

// Сгенерировать простой уникальный id для записи.
function makeHistoryId() {
  return 'h' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

// Добавить пересказ в историю. Возвращает созданную запись (с её id).
// Новая запись встаёт в начало списка; если записей стало больше лимита —
// самые старые (в конце списка) отбрасываются.
function addHistoryItem(query, text) {
  const items = getHistory();

  const item = {
    id: makeHistoryId(),
    query: (query || '').trim(),
    text: text || '',
    createdAt: Date.now()
  };

  items.unshift(item);                 // новая запись — в начало
  const trimmed = items.slice(0, HISTORY_LIMIT); // обрезаем хвост сверх лимита

  saveHistoryArray(trimmed);
  return item;
}

// Найти одну запись по id. Вернёт объект записи или null.
function getHistoryItem(id) {
  return getHistory().find((item) => item.id === id) || null;
}

// Удалить одну запись по id.
function deleteHistoryItem(id) {
  const items = getHistory().filter((item) => item.id !== id);
  saveHistoryArray(items);
}

// Удалить несколько записей сразу по массиву id (удаление пачкой).
function deleteHistoryItems(ids) {
  const idsSet = new Set(ids || []);
  const items = getHistory().filter((item) => !idsSet.has(item.id));
  saveHistoryArray(items);
}

// Удалить всю историю целиком.
function clearHistory() {
  localStorage.removeItem(STORAGE_KEYS.history);
}
