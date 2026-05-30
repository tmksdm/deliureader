// js/storage.js
// Модуль хранения настроек DeliuReader в памяти браузера (localStorage).
// Этап 7: API-ключ OpenRouter + выбранная модель.

// Ключи, под которыми храним данные в localStorage.
// Префикс "deliu." — чтобы не пересекаться с чужими записями.
const STORAGE_KEYS = {
  apiKey: 'deliu.apiKey',
  modelId: 'deliu.modelId'
};

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
