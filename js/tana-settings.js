/* tana-settings.js : 設定 */
(function () {
  'use strict';
  var U = TANA.util;
  var st = {};

  var LABELS = {
    storeName: '店舗名', storeAddress: '住所', ownerName: '事業主名', authorName: '作成者名',
    fiscalMonth: '決算月', taxMode: '税込/税抜', rounding: '端数処理', currency: '通貨記号', autoSave: '自動保存'
  };

  st.render = function () {
    var el = document.getElementById('tana-tab-settings');
    var s = TANA.store.state.settings;
    var hasSample = TANA.store.hasSample();

    var html = '';

    /* --- 店舗情報・表示設定 --- */
    html += '<div class="tana-card"><h2 class="tana-h2">店舗情報と表示の設定</h2>' +
      '<div class="tana-form-grid">' +
      '<label>店舗名<input type="text" id="ts-store" value="' + U.escapeHtml(s.storeName) + '" placeholder="例：ヘアーサロン○○"></label>' +
      '<label>住所<input type="text" id="ts-addr" value="' + U.escapeHtml(s.storeAddress) + '"></label>' +
      '<label>事業主名<input type="text" id="ts-owner" value="' + U.escapeHtml(s.ownerName) + '"></label>' +
      '<label>作成者名（棚卸表に印字）<input type="text" id="ts-author" value="' + U.escapeHtml(s.authorName) + '"></label>' +
      '<label>決算月<select id="ts-fiscal">' + monthOptions(s.fiscalMonth) + '</select>' +
      '<span class="tana-hint">新年度を作るときの基準日の初期値になります（決算月の末日）</span></label>' +
      '<label>金額の扱い<select id="ts-tax">' +
      opt('incl', '税込で入力・表示', s.taxMode) + opt('excl', '税抜で入力・表示', s.taxMode) +
      '</select><span class="tana-hint">入力した単価をどちらとして扱うかの表示上の区別です</span></label>' +
      '<label>金額の端数処理<select id="ts-round">' +
      opt('floor', '切り捨て', s.rounding) + opt('round', '四捨五入', s.rounding) + opt('ceil', '切り上げ', s.rounding) +
      '</select></label>' +
      '<label>通貨記号<input type="text" id="ts-cur" value="' + U.escapeHtml(s.currency) + '" style="max-width:6em;"></label>' +
      '<label><input type="checkbox" id="ts-autosave"' + (s.autoSave ? ' checked' : '') + '> 入力を自動保存する（推奨）</label>' +
      '</div>' +
      '<div class="tana-toolbar"><button class="tana-btn tana-btn-primary" id="ts-save">設定を保存</button></div>' +
      '</div>';

    /* --- バックアップ・復元 --- */
    html += '<div class="tana-card"><h2 class="tana-h2">バックアップと復元</h2>' +
      '<p>すべてのデータ（設定・品目マスター・全年度・履歴）を1つのファイルに保存できます。' +
      'パソコンの買い替えやブラウザの変更、万一のデータ消失に備えて、<strong>棚卸が終わったらバックアップを取る</strong>ことをおすすめします。</p>' +
      '<div class="tana-toolbar">' +
      '<button class="tana-btn tana-btn-primary" id="ts-backup">バックアップを保存（JSONファイル）</button>' +
      '<button class="tana-btn" id="ts-restore">バックアップから復元</button>' +
      '<input type="file" id="ts-restore-file" accept=".json,application/json" style="display:none;">' +
      '</div>' +
      '<p class="tana-hint">※データはこのパソコンのこのブラウザの中（localStorage）に保存されています。' +
      'ブラウザの履歴削除で「サイトデータ」を消すと棚卸データも消えるため、バックアップが安全です。</p>' +
      '</div>';

    /* --- サンプルデータ --- */
    html += '<div class="tana-card"><h2 class="tana-h2">サンプルデータ</h2>' +
      '<p>操作を試すためのサンプル（品目9件と2年分の年度データ）を作成・削除できます。' +
      (hasSample ? '<br><span class="tana-badge tana-badge-sample">現在サンプルデータが入っています</span>' : '') + '</p>' +
      '<div class="tana-toolbar">' +
      '<button class="tana-btn" id="ts-sample-add"' + (hasSample ? ' disabled' : '') + '>サンプルデータを作成</button>' +
      '<button class="tana-btn tana-btn-danger" id="ts-sample-del"' + (hasSample ? '' : ' disabled') + '>サンプルデータを一括削除</button>' +
      '</div>' +
      '<p class="tana-hint">一括削除では、サンプルとして作られた品目と年度だけが削除されます。ご自身で追加したデータは残ります。</p>' +
      '</div>';

    /* --- 初期化 --- */
    html += '<div class="tana-card"><h2 class="tana-h2">全データの初期化</h2>' +
      '<p class="tana-danger-text">すべてのデータ（設定・品目マスター・全年度・履歴）を削除して、最初の状態に戻します。元に戻せません。</p>' +
      '<div class="tana-toolbar"><button class="tana-btn tana-btn-danger" id="ts-reset">全データを初期化する</button></div>' +
      '</div>';

    /* --- バージョン情報 --- */
    html += '<div class="tana-card"><h2 class="tana-h2">バージョン情報</h2>' +
      '<p>棚卸管理アプリ　<strong>Ver.' + U.escapeHtml(TANA.store.state.appVersion || '1.0.0') + '</strong></p>' +
      '<h3 style="margin:8px 0 4px;">更新履歴</h3>' +
      '<ul class="tana-changelog">' +
      '<li><strong>Ver.1.0.2</strong>（不具合修正）：旧版（Ver.1.0.0）のJSONバックアップを復元した直後にも、移行の確認警告をその場で表示するように修正（従来は次回起動時まで表示されなかった）</li>' +
      '<li><strong>Ver.1.0.1</strong>（不具合修正）：初期表示の空モーダル修正／残量割合の初期値を未入力に変更（自動計上の解消）／修正履歴の項目名表示と二重記録の修正／基準日調整の計算方向を実地日と基準日の前後で正しく判定（画面に計算式を表示）／入力範囲チェック強化（割合0〜1・残量≦容量・整数・箱の入数と1本容量の必須化）／直接追加品目の区分・メーカー等を編集可能に／サンプル削除時に利用者追加データを保護／CSSのグローバル指定を廃止（統合対応）／サンプル再作成時に利用者データがあると作成を中止（上書き事故の防止）／旧版（Ver.1.0.0）保存データの読込・復元時にサンプル年度の残量割合を未入力へ自動移行（利用者の通常年度は変更せず確認のお願いを一度だけ表示）</li>' +
      '<li><strong>Ver.1.0.0</strong>（初回リリース）：棚卸入力（4種類の数え方・処理区分・基準日調整）、品目マスター、年度管理（作成・確定・確定解除・削除・前年比較）、修正履歴、棚卸記入用紙・完成棚卸表の印刷、CSV出力、JSONバックアップ／復元、サンプルデータ</li>' +
      '</ul>' +
      '<p class="tana-hint">このアプリは決算時の棚卸金額を確認するための補助資料を作るものです。税務上の取り扱いについては税理士等の専門家にご確認ください。</p>' +
      '</div>';

    el.innerHTML = html;
    bind(el);
  };

  function opt(v, label, cur) {
    return '<option value="' + v + '"' + (String(cur) === v ? ' selected' : '') + '>' + label + '</option>';
  }
  function monthOptions(cur) {
    var h = '';
    for (var m = 1; m <= 12; m++) h += '<option value="' + m + '"' + (Number(cur) === m ? ' selected' : '') + '>' + m + '月</option>';
    return h;
  }

  function bind(el) {
    var q = function (id) { return el.querySelector('#' + id); };

    /* 設定保存 */
    q('ts-save').addEventListener('click', function () {
      var s = TANA.store.state.settings;
      var before = JSON.parse(JSON.stringify(s));
      s.storeName = q('ts-store').value.trim();
      s.storeAddress = q('ts-addr').value.trim();
      s.ownerName = q('ts-owner').value.trim();
      s.authorName = q('ts-author').value.trim();
      s.fiscalMonth = Number(q('ts-fiscal').value);
      s.taxMode = q('ts-tax').value;
      s.rounding = q('ts-round').value;
      s.currency = q('ts-cur').value || '¥';
      s.autoSave = q('ts-autosave').checked;

      var mapped = function (x) {
        return {
          storeName: x.storeName, storeAddress: x.storeAddress, ownerName: x.ownerName, authorName: x.authorName,
          fiscalMonth: x.fiscalMonth + '月',
          taxMode: x.taxMode === 'incl' ? '税込' : '税抜',
          rounding: { floor: '切り捨て', round: '四捨五入', ceil: '切り上げ' }[x.rounding],
          currency: x.currency,
          autoSave: x.autoSave ? 'オン' : 'オフ'
        };
      };
      var changes = TANA.store.diff(LABELS, mapped(before), mapped(s));
      if (changes.length) TANA.store.log('設定変更', '', changes);
      TANA.store.save();
      TANA.app.renderHeader();
      TANA.ui.toast('設定を保存しました', 'ok');
    });

    /* バックアップ */
    q('ts-backup').addEventListener('click', function () {
      TANA.store.backupJSON();
      TANA.store.log('バックアップ保存', 'JSONファイル', []);
      TANA.store.save();
      TANA.ui.toast('バックアップファイルをダウンロードしました', 'ok');
    });

    /* 復元 */
    q('ts-restore').addEventListener('click', function () { q('ts-restore-file').click(); });
    q('ts-restore-file').addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var res = TANA.store.parseBackup(String(reader.result));
        if (!res.ok) {
          TANA.ui.modal('復元できません', '<p>選択したファイルは、このアプリのバックアップファイルとして読み込めませんでした。</p>' +
            '<p class="tana-hint">' + U.escapeHtml(res.error || '不明なエラー') + '</p>',
            [{ label: '閉じる', primary: true }]);
          return;
        }
        var parsed = res.data;
        var yn = Object.keys(parsed.years || {}).length;
        var mn = (parsed.master || []).length;
        var msg = '<p>次の内容で復元します。</p>' +
          '<ul><li>ファイル名：' + U.escapeHtml(file.name) + '</li>' +
          '<li>品目マスター：' + mn + ' 件</li><li>年度データ：' + yn + ' 年分</li></ul>' +
          '<p class="tana-danger-text">現在このアプリに入っているデータは、復元した内容で上書きされます。</p>' +
          '<p>安全のため、復元の直前に<strong>現在のデータのバックアップを自動でダウンロード</strong>してから復元します。</p>';
        TANA.ui.confirm('バックアップからの復元', msg, { danger: true, okLabel: '復元する' }).then(function (ok) {
          if (!ok) return;
          TANA.store.backupJSON(); /* 復元前の自動バックアップ */
          TANA.store.restore(parsed); /* restore内で履歴記録と保存が行われる */
          TANA.app.setCurrentYear(null);
          TANA.app.renderHeader();
          TANA.app.renderAll();
          TANA.ui.toast('復元が完了しました', 'ok');
          /* 旧版バックアップだった場合、移行の確認警告をその場で表示する */
          TANA.app.showMigrationNoticeIfNeeded();
        });
      };
      reader.onerror = function () { TANA.ui.toast('ファイルの読み込みに失敗しました', 'error'); };
      reader.readAsText(file);
    });

    /* サンプル作成 */
    q('ts-sample-add').addEventListener('click', function () {
      var res = TANA.store.createSample(); /* 履歴はcreateSample内で記録される */
      if (!res || !res.ok) {
        TANA.ui.modal('サンプルデータを作成できません',
          '<p>利用者データが存在するため、サンプルデータは作成できません（' + U.escapeHtml(res && res.reason ? res.reason : '既存データあり') + '）。</p>' +
          '<p>サンプルを試す場合は、JSONバックアップを保存したうえで「全データの初期化」を行ってから作成してください。</p>',
          [{ label: '閉じる', primary: true }]);
        return;
      }
      TANA.store.save();
      TANA.app.setCurrentYear(null);
      TANA.ui.toast('サンプルデータを作成しました', 'ok');
      st.render();
    });

    /* サンプル削除 */
    q('ts-sample-del').addEventListener('click', function () {
      TANA.ui.confirm('サンプルデータの一括削除',
        '<p>サンプルとして作成された品目と、サンプル年度内のサンプル品目の行を削除します。</p>' +
        '<ul><li>ご自身で追加した品目マスターは残ります。</li>' +
        '<li>サンプル年度にご自身で追加した品目の行は<strong>削除されず</strong>、その年度は通常の年度として残ります。</li>' +
        '<li>サンプル品目の行しかない年度は、年度ごと削除されます。</li></ul>' +
        '<p class="tana-hint">※サンプル品目の行にご自身で入力した数量・単価は、行ごと削除されます。残したい入力がある場合は、先にJSONバックアップを取ってください。</p>',
        { danger: true, okLabel: '削除する' }).then(function (ok) {
          if (!ok) return;
          TANA.store.deleteSample(); /* 履歴記録と保存はdeleteSample内で行われる */
          TANA.app.setCurrentYear(null);
          TANA.ui.toast('サンプルデータを削除しました', 'ok');
          st.render();
        });
    });

    /* 初期化 */
    q('ts-reset').addEventListener('click', function () {
      var msg = '<p class="tana-danger-text"><strong>すべてのデータが削除されます。この操作は元に戻せません。</strong></p>' +
        '<p>必要であれば、先に「バックアップを保存」を行ってください。</p>' +
        '<p>確認のため、下の欄に「<strong>初期化</strong>」と入力してください。</p>';
      TANA.ui.confirm('全データの初期化', msg, { danger: true, okLabel: '初期化する', requireText: '初期化' }).then(function (ok) {
        if (!ok) return;
        TANA.store.resetAll();
        TANA.store.save();
        TANA.app.setCurrentYear(null);
        TANA.app.renderHeader();
        TANA.app.renderAll();
        TANA.ui.toast('すべてのデータを初期化しました', 'ok');
      });
    });
  }

  TANA.settings = st;
})();
