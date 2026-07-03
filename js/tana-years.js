/* tana-years.js : 年度管理・過去履歴 */
(function () {
  'use strict';
  var U = TANA.util;
  var yrs = {};

  /* ---------- 描画 ---------- */
  yrs.render = function () {
    var el = document.getElementById('tana-tab-years');
    var S = TANA.store.state;
    var list = TANA.store.yearList();
    var html = '';

    /* --- 年度一覧 --- */
    html += '<div class="tana-card">' +
      '<div class="tana-toolbar"><h2 class="tana-h2">年度一覧</h2><span class="tana-spacer"></span>' +
      '<button class="tana-btn tana-btn-primary" id="tana-year-new">＋ 新しい年度を作成</button></div>';

    if (!list.length) {
      html += '<p>年度がまだありません。「新しい年度を作成」から始めてください。</p>';
    } else {
      html += '<div class="tana-table-wrap"><table class="tana-table"><thead><tr>' +
        '<th>年度</th><th>状態</th><th>基準日</th><th>実地日</th><th>品目数</th><th>入力済</th><th>参考合計</th><th>操作</th>' +
        '</tr></thead><tbody>';
      list.forEach(function (k) {
        var y = TANA.store.getYear(k);
        var t = TANA.calc.totals(y, S.settings.rounding);
        html += '<tr>' +
          '<td><strong>' + U.escapeHtml(k) + '年</strong>' + (y.isSample ? ' <span class="tana-badge tana-badge-sample">サンプル</span>' : '') + '</td>' +
          '<td><span class="tana-badge tana-badge-status-' + y.status + '">' + U.STATUS[y.status] + '</span></td>' +
          '<td>' + (y.baseDate ? U.fmtDateJP(y.baseDate) : '<span class="tana-hint">未設定</span>') + '</td>' +
          '<td>' + (y.actualDate ? U.fmtDateJP(y.actualDate) : '<span class="tana-hint">未設定</span>') + '</td>' +
          '<td class="tana-num">' + t.itemCount + '</td>' +
          '<td class="tana-num">' + t.entered + ' / ' + t.itemCount + '</td>' +
          '<td class="tana-num">' + U.yen(t.total, S.settings.currency) + '</td>' +
          '<td class="tana-cell-actions">' + actionButtons(y) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
      html += '<p class="tana-hint">※「参考合計」は棚卸対象の品目のみの合計です。金額はあくまで補助資料としての参考値です。</p>';
    }
    html += '</div>';

    /* --- 前年度比較 --- */
    var cur = TANA.app.currentYear();
    var yObj = cur ? TANA.store.getYear(cur) : null;
    if (yObj) {
      var prev = TANA.store.prevYearOf(yObj.year);
      html += '<div class="tana-card"><div class="tana-toolbar">' +
        '<h2 class="tana-h2">前年度比較</h2>' +
        '<label for="tana-years-cmp-year">対象年度</label>' +
        TANA.app.yearSelectHtml('tana-years-cmp-year', cur) +
        '</div>';
      if (!prev) {
        html += '<p class="tana-hint">' + U.escapeHtml(String(yObj.year)) + '年より前の年度データがないため、比較できません。</p>';
      } else {
        var cmp = TANA.calc.compare(yObj, prev, S.settings.rounding);
        html += '<div class="tana-table-wrap"><table class="tana-table"><thead><tr>' +
          '<th>区分</th><th>前年（' + prev.year + '年）</th><th>今年（' + yObj.year + '年）</th><th>差額</th><th>増減率</th>' +
          '</tr></thead><tbody>';
        U.CATEGORY_ORDER.forEach(function (c) {
          html += cmpRow(U.CATEGORY[c], cmp[c], S.settings.currency, false);
        });
        html += cmpRow('参考合計', cmp.total, S.settings.currency, true);
        html += '</tbody></table></div>';
      }
      html += '</div>';
    }

    /* --- 修正履歴 --- */
    html += '<div class="tana-card"><div class="tana-toolbar">' +
      '<h2 class="tana-h2">修正履歴</h2><span class="tana-spacer"></span>' +
      '<label class="tana-hint"><input type="checkbox" id="tana-hist-all"> すべて表示（既定は最新50件）</label></div>' +
      '<div id="tana-hist-list">' + historyHtml(false) + '</div></div>';

    el.innerHTML = html;
    bind(el);
  };

  function actionButtons(y) {
    var b = '';
    if (y.status === 'draft') {
      b += '<button class="tana-btn tana-btn-sm" data-act="check" data-year="' + y.year + '">確認済みにする</button>';
      b += '<button class="tana-btn tana-btn-sm tana-btn-primary" data-act="finalize" data-year="' + y.year + '">確定する</button>';
    } else if (y.status === 'checked') {
      b += '<button class="tana-btn tana-btn-sm" data-act="uncheck" data-year="' + y.year + '">作成中に戻す</button>';
      b += '<button class="tana-btn tana-btn-sm tana-btn-primary" data-act="finalize" data-year="' + y.year + '">確定する</button>';
    } else {
      b += '<button class="tana-btn tana-btn-sm" data-act="unfinalize" data-year="' + y.year + '">確定を解除</button>';
    }
    b += '<button class="tana-btn tana-btn-sm tana-btn-danger" data-act="del" data-year="' + y.year + '">削除</button>';
    return b;
  }

  function cmpRow(label, r, cur, isTotal) {
    var rateTxt = (r.rate === null) ? '－' : ((r.rate > 0 ? '+' : '') + r.rate + '%');
    var diffCls = r.diff > 0 ? ' tana-diff-plus' : (r.diff < 0 ? ' tana-diff-minus' : '');
    return '<tr' + (isTotal ? ' class="tana-grandtotal"' : '') + '>' +
      '<td>' + U.escapeHtml(label) + '</td>' +
      '<td class="tana-num">' + U.yen(r.prev, cur) + '</td>' +
      '<td class="tana-num">' + U.yen(r.cur, cur) + '</td>' +
      '<td class="tana-num' + diffCls + '">' + (r.diff > 0 ? '+' : '') + U.yen(r.diff, cur) + '</td>' +
      '<td class="tana-num">' + rateTxt + '</td></tr>';
  }

  function historyHtml(showAll) {
    var h = TANA.store.state.history || [];
    if (!h.length) return '<p class="tana-hint">まだ履歴がありません。入力や設定の変更を行うと、ここに記録されます。</p>';
    var items = showAll ? h : h.slice(0, 50);
    var out = '<div class="tana-hist">';
    items.forEach(function (e) {
      var when = e.ts ? e.ts.replace('T', ' ').slice(0, 19) : '';
      out += '<div class="tana-hist-item">' +
        '<div class="tana-hist-head"><span class="tana-hist-time">' + U.escapeHtml(when) + '</span> ' +
        '<strong>' + U.escapeHtml(e.action || '') + '</strong>' +
        (e.target ? '　<span>' + U.escapeHtml(e.target) + '</span>' : '') +
        (e.operator ? '　<span class="tana-hint">操作者：' + U.escapeHtml(e.operator) + '</span>' : '') + '</div>';
      if (e.changes && e.changes.length) {
        out += '<ul class="tana-hist-changes">';
        e.changes.forEach(function (c) {
          out += '<li>' + U.escapeHtml(c.label || c.field || '') + '：「' + U.escapeHtml(String(c.before === null || c.before === undefined || c.before === '' ? '（空欄）' : c.before)) +
            '」→「' + U.escapeHtml(String(c.after === null || c.after === undefined || c.after === '' ? '（空欄）' : c.after)) + '」</li>';
        });
        out += '</ul>';
      }
      if (e.reason) out += '<div class="tana-hint">理由：' + U.escapeHtml(e.reason) + '</div>';
      out += '</div>';
    });
    out += '</div>';
    if (!showAll && h.length > 50) out += '<p class="tana-hint">全 ' + h.length + ' 件中、最新50件を表示しています。</p>';
    return out;
  }

  /* ---------- 操作 ---------- */
  function bind(el) {
    var btnNew = el.querySelector('#tana-year-new');
    if (btnNew) btnNew.addEventListener('click', openCreate);

    var cmpSel = el.querySelector('#tana-years-cmp-year');
    if (cmpSel) cmpSel.addEventListener('change', function () {
      TANA.app.setCurrentYear(this.value);
      yrs.render();
    });

    var histAll = el.querySelector('#tana-hist-all');
    if (histAll) histAll.addEventListener('change', function () {
      el.querySelector('#tana-hist-list').innerHTML = historyHtml(this.checked);
    });

    el.querySelectorAll('button[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var y = this.getAttribute('data-year');
        var act = this.getAttribute('data-act');
        if (act === 'check') setStatus(y, 'checked');
        else if (act === 'uncheck') setStatus(y, 'draft');
        else if (act === 'finalize') finalize(y);
        else if (act === 'unfinalize') unfinalize(y);
        else if (act === 'del') deleteYear(y);
      });
    });
  }

  /* --- 新年度作成 --- */
  function openCreate() {
    var S = TANA.store.state;
    var list = TANA.store.yearList();
    var suggested = list.length ? (Number(list[0]) + 1) : (new Date().getFullYear());
    var fm = Number(S.settings.fiscalMonth) || 12;
    var defBase = suggested + '-' + ('0' + fm).slice(-2) + '-' +
      ('0' + U.lastDayOfMonth(suggested, fm)).slice(-2);
    var hasPrev = list.length > 0;

    var html =
      '<div class="tana-form-grid">' +
      '<label>年度（西暦）<input type="number" id="ty-year" value="' + suggested + '" min="2000" max="2100"></label>' +
      '<label>棚卸基準日<input type="date" id="ty-base" value="' + defBase + '"><span class="tana-hint">既定：決算月（' + S.settings.fiscalMonth + '月）の末日</span></label>' +
      '<label>品目の作り方<select id="ty-copy">' +
      (hasPrev ? '<option value="prev">前年度の品目をコピー（数量は空欄・推奨）</option>' : '') +
      '<option value="master">品目マスターの使用中の品目から作成</option>' +
      '<option value="none">空の状態から作成</option>' +
      '</select></label>' +
      '</div>' +
      '<p class="tana-hint">※コピーされるのは品目情報と単価です。数量はすべて空欄で始まります。前年度の数量は入力画面に参考として表示されます。</p>';

    TANA.ui.modal('新しい年度を作成', html, [
      { label: 'キャンセル' },
      {
        label: '作成する', primary: true, keepOpen: true,
        onClick: function (close) {
          var year = U.num(document.getElementById('ty-year').value);
          var base = document.getElementById('ty-base').value;
          var copy = document.getElementById('ty-copy').value;
          if (!year || year < 2000 || year > 2100) { TANA.ui.toast('年度を正しく入力してください', 'warn'); return; }
          if (TANA.store.getYear(year)) { TANA.ui.toast(year + '年はすでに存在します', 'error'); return; }
          TANA.store.createYear(year, base, copy); /* 履歴はcreateYear内で記録される */
          TANA.store.save();
          TANA.app.setCurrentYear(String(year));
          close();
          TANA.ui.toast(year + '年の棚卸表を作成しました', 'ok');
          yrs.render();
        }
      }
    ]);
  }

  /* --- 状態変更（作成中⇔確認済み） --- */
  function setStatus(yearKey, to) {
    var y = TANA.store.getYear(yearKey);
    if (!y) return;
    var from = y.status;
    y.status = to;
    TANA.store.log('状態変更', yearKey + '年', [{ field: '状態', before: U.STATUS[from], after: U.STATUS[to] }]);
    TANA.store.save();
    TANA.ui.toast(yearKey + '年を「' + U.STATUS[to] + '」にしました', 'ok');
    yrs.render();
  }

  /* --- 確定 --- */
  function finalize(yearKey) {
    var y = TANA.store.getYear(yearKey);
    if (!y) return;
    var prev = TANA.store.prevYearOf(y.year);
    var v = TANA.calc.validate(y, prev, true);

    if (v.errors.length) {
      var eh = '<p>次の問題があるため確定できません。修正してから再度お試しください。</p><ul class="tana-issue-list">';
      v.errors.forEach(function (m) { eh += '<li class="tana-issue-error">' + U.escapeHtml(m) + '</li>'; });
      eh += '</ul>';
      TANA.ui.modal('確定できません', eh, [{ label: '閉じる', primary: true }]);
      return;
    }

    var msg = '<p><strong>' + yearKey + '年</strong>の棚卸表を確定します。確定すると入力がロックされ、編集できなくなります。</p>';
    if (v.warnings.length) {
      msg += '<p>次の注意点があります。内容を確認のうえ、問題なければ確定してください。</p><ul class="tana-issue-list">';
      v.warnings.forEach(function (m) { msg += '<li class="tana-issue-warn">' + U.escapeHtml(m) + '</li>'; });
      msg += '</ul>';
    }
    msg += '<p class="tana-hint">確定後に修正が必要になった場合は、「確定を解除」してから修正できます（解除と修正は履歴に記録されます）。</p>';

    TANA.ui.confirm('棚卸表の確定', msg, { okLabel: '確定する' }).then(function (ok) {
      if (!ok) return;
      y.status = 'finalized';
      y.finalizedAt = U.nowStamp();
      TANA.store.log('棚卸確定', yearKey + '年', [{ field: '状態', before: '', after: '確定済み' }]);
      TANA.store.save();
      TANA.ui.toast(yearKey + '年を確定しました', 'ok');
      yrs.render();
    });
  }

  /* --- 確定解除 --- */
  function unfinalize(yearKey) {
    var y = TANA.store.getYear(yearKey);
    if (!y) return;
    var html = '<p><strong>' + yearKey + '年</strong>の確定を解除し、編集できる状態に戻します。</p>' +
      '<label style="display:block;">解除の理由（履歴に記録されます）<br>' +
      '<input type="text" id="ty-unfin-reason" style="width:100%;" placeholder="例：数量の入力誤りを修正するため"></label>';
    TANA.ui.modal('確定の解除', html, [
      { label: 'キャンセル' },
      {
        label: '解除する', primary: true, keepOpen: true,
        onClick: function (close) {
          var reason = document.getElementById('ty-unfin-reason').value.trim();
          if (!reason) { TANA.ui.toast('解除の理由を入力してください', 'warn'); return; }
          y.status = 'draft';
          y.finalizedAt = '';
          TANA.store.log('確定解除', yearKey + '年', [{ field: '状態', before: '確定済み', after: '作成中' }], reason);
          TANA.store.save();
          close();
          TANA.ui.toast(yearKey + '年の確定を解除しました', 'ok');
          yrs.render();
        }
      }
    ]);
  }

  /* --- 年度削除（強い確認） --- */
  function deleteYear(yearKey) {
    var y = TANA.store.getYear(yearKey);
    if (!y) return;
    var t = TANA.calc.totals(y, TANA.store.state.settings.rounding);
    var msg = '<p><strong>' + yearKey + '年</strong>の棚卸データを削除します。<span class="tana-danger-text">この操作は元に戻せません。</span></p>' +
      '<p>品目 ' + t.itemCount + ' 件、参考合計 ' + U.yen(t.total, TANA.store.state.settings.currency) + ' のデータが失われます。</p>' +
      '<p class="tana-hint">削除の前に、設定タブから JSON バックアップを取っておくことをおすすめします。</p>' +
      '<p>確認のため、下の欄に「<strong>' + yearKey + '</strong>」と入力してください。</p>';
    TANA.ui.confirm('年度の削除', msg, { danger: true, okLabel: '削除する', requireText: String(yearKey) }).then(function (ok) {
      if (!ok) return;
      delete TANA.store.state.years[String(yearKey)];
      TANA.store.log('年度削除', yearKey + '年', [{ field: '品目数', before: String(t.itemCount), after: '（削除）' }]);
      TANA.store.save();
      if (TANA.app.currentYear() === String(yearKey)) TANA.app.setCurrentYear(null);
      TANA.ui.toast(yearKey + '年を削除しました', 'ok');
      yrs.render();
    });
  }

  TANA.years = yrs;
})();
