// js/app.js
// Точка входа приложения DeliuReader.
// Этап 4: заглушка генерации.
// Этап 5: озвучка через Web Speech API.
// Этап 6: полноценный плеер — пауза/стоп/скорость/перемотка/тап по слову.
// Этап 7: экран настроек — API-ключ OpenRouter и выбор модели.

const FAKE_SUMMARY = `Это тестовый пересказ. Настоящий текст будет приходить от языковой модели позже, на этапе 10. Сейчас наша задача — убедиться, что кнопка работает, текст появляется на экране, а блок с результатом выглядит аккуратно.

Представь, что здесь идёт спокойный устный рассказ о произведении: автор, время создания, главные герои, ключевые события и темы. Текст написан сплошными абзацами, без списков и заголовков, потому что позже он пойдёт прямо в синтезатор речи — браузер будет читать его вслух.

На этом этапе не важно, какую книгу ты ввёл в поле — ответ всегда один и тот же. Это нормально. Главное — что весь путь нажал кнопку, увидел текст работает от начала до конца.`;

document.addEventListener('DOMContentLoaded', () => {
  const queryInput   = document.getElementById('query');
  const generateBtn  = document.getElementById('generate-btn');
  const resultBlock  = document.getElementById('result');
  const resultText   = document.getElementById('result-text');
  const resultTitle  = document.getElementById('result-title');
  const speakBtn     = document.getElementById('speak-btn');
  const stopBtn      = document.getElementById('stop-btn');
  const rewindBtn    = document.getElementById('rewind-btn');
  const rateSelect   = document.getElementById('rate-select');

  // --- Этап 4: показать фиктивный пересказ ---
  generateBtn.addEventListener('click', () => {
    const query = queryInput.value.trim();

    if (query === '') {
      alert('Введи автора и название книги.');
      return;
    }

    // Если до этого что-то читалось — остановить.
    if (typeof stop === 'function') stop();

    resultTitle.textContent = query;

    // Раскладываем текст по словам прямо в #result-text (функция из tts.js).
    renderText(FAKE_SUMMARY, resultText);

    resultBlock.hidden = false;
    resultBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Сбрасываем кнопки в исходное состояние.
    updatePlayerUI({ isPlaying: false, isPaused: false });
  });

  // --- Этап 6: главная кнопка «Слушать ↔ Пауза ↔ Возобновить» ---
  speakBtn.addEventListener('click', () => {
    const state = getTtsState();

    if (!state.isPlaying) {
      // Ничего не читается — стартуем с начала текста.
      speak(FAKE_SUMMARY, resultText);
    } else if (state.isPaused) {
      // Стоит на паузе — продолжаем.
      resume();
    } else {
      // Читается — ставим на паузу.
      pause();
    }
  });

  // --- Кнопка «Стоп» ---
  stopBtn.addEventListener('click', () => {
    stop();
  });

  // --- Кнопка «−15 сек» ---
  rewindBtn.addEventListener('click', () => {
    rewind(15);
  });

  // --- Селект скорости ---
  rateSelect.addEventListener('change', () => {
    const rate = parseFloat(rateSelect.value);
    setRate(rate);
  });

  // --- Тап/клик по любому слову в тексте → читать с этого слова ---
  resultText.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('word')) {
      const wordIndex = parseInt(target.dataset.index, 10);
      if (!isNaN(wordIndex)) {
        speakFromWordIndex(wordIndex);
      }
    }
  });

  // --- Подписка на смену состояния плеера (из tts.js) ---
  onTtsStateChange(updatePlayerUI);

  // --- Обновление вида кнопок под текущее состояние ---
  function updatePlayerUI(state) {
    if (state.isPlaying && !state.isPaused) {
      speakBtn.textContent = '⏸ Пауза';
      stopBtn.hidden = false;
      rewindBtn.hidden = false;
    } else if (state.isPlaying && state.isPaused) {
      speakBtn.textContent = '▶ Продолжить';
      stopBtn.hidden = false;
      rewindBtn.hidden = false;
    } else {
      speakBtn.textContent = '▶ Слушать';
      stopBtn.hidden = true;
      rewindBtn.hidden = true;
    }
  }

  // ========================================================
  // --- Этап 7: экран настроек (ключ OpenRouter + модель) ---
  // ========================================================

  const settingsBtn     = document.getElementById('settings-btn');
  const settingsModal   = document.getElementById('settings-modal');
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsClose   = document.getElementById('settings-close');
  const settingsSave    = document.getElementById('settings-save');
  const apiKeyInput     = document.getElementById('api-key');
  const modelSelect     = document.getElementById('model-select');
  const modelNote       = document.getElementById('model-note');
  const settingsStatus  = document.getElementById('settings-status');

  // Список моделей, загруженный из data/models.json (заполнится при загрузке страницы).
  let availableModels = [];

  // Загружаем список моделей сразу при старте, чтобы окно открывалось уже готовым.
  loadModels().then((models) => {
    availableModels = models;
    fillModelSelect();
  });

  // Заполнить выпадающий список моделей.
  function fillModelSelect() {
    if (availableModels.length === 0) {
      modelSelect.innerHTML = '<option value="">Список моделей не загрузился</option>';
      return;
    }

    modelSelect.innerHTML = '';
    availableModels.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      modelSelect.appendChild(option);
    });

    // Если у пользователя уже была выбрана модель — восстановить выбор.
    const savedModel = getModelId();
    if (savedModel && availableModels.some((m) => m.id === savedModel)) {
      modelSelect.value = savedModel;
    }
    showModelNote();
  }

  // Показать примечание к выбранной модели.
  function showModelNote() {
    const selected = availableModels.find((m) => m.id === modelSelect.value);
    modelNote.textContent = selected && selected.note ? selected.note : '';
  }

  modelSelect.addEventListener('change', showModelNote);

  // Открыть окно настроек: подставить сохранённые значения и обновить статус.
  function openSettings() {
    apiKeyInput.value = getApiKey();

    const savedModel = getModelId();
    if (savedModel && availableModels.some((m) => m.id === savedModel)) {
      modelSelect.value = savedModel;
    }
    showModelNote();
    updateSettingsStatus();

    settingsModal.hidden = false;
  }

  // Закрыть окно настроек.
  function closeSettings() {
    settingsModal.hidden = true;
  }

  // Показать индикатор «ключ установлен / не установлен».
  function updateSettingsStatus() {
    if (hasApiKey()) {
      settingsStatus.textContent = '✓ Ключ установлен';
      settingsStatus.className = 'settings-status settings-status--ok';
    } else {
      settingsStatus.textContent = '⚠ Ключ не установлен';
      settingsStatus.className = 'settings-status settings-status--warn';
    }
  }

  // Сохранить настройки.
  function saveSettings() {
    const key = apiKeyInput.value.trim();

    // Если поле не пустое — проверяем формат. Пустое разрешаем (вдруг хочет стереть).
    if (key !== '' && !isValidApiKeyFormat(key)) {
      alert('Ключ OpenRouter должен начинаться с «sk-or-v1-». Проверь, что скопировал его целиком.');
      return;
    }

    if (modelSelect.value === '') {
      alert('Выбери модель из списка.');
      return;
    }

    setApiKey(key);
    setModelId(modelSelect.value);
    updateSettingsStatus();

    alert('Настройки сохранены.');
    closeSettings();
  }

  // Навешиваем обработчики на элементы окна.
  settingsBtn.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', closeSettings);
  settingsSave.addEventListener('click', saveSettings);
});
