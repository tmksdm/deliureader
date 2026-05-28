// js/app.js
// Точка входа приложения DeliuReader.
// Этап 4: заглушка генерации.
// Этап 5: подключена кнопка «Слушать» — озвучивает текст из карточки.

const FAKE_SUMMARY = `Это тестовый пересказ. Настоящий текст будет приходить от языковой модели позже, на этапе 10. Сейчас наша задача — убедиться, что кнопка работает, текст появляется на экране, а блок с результатом выглядит аккуратно.

Представь, что здесь идёт спокойный устный рассказ о произведении: автор, время создания, главные герои, ключевые события и темы. Текст написан сплошными абзацами, без списков и заголовков, потому что позже он пойдёт прямо в синтезатор речи — браузер будет читать его вслух.

На этом этапе не важно, какую книгу ты ввёл в поле — ответ всегда один и тот же. Это нормально. Главное — что весь путь «нажал кнопку → увидел текст» работает от начала до конца.`;

document.addEventListener('DOMContentLoaded', () => {
  const queryInput = document.getElementById('query');
  const generateBtn = document.getElementById('generate-btn');
  const resultBlock = document.getElementById('result');
  const resultText = document.getElementById('result-text');
  const resultTitle = document.getElementById('result-title');
  const speakBtn = document.getElementById('speak-btn');

  // --- Этап 4: показать фиктивный пересказ ---
  generateBtn.addEventListener('click', () => {
    const query = queryInput.value.trim();

    if (query === '') {
      alert('Введи автора и название книги.');
      return;
    }

    resultTitle.textContent = query;
    resultText.textContent = FAKE_SUMMARY;
    resultBlock.hidden = false;

    resultBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // --- Этап 5: озвучить текст пересказа ---
  speakBtn.addEventListener('click', () => {
    const text = resultText.textContent;
    speak(text);   // функция объявлена в js/tts.js
  });
});
