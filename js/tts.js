// js/tts.js
// Обёртка над браузерным синтезатором речи (Web Speech API).
// Этап 5: умеем начать чтение текста русским голосом.

// Внутренний кэш голосов. Браузер подгружает их асинхронно,
// поэтому мы их «ловим» один раз и держим под рукой.
let cachedVoices = [];

function loadVoices() {
  cachedVoices = window.speechSynthesis.getVoices();
}

// Подписываемся на событие «голоса обновились» — оно срабатывает,
// когда браузер закончил загрузку списка голосов.
if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Выбирает лучший доступный русский голос. Если русского нет — вернёт null,
// и тогда браузер будет читать дефолтным голосом (часто всё равно сносно).
function pickRussianVoice() {
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  return cachedVoices.find(v => v.lang === 'ru-RU')
      || cachedVoices.find(v => v.lang && v.lang.startsWith('ru'))
      || null;
}

// Запускает озвучку переданного текста.
// Возвращает true, если получилось запустить, иначе false.
function speak(text) {
  if (!('speechSynthesis' in window)) {
    alert('Твой браузер не умеет озвучивать текст. Попробуй другой браузер.');
    return false;
  }

  if (!text || text.trim() === '') {
    return false;
  }

  // На всякий случай останавливаем то, что уже могло читаться.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const russianVoice = pickRussianVoice();
  if (russianVoice) {
    utterance.voice = russianVoice;
    console.log('TTS: выбран голос', russianVoice.name, russianVoice.lang);
  } else {
    console.warn('TTS: русский голос не найден, читаю дефолтным');
  }

  utterance.onstart = () => console.log('TTS: начали читать');
  utterance.onend   = () => console.log('TTS: закончили читать');
  utterance.onerror = (e) => console.error('TTS: ошибка', e);

  window.speechSynthesis.speak(utterance);
  return true;
}
