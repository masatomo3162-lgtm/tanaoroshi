/* tana-dashboard.js : ダッシュボード */
(function () {
  'use strict';
  var U = TANA.util;
  var dash = {};

  dash.render = function () {
    var el = document.getElementById('tana-tab-dashboard');
    var S = TANA.store.state;
    var yearKey = TANA.app.currentYear();
    var y = yearKey ? TANA.store.getYear(yearKey) : null;
    var html = '';

    html += '<div class="tana-card"><div class="tana-toolbar">' +
      '<label for="tana-dash-year" style="font-weight:700;">表示年度</label>' +
      TANA.app.yearSelectHtml('tana-dash-year', yearKey) +
      '<span class="tana-spacer"></span>' +
      (y ? '<span class="tana-badge tana-badge-status-' + y.status + '">' + U.STATUS[y.status] + '</span>' : '') +
      '</div>';

    if (!y) {
      html += '<p>年度がまだ作成されていません。「年度管理・履歴」タブから新しい年度を作成してください。</p></div>';
      el.innerHTML = html;
      bind(el);
      return;
    }

    var t = TANA.calc.totals(y, S.settings.rounding);
    var prev = TANA.store.prevYearOf(y.year);
    var cmp = TANA.calc.compare(y, prev, S.settings.rounding);
    var cur = S.settings.currency;
    var taxLabel = S.settings.taxMode === 'excl' ? '（税抜）' : '（税込）';

    html += '<div class="tana-stat-grid">' +
      stat('棚卸基準日', U.fmtDateJP(y.baseDate)) +
      stat('実地棚卸日', U.fmtDateJP(y.actualDate)) +
      stat('登録品目数', t.itemCount + ' 件') +
      stat('入力済み品目数', t.entered + ' 件') +
      stat('未入力品目数', t.notEntered + ' 件' +
        (t.notEntered > 0 ? ' <span class="tana-badge tana-badge-warn">⚠ 未入力あり</span>' : ' <span class="tana-badge tana-badge-ok">✓ 完了</span>')) +
      stat('棚卸表の状態', '<span class="tana-badge tana-badge-status-' + y.status + '">' + U.STATUS[y.status] + '</span>') +
      '</div>';

    html += '<h3>棚卸金額 ' + taxLabel + '</h3><div class="tana-stat-grid">' +
      stat('販売商品の棚卸合計', U.yen(t.sale, cur)) +
      stat('施術材料の棚卸合計', U.yen(t.material, cur)) +
      stat('消耗品の棚卸合計', U.yen(t.consumable, cur)) +
      stat('その他の棚卸合計', U.yen(t.other, cur)) +
      '<div class="tana-stat tana-stat-total"><div class="tana-stat-label">全在庫の参考合計</div>' +
      '<div class="tana-stat-value">' + U.yen(t.total, cur) + '</div></div>' +
      stat('前年度との差額', prev
        ? (cmp.total.diff >= 0 ? '+' : '−') + U.yen(Math.abs(cmp.total.diff), cur).replace(cur, cur) +
          (cmp.total.rate !== null ? ' <span class="tana-hint">(' + (cmp.total.rate >= 0 ? '+' : '') + cmp.total.rate + '%)</span>' : '')
        : '前年度データなし') +
      '</div>';

    html += '<h3>分類別の金額グラフ</h3><div class="tana-chart-wrap">' + chart(t, prev ? TANA.calc.totals(prev, S.settings.rounding) : null, cur) + '</div>';
    if (prev) html += '<div class="tana-legend"><span class="tana-leg-cur">今年度（' + y.year + '年）</span><span class="tana-leg-prev">前年度（' + prev.year + '年）</span></div>';
    html += '</div>';

    el.innerHTML = html;
    bind(el);

    function stat(label, value) {
      return '<div class="tana-stat"><div class="tana-stat-label">' + label + '</div><div class="tana-stat-value">' + value + '</div></div>';
    }
  };

  function chart(t, pt, cur) {
    var cats = U.CATEGORY_ORDER;
    var max = 1;
    cats.forEach(function (c) {
      max = Math.max(max, t[c], pt ? pt[c] : 0);
    });
    var W = 640, rowH = pt ? 52 : 38, left = 96, right = 100;
    var H = cats.length * rowH + 10;
    var barW = W - left - right;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" role="img" aria-label="分類別棚卸金額グラフ" xmlns="http://www.w3.org/2000/svg">';
    cats.forEach(function (c, i) {
      var yTop = i * rowH + 6;
      var w1 = Math.round(t[c] / max * barW);
      s += '<text x="' + (left - 8) + '" y="' + (yTop + 16) + '" text-anchor="end" font-size="13" fill="#5c6670">' + U.CATEGORY[c] + '</text>';
      s += '<rect x="' + left + '" y="' + yTop + '" width="' + Math.max(w1, t[c] > 0 ? 2 : 0) + '" height="20" rx="3" fill="#23405c"></rect>';
      s += '<text x="' + (left + Math.max(w1, 2) + 6) + '" y="' + (yTop + 15) + '" font-size="12" fill="#26292c">' + U.yen(t[c], cur) + '</text>';
      if (pt) {
        var w2 = Math.round(pt[c] / max * barW);
        s += '<rect x="' + left + '" y="' + (yTop + 23) + '" width="' + Math.max(w2, pt[c] > 0 ? 2 : 0) + '" height="14" rx="3" fill="#c3cdd4"></rect>';
        s += '<text x="' + (left + Math.max(w2, 2) + 6) + '" y="' + (yTop + 35) + '" font-size="11" fill="#5c6670">' + U.yen(pt[c], cur) + '</text>';
      }
    });
    s += '</svg>';
    return s;
  }

  function bind(el) {
    var sel = el.querySelector('#tana-dash-year');
    if (sel) sel.addEventListener('change', function () {
      TANA.app.setCurrentYear(sel.value);
      dash.render();
    });
  }

  TANA.dashboard = dash;
})();
