// js/app.js
// Точка входа приложения DeliuReader.
// Этап 4: заглушка генерации.
// Этап 5: озвучка через Web Speech API.
// Этап 6: полноценный плеер — пауза/стоп/скорость/перемотка/тап по слову.
// Этап 7: экран настроек — API-ключ OpenRouter и выбор модели.
// Этап 10: реальная генерация — ввод → LLM → пересказ → озвучка.
// Этап 10.4: панель кнопок закреплена внизу, пока показан пересказ.
// Этап 11: история пересказов — автосохранение, список, открытие, удаление.
// Этап 13: скачивание пересказа как .txt.
// Этап 14: автоподсказки из списка книг ВГИК.

document.addEventListener('DOMContentLoaded', () => {
  const queryInput   = document.getElementById('query');
  const generateBtn  = document.getElementById('generate-btn');
  const resultBlock  = document.getElementById('result');
  const resultText   = document.getElementById('result-text');
  const resultDisclaimer = document.getElementById('result-disclaimer');
  const resultTitle  = document.getElementById('result-title');
  const speakBtn      = document.getElementById('speak-btn');
  const stopBtn       = document.getElementById('stop-btn');
  const rewindBtn     = document.getElementById('rewind-btn');
  const downloadBtn   = document.getElementById('download-btn');
  const rateSelect    = document.getElementById('rate-select');
  const resultControls = document.querySelector('.result__controls');

  // Сюда кладём текст пересказа, который реально пришёл от модели.
  // Кнопка «Слушать» читает именно его (а не какую-то константу).
  let currentSummaryText = '';

  // Заголовок текущего пересказа (то, что ввёл пользователь). Нужен
  // для имени файла при скачивании .txt.
  let currentSummaryTitle = '';

  // ----------------------------------------------------------
  // Вспомогательные функции отображения карточки
  // ----------------------------------------------------------

  // Показать в карточке настоящий пересказ: раскладываем по словам
  // (для подсветки и тапа), показываем кнопки плеера.
  //
  // Этап 11: третий аргумент saveToHistory — нужно ли сохранять пересказ
  // в историю. true (по умолчанию) — для свежих пересказов от модели;
  // false — когда мы открываем УЖЕ сохранённый пересказ из истории
  // (его повторно сохранять не нужно, иначе появятся дубли).
  function showSummary(title, text, saveToHistory = true) {
    currentSummaryText = text;
    currentSummaryTitle = title;
    resultTitle.textContent = title;

    // Раскладываем текст по словам прямо в #result-text (функция из tts.js).
    renderText(text, resultText);

    // Кнопки плеера нужны — показываем панель управления.
    resultControls.hidden = false;

    // Этап 10.3: показываем предупреждение о возможных ошибках нейросети.
    resultDisclaimer.hidden = false;

    // Этап 10.4: панель кнопок закрепляем внизу экрана сразу, как только
    // показан пересказ, — чтобы «Слушать» был под рукой и не надо было
    // листать весь текст вниз.
    resultControls.classList.add('result__controls--floating');
    document.body.classList.add('is-playing');

    resultBlock.hidden = false;
    resultBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Сбрасываем кнопки плеера в исходное состояние.
    updatePlayerUI({ isPlaying: false, isPaused: false });

    // Этап 11: сохраняем свежий пересказ в историю.
    if (saveToHistory) {
      addHistoryItem(title, text);
    }
  }

  // Показать в карточке простое сообщение (загрузка / ошибка /
  // «книга не найдена»). Без кнопок плеера — озвучивать нечего.
  function showMessage(title, message) {
    currentSummaryText = '';
    currentSummaryTitle = '';
    resultTitle.textContent = title;

    // Просто текст, без разбивки по словам.
    resultText.textContent = message;

    // Прячем панель плеера — здесь нечего слушать.
    resultControls.hidden = true;

    // Этап 10.3: на загрузке/ошибке/«не найдено» предупреждение ни к чему.
    resultDisclaimer.hidden = true;

    // Этап 10.4: снимаем закрепление панели и запас снизу —
    // в режиме сообщения панели нет.
    resultControls.classList.remove('result__controls--floating');
    document.body.classList.remove('is-playing');

    resultBlock.hidden = false;
    resultBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }


  // ----------------------------------------------------------
  // Этап 13: скачивание пересказа как .txt
  // ----------------------------------------------------------

  // Превратить заголовок в безопасное имя файла: убираем символы,
  // которые нельзя в именах файлов (\ / : * ? " < > |), схлопываем
  // пробелы, обрезаем по длине. Если в итоге пусто — даём запасное имя.
  function makeFileName(title) {
    let name = (title || '').trim();
    name = name.replace(/[\\/:*?"<>|]/g, ' '); // запрещённые символы → пробел
    name = name.replace(/\s+/g, ' ').trim();    // лишние пробелы схлопываем
    if (name.length > 80) name = name.slice(0, 80).trim();
    if (name === '') name = 'Пересказ';
    return name + '.txt';
  }

  // Собрать текст в виртуальный файл (Blob) и «нажать» невидимую ссылку,
  // чтобы браузер скачал его. Заголовок ставим первой строкой текста.
  function downloadAsTxt() {
    if (!currentSummaryText) return; // нечего скачивать

    // Первой строкой кладём заголовок, потом пустая строка и сам пересказ.
    const fileBody = currentSummaryTitle
      ? currentSummaryTitle + '\n\n' + currentSummaryText
      : currentSummaryText;

    // Blob — «коробка» с текстом. \uFEFF в начале (BOM) помогает
    // блокноту Windows правильно распознать кириллицу в UTF-8.
    const blob = new Blob(['\uFEFF' + fileBody], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Создаём невидимую ссылку, кликаем по ней, потом убираем.
    const link = document.createElement('a');
    link.href = url;
    link.download = makeFileName(currentSummaryTitle);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Освобождаем память — ссылка на Blob больше не нужна.
    URL.revokeObjectURL(url);
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

    // Если открыта история — спрятать её, показываем результат.
    hideHistory();

    // Этап 14: при запуске генерации прячем список подсказок.
    hideSuggestions();

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
      // Третий аргумент по умолчанию true → пересказ сохранится в историю.
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

  // --- Этап 13: кнопка «Скачать .txt» ---
  downloadBtn.addEventListener('click', () => {
    downloadAsTxt();
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
    // Этап 10.4: закрепление панели внизу больше НЕ зависит от состояния
    // плеера — оно включается в showSummary и держится, пока виден пересказ.
  }


  // ========================================================
  // --- Этап 11: раздел «История» ---
  // ========================================================

  const historyBtn            = document.getElementById('history-btn');
  const historyBlock          = document.getElementById('history');
  const historyClose          = document.getElementById('history-close');
  const historyList           = document.getElementById('history-list');
  const historyEmpty          = document.getElementById('history-empty');
  const historyToolbar        = document.getElementById('history-toolbar');
  const historySelectAll      = document.getElementById('history-select-all');
  const historyDeleteSelected = document.getElementById('history-delete-selected');

  // Превратить метку времени в человекочитаемую дату вида «28.05.2026, 15:06».
  function formatDate(ms) {
    try {
      return new Date(ms).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  }

  // Перерисовать список истории целиком из localStorage.
  function renderHistory() {
    const items = getHistory();

    // Чистим список перед новой отрисовкой.
    historyList.innerHTML = '';

    // Если истории нет — показываем заглушку и прячем панель действий.
    if (items.length === 0) {
      historyEmpty.hidden = false;
      historyToolbar.hidden = true;
      return;
    }
    historyEmpty.hidden = true;
    historyToolbar.hidden = false;

    // Строим по записи на каждый сохранённый пересказ.
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history__item';
      li.dataset.id = item.id;

      // Галочка для массового выбора.
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'history__check';
      check.addEventListener('change', updateSelectAllState);

      // Кликабельная середина — открывает пересказ.
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'history__open';

      const query = document.createElement('div');
      query.className = 'history__query';
      query.textContent = item.query || '(без названия)';

      const date = document.createElement('div');
      date.className = 'history__date';
      date.textContent = formatDate(item.createdAt);

      open.appendChild(query);
      open.appendChild(date);
      open.addEventListener('click', () => openHistoryItem(item.id));

      // Крестик — удалить одну запись.
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'history__delete';
      del.setAttribute('aria-label', 'Удалить пересказ');
      del.textContent = '✕';
      del.addEventListener('click', () => deleteOne(item.id, item.query));

      li.appendChild(check);
      li.appendChild(open);
      li.appendChild(del);
      historyList.appendChild(li);
    });

    // Сбрасываем «Выбрать все» в исходное и обновляем доступность кнопки удаления.
    historySelectAll.checked = false;
    updateSelectAllState();
  }

  // Показать раздел «История» (прячем карточку результата).
  function openHistory() {
    if (typeof stop === 'function') stop(); // остановить чтение, если шло
    resultBlock.hidden = true;
    document.body.classList.remove('is-playing'); // снять запас снизу
    renderHistory();
    historyBlock.hidden = false;
    historyBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Спрятать раздел «История».
  function hideHistory() {
    historyBlock.hidden = true;
  }

  // Открыть сохранённый пересказ из истории в обычной карточке.
  // saveToHistory = false — повторно в историю НЕ кладём.
  function openHistoryItem(id) {
    const item = getHistoryItem(id);
    if (!item) return;
    hideHistory();
    showSummary(item.query, item.text, false);
  }

  // Собрать id всех отмеченных галочками записей.
  function getCheckedIds() {
    const ids = [];
    historyList.querySelectorAll('.history__item').forEach((li) => {
      const check = li.querySelector('.history__check');
      if (check && check.checked) ids.push(li.dataset.id);
    });
    return ids;
  }

  // Обновить состояние галочки «Выбрать все» и доступность кнопки удаления.
  function updateSelectAllState() {
    const checkedCount = getCheckedIds().length;
    historyDeleteSelected.disabled = checkedCount === 0;
  }

  // Удалить одну запись (крестик) — с подтверждением.
  function deleteOne(id, query) {
    const label = query ? `«${query}»` : 'этот пересказ';
    if (!confirm(`Удалить ${label}?`)) return;
    deleteHistoryItem(id);
    renderHistory();
  }

  // «Выбрать все» — отметить/снять все галочки.
  historySelectAll.addEventListener('change', () => {
    const checked = historySelectAll.checked;
    historyList.querySelectorAll('.history__check').forEach((c) => {
      c.checked = checked;
    });
    updateSelectAllState();
  });

  // «Удалить выбранные» — пачкой, с подтверждением.
  historyDeleteSelected.addEventListener('click', () => {
    const ids = getCheckedIds();
    if (ids.length === 0) return;
    if (!confirm(`Удалить выбранные пересказы (${ids.length})?`)) return;
    deleteHistoryItems(ids);
    renderHistory();
  });

  // Открыть/закрыть раздел истории по иконке и крестику.
  historyBtn.addEventListener('click', openHistory);
  historyClose.addEventListener('click', hideHistory);


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


  // ========================================================
  // --- Этап 14: автоподсказки из списка книг ВГИК ---
  // ========================================================

  const suggestionsBox = document.getElementById('suggestions');

  // Сюда загрузим список книг из data/required-books.json (массив {author, title}).
  let requiredBooks = [];

  // Грузим список книг сразу при старте — чтобы подсказки были готовы
  // к первому же набору. Если файл не загрузился — массив останется пустым,
  // подсказок просто не будет, на остальное приложение это не влияет.
  loadRequiredBooks().then((books) => {
    requiredBooks = books;
  });

  // Привести строку к «поисковому» виду: нижний регистр, без точек,
  // лишние пробелы схлопнуты. Чтобы «достоевский» находил «Ф.М. Достоевский»,
  // а регистр и инициалы не мешали поиску.
  function normalizeForSearch(str) {
    return (str || '')
      .toLowerCase()
      .replace(/\./g, ' ')   // точки в инициалах → пробел
      .replace(/ё/g, 'е')    // ё и е считаем одинаковыми
      .replace(/\s+/g, ' ')  // лишние пробелы схлопываем
      .trim();
  }

  // Спрятать список подсказок.
  function hideSuggestions() {
    suggestionsBox.hidden = true;
    suggestionsBox.innerHTML = '';
  }

  // Подобрать и показать подсказки под то, что набрал пользователь.
  function renderSuggestions() {
    const query = normalizeForSearch(queryInput.value);

    // Поле пустое или список книг не загрузился — прячем подсказки.
    if (query === '' || requiredBooks.length === 0) {
      hideSuggestions();
      return;
    }

    // Оставляем книги, где запрос встречается в авторе ИЛИ в названии.
    const matches = requiredBooks.filter((book) => {
      const haystack = normalizeForSearch(book.author + ' ' + book.title);
      return haystack.includes(query);
    }).slice(0, 8); // не больше 8 подсказок, чтобы список не разрастался

    // Совпадений нет — прячем список.
    if (matches.length === 0) {
      hideSuggestions();
      return;
    }

    // Рисуем список заново.
    suggestionsBox.innerHTML = '';
    matches.forEach((book) => {
      const li = document.createElement('li');
      li.className = 'suggestions__item';
      // То, что покажем пользователю и вставим в поле при клике.
      const label = book.author + ' — ' + book.title;
      li.textContent = label;
      li.addEventListener('click', () => {
        queryInput.value = label;
        hideSuggestions();
        queryInput.focus();
      });
      suggestionsBox.appendChild(li);
    });

    suggestionsBox.hidden = false;
  }

  // Набор текста в поле → пересобираем подсказки.
  queryInput.addEventListener('input', renderSuggestions);

  // Фокус на поле → если там уже что-то есть, сразу показать подсказки.
  queryInput.addEventListener('focus', renderSuggestions);

  // Клик мимо поля и списка → прячем подсказки.
  document.addEventListener('click', (e) => {
    if (e.target !== queryInput && !suggestionsBox.contains(e.target)) {
      hideSuggestions();
    }
  });

  // Enter в поле → прячем подсказки (чтобы не мешали), а генерацию
  // запускает кнопка. Esc — тоже прячем.
  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      hideSuggestions();
    }
  });
});
