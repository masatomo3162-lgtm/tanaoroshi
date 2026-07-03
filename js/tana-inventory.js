/* tana-inventory.js : 棚卸入力 */
(function () {
  'use strict';
  var U = TANA.util;
  var inv = {};

  var editSnapshots = {}; /* 変更履歴用：フォーカス時点の行の控え */

  var ROW_LABELS = {
    category: '区分', name: '品名', maker: 'メーカー', spec: '規格・容量', location: '保管場所', countMethod: '数え方', unit: '単位',
    perBox: '1箱の個数', volumePerUnit: '1本の容量', qty: '数量', boxes: '箱数', loose: '端数',
    remainVol: '残量', ratioValue: '残量割合', unitPrice: '単価', lastPurchaseDate: '最終仕入日',
    supplier: '仕入先', invoiceNo: '納品書・請求書番号', priceBasis: '単価の根拠',
    priceChangeReason: '単価変更理由', processing: '処理区分', omitReason: '省略理由',
    adjAdd: '追加仕入数量', adjUse: '使用・販売数量', adjOther: 'その他調整数', adjReason: '調整理由',
    note: '備考'
  };

  function rowForDiff(r) {
    var o = {};
    for (var k in ROW_LABELS) o[k] = r[k];
    o.category = U.CATEGORY[r.category] || r.category;
    o.countMethod = U.METHOD[r.countMethod] || r.countMethod;
    o.processing = U.PROCESSING[r.processing] || r.processing;
    return o;
  }

  inv.render = function () {
    var el = document.getElementById('tana-tab-input');
    var S = TANA.store.state;
    var yearKey = TANA.app.currentYear();
    var y = yearKey ? TANA.store.getYear(yearKey) : null;

    var html = '<div class="tana-card"><div class="tana-toolbar">' +
      '<label for="tana-inv-year" style="font-weight:700;">年度</label>' +
      TANA.app.yearSelectHtml('tana-inv-year', yearKey) +
      '<span class="tana-spacer"></span>';
    if (y) html += '<span class="tana-badge tana-badge-status-' + y.status + '">' + U.STATUS[y.status] + '</span>';
    html += '</div>';

    if (!y) {
      html += '<p>年度がまだありません。「年度管理・履歴」タブから作成してください。</p></div>';
      el.innerHTML = html; bindTop(el); return;
    }

    var locked = (y.status === 'finalized');
    var dis = locked ? ' disabled' : '';

    html += '<div class="tana-field-row">' +
      '<div class="tana-field"><label>棚卸基準日（在庫金額の基準となる日）</label><input type="date" id="tana-inv-basedate" value="' + U.escapeHtml(y.baseDate || '') + '"' + dis + '></div>' +
      '<div class="tana-field"><label>実地棚卸日（実際に数えた日）</label><input type="date" id="tana-inv-actualdate" value="' + U.escapeHtml(y.actualDate || '') + '"' + dis + '></div>' +
      '</div>';
    if (y.baseDate && y.actualDate && y.baseDate !== y.actualDate) {
      var adDir = TANA.calc.adjDir(y);
      html += '<p class="tana-hint">⚠ 基準日と実地棚卸日が異なります。日付の間に仕入・使用があった品目は、各行の「編集」から調整数を記録してください。<br>' +
        '現在の計算式：' + TANA.calc.adjFormulaText(adDir) + '</p>';
    }
    if (locked) {
      html += '<p class="tana-hint">🔒 この年度は確定済みのため編集できません。修正が必要な場合は「年度管理・履歴」タブで確定解除してください。</p>';
    }

    /* 品目追加 */
    if (!locked) {
      var inYear = {};
      y.rows.forEach(function (r) { if (r.masterId) inYear[r.masterId] = true; });
      var opts = TANA.store.state.master
        .filter(function (m) { return m.active !== false; })
        .map(function (m) {
          return '<option value="' + m.id + '">' + (inYear[m.id] ? '【登録済】' : '') +
            U.escapeHtml('[' + U.CATEGORY[m.category] + '] ' + m.name + (m.spec ? '（' + m.spec + '）' : '')) + '</option>';
        }).join('');
      html += '<div class="tana-toolbar">' +
        '<select id="tana-inv-addsel" style="max-width:340px;">' + (opts || '<option value="">（マスターに品目がありません）</option>') + '</select>' +
        '<button class="tana-btn" id="tana-inv-addone">この品目を追加</button>' +
        '<button class="tana-btn" id="tana-inv-addall">未追加の品目をまとめて追加</button>' +
        '<button class="tana-btn" id="tana-inv-adddirect">マスターにない品目を直接追加</button>' +
        '</div>';
    }

    /* 入力チェック結果 */
    var prev = TANA.store.prevYearOf(y.year);
    var v = TANA.calc.validate(y, prev, false);
    html += '<div class="tana-issues" id="tana-inv-issues">' + issuesHtml(v) + '</div>';

    /* 表 */
    html += '<div class="tana-table-wrap" style="max-height:60vh; overflow-y:auto;"><table class="tana-table" id="tana-inv-table"><thead><tr>' +
      '<th>区分</th><th class="tana-sticky-col">品名</th><th>規格・容量</th><th>保管場所</th><th>数え方</th>' +
      '<th>数量</th><th>単位</th><th class="tana-num">換算数量</th><th class="tana-num">単価(円)</th><th class="tana-num">金額</th>' +
      '<th>最終仕入日</th><th>仕入先</th><th>処理区分</th><th>備考</th><th>編集</th><th>削除</th>' +
      '</tr></thead><tbody>';
    var sorted = sortedRows(y);
    sorted.forEach(function (r) { html += rowHtml(r, y, prev, locked); });
    html += '</tbody></table></div>';

    /* 合計と操作 */
    html += '<div id="tana-inv-totals" style="margin-top:12px;">' + totalsHtml(y) + '</div>';
    html += '<div class="tana-toolbar" style="margin-top:10px;">' +
      (!locked ? '<button class="tana-btn tana-btn-primary" id="tana-inv-save">保存</button>' : '') +
      '<span class="tana-hint" id="tana-inv-savenote">' +
      (S.settings.autoSave ? '自動保存：ON（入力すると自動で保存されます）' : '自動保存：OFF（保存ボタンを押してください）') +
      '</span></div>';
    html += '</div>';

    el.innerHTML = html;
    bindTop(el);
    bindTable(el, y, prev, locked);
  };

  function sortedRows(y) {
    return y.rows.slice().sort(function (a, b) {
      var ca = U.CATEGORY_ORDER.indexOf(a.category), cb = U.CATEGORY_ORDER.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name, 'ja');
    });
  }

  function issuesHtml(v) {
    var s = '';
    v.errors.forEach(function (m) { s += '<div class="tana-issue tana-issue-error">' + U.escapeHtml(m) + '</div>'; });
    var maxWarn = 8;
    v.warnings.slice(0, maxWarn).forEach(function (m) { s += '<div class="tana-issue tana-issue-warn">' + U.escapeHtml(m) + '</div>'; });
    if (v.warnings.length > maxWarn) s += '<div class="tana-hint">ほか ' + (v.warnings.length - maxWarn) + ' 件の注意があります</div>';
    return s;
  }

  function totalsHtml(y) {
    var S = TANA.store.state;
    var t = TANA.calc.totals(y, S.settings.rounding);
    var cur = S.settings.currency;
    var tax = S.settings.taxMode === 'excl' ? '（税抜）' : '（税込）';
    return '<div class="tana-stat-grid">' +
      '<div class="tana-stat"><div class="tana-stat-label">販売商品</div><div class="tana-stat-value">' + U.yen(t.sale, cur) + '</div></div>' +
      '<div class="tana-stat"><div class="tana-stat-label">施術材料</div><div class="tana-stat-value">' + U.yen(t.material, cur) + '</div></div>' +
      '<div class="tana-stat"><div class="tana-stat-label">消耗品</div><div class="tana-stat-value">' + U.yen(t.consumable, cur) + '</div></div>' +
      '<div class="tana-stat"><div class="tana-stat-label">その他</div><div class="tana-stat-value">' + U.yen(t.other, cur) + '</div></div>' +
      '<div class="tana-stat tana-stat-total"><div class="tana-stat-label">全在庫の参考合計 ' + tax + '</div><div class="tana-stat-value">' + U.yen(t.total, cur) + '</div></div>' +
      '</div>';
  }

  function qtyCellHtml(r, dis) {
    var id = r.rowId;
    function numIn(field, val, w, ph) {
      return '<input type="number" min="0" step="any" style="width:' + w + 'px" data-row="' + id + '" data-field="' + field + '" value="' + (val === null || val === undefined ? '' : val) + '" placeholder="' + (ph || '') + '"' + dis + '>';
    }
    switch (r.countMethod) {
      case 'box':
        return numIn('boxes', r.boxes, 62) + '箱 ＋ ' + numIn('loose', r.loose, 62) + U.escapeHtml(r.unit) +
          '<span class="tana-prev-ref">1箱＝' + (r.perBox || '?') + U.escapeHtml(r.unit) + '</span>';
      case 'volume':
        return numIn('qty', r.qty, 56) + '本(未開封) ＋ 残量' + numIn('remainVol', r.remainVol, 72) + 'ml' +
          '<span class="tana-prev-ref">1本＝' + (r.volumePerUnit || '?') + 'ml</span>';
      case 'ratio': {
        var sel = '<select data-row="' + id + '" data-field="ratioType"' + dis + '>';
        U.RATIO_PRESETS.forEach(function (p) {
          sel += '<option value="' + p.key + '"' + (p.key === (r.ratioType || '') ? ' selected' : '') + '>' + p.label + '</option>';
        });
        sel += '</select>';
        var custom = (r.ratioType === 'custom')
          ? ' <input type="number" min="0" max="1" step="0.01" style="width:66px" data-row="' + id + '" data-field="ratioValue" value="' + (r.ratioValue === null ? '' : r.ratioValue) + '"' + dis + '>'
          : '';
        return numIn('qty', r.qty, 56) + '本(未開封) ＋ 開封分:' + sel + custom +
          '<span class="tana-prev-ref">開封済み1本の残量割合（手動修正時は理由を備考へ）</span>';
      }
      default:
        return numIn('qty', r.qty, 84);
    }
  }

  function rowHtml(r, y, prev, locked) {
    var S = TANA.store.state;
    var dis = locked ? ' disabled' : '';
    var dir = TANA.calc.adjDir(y);
    var conv = TANA.calc.convQty(r);
    var adj = TANA.calc.adjustedQty(r, dir);
    var amt = TANA.calc.amount(r, S.settings.rounding, dir);
    var isTarget = r.processing === 'target';
    var missingQty = isTarget && conv === null;
    var missingPrice = isTarget && U.num(r.unitPrice) === null;

    var prevRef = '';
    if (prev && r.masterId) {
      for (var i = 0; i < prev.rows.length; i++) {
        if (prev.rows[i].masterId === r.masterId) {
          var pq = TANA.calc.adjustedQty(prev.rows[i], TANA.calc.adjDir(prev));
          if (pq !== null) prevRef = '<span class="tana-prev-ref">前年: ' + U.qty(pq) + '</span>';
          break;
        }
      }
    }

    var procSel = '<select data-row="' + r.rowId + '" data-field="processing"' + dis + '>';
    Object.keys(U.PROCESSING).forEach(function (k) {
      procSel += '<option value="' + k + '"' + (k === r.processing ? ' selected' : '') + '>' + U.PROCESSING[k] + '</option>';
    });
    procSel += '</select>';

    return '<tr data-rowid="' + r.rowId + '"' + (!isTarget ? ' class="tana-row-excluded"' : '') + '>' +
      '<td>' + U.CATEGORY[r.category] + '</td>' +
      '<td class="tana-sticky-col">' + U.escapeHtml(r.name) +
      (r.processing === 'check' ? ' <span class="tana-badge tana-badge-warn">要確認</span>' : '') +
      (TANA.calc.hasAdjust(r) ? ' <span class="tana-badge tana-badge-neutral" title="基準日調整あり">調整</span>' : '') + '</td>' +
      '<td>' + U.escapeHtml(r.spec) + '</td>' +
      '<td>' + U.escapeHtml(r.location) + '</td>' +
      '<td>' + U.METHOD[r.countMethod] + '</td>' +
      '<td' + (missingQty ? ' class="tana-cell-missing" title="数量が未入力です"' : '') + '>' + qtyCellHtml(r, dis) + '</td>' +
      '<td>' + U.escapeHtml(r.unit) + '</td>' +
      '<td class="tana-num" data-cell="conv">' + (adj === null ? (missingQty ? '⚠' : '') : U.qty(adj) + (TANA.calc.hasAdjust(r) ? '<span class="tana-prev-ref">換算' + U.qty(conv) + '→調整後</span>' : '')) + prevRef + '</td>' +
      '<td class="tana-num' + (missingPrice ? ' tana-cell-missing" title="単価が未入力です' : '') + '"><input type="number" min="0" step="any" style="width:90px" data-row="' + r.rowId + '" data-field="unitPrice" value="' + (r.unitPrice === null || r.unitPrice === undefined ? '' : r.unitPrice) + '"' + dis + '></td>' +
      '<td class="tana-num tana-amount-cell" data-cell="amount">' + (isTarget ? U.yen(amt, S.settings.currency) : '<span title="棚卸対象外のため合計に含まれません">対象外</span>') + '</td>' +
      '<td><input type="date" data-row="' + r.rowId + '" data-field="lastPurchaseDate" value="' + U.escapeHtml(r.lastPurchaseDate || '') + '"' + dis + '></td>' +
      '<td><input type="text" data-row="' + r.rowId + '" data-field="supplier" value="' + U.escapeHtml(r.supplier || '') + '"' + dis + '></td>' +
      '<td>' + procSel + '</td>' +
      '<td><input type="text" style="width:140px" data-row="' + r.rowId + '" data-field="note" value="' + U.escapeHtml(r.note || '') + '"' + dis + '></td>' +
      '<td><button class="tana-btn tana-btn-sm" data-editrow="' + r.rowId + '">編集</button></td>' +
      '<td><button class="tana-btn tana-btn-sm tana-btn-danger" data-delrow="' + r.rowId + '"' + dis + '>削除</button></td>' +
      '</tr>';
  }

  /* ---------- イベント ---------- */

  function bindTop(el) {
    var sel = el.querySelector('#tana-inv-year');
    if (sel) sel.addEventListener('change', function () {
      TANA.app.setCurrentYear(sel.value);
      inv.render();
    });
  }

  var scheduleAutoSave = U.debounce(function () {
    var S = TANA.store.state;
    if (S.settings.autoSave) {
      if (TANA.store.save()) noteSaved('自動保存しました ' + U.nowISO().slice(11));
    } else {
      noteSaved('未保存の変更があります。「保存」を押してください');
    }
  }, 800);

  function noteSaved(msg) {
    var n = document.getElementById('tana-inv-savenote');
    if (n) n.textContent = msg;
  }

  function findRow(y, rowId) {
    for (var i = 0; i < y.rows.length; i++) if (y.rows[i].rowId === rowId) return y.rows[i];
    return null;
  }

  function bindTable(el, y, prev, locked) {
    /* 日付 */
    ['basedate', 'actualdate'].forEach(function (key) {
      var input = el.querySelector('#tana-inv-' + key);
      if (!input || locked) return;
      input.addEventListener('change', function () {
        var field = key === 'basedate' ? 'baseDate' : 'actualDate';
        var label = key === 'basedate' ? '棚卸基準日' : '実地棚卸日';
        var before = y[field];
        y[field] = input.value;
        TANA.store.log('年度情報変更', y.year + '年度', [{ field: label, before: before || '', after: input.value }]);
        TANA.store.save();
        inv.render();
      });
    });

    if (!locked) {
      var addOne = el.querySelector('#tana-inv-addone');
      if (addOne) addOne.addEventListener('click', function () {
        var sel = el.querySelector('#tana-inv-addsel');
        if (!sel.value) return;
        var m = TANA.store.getMaster(sel.value);
        if (!m) return;
        var dup = y.rows.some(function (r) { return r.masterId === m.id; });
        var doAdd = function () {
          var r = TANA.store.rowFromMaster(m);
          y.rows.push(r);
          TANA.store.log('棚卸品目追加', y.year + '年度 ' + m.name);
          TANA.store.save(); inv.render();
        };
        if (dup) {
          TANA.ui.confirm('重複の確認', '「' + U.escapeHtml(m.name) + '」はこの年度にすでに登録されています。もう1行追加しますか？（重複は警告として表示されます）', { okLabel: '追加する' })
            .then(function (ok) { if (ok) doAdd(); });
        } else doAdd();
      });

      var addAll = el.querySelector('#tana-inv-addall');
      if (addAll) addAll.addEventListener('click', function () {
        var inYear = {};
        y.rows.forEach(function (r) { if (r.masterId) inYear[r.masterId] = true; });
        var targets = TANA.store.state.master.filter(function (m) { return m.active !== false && !inYear[m.id]; });
        if (!targets.length) { TANA.ui.toast('追加できる未登録の品目はありません'); return; }
        targets.forEach(function (m) { y.rows.push(TANA.store.rowFromMaster(m)); });
        TANA.store.log('棚卸品目一括追加', y.year + '年度 ' + targets.length + '件');
        TANA.store.save(); inv.render();
        TANA.ui.toast(targets.length + '件の品目を追加しました');
      });

      var addDirect = el.querySelector('#tana-inv-adddirect');
      if (addDirect) addDirect.addEventListener('click', function () {
        var r = {
          rowId: U.newId('R'), masterId: '', category: 'other', name: '（新しい品目）',
          maker: '', spec: '', location: '', countMethod: 'count', unit: '個',
          perBox: null, volumePerUnit: null,
          qty: null, boxes: null, loose: null, remainVol: null, ratioType: '', ratioValue: null,
          unitPrice: null, lastPurchaseDate: '', supplier: '', invoiceNo: '', priceBasis: '',
          priceChangeReason: '', processing: 'target', omitReason: '',
          adjAdd: null, adjUse: null, adjOther: null, adjReason: '', note: '', updatedAt: U.nowISO()
        };
        y.rows.push(r);
        TANA.store.log('棚卸品目追加', y.year + '年度 （直接追加）');
        TANA.store.save();
        inv.render();
        openRowEditor(y, r.rowId);
      });

      var saveBtn = el.querySelector('#tana-inv-save');
      if (saveBtn) saveBtn.addEventListener('click', function () {
        if (TANA.store.save()) { TANA.ui.toast('保存しました'); noteSaved('保存しました ' + U.nowISO().slice(11)); }
      });
    }

    var table = el.querySelector('#tana-inv-table');
    if (!table) return;

    /* インライン入力：input=即時再計算、change=履歴記録と保存 */
    table.addEventListener('focusin', function (e) {
      var rid = e.target.getAttribute && e.target.getAttribute('data-row');
      if (!rid) return;
      var r = findRow(y, rid);
      if (r && !editSnapshots[rid]) editSnapshots[rid] = rowForDiff(r);
    });

    table.addEventListener('input', function (e) {
      var t = e.target, rid = t.getAttribute && t.getAttribute('data-row');
      if (!rid || locked) return;
      var r = findRow(y, rid);
      if (!r) return;
      applyInput(r, t);
      updateRowCells(table, y, r);
      updateTotals(y);
    });

    table.addEventListener('change', function (e) {
      var t = e.target, rid = t.getAttribute && t.getAttribute('data-row');
      if (!rid || locked) return;
      var r = findRow(y, rid);
      if (!r) return;
      applyInput(r, t);
      /* 範囲外の阻止（保存不可のエラー） */
      var v = U.num(t.value);
      var fieldName = t.getAttribute('data-field');
      if (v !== null && t.type === 'number') {
        var rejectMsg = '';
        if (v < 0) rejectMsg = 'マイナスの値は保存できません。0以上を入力してください';
        else if (fieldName === 'ratioValue' && v > 1) rejectMsg = '残量割合は0〜1の範囲で入力してください（例：半分なら0.5）';
        else if (fieldName === 'remainVol') {
          var cap = U.num(r.volumePerUnit);
          if (cap !== null && cap > 0 && v > cap) rejectMsg = '残量が1本あたりの容量（' + cap + 'ml）を超えています';
        }
        if (rejectMsg) {
          TANA.ui.toast(rejectMsg, 'error');
          t.value = '';
          applyInput(r, t);
          updateRowCells(table, y, r);
          updateTotals(y);
        }
      }
      r.updatedAt = U.nowISO();
      /* 履歴（フォーカス時点との差分） */
      var before = editSnapshots[rid];
      if (before) {
        var changes = TANA.store.diff(ROW_LABELS, before, rowForDiff(r));
        if (changes.length) TANA.store.log('棚卸入力変更', y.year + '年度 ' + r.name, changes);
        delete editSnapshots[rid];
      }
      /* 処理区分：省略を選んだら理由入力を促す */
      if (t.getAttribute('data-field') === 'processing') {
        if (r.processing === 'omit' && !r.omitReason) promptOmitReason(y, r);
        inv.render();
      } else if (t.getAttribute('data-field') === 'ratioType') {
        inv.render(); /* 任意割合の入力欄を出すため再描画 */
      } else {
        refreshIssues(y);
      }
      scheduleAutoSave();
    });

    /* 行編集・削除 */
    table.querySelectorAll('[data-editrow]').forEach(function (b) {
      b.addEventListener('click', function () { openRowEditor(y, b.getAttribute('data-editrow')); });
    });
    table.querySelectorAll('[data-delrow]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = findRow(y, b.getAttribute('data-delrow'));
        if (!r) return;
        TANA.ui.confirm('品目の削除', 'この年度の棚卸表から「' + U.escapeHtml(r.name) + '」を削除します。よろしいですか？<br><span class="tana-hint">使い切った等で在庫に含めない場合は、削除ではなく処理区分（使用済み・廃棄など）の利用も検討してください。</span>', { danger: true, okLabel: '削除する' })
          .then(function (ok) {
            if (!ok) return;
            y.rows = y.rows.filter(function (x) { return x.rowId !== r.rowId; });
            TANA.store.log('棚卸品目削除', y.year + '年度 ' + r.name);
            TANA.store.save(); inv.render();
          });
      });
    });
  }

  function applyInput(r, t) {
    var field = t.getAttribute('data-field');
    if (field === 'ratioType') {
      r.ratioType = t.value;
      if (t.value === '') {
        r.ratioValue = null;                 /* 未選択＝未入力（0とは区別） */
      } else if (t.value === 'custom') {
        if (r.ratioValue === null || r.ratioValue === undefined) r.ratioValue = 0.5;
      } else {
        var preset = U.RATIO_PRESETS.filter(function (p) { return p.key === t.value; })[0];
        if (preset) r.ratioValue = preset.value; /* 「開封済みなし」は0が入る */
      }
      return;
    }
    if (field === 'processing' || field === 'supplier' || field === 'note' || field === 'lastPurchaseDate') {
      r[field] = t.value;
      return;
    }
    r[field] = (t.value === '') ? null : U.num(t.value);
  }

  function updateRowCells(table, y, r) {
    var tr = table.querySelector('tr[data-rowid="' + r.rowId + '"]');
    if (!tr) return;
    var S = TANA.store.state;
    var dir = TANA.calc.adjDir(y);
    var conv = TANA.calc.convQty(r);
    var adj = TANA.calc.adjustedQty(r, dir);
    var amt = TANA.calc.amount(r, S.settings.rounding, dir);
    var convCell = tr.querySelector('[data-cell="conv"]');
    var amtCell = tr.querySelector('[data-cell="amount"]');
    if (convCell) convCell.textContent = adj === null ? '' : U.qty(adj);
    if (amtCell && r.processing === 'target') amtCell.textContent = U.yen(amt, S.settings.currency);
  }

  function updateTotals(y) {
    var box = document.getElementById('tana-inv-totals');
    if (box) box.innerHTML = totalsHtml(y);
  }

  function refreshIssues(y) {
    var box = document.getElementById('tana-inv-issues');
    if (box) box.innerHTML = issuesHtml(TANA.calc.validate(y, TANA.store.prevYearOf(y.year), false));
  }

  function promptOmitReason(y, r) {
    TANA.ui.modal('省略理由の入力', '<p>「通常量の消耗品として省略」を選びました。省略理由を残しておくと、後から説明しやすくなります。</p>' +
      '<div class="tana-field"><label>省略理由</label><textarea id="tana-omit-reason" placeholder="例：常時使用する量のみで、期末在庫として計上するほどの残数がないため"></textarea></div>',
      [
        { label: '入力しない' },
        {
          label: '保存', primary: true, keepOpen: true, onClick: function (close) {
            var v = document.getElementById('tana-omit-reason').value.trim();
            var before = r.omitReason;
            r.omitReason = v;
            if (v !== before) TANA.store.log('棚卸入力変更', y.year + '年度 ' + r.name, [{ field: '省略理由', before: before || '', after: v }]);
            TANA.store.save(); close(); inv.render();
          }
        }
      ]);
  }

  /* ---------- 行の詳細編集モーダル ---------- */

  function openRowEditor(y, rowId) {
    var r = findRow(y, rowId);
    if (!r) return;
    var locked = (y.status === 'finalized');
    var dis = locked ? ' disabled' : '';

    function optHtml(map, sel) {
      return Object.keys(map).map(function (k) {
        return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + map[k] + '</option>';
      }).join('');
    }
    function val(v) { return (v === null || v === undefined) ? '' : v; }

    var html = '' +
      '<h3 style="margin-top:0;">品目情報（この年度のコピー）</h3>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>区分</label><select id="te-category"' + dis + '>' + optHtml(U.CATEGORY, (r.category in U.CATEGORY) ? r.category : 'other') + '</select></div>' +
      '<div class="tana-field"><label>品名</label><input type="text" id="te-name" value="' + U.escapeHtml(r.name) + '"' + dis + '></div>' +
      '</div>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>メーカー</label><input type="text" id="te-maker" value="' + U.escapeHtml(r.maker || '') + '"' + dis + '></div>' +
      '<div class="tana-field"><label>規格・容量</label><input type="text" id="te-spec" value="' + U.escapeHtml(r.spec) + '"' + dis + '></div>' +
      '</div>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>保管場所</label><input type="text" id="te-location" value="' + U.escapeHtml(r.location) + '"' + dis + '></div>' +
      '<div class="tana-field"><label>単位</label><input type="text" id="te-unit" value="' + U.escapeHtml(r.unit) + '"' + dis + '></div>' +
      '</div>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>数え方</label><select id="te-method"' + dis + '>' + optHtml(U.METHOD, r.countMethod) + '</select></div>' +
      '<div class="tana-field"><label>1箱の個数</label><input type="number" min="0" id="te-perbox" value="' + val(r.perBox) + '"' + dis + '></div>' +
      '<div class="tana-field"><label>1本の容量(ml)</label><input type="number" min="0" id="te-vol" value="' + val(r.volumePerUnit) + '"' + dis + '></div>' +
      '</div>' +
      '<h3>単価の管理</h3>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>単価（円）</label><input type="number" min="0" step="any" id="te-price" value="' + val(r.unitPrice) + '"' + dis + '></div>' +
      '<div class="tana-field"><label>最終仕入日</label><input type="date" id="te-lastdate" value="' + U.escapeHtml(r.lastPurchaseDate || '') + '"' + dis + '></div>' +
      '<div class="tana-field"><label>仕入先</label><input type="text" id="te-supplier" value="' + U.escapeHtml(r.supplier || '') + '"' + dis + '></div>' +
      '</div>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>納品書・請求書番号</label><input type="text" id="te-invoice" value="' + U.escapeHtml(r.invoiceNo || '') + '"' + dis + '></div>' +
      '<div class="tana-field"><label>単価の根拠</label><input type="text" id="te-basis" value="' + U.escapeHtml(r.priceBasis || '') + '" placeholder="例：2026/11/20 △△問屋 納品書"' + dis + '></div>' +
      '</div>' +
      '<div class="tana-field"><label>単価を変更した理由（前年から変えた場合など）</label><input type="text" id="te-pricereason" value="' + U.escapeHtml(r.priceChangeReason || '') + '"' + dis + '></div>' +
      '<h3>処理区分</h3>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>処理区分</label><select id="te-proc"' + dis + '>' + optHtml(U.PROCESSING, r.processing) + '</select>' +
      '<span class="tana-hint">「棚卸対象」以外は合計に含まれませんが、記録としては残ります。</span></div>' +
      '<div class="tana-field"><label>省略理由（「省略」を選んだ場合）</label><input type="text" id="te-omit" value="' + U.escapeHtml(r.omitReason || '') + '"' + dis + '></div>' +
      '</div>' +
      '<h3>基準日と実地棚卸日の差の調整</h3>' +
      '<p class="tana-hint">実地棚卸日と基準日の間に仕入・使用・販売があった場合に入力します。<br>' +
      '現在の計算式：' + TANA.calc.adjFormulaText(TANA.calc.adjDir(y)) + '</p>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>追加仕入数量</label><input type="number" min="0" step="any" id="te-adjadd" value="' + val(r.adjAdd) + '"' + dis + '></div>' +
      '<div class="tana-field"><label>使用・販売数量</label><input type="number" min="0" step="any" id="te-adjuse" value="' + val(r.adjUse) + '"' + dis + '></div>' +
      '<div class="tana-field"><label>その他調整数（±可）</label><input type="number" step="any" id="te-adjother" value="' + val(r.adjOther) + '"' + dis + '></div>' +
      '</div>' +
      '<div class="tana-field"><label>調整理由</label><input type="text" id="te-adjreason" value="' + U.escapeHtml(r.adjReason || '') + '"' + dis + '></div>' +
      '<div class="tana-field"><label>備考</label><textarea id="te-note"' + dis + '>' + U.escapeHtml(r.note || '') + '</textarea></div>';

    var buttons = [{ label: locked ? '閉じる' : 'キャンセル' }];
    if (!locked) {
      buttons.push({
        label: '保存', primary: true, keepOpen: true, onClick: function (close) {
          var before = rowForDiff(r);
          function g(id) { return document.getElementById(id).value; }
          r.category = g('te-category');
          r.name = g('te-name').trim() || r.name;
          r.maker = g('te-maker').trim();
          r.spec = g('te-spec').trim();
          r.location = g('te-location').trim();
          r.unit = g('te-unit').trim() || '個';
          r.countMethod = g('te-method');
          r.perBox = U.num(g('te-perbox'));
          r.volumePerUnit = U.num(g('te-vol'));
          r.unitPrice = U.num(g('te-price'));
          r.lastPurchaseDate = g('te-lastdate');
          r.supplier = g('te-supplier').trim();
          r.invoiceNo = g('te-invoice').trim();
          r.priceBasis = g('te-basis').trim();
          r.priceChangeReason = g('te-pricereason').trim();
          r.processing = g('te-proc');
          r.omitReason = g('te-omit').trim();
          r.adjAdd = U.num(g('te-adjadd'));
          r.adjUse = U.num(g('te-adjuse'));
          r.adjOther = U.num(g('te-adjother'));
          r.adjReason = g('te-adjreason').trim();
          r.note = g('te-note').trim();
          /* マイナスチェック（保存不可のエラー） */
          var negFields = [['unitPrice', r.unitPrice], ['perBox', r.perBox], ['volumePerUnit', r.volumePerUnit], ['adjAdd', r.adjAdd], ['adjUse', r.adjUse]];
          for (var i = 0; i < negFields.length; i++) {
            if (negFields[i][1] !== null && negFields[i][1] < 0) {
              TANA.ui.toast('マイナスの値は保存できません（' + ROW_LABELS[negFields[i][0]] + '）', 'error');
              return;
            }
          }
          r.updatedAt = U.nowISO();
          var changes = TANA.store.diff(ROW_LABELS, before, rowForDiff(r));
          if (changes.length) TANA.store.log('棚卸入力変更', y.year + '年度 ' + r.name, changes);
          if (TANA.store.save()) { close(); inv.render(); TANA.ui.toast('保存しました'); }
        }
      });
    }
    TANA.ui.modal('品目の詳細編集：' + U.escapeHtml(r.name), html, buttons);
  }

  TANA.inventory = inv;
})();
