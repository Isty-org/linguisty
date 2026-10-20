# Linguisty v0.4.10 — MIT

Автор разработки — Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)).

- Собственный код и документация распространяются под MIT: `Copyright (c) 2026 Никита Цыжман (@tsyzhman)`.
- Полный `LICENSE` и `THIRD_PARTY_NOTICES.txt` входят в исходники и оба ZIP автоматически при сборке.
- Сторонние copyright и OFL-лицензии шрифтов сохранены.
- Проверка пакетов отклоняет отсутствие или изменение лицензий. Функциональность перевода сохранена.

## Установка

Chrome: распакуйте `linguisty-0.4.10-chrome.zip`, откройте `chrome://extensions`, включите режим разработчика и загрузите распакованную папку.

Firefox: распакуйте `linguisty-0.4.10-firefox.zip`, откройте `about:debugging` → «Этот Firefox» → «Загрузить временное дополнение», выберите `manifest.json`. Firefox ZIP неподписан; постоянная установка требует подписи Mozilla.

SHA-256 пакетов находится в `SHA256SUMS.txt`. Полные исходники доступны через GitHub Source code по tag `v0.4.10`; пересборка — `npm ci` и `npm run build:chrome` / `npm run build:firefox`.

Проверки и ограничения: [QA-MIT-2026-10-20](QA-MIT-2026-10-20.md). Реальные вход ChatGPT, платные API, доступность плана всем аккаунтам, языковая точность и магазинная установка не проверяются этим выпуском. MIT не меняет условия доступа к сторонним сервисам.

Пройдено: typecheck/lint, 780 unit tests, 15 native tests, 10 manifest/license tests, обе сборки и целевой browser smoke в Chrome/Firefox. Mozilla linter: 0 errors / notices / warnings. Прежние runtime/assets побайтно совпали с v0.4.9; в manifest изменён только номер версии, добавлены два текста лицензий.

Первый релиз v0.4.9 сохранён в истории. [Лицензия](../LICENSE), [авторство](../AUTHORS.md), [сторонние notices](../THIRD_PARTY_NOTICES.txt).
