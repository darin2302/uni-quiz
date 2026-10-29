/*
 * Обща парола за сайта (само в браузъра).
 *
 * ВНИМАНИЕ: това НЕ е истинска защита. Хранилището е публично и всеки, който
 * отвори изходния код, може да заобиколи проверката. Целта е само случайни
 * посетители и търсачки да не стигат до тестовете.
 *
 * Как работи: страницата е скрита, докато не се въведе парола. SHA-256 на
 * въведения текст се сравнява с HASH по-долу. При успех хешът се запомня в
 * localStorage ("uniquiz-unlocked") за 30 дни — важи за всички страници на
 * сайта (същият произход). Смяна на паролата: python publish.py --password НОВА
 */
(function () {
  'use strict';

  var HASH = 'd79e52ddbff9dca0072e345d48d50943a100212261709e52507eddd306748ce0';
  var KEY = 'uniquiz-unlocked';
  var DAYS = 30;

  var root = document.documentElement;

  function isUnlocked() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      return !!v && v.hash === HASH && typeof v.exp === 'number' && v.exp > Date.now();
    } catch (e) {
      return false;
    }
  }

  if (isUnlocked()) return; // запомнено — страницата се показва веднага

  root.style.visibility = 'hidden';

  async function sha256Hex(text) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function showPrompt() {
    var style = document.createElement('style');
    style.textContent =
      '#uq-gate{position:fixed;inset:0;z-index:2147483647;visibility:visible;display:grid;place-items:center;padding:16px;' +
      'background:#f3f4f6;color:#1d2125;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
      '#uq-gate form{width:100%;max-width:340px;background:#fff;border:1px solid #d8dde3;border-radius:10px;padding:22px;' +
      'box-shadow:0 1px 2px rgba(0,0,0,.06),0 2px 8px rgba(0,0,0,.04)}' +
      '#uq-gate h1{font-size:1.2rem;margin:0 0 12px}' +
      '#uq-gate input{width:100%;box-sizing:border-box;font:inherit;padding:8px 10px;border-radius:7px;border:1px solid #d8dde3;background:#fff;color:inherit}' +
      '#uq-gate button{margin-top:12px;width:100%;font:inherit;padding:8px 12px;border-radius:7px;border:1px solid #0f6cbf;background:#0f6cbf;color:#fff;cursor:pointer}' +
      '#uq-gate .err{color:#c62828;min-height:1.5em;margin-top:8px;font-size:.92rem}' +
      '@media (prefers-color-scheme: dark){#uq-gate{background:#14171b;color:#e6e8eb}' +
      '#uq-gate form{background:#1d2126;border-color:#353b42;box-shadow:none}' +
      '#uq-gate input{background:#23282e;border-color:#353b42}' +
      '#uq-gate button{background:#5aa9ff;border-color:#5aa9ff;color:#0b1a2b}#uq-gate .err{color:#ff8a80}}';

    var gate = document.createElement('div');
    gate.id = 'uq-gate';
    gate.innerHTML =
      '<form autocomplete="off">' +
      '<h1>Въведи паролата</h1>' +
      '<input type="password" id="uq-pass" aria-label="Парола" autofocus>' +
      '<button type="submit">Влез</button>' +
      '<div class="err" id="uq-err" role="alert"></div>' +
      '</form>';

    root.appendChild(style);
    root.appendChild(gate);

    var input = gate.querySelector('#uq-pass');
    var err = gate.querySelector('#uq-err');
    input.focus();

    gate.querySelector('form').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!window.crypto || !crypto.subtle) {
        err.textContent = 'Браузърът не поддържа проверката (нужен е HTTPS).';
        return;
      }
      var h = await sha256Hex(input.value);
      if (h === HASH) {
        try { localStorage.setItem(KEY, JSON.stringify({ hash: HASH, exp: Date.now() + DAYS * 864e5 })); } catch (e2) {}
        gate.remove();
        style.remove();
        root.style.visibility = '';
      } else {
        err.textContent = 'Грешна парола';
        input.select();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showPrompt);
  else showPrompt();
})();
