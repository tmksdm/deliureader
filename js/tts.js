// js/tts.js
// Обёртка над браузерным синтезатором речи (Web Speech API).
// Этап 6: пауза/стоп/скорость/подсветка/перемотка + обходы багов Android Chrome.

// ---------- Состояние ----------

let cachedVoices = [];

const ttsState = {
  isPlaying: false,
  isPaused: false,
  fullText: '',
  currentCharIndex: 0,
  rate: 1.0,
  wordSpans: [],
  wordOffsets: [],
  container: null,
  utteranceStartOffset: 0,
  onStateChange: null,

  // Для эмуляции подсветки и точной позиции на Android Chrome,
  // где не приходят события onboundary.
  utteranceStartTime: 0,        // timestamp начала текущей реплики
  highlightTimer: null,         // setInterval, двигающий подсветку
  boundaryReceived: false,      // пришло ли хоть одно onboundary
};

// Эмпирическая скорость чтения: символов в секунду на rate 1.0.
const CHARS_PER_SECOND = 14;

// ---------- Голоса ----------

function loadVoices() {
  cachedVoices = window.speechSynthesis.getVoices();
}

if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickRussianVoice() {
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  return cachedVoices.find(v => v.lang === 'ru-RU')
      || cachedVoices.find(v => v.lang && v.lang.startsWith('ru'))
      || null;
}

// ---------- Рендер текста по словам ----------

function renderText(text, container) {
  ttsState.fullText = text;
  ttsState.container = container;
  ttsState.wordSpans = [];
  ttsState.wordOffsets = [];
  ttsState.currentCharIndex = 0;

  container.innerHTML = '';

  const tokens = text.match(/(\S+|\s+)/g) || [];
  let offset = 0;

  tokens.forEach((token) => {
    if (/^\s+$/.test(token)) {
      container.appendChild(document.createTextNode(token));
    } else {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = token;
      span.dataset.offset = String(offset);
      span.dataset.index = String(ttsState.wordSpans.length);
      container.appendChild(span);
      ttsState.wordSpans.push(span);
      ttsState.wordOffsets.push(offset);
    }
    offset += token.length;
  });
}

// ---------- Подсветка ----------

function clearHighlight() {
  ttsState.wordSpans.forEach(s => s.classList.remove('word--active'));
}

function highlightWordAt(charIndex) {
  if (ttsState.wordOffsets.length === 0) return;
  clearHighlight();

  let targetIndex = 0;
  for (let i = ttsState.wordOffsets.length - 1; i >= 0; i--) {
    if (ttsState.wordOffsets[i] <= charIndex) {
      targetIndex = i;
      break;
    }
  }

  const span = ttsState.wordSpans[targetIndex];
  span.classList.add('word--active');

  const rect = span.getBoundingClientRect();
  const viewportH = window.innerHeight;
  if (rect.top < 80 || rect.bottom > viewportH - 80) {
    span.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ---------- Эмуляция подсветки по таймеру ----------
// Нужна для Android Chrome, где onboundary не работает.
// Включается через 500 мс после старта, если ни одного boundary не пришло.

function startHighlightTimer() {
  stopHighlightTimer();

  setTimeout(() => {
    // Если за полсекунды браузер прислал хотя бы один boundary — он работает,
    // эмуляция не нужна.
    if (ttsState.boundaryReceived || !ttsState.isPlaying) return;

    console.log('TTS: onboundary не пришёл, включаю эмуляцию подсветки');
    ttsState.highlightTimer = setInterval(() => {
      if (!ttsState.isPlaying || ttsState.isPaused) return;
      const elapsedSec = (Date.now() - ttsState.utteranceStartTime) / 1000;
      const charsRead = elapsedSec * CHARS_PER_SECOND * ttsState.rate;
      const absoluteIndex = ttsState.utteranceStartOffset + Math.floor(charsRead);
      if (absoluteIndex >= ttsState.fullText.length) return;
      ttsState.currentCharIndex = absoluteIndex;
      highlightWordAt(absoluteIndex);
    }, 200);
  }, 500);
}

function stopHighlightTimer() {
  if (ttsState.highlightTimer) {
    clearInterval(ttsState.highlightTimer);
    ttsState.highlightTimer = null;
  }
}

// ---------- Запуск чтения ----------

function startUtteranceFrom(offset) {
  if (!('speechSynthesis' in window)) return false;

  const text = ttsState.fullText.slice(offset);
  if (!text.trim()) return false;

  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  const russianVoice = pickRussianVoice();

  if (!russianVoice && cachedVoices.length === 0) {
    console.warn('TTS: голоса ещё не загружены, ждём…');
    const retry = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', retry);
      loadVoices();
      startUtteranceFrom(offset);
    };
    window.speechSynthesis.addEventListener('voiceschanged', retry);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', retry);
    }, 1000);
    return false;
  }

  if (!russianVoice) {
    alert('В твоём браузере нет русского голоса для озвучки. ' +
          'Открой сайт в другом браузере (например, Chrome) или используй телефон.');
    ttsState.isPlaying = false;
    ttsState.isPaused = false;
    notifyStateChange();
    return false;
  }

  window.speechSynthesis.cancel();
  stopHighlightTimer();

  const utterance = new SpeechSynthesisUtterance(text);

  if (russianVoice) {
    utterance.voice = russianVoice;
    utterance.lang = russianVoice.lang || 'ru-RU';
  } else {
    utterance.lang = 'ru-RU';
  }
  utterance.rate = ttsState.rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  console.log('TTS: запускаем с позиции', offset, 'rate =', ttsState.rate);

  ttsState.utteranceStartOffset = offset;
  ttsState.currentCharIndex = offset;
  ttsState.utteranceStartTime = Date.now();
  ttsState.boundaryReceived = false;

  // Состояние ставим сразу: Android Chrome onstart часто не присылает.
  ttsState.isPlaying = true;
  ttsState.isPaused = false;
  notifyStateChange();

  // Сразу подсветим первое слово на позиции offset.
  highlightWordAt(offset);

  utterance.onstart = () => {
    console.log('TTS: подтверждено начало');
  };

  utterance.onend = () => {
    if (ttsState.isPlaying) {
      ttsState.isPlaying = false;
      ttsState.isPaused = false;
      stopHighlightTimer();
      clearHighlight();
      console.log('TTS: закончили читать');
      notifyStateChange();
    }
  };

  utterance.onerror = (e) => {
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      console.error('TTS: ошибка', e.error, e);
    }
  };

  utterance.onboundary = (e) => {
    if (e.name && e.name !== 'word') return;
    ttsState.boundaryReceived = true;
    // Раз boundary пришёл — эмуляция по таймеру не нужна, гасим её.
    stopHighlightTimer();
    const absoluteIndex = ttsState.utteranceStartOffset + e.charIndex;
    ttsState.currentCharIndex = absoluteIndex;
    highlightWordAt(absoluteIndex);
  };

  window.speechSynthesis.speak(utterance);

  // Запускаем фолбэк-подсветку: если через 500мс boundary так и не пришёл,
  // включится таймер.
  startHighlightTimer();

  return true;
}

