// js/tts.js
// Обёртка над браузерным синтезатором речи (Web Speech API).
// Этап 5: умеем читать русским голосом.
// Этап 6: пауза/возобновление, стоп, скорость, подсветка слов,
//         перемотка назад и старт чтения с произвольного слова.

// ---------- Внутреннее состояние модуля ----------

let cachedVoices = [];

// Текущее состояние плеера. Нужно, чтобы UI знал, что показывать.
const ttsState = {
  isPlaying: false,
  isPaused: false,
  fullText: '',           // полный текст пересказа (без изменений)
  currentCharIndex: 0,    // позиция в fullText, где сейчас читаем
  rate: 1.0,              // текущая скорость
  wordSpans: [],          // массив <span>-ов слов (для подсветки)
  wordOffsets: [],        // позиция каждого слова в fullText (charIndex)
  container: null,        // DOM-элемент, куда отрендерен текст
  utteranceStartOffset: 0,// с какого charIndex стартовала текущая реплика
  onStateChange: null,    // колбэк для UI: «обнови вид кнопок»
};

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

// Раскладывает текст на <span class="word"> и пробелы.
// Запоминает в ttsState массив спанов и массив их смещений в исходном тексте.
function renderText(text, container) {
  ttsState.fullText = text;
  ttsState.container = container;
  ttsState.wordSpans = [];
  ttsState.wordOffsets = [];
  ttsState.currentCharIndex = 0;

  container.innerHTML = '';

  // Регулярка делит текст на «слова» и «не-слова» (пробелы, переносы, знаки).
  // Сохраняем всё подряд, чтобы абзацы и пунктуация остались на местах.
  const tokens = text.match(/(\S+|\s+)/g) || [];
  let offset = 0;

  tokens.forEach((token, index) => {
    if (/^\s+$/.test(token)) {
      // Пробельный кусок — вставляем как текстовый узел, не кликабельный.
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

// Подсвечивает слово, чьё смещение ближе всего (но не больше) к charIndex.
function highlightWordAt(charIndex) {
  if (ttsState.wordOffsets.length === 0) return;
  clearHighlight();

  // Бинарный поиск был бы быстрее, но слов у нас максимум пара тысяч —
  // линейный проход с конца тоже отработает мгновенно.
  let targetIndex = 0;
  for (let i = ttsState.wordOffsets.length - 1; i >= 0; i--) {
    if (ttsState.wordOffsets[i] <= charIndex) {
      targetIndex = i;
      break;
    }
  }

  const span = ttsState.wordSpans[targetIndex];
  span.classList.add('word--active');

  // Мягкий автоскролл, только если слово ушло за пределы экрана.
  const rect = span.getBoundingClientRect();
  const viewportH = window.innerHeight;
  if (rect.top < 80 || rect.bottom > viewportH - 80) {
    span.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ---------- Запуск чтения ----------

// Внутренняя функция: запускает озвучку подстроки начиная с offset.
function startUtteranceFrom(offset) {
  if (!('speechSynthesis' in window)) return false;

  const text = ttsState.fullText.slice(offset);
  if (!text.trim()) return false;

  // Голоса могут быть ещё не загружены при первом запуске.
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  const russianVoice = pickRussianVoice();

  // Если голоса ещё не подгрузились — подождём событие и попробуем снова.
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

  // Голоса есть, но русского нет — честно говорим пользователю.
  // Английским читать русский текст бессмысленно: голос спотыкается на словах.
  if (!russianVoice) {
    alert('В твоём браузере нет русского голоса для озвучки. ' +
          'Открой сайт в другом браузере (например, Chrome) или используй телефон.');
    ttsState.isPlaying = false;
    ttsState.isPaused = false;
    notifyStateChange();
    return false;
  }


  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // Порядок важен для Android Chrome: сначала voice и lang, потом rate.
  // Если rate выставить ДО voice — на некоторых сборках игнорируется.
  if (russianVoice) {
    utterance.voice = russianVoice;
    utterance.lang = russianVoice.lang || 'ru-RU';
    console.log('TTS: голос', russianVoice.name, russianVoice.lang);
  } else {
    utterance.lang = 'ru-RU';
    console.warn('TTS: русский голос не найден, читаю дефолтным');
  }
  utterance.rate = ttsState.rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  console.log('TTS: rate =', ttsState.rate);


  ttsState.utteranceStartOffset = offset;
  ttsState.currentCharIndex = offset;

  // На Android Chrome событие onstart часто не приходит — ставим состояние
  // сразу при вызове speak(), не дожидаясь подтверждения от браузера.
  ttsState.isPlaying = true;
  ttsState.isPaused = false;
  console.log('TTS: запускаем чтение с позиции', offset);
  notifyStateChange();

  utterance.onstart = () => {
    // Подстраховка для десктопа: если onstart всё-таки придёт — просто лог.
    console.log('TTS: подтверждено начало');
  };


  utterance.onend = () => {
    if (ttsState.isPlaying) {
      ttsState.isPlaying = false;
      ttsState.isPaused = false;
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
    const absoluteIndex = ttsState.utteranceStartOffset + e.charIndex;
    ttsState.currentCharIndex = absoluteIndex;
    highlightWordAt(absoluteIndex);
  };

  window.speechSynthesis.speak(utterance);
  return true;
}


// ---------- Публичный API ----------

// Запустить с начала или с произвольного смещения.
function speak(text, container) {
  if (!('speechSynthesis' in window)) {
    alert('Твой браузер не умеет озвучивать текст. Попробуй другой браузер.');
    return false;
  }
  if (!text || !text.trim()) return false;

  // Если переданы новые text+container — переразложить текст по словам.
  if (text !== ttsState.fullText || container !== ttsState.container) {
    renderText(text, container);
  }
  return startUtteranceFrom(0);
}

// Старт с конкретного слова (по клику пользователя).
function speakFromWordIndex(wordIndex) {
  if (wordIndex < 0 || wordIndex >= ttsState.wordOffsets.length) return false;
  const offset = ttsState.wordOffsets[wordIndex];
  highlightWordAt(offset);
  return startUtteranceFrom(offset);
}

function pause() {
  if (!('speechSynthesis' in window)) return;
  if (ttsState.isPlaying && !ttsState.isPaused) {
    window.speechSynthesis.pause();
    ttsState.isPaused = true;
    console.log('TTS: пауза');
    notifyStateChange();
  }
}

function resume() {
  if (!('speechSynthesis' in window)) return;
  if (ttsState.isPlaying && ttsState.isPaused) {
    window.speechSynthesis.resume();
    ttsState.isPaused = false;
    console.log('TTS: продолжаем');
    notifyStateChange();
  }
}

function stop() {
  if (!('speechSynthesis' in window)) return;
  ttsState.isPlaying = false;
  ttsState.isPaused = false;
  window.speechSynthesis.cancel();
  clearHighlight();
  console.log('TTS: стоп');
  notifyStateChange();
}

// Перемотка назад. На скорости 1.0 принимаем 2.5 слова/сек.
function rewind(seconds) {
  if (!ttsState.fullText) return;

  const wordsBack = Math.round(seconds * 2.5 * ttsState.rate);
  // Найти индекс слова, на котором мы сейчас, и отступить назад.
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
  // Если сейчас читаем — перезапустить с текущей позиции с новой скоростью.
  if (ttsState.isPlaying) {
    startUtteranceFrom(ttsState.currentCharIndex);
  }
}

// Колбэк, чтобы UI узнавал об изменениях (play/pause/stop).
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

// Удобный геттер для app.js: что показать на кнопке.
function getTtsState() {
  return {
    isPlaying: ttsState.isPlaying,
    isPaused: ttsState.isPaused,
  };
}
