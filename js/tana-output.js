/* tana-output.js : 出力（記入用紙・完成棚卸表・CSV） */
(function () {
  'use strict';
  var U = TANA.util;
  var out = {};

  /* ---------- 描画 ---------- */
  out.render = function () {
    var el = document.getElementById('tana-tab-output');
    var yearKey = TANA.app.currentYear();
    var y = yearKey ? TANA.store.getYear(yearKey) : null;

    var html = '<div class="tana-card"><div class="tana-toolbar">' +
      '<label for="tana-out-year" style="font-weight:700;">対象年度</label>' +
      TANA.app.yearSelectHtml('tana-out-year', yearKey) +
      (y ? '<span class="tana-badge tana-badge-status-' + y.status + '">' + U.STATUS[y.status] + '</span>' : '') +
      '</div>';

    if (!y) {
      html += '<p>年度がまだ作成されていません。「年度管理・履歴」タブから作成してください。</p></div>';
      el.innerHTML = html; bind(el); return;
    }

    html +=
      '<div class="tana-out-grid">' +

      '<div class="tana-out-box"><h3>① 棚卸記入用紙（数える時に使う紙）</h3>' +
      '<p>数量欄が空欄の用紙です。印刷して、実地棚卸のときに手書きで記入できます。</p>' +
      '<div class="tana-toolbar">' +
      '<button class="tana-btn" id="tana-out-sheet-preview">画面で確認</button>' +
      '<button class="tana-btn tana-btn-primary" id="tana-out-sheet-print">印刷する</button>' +
      '</div></div>' +

      '<div class="tana-out-box"><h3>② 完成棚卸表（保存用・A4縦）</h3>' +
      '<p>入力した内容をもとにした棚卸表です。決算資料と一緒に保管する補助資料として使えます。</p>' +
      '<div class="tana-toolbar">' +
      '<button class="tana-btn" id="tana-out-final-preview">画面で確認</button>' +
      '<button class="tana-btn tana-btn-primary" id="tana-out-final-print">印刷する</button>' +
      '</div>' +
      '<p class="tana-hint">PDFで保存したい場合：印刷画面でプリンターを「PDFに保存」に変更してください。</p></div>' +

      '<div class="tana-out-box"><h3>③ CSVファイル出力</h3>' +
      '<p>Excelなどで開ける形式で保存します（文字化けしないようBOM付きUTF-8で出力します）。</p>' +
      '<div class="tana-toolbar">' +
      '<button class="tana-btn" id="tana-out-csv-year">この年度の棚卸データCSV</button>' +
      '<button class="tana-btn" id="tana-out-csv-master">品目マスターCSV</button>' +
      '</div></div>' +

      '</div>' +
      '<div class="tana-note-box"><strong>印刷についての注意</strong><br>' +
      'ページ番号と印刷日時は、ブラウザの印刷画面にある「ヘッダーとフッター」をオンにすると各ページに付きます（本アプリからは自動で付けられません）。' +
      '2ページ目以降にも表の見出し行は自動で繰り返されます。</div>' +
      '</div>';

    el.innerHTML = html;
    bind(el);
  };

  function bind(el) {
    var sel = el.querySelector('#tana-out-year');
    if (sel) sel.addEventListener('change', function () {
      TANA.app.setCurrentYear(this.value);
      out.render();
    });
    var q = function (id) { return el.querySelector('#' + id); };
    if (q('tana-out-sheet-preview')) q('tana-out-sheet-preview').addEventListener('click', function () { show('sheet', false); });
    if (q('tana-out-sheet-print')) q('tana-out-sheet-print').addEventListener('click', function () { show('sheet', true); });
    if (q('tana-out-final-preview')) q('tana-out-final-preview').addEventListener('click', function () { show('final', false); });
    if (q('tana-out-final-print')) q('tana-out-final-print').addEventListener('click', function () { show('final', true); });
    if (q('tana-out-csv-year')) q('tana-out-csv-year').addEventListener('click', function () {
      TANA.store.exportYearCSV(TANA.app.currentYear());
      TANA.ui.toast('CSVをダウンロードしました', 'ok');
    });
    if (q('tana-out-csv-master')) q('tana-out-csv-master').addEventListener('click', function () {
      TANA.store.exportMasterCSV();
      TANA.ui.toast('CSVをダウンロードしました', 'ok');
    });
  }

  /* ---------- 帳票の生成と表示 ---------- */
  function show(kind, doPrint) {
    var y = TANA.store.getYear(TANA.app.currentYear());
    if (!y) { TANA.ui.toast('年度を選択してください', 'warn'); return; }
    var root = document.getElementById('tana-print-root');
    root.innerHTML = (kind === 'sheet') ? sheetHtml(y) : finalHtml(y);

    if (doPrint) {
      document.body.classList.add('tana-printing');
      /* afterprintで確実に解除（キャンセル時も） */
      var done = function () {
        document.body.classList.remove('tana-printing');
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      setTimeout(function () { window.print(); }, 50);
    } else {
      document.body.classList.add('tana-preview');
      var bar = document.createElement('div');
      bar.className = 'tana-preview-bar';
      bar.innerHTML = '<span>プレビュー表示中（実際の印刷イメージに近い表示です）</span>' +
        '<button class="tana-btn tana-btn-primary" id="tana-preview-print">この内容を印刷</button>' +
        '<button class="tana-btn" id="tana-preview-close">プレビューを閉じる</button>';
      root.insertBefore(bar, root.firstChild);
      bar.querySelector('#tana-preview-close').addEventListener('click', closePreview);
      bar.querySelector('#tana-preview-print').addEventListener('click', function () {
        document.body.classList.remove('tana-preview');
        bar.parentNode.removeChild(bar);
        document.body.classList.add('tana-printing');
        var done = function () {
          document.body.classList.remove('tana-printing');
          window.removeEventListener('afterprint', done);
          closePreview();
        };
        window.addEventListener('afterprint', done);
        setTimeout(function () { window.print(); }, 50);
      });
      window.scrollTo(0, 0);
    }
  }

  function closePreview() {
    document.body.classList.remove('tana-preview');
    document.getElementById('tana-print-root').innerHTML = '';
  }

  /* --- 帳票ヘッダー共通 --- */
  function docHead(title, y) {
    var s = TANA.store.state.settings;
    return '<div class="tana-doc-head">' +
      '<h1 >' + U.escapeHtml(title) + '</h1>' +
      '<table class="tana-doc-meta"><tbody>' +
      '<tr><th>店舗名</th><td>' + U.escapeHtml(s.storeName || '　') + '</td>' +
      '<th>事業主</th><td>' + U.escapeHtml(s.ownerName || '　') + '</td></tr>' +
      '<tr><th>棚卸基準日</th><td>' + (y.baseDate ? U.fmtDateJP(y.baseDate) : '　') + '</td>' +
      '<th>実地棚卸日</th><td>' + (y.actualDate ? U.fmtDateJP(y.actualDate) : '　') + '</td></tr>' +
      '</tbody></table></div>';
  }

  function sortedRows(y) {
    var order = {}; U.CATEGORY_ORDER.forEach(function (c, i) { order[c] = i; });
    return y.rows.slice().sort(function (a, b) {
      var oa = (order[a.category] !== undefined) ? order[a.category] : 99;
      var ob = (order[b.category] !== undefined) ? order[b.category] : 99;
      if (oa !== ob) return oa - ob;
      return String(a.name).localeCompare(String(b.name), 'ja');
    });
  }

  /* --- ① 棚卸記入用紙（空欄） --- */
  function sheetHtml(y) {
    var rows = sortedRows(y).filter(function (r) { return r.processing !== 'excluded'; });
    var html = '<div class="tana-sheet">' + docHead(y.year + '年 棚卸記入用紙', y);
    html += '<p class="tana-sheet-note">数えた数量を鉛筆・ボールペンで記入してください。数え方の欄を参考に、箱数と端数、残量なども記録できます。</p>';
    html += '<table ><thead><tr>' +
      '<th style="width:9%;">区分</th><th>品名</th><th style="width:12%;">メーカー</th><th style="width:11%;">規格</th>' +
      '<th style="width:10%;">保管場所</th><th style="width:8%;">数え方</th>' +
      '<th style="width:12%;">数量（記入）</th><th style="width:6%;">単位</th>' +
      '<th style="width:6%;">確認</th><th style="width:12%;">備考（記入）</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr>' +
        '<td>' + U.escapeHtml(U.CATEGORY[r.category] || 'その他') + '</td>' +
        '<td>' + U.escapeHtml(r.name) + '</td>' +
        '<td>' + U.escapeHtml(r.maker || '') + '</td>' +
        '<td>' + U.escapeHtml(r.spec || '') + '</td>' +
        '<td>' + U.escapeHtml(r.location || '') + '</td>' +
        '<td>' + U.escapeHtml(U.METHOD[r.countMethod] || '') + '</td>' +
        '<td class="tana-doc-blank"></td>' +
        '<td>' + U.escapeHtml(r.unit || '') + '</td>' +
        '<td class="tana-doc-blank"></td>' +
        '<td class="tana-doc-blank"></td>' +
        '</tr>';
    });
    /* 追加記入用の空行 */
    for (var i = 0; i < 5; i++) {
      html += '<tr><td class="tana-doc-blank"></td><td class="tana-doc-blank"></td><td class="tana-doc-blank"></td><td class="tana-doc-blank"></td>' +
        '<td class="tana-doc-blank"></td><td class="tana-doc-blank"></td><td class="tana-doc-blank"></td><td class="tana-doc-blank"></td>' +
        '<td class="tana-doc-blank"></td><td class="tana-doc-blank"></td></tr>';
    }
    html += '</tbody></table>';
    html += signBox('記入者', '確認者');
    html += '</div>';
    return html;
  }

  /* --- ② 完成棚卸表 --- */
  function finalHtml(y) {
    var S = TANA.store.state;
    var s = S.settings;
    var cur = s.currency;
    var rows = sortedRows(y);
    var target = rows.filter(function (r) { return r.processing === 'target'; });
    var others = rows.filter(function (r) { return r.processing !== 'target'; });
    var dir = TANA.calc.adjDir(y);
    var t = TANA.calc.totals(y, s.rounding);

    var html = '<div class="tana-sheet">' + docHead(y.year + '年 棚卸表', y);
    html += '<table class="tana-doc-meta" style="margin-bottom:10px;"><tbody><tr>' +
      '<th>作成日</th><td>' + U.fmtDateJP(U.todayISO()) + '</td>' +
      '<th>作成者</th><td>' + U.escapeHtml(s.authorName || '　') + '</td>' +
      '<th>状態</th><td>' + U.STATUS[y.status] + (y.finalizedAt ? '（' + U.escapeHtml(y.finalizedAt) + ' 確定）' : '') + '</td>' +
      '</tr></tbody></table>';
    html += '<p class="tana-sheet-note">金額は ' + (s.taxMode === 'incl' ? '税込' : '税抜') + ' で表示しています。' +
      '端数処理：' + ({ floor: '切り捨て', round: '四捨五入', ceil: '切り上げ' }[s.rounding] || '切り捨て') + '。' +
      '本表は決算時の棚卸金額を確認するための補助資料です。</p>';

    html += '<table ><thead><tr>' +
      '<th style="width:9%;">区分</th><th>品名</th><th style="width:11%;">規格</th>' +
      '<th style="width:9%;">数量</th><th style="width:6%;">単位</th>' +
      '<th style="width:10%;">単価</th><th style="width:12%;">金額</th><th style="width:16%;">備考</th>' +
      '</tr></thead><tbody>';

    U.CATEGORY_ORDER.forEach(function (c) {
      var group = target.filter(function (r) { return ((r.category in U.CATEGORY) ? r.category : 'other') === c; });
      if (!group.length) return;
      group.forEach(function (r) {
        var q = TANA.calc.adjustedQty(r, dir);
        var amt = TANA.calc.amount(r, s.rounding, dir);
        var noteParts = [];
        if (TANA.calc.hasAdjust(r)) noteParts.push('基準日調整あり');
        if (r.note) noteParts.push(r.note);
        html += '<tr>' +
          '<td>' + U.escapeHtml(U.CATEGORY[c]) + '</td>' +
          '<td>' + U.escapeHtml(r.name) + (r.maker ? '（' + U.escapeHtml(r.maker) + '）' : '') + '</td>' +
          '<td>' + U.escapeHtml(r.spec || '') + '</td>' +
          '<td class="tana-num">' + (q === null ? '' : U.qty(q)) + '</td>' +
          '<td>' + U.escapeHtml(r.unit || '') + '</td>' +
          '<td class="tana-num">' + (U.num(r.unitPrice) === null ? '' : U.yen(U.num(r.unitPrice), cur)) + '</td>' +
          '<td class="tana-num">' + (amt === null ? '' : U.yen(amt, cur)) + '</td>' +
          '<td>' + U.escapeHtml(noteParts.join('／')) + '</td>' +
          '</tr>';
      });
      html += '<tr class="tana-subtotal"><td colspan="6">' + U.escapeHtml(U.CATEGORY[c]) + ' 小計</td>' +
        '<td class="tana-num">' + U.yen(t[c], cur) + '</td><td></td></tr>';
    });

    html += '<tr class="tana-grandtotal"><td colspan="6">参考合計（棚卸対象のみ）</td>' +
      '<td class="tana-num">' + U.yen(t.total, cur) + '</td><td></td></tr>';
    html += '</tbody></table>';

    /* 対象外品目の記録 */
    if (others.length) {
      html += '<h2 class="tana-sheet-sub">棚卸対象外とした品目の記録</h2>' +
        '<table ><thead><tr>' +
        '<th style="width:9%;">区分</th><th>品名</th><th style="width:18%;">処理区分</th><th>理由・備考</th>' +
        '</tr></thead><tbody>';
      others.forEach(function (r) {
        var reason = [];
        if (r.processing === 'omit' && r.omitReason) reason.push(r.omitReason);
        if (r.note) reason.push(r.note);
        html += '<tr>' +
          '<td>' + U.escapeHtml(U.CATEGORY[r.category] || 'その他') + '</td>' +
          '<td>' + U.escapeHtml(r.name) + '</td>' +
          '<td>' + U.escapeHtml(U.PROCESSING[r.processing] || '') + '</td>' +
          '<td>' + U.escapeHtml(reason.join('／')) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    }

    html += signBox('作成者', '確認者');
    html += '</div>';
    return html;
  }

  function signBox(a, b) {
    return '<div class="tana-sign-area">' +
      '<div class="tana-sign-box"><div class="tana-sign-label">' + a + '</div><div class="tana-sign-space"></div></div>' +
      '<div class="tana-sign-box"><div class="tana-sign-label">' + b + '</div><div class="tana-sign-space"></div></div>' +
      '</div>';
  }

  TANA.output = out;
})();