// ---------- Публичный API ----------

function speak(text, container) {
  if (!('speechSynthesis' in window)) {
    alert('Твой браузер не умеет озвучивать текст. Попробуй другой браузер.');
    return false;
  }
  if (!text || !text.trim()) return false;

  if (text !== ttsState.fullText || container !== ttsState.container) {
    renderText(text, container);
  }
  return startUtteranceFrom(0);
}

function speakFromWordIndex(wordIndex) {
  if (wordIndex < 0 || wordIndex >= ttsState.wordOffsets.length) return false;
  const offset = ttsState.wordOffsets[wordIndex];
  return startUtteranceFrom(offset);
}

// Пауза/возобновление: на Android Chrome speechSynthesis.pause/resume не
// работают надёжно. Эмулируем через cancel + повторный старт с позиции.
function pause() {
  if (!('speechSynthesis' in window)) return;
  if (!ttsState.isPlaying || ttsState.isPaused) return;

  // Зафиксируем позицию ДО cancel — после cancel её уже не получить.
  // currentCharIndex обновлялся либо onboundary, либо таймером.
  // Если ни то ни другое не работало — оценим по времени.
  if (!ttsState.boundaryReceived && !ttsState.highlightTimer) {
    const elapsedSec = (Date.now() - ttsState.utteranceStartTime) / 1000;
    const charsRead = elapsedSec * CHARS_PER_SECOND * ttsState.rate;
    ttsState.currentCharIndex = ttsState.utteranceStartOffset + Math.floor(charsRead);
  }

  ttsState.isPaused = true;
  stopHighlightTimer();
  window.speechSynthesis.cancel();
  console.log('TTS: пауза на позиции', ttsState.currentCharIndex);
  notifyStateChange();
}

function resume() {
  if (!ttsState.isPaused) return;
  // Продолжаем с запомненной позиции — это перезапуск, не реальный resume.
  startUtteranceFrom(ttsState.currentCharIndex);
}

function stop() {
  if (!('speechSynthesis' in window)) return;
  ttsState.isPlaying = false;
  ttsState.isPaused = false;
  stopHighlightTimer();
  window.speechSynthesis.cancel();
  clearHighlight();
  console.log('TTS: стоп');
  notifyStateChange();
}

function rewind(seconds) {
  if (!ttsState.fullText) return;

  // Обновим currentCharIndex по времени, если других источников нет.
  if (ttsState.isPlaying && !ttsState.isPaused
      && !ttsState.boundaryReceived && !ttsState.highlightTimer) {
    const elapsedSec = (Date.now() - ttsState.utteranceStartTime) / 1000;
    const charsRead = elapsedSec * CHARS_PER_SECOND * ttsState.rate;
    ttsState.currentCharIndex = ttsState.utteranceStartOffset + Math.floor(charsRead);
  }

  const wordsBack = Math.round(seconds * 2.5 * ttsState.rate);
  let currentWordIndex = 0;
  for (let i = ttsState.wordOffsets.length - 1; i >= 0; i--) {
    if (ttsState.wordOffsets[i] <= ttsState.currentCharIndex) {
      currentWordIndex = i;
      break;
    }
  }
  const targetIndex = Math.max(0, currentWordIndex - wordsBack);
  speakFromWordIndex(targetIndex);
}

function setRate(rate) {
  ttsState.rate = rate;
  if (ttsState.isPlaying && !ttsState.isPaused) {
    startUtteranceFrom(ttsState.currentCharIndex);
  }
}

function onTtsStateChange(callback) {
  ttsState.onStateChange = callback;
}

function notifyStateChange() {
  if (typeof ttsState.onStateChange === 'function') {
    ttsState.onStateChange({
      isPlaying: ttsState.isPlaying,
      isPaused: ttsState.isPaused,
    });
  }
}

function getTtsState() {
  return {
    isPlaying: ttsState.isPlaying,
    isPaused: ttsState.isPaused,
  };
}
