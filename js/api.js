// js/api.js
// Модуль связи с OpenRouter. Единственная задача — отправить текст-запрос
// в выбранную модель и вернуть готовый ответ. Ничего на экране не рисует.
// Этап 8: реальный запрос + честная обработка ошибок (бесплатные модели).

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Главная функция. Принимает системный промпт и запрос пользователя.
// Возвращает строку с ответом модели. При проблеме — бросает Error
// с понятным человеку текстом (его потом покажем в карточке на этапе 10).
async function requestSummary(systemPrompt, userQuery) {
  // 1. Проверяем, что есть ключ. Без ключа звонить некуда.
  if (!hasApiKey()) {
    throw new Error('NO_API_KEY');
  }

  // 2. Проверяем, что выбрана модель.
  const modelId = getModelId();
  if (!modelId) {
    throw new Error('NO_MODEL');
  }

  const apiKey = getApiKey();

  // 3. Собираем тело запроса. messages — это диалог: сначала роль системы
  // (кто модель такая), потом реплика пользователя (что нужно пересказать).
  const body = {
    model: modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery }
    ]
  };

  // 4. Звоним на сервер. Заголовок Authorization несёт наш ключ.
  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        // OpenRouter просит указывать, откуда идёт запрос.
        'HTTP-Referer': 'https://tmksdm.github.io/deliureader/',
        'X-Title': 'DeliuReader'
      },
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    // Сюда попадаем, если не дозвонились вообще (нет интернета и т.п.).
    console.error('API: сетевая ошибка', networkErr);
    throw new Error('NETWORK');
  }

  // 5. Разбираем ответ сервера.
  // Если что-то пошло не так — сервер вернёт код != 200 и текст ошибки.
  if (!response.ok) {
    let serverMessage = '';
    try {
      const errData = await response.json();
      serverMessage = (errData.error && errData.error.message) || '';
    } catch (_) {
      // тело не разобралось — оставим пустым
    }
    console.error('API: ошибка сервера', response.status, serverMessage);

    // 401 — ключ неверный или недействителен.
    if (response.status === 401) {
      throw new Error('BAD_KEY');
    }
    // 402 — требуется оплата: модель перестала быть бесплатной.
    // По ТЗ НИКОГДА не подменяем на платную — честно говорим пользователю.
    if (response.status === 402) {
      throw new Error('MODEL_PAID');
    }
    // 404 — модель не найдена (id устарел / убрали с OpenRouter).
    if (response.status === 404) {
      throw new Error('MODEL_NOT_FOUND');
    }
    // 429 — слишком много запросов / кончился бесплатный лимит.
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    // Всё остальное — общая ошибка модели.
    throw new Error('MODEL_ERROR');
  }

  // 6. Ответ успешный — достаём текст.
  const data = await response.json();
  const text = data
    && data.choices
    && data.choices[0]
    && data.choices[0].message
    && data.choices[0].message.content;

  if (!text || !text.trim()) {
    console.error('API: пустой ответ модели', data);
    throw new Error('EMPTY_RESPONSE');
  }

  return text.trim();
}

// Переводит коды ошибок выше в человеческий текст для показа пользователю.
// Пригодится на этапе 10, когда будем выводить ошибку в карточку.
function describeApiError(message) {
  switch (message) {
    case 'NO_API_KEY':
      return 'Не задан API-ключ. Открой настройки (⚙) и вставь ключ OpenRouter.';
    case 'NO_MODEL':
      return 'Не выбрана модель. Открой настройки (⚙) и выбери модель.';
    case 'BAD_KEY':
      return 'Ключ не подошёл. Проверь его в настройках (⚙).';
    case 'MODEL_PAID':
      return 'Эта модель больше не бесплатна. Выбери другую в настройках (⚙).';
    case 'MODEL_NOT_FOUND':
      return 'Модель недоступна (возможно, её убрали). Выбери другую в настройках (⚙).';
    case 'RATE_LIMIT':
      return 'Слишком много запросов или исчерпан бесплатный лимит. Подожди немного или выбери другую модель.';
    case 'EMPTY_RESPONSE':
      return 'Модель вернула пустой ответ. Попробуй ещё раз или выбери другую модель.';
    case 'NETWORK':
      return 'Нет связи с сервером. Проверь интернет и попробуй снова.';
    default:
      return 'Что-то пошло не так с моделью. Попробуй ещё раз или выбери другую.';
  }
}
