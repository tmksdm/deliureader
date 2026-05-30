// js/app.js
// Точка входа приложения DeliuReader.
// Этап 4: заглушка генерации.
// Этап 5: озвучка через Web Speech API.
// Этап 6: полноценный плеер — пауза/стоп/скорость/перемотка/тап по слову.
// Этап 7: экран настроек — API-ключ OpenRouter и выбор модели.
// Этап 10: реальная генерация — ввод → LLM → пересказ → озвучка.

document.addEventListener('DOMContentLoaded', () => {
  const queryInput   = document.getElementById('query');
  const generateBtn  = document.getElementById('generate-btn');
  const resultBlock  = document.getElementById('result');
  const resultText   = document.getElementById('result-text');
  const resultTitle  = document.getElementById('result-title');
  const speakBtn      = document.getElementById('speak-btn');
  const stopBtn       = document.getElementById('stop-btn');
  const rewindBtn     = document.getElementById('rewind-btn');
  const rateSelect    = document.getElementById('rate-select');
  const resultControls = document.querySelector('.result__controls');

  // Сюда кладём текст пересказа, который реально пришёл от модели.
  // Кнопка «Слушать» читает именно его (а не какую-то константу).
  let currentSummaryText = '';

  // ----------------------------------------------------------
  // Вспомогательные функции отображения карточки
  // ----------------------------------------------------------

  // Показать в карточке настоящий пересказ: раскладываем по словам
  // (для подсветки и тапа), показываем кнопки плеера.
  function showSummary(title, text) {
    currentSummaryText = text;
    resultTitle.textContent = title;

    // Раскладываем текст по словам прямо в #result-text (функция из tts.js).
    renderText(text, resultText);

    // Кнопки плеера нужны — показываем панель управления.
    resultControls.hidden = false;

    resultBlock.hidden = false;
    resultBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Сбрасываем кнопки плеера в исходное состояние.
    updatePlayerUI({ isPlaying: false, isPaused: false });
  }

  // Показать в карточке простое сообщение (загрузка / ошибка /
  // «книга не найдена»). Без кнопок плеера — озвучивать нечего.
  function showMessage(title, message) {
    currentSummaryText = '';
    resultTitle.textContent = title;

    // Просто текст, без разбивки по словам.
    resultText.textContent = message;

    // Прячем панель плеера — здесь нечего слушать.
    resultControls.hidden = true;

    resultBlock.hidden = false;
    resultBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ----------------------------------------------------------
  // Этап 10: главная кнопка «Получить пересказ» → реальный запрос
  // ----------------------------------------------------------

  generateBtn.addEventListener('click', async () => {
    const query = queryInput.value.trim();

    if (query === '') {
      alert('Введи автора и название книги.');
      return;
    }

    // Если до этого что-то читалось — остановить.
    if (typeof stop === 'function') stop();

    // Блокируем кнопку и показываем состояние загрузки,
    // чтобы человек не жал её повторно, пока модель думает.
    generateBtn.disabled = true;
    const originalBtnText = generateBtn.textContent;
    generateBtn.textContent = 'Готовлю пересказ…';
    showMessage(query, 'Готовлю пересказ, это займёт несколько секунд…');

    try {
      // Идём в модель. systemPrompt — наш «литературовед» из prompts.js,
      // query — то, что ввёл пользователь.
      const summary = await requestSummary(LITERATURE_SYSTEM_PROMPT, query);

      // Особый случай: модель не опознала произведение и вернула
      // ровно метку BOOK_NOT_FOUND. Показываем дружелюбный текст,
      // а не сам код.
      if (summary.trim() === 'BOOK_NOT_FOUND') {
        showMessage(query, 'Не нашёл такое произведение. Проверь, правильно ли указаны автор и название.');
        return;
      }

      // Всё хорошо — показываем настоящий пересказ с плеером.
      showSummary(query, summary);

    } catch (err) {
      // Любая ошибка из api.js приходит как Error с кодом-меткой.
      // Переводим её в человеческий текст и показываем в карточке.
      console.error('Ошибка генерации:', err);
      showMessage(query, describeApiError(err.message));

    } finally {
      // Что бы ни случилось — возвращаем кнопку в рабочее состояние.
      generateBtn.disabled = false;
      generateBtn.textContent = originalBtnText;
    }
  });

  // --- Этап 6: главная кнопка «Слушать ↔ Пауза ↔ Возобновить» ---
  speakBtn.addEventListener('click', () => {
    const state = getTtsState();

    if (!state.isPlaying) {
      // Ничего не читается — стартуем с начала текста.
      speak(currentSummaryText, resultText);
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

    // Этап 10.1: во время чтения (играет ИЛИ на паузе) прилепляем
    // панель кнопок к низу экрана, чтобы до неё всегда можно было
    // дотянуться. Когда чтение остановлено — возвращаем в карточку.
    if (state.isPlaying) {
      resultControls.classList.add('result__controls--floating');
      document.body.classList.add('is-playing');
    } else {
      resultControls.classList.remove('result__controls--floating');
      document.body.classList.remove('is-playing');
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
