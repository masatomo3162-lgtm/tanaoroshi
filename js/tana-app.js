/* tana-app.js : アプリ本体（共通UI・タブ切替・初期化） */
(function () {
  'use strict';
  var U = TANA.util;

  /* ================= 共通UI ================= */
  var ui = {};

  /* --- モーダル ---
     buttons: [{label, primary?, danger?, keepOpen?, onClick(close)}]
     keepOpen が無いボタンは押すと自動で閉じる */
  ui.modal = function (title, bodyHtml, buttons) {
    var ov = document.getElementById('tana-modal-overlay');
    var elTitle = document.getElementById('tana-modal-title');
    var elBody = document.getElementById('tana-modal-body');
    var elFoot = document.getElementById('tana-modal-foot');
    var elClose = document.getElementById('tana-modal-close');

    elTitle.textContent = title;
    elBody.innerHTML = bodyHtml;
    elFoot.innerHTML = '';

    function close() {
      ov.hidden = true;
      elBody.innerHTML = '';
      elFoot.innerHTML = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    (buttons || [{ label: '閉じる', primary: true }]).forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tana-btn' + (b.primary ? ' tana-btn-primary' : '') + (b.danger ? ' tana-btn-danger' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', function () {
        if (b.onClick) b.onClick(close);
        if (!b.keepOpen) close();
      });
      elFoot.appendChild(btn);
    });

    elClose.onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };
    document.addEventListener('keydown', onKey);
    ov.hidden = false;

    /* 最初の入力欄にフォーカス */
    var first = elBody.querySelector('input, select, textarea');
    if (first) setTimeout(function () { first.focus(); }, 30);
    return { close: close };
  };

  /* --- 確認ダイアログ（Promise<boolean>） ---
     opts: {danger, okLabel, cancelLabel, requireText} */
  ui.confirm = function (title, msgHtml, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var body = '<div class="tana-confirm-body">' + msgHtml + '</div>';
      if (opts.requireText) {
        body += '<input type="text" id="tana-confirm-text" style="width:100%;margin-top:8px;" ' +
          'placeholder="ここに「' + U.escapeHtml(opts.requireText) + '」と入力" autocomplete="off">';
      }
      var settled = false;
      var done = function (v, close) { if (!settled) { settled = true; resolve(v); } if (close) close(); };

      var m = ui.modal(title, body, [
        {
          label: opts.cancelLabel || 'キャンセル', keepOpen: true,
          onClick: function (close) { done(false, close); }
        },
        {
          label: opts.okLabel || 'OK', primary: !opts.danger, danger: !!opts.danger, keepOpen: true,
          onClick: function (close) {
            if (opts.requireText) {
              var v = document.getElementById('tana-confirm-text').value.trim();
              if (v !== String(opts.requireText)) {
                ui.toast('確認のため「' + opts.requireText + '」と入力してください', 'warn');
                return;
              }
            }
            done(true, close);
          }
        }
      ]);

      /* ×やオーバーレイで閉じた場合はキャンセル扱い */
      var ov = document.getElementById('tana-modal-overlay');
      var elClose = document.getElementById('tana-modal-close');
      var origCloseBtn = elClose.onclick;
      elClose.onclick = function () { done(false); if (origCloseBtn) origCloseBtn(); };
      var origOv = ov.onclick;
      ov.onclick = function (e) { if (e.target === ov) { done(false); } if (origOv) origOv(e); };
      void m;
    });
  };

  /* --- トースト --- */
  ui.toast = function (msg, type, ms) {
    var wrap = document.getElementById('tana-toast-wrap');
    var t = document.createElement('div');
    t.className = 'tana-toast tana-toast-' + (type || 'ok');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.classList.add('is-show'); }, 10);
    setTimeout(function () {
      t.classList.remove('is-show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, ms || 2600);
  };

  /* --- 保存エラーバー（容量超過など） --- */
  ui.setSaveError = function (on) {
    var id = 'tana-save-error-bar';
    var bar = document.getElementById(id);
    if (on) {
      if (bar) return;
      bar = document.createElement('div');
      bar.id = id;
      bar.className = 'tana-save-error';
      bar.innerHTML = '<strong>保存に失敗しました。</strong>ブラウザの保存領域（localStorage）が不足している可能性があります。' +
        '設定タブからJSONバックアップを保存し、不要な年度やサンプルデータの削除をお試しください。';
      document.body.insertBefore(bar, document.body.firstChild);
    } else if (bar) {
      bar.parentNode.removeChild(bar);
    }
  };

  TANA.ui = ui;

  /* ================= アプリ本体 ================= */
  var app = {};
  var _currentYear = null;
  var _currentTab = 'dashboard';

  /* --- 現在の対象年度 --- */
  app.currentYear = function () {
    var list = TANA.store.yearList();
    if (_currentYear && TANA.store.getYear(_currentYear)) return _currentYear;
    _currentYear = list.length ? list[0] : null; /* 既定＝最新年度 */
    return _currentYear;
  };
  app.setCurrentYear = function (y) {
    _currentYear = (y && TANA.store.getYear(y)) ? String(y) : null;
  };

  /* --- 年度選択セレクトのHTML --- */
  app.yearSelectHtml = function (id, selected) {
    var list = TANA.store.yearList();
    var h = '<select id="' + id + '" class="tana-year-select">';
    if (!list.length) h += '<option value="">（年度なし）</option>';
    list.forEach(function (k) {
      var y = TANA.store.getYear(k);
      h += '<option value="' + k + '"' + (String(selected) === k ? ' selected' : '') + '>' +
        k + '年（' + U.STATUS[y.status] + '）</option>';
    });
    h += '</select>';
    return h;
  };

  /* --- ヘッダー店舗名 --- */
  app.renderHeader = function () {
    var el = document.getElementById('tana-header-store');
    el.textContent = TANA.store.state.settings.storeName || '';
  };

  /* --- タブ描画 --- */
  var renderers = {
    dashboard: function () { TANA.dashboard.render(); },
    input: function () { TANA.inventory.render(); },
    master: function () { TANA.master.render(); },
    years: function () { TANA.years.render(); },
    output: function () { TANA.output.render(); },
    settings: function () { TANA.settings.render(); }
  };

  app.renderTab = function (tab) {
    if (renderers[tab]) renderers[tab]();
  };
  app.renderAll = function () {
    app.renderTab(_currentTab);
  };

  app.switchTab = function (tab) {
    if (!renderers[tab]) return;
    _currentTab = tab;
    document.querySelectorAll('#tana-tabs .tana-tab').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.tana-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.id === 'tana-tab-' + tab);
    });
    app.renderTab(tab);
    window.scrollTo(0, 0);
  };

  /* 旧バージョンからの移行警告（通常年度に旧初期値の可能性がある場合、一度だけ表示）。
     起動時と、旧版バックアップの復元直後の両方から呼ばれる。対象がなければ何もしない */
  app.showMigrationNoticeIfNeeded = function () {
    var mn = TANA.store.state.migrationNotice;
    if (!mn || mn.shown || !mn.items || !mn.items.length) return false;
    setTimeout(function () {
      var list = '<ul>' + mn.items.map(function (t) { return '<li>' + U.escapeHtml(t) + '</li>'; }).join('') + '</ul>';
      TANA.ui.modal('旧バージョンのデータ確認のお願い',
        '<p>旧版（Ver.1.0.0）の初期値が残っている可能性のある残量割合品目があります。棚卸入力画面で、実際の残量と合っているか確認してください。</p>' +
        list +
        '<p class="tana-hint">実際に「未開封同等（1本分）」で正しい場合は、そのままで問題ありません。この確認は一度だけ表示されます。</p>',
        [{
          label: '確認しました', primary: true,
          onClick: function () {
            TANA.store.state.migrationNotice.shown = true;
            TANA.store.save();
          }
        }]);
    }, 400);
    return true;
  };

  /* --- 初期化 --- */
  app.init = function () {
    TANA.store.load();

    /* 初回起動（保存データなし）かつマスター・年度が完全に空ならサンプルデータを作成。
       設定タブから一括削除できる */
    var isFirstRun = false;
    try { isFirstRun = (localStorage.getItem('tana_v1_data') === null); } catch (e) { /* 読めない環境では作らない */ }
    var sampleCreated = false;
    if (isFirstRun && TANA.store.state.master.length === 0 && TANA.store.yearList().length === 0) {
      var sr = TANA.store.createSample(); /* createSample側でも衝突を確認する */
      if (sr && sr.ok) { TANA.store.save(); sampleCreated = true; }
    }

    app.renderHeader();

    document.getElementById('tana-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.tana-tab');
      if (btn) app.switchTab(btn.getAttribute('data-tab'));
    });

    /* 印刷が終わったら（またはキャンセルされたら）印刷用クラスを必ず外す保険 */
    window.addEventListener('afterprint', function () {
      document.body.classList.remove('tana-printing');
    });

    app.switchTab('dashboard');

    if (sampleCreated) {
      setTimeout(function () {
        TANA.ui.toast('はじめての起動のため、サンプルデータを表示しています（設定タブから削除できます）', 'ok', 5000);
      }, 300);
    }

    /* 旧バージョンからの移行警告（対象がある場合のみ、一度だけ） */
    app.showMigrationNoticeIfNeeded();
  };

  TANA.app = app;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app.init);
  } else {
    app.init();
  }
})();
