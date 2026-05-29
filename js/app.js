// js/app.js
// Точка входа приложения DeliuReader.
// Этап 4: заглушка генерации.
// Этап 5: озвучка через Web Speech API.
// Этап 6: полноценный плеер — пауза/стоп/скорость/перемотка/тап по слову.

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
});
