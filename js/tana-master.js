/* tana-master.js : 品目マスター */
(function () {
  'use strict';
  var U = TANA.util;
  var master = {};

  var LABELS = {
    category: '区分', name: '品名', maker: 'メーカー', spec: '規格・容量', location: '保管場所',
    countMethod: '数え方', unit: '単位', perBox: '1箱あたりの個数', volumePerUnit: '1本あたりの容量',
    supplier: '通常の仕入先', lastPrice: '前回仕入単価', active: '使用中', note: '備考'
  };

  master.render = function () {
    var el = document.getElementById('tana-tab-master');
    var list = TANA.store.state.master;
    var html = '<div class="tana-card">' +
      '<div class="tana-toolbar">' +
      '<h2 style="margin:0;">品目マスター</h2><span class="tana-spacer"></span>' +
      '<button class="tana-btn tana-btn-primary" id="tana-master-add">＋ 品目を追加</button>' +
      '</div>' +
      '<p class="tana-hint">毎年使用する品目を登録します。ここを変更しても、過去年度の棚卸表（各年度に保存されたコピー）は変わりません。規格・容量・入り数が違う商品は別品目として登録してください。</p>';

    if (!list.length) {
      html += '<p>品目がまだ登録されていません。「＋ 品目を追加」から登録するか、設定画面のサンプルデータ作成をお試しください。</p></div>';
      el.innerHTML = html; bind(el); return;
    }

    html += '<div class="tana-table-wrap"><table class="tana-table"><thead><tr>' +
      '<th>品目ID</th><th class="tana-sticky-col">品名</th><th>区分</th><th>メーカー</th><th>規格・容量</th><th>保管場所</th>' +
      '<th>数え方</th><th>単位</th><th class="tana-num">1箱の個数</th><th class="tana-num">1本の容量</th>' +
      '<th>通常の仕入先</th><th class="tana-num">前回仕入単価</th><th>状態</th><th>備考</th><th>操作</th>' +
      '</tr></thead><tbody>';

    var sorted = list.slice().sort(function (a, b) {
      var ca = U.CATEGORY_ORDER.indexOf(a.category), cb = U.CATEGORY_ORDER.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return a.id < b.id ? -1 : 1;
    });
    sorted.forEach(function (m) {
      html += '<tr' + (m.active === false ? ' class="tana-row-excluded"' : '') + '>' +
        '<td>' + U.escapeHtml(m.id) + '</td>' +
        '<td class="tana-sticky-col">' + U.escapeHtml(m.name) + (m.isSample ? ' <span class="tana-badge tana-badge-neutral">サンプル</span>' : '') + '</td>' +
        '<td>' + U.CATEGORY[m.category] + '</td>' +
        '<td>' + U.escapeHtml(m.maker) + '</td>' +
        '<td>' + U.escapeHtml(m.spec) + '</td>' +
        '<td>' + U.escapeHtml(m.location) + '</td>' +
        '<td>' + U.METHOD[m.countMethod] + '</td>' +
        '<td>' + U.escapeHtml(m.unit) + '</td>' +
        '<td class="tana-num">' + (m.perBox || '') + '</td>' +
        '<td class="tana-num">' + (m.volumePerUnit ? m.volumePerUnit + 'ml' : '') + '</td>' +
        '<td>' + U.escapeHtml(m.supplier) + '</td>' +
        '<td class="tana-num">' + (m.lastPrice === null || m.lastPrice === undefined || m.lastPrice === '' ? '' : U.yen(m.lastPrice, TANA.store.state.settings.currency)) + '</td>' +
        '<td>' + (m.active === false ? '<span class="tana-badge tana-badge-neutral">休止中</span>' : '<span class="tana-badge tana-badge-ok">使用中</span>') + '</td>' +
        '<td>' + U.escapeHtml(m.note) + '</td>' +
        '<td><button class="tana-btn tana-btn-sm" data-edit="' + m.id + '">編集</button> ' +
        '<button class="tana-btn tana-btn-sm tana-btn-danger" data-del="' + m.id + '">削除</button></td>' +
        '</tr>';
    });
    html += '</tbody></table></div></div>';
    el.innerHTML = html;
    bind(el);
  };

  function bind(el) {
    var add = el.querySelector('#tana-master-add');
    if (add) add.addEventListener('click', function () { openForm(null); });
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { openForm(b.getAttribute('data-edit')); });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { del(b.getAttribute('data-del')); });
    });
  }

  function formHtml(m) {
    m = m || {};
    function opt(map, selected) {
      return Object.keys(map).map(function (k) {
        return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + map[k] + '</option>';
      }).join('');
    }
    return '' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label class="tana-required">品名</label><input type="text" id="tm-name" value="' + U.escapeHtml(m.name || '') + '"></div>' +
      '<div class="tana-field"><label>区分</label><select id="tm-category">' + opt(U.CATEGORY, m.category || 'sale') + '</select></div>' +
      '</div>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>メーカー</label><input type="text" id="tm-maker" value="' + U.escapeHtml(m.maker || '') + '"></div>' +
      '<div class="tana-field"><label>規格・容量</label><input type="text" id="tm-spec" value="' + U.escapeHtml(m.spec || '') + '" placeholder="例：300ml、10枚入"></div>' +
      '<div class="tana-field"><label>保管場所</label><input type="text" id="tm-location" value="' + U.escapeHtml(m.location || '') + '"></div>' +
      '</div>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>数え方</label><select id="tm-method">' + opt(U.METHOD, m.countMethod || 'count') + '</select>' +
      '<span class="tana-hint">箱＋端数：単価は1' + U.escapeHtml(m.unit || '個') + 'あたりで入力します／容量・割合：単価は1本あたり</span></div>' +
      '<div class="tana-field"><label>単位</label><input type="text" id="tm-unit" value="' + U.escapeHtml(m.unit || '個') + '" placeholder="個・本・枚など"></div>' +
      '</div>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>1箱あたりの個数（箱＋端数で使用）</label><input type="number" id="tm-perbox" min="0" value="' + (m.perBox || '') + '"></div>' +
      '<div class="tana-field"><label>1本あたりの容量 ml（容量で使用）</label><input type="number" id="tm-vol" min="0" value="' + (m.volumePerUnit || '') + '"></div>' +
      '</div>' +
      '<div class="tana-field-row">' +
      '<div class="tana-field"><label>通常の仕入先</label><input type="text" id="tm-supplier" value="' + U.escapeHtml(m.supplier || '') + '"></div>' +
      '<div class="tana-field"><label>前回仕入単価（円）</label><input type="number" id="tm-price" min="0" value="' + (m.lastPrice === null || m.lastPrice === undefined ? '' : m.lastPrice) + '"></div>' +
      '</div>' +
      '<div class="tana-field"><label>状態</label><select id="tm-active"><option value="1"' + (m.active !== false ? ' selected' : '') + '>使用中</option><option value="0"' + (m.active === false ? ' selected' : '') + '>休止中</option></select>' +
      '<span class="tana-hint">休止中の品目は、新しい年度へ品目をコピーする際に対象外になります。</span></div>' +
      '<div class="tana-field"><label>備考</label><textarea id="tm-note">' + U.escapeHtml(m.note || '') + '</textarea></div>';
  }

  function readForm() {
    function v(id) { return document.getElementById(id).value.trim(); }
    return {
      name: v('tm-name'), category: v('tm-category'), maker: v('tm-maker'),
      spec: v('tm-spec'), location: v('tm-location'), countMethod: v('tm-method'),
      unit: v('tm-unit') || '個',
      perBox: U.num(v('tm-perbox')), volumePerUnit: U.num(v('tm-vol')),
      supplier: v('tm-supplier'), lastPrice: U.num(v('tm-price')),
      active: v('tm-active') === '1', note: v('tm-note')
    };
  }

  function openForm(id) {
    var m = id ? TANA.store.getMaster(id) : null;
    TANA.ui.modal(id ? '品目を編集（' + id + '）' : '品目を追加', formHtml(m), [
      { label: 'キャンセル' },
      {
        label: id ? '保存' : '追加', primary: true, keepOpen: true,
        onClick: function (close) {
          var f = readForm();
          if (!f.name) { TANA.ui.toast('品名を入力してください', 'warn'); return; }
          if ((f.lastPrice !== null && f.lastPrice < 0) || (f.perBox !== null && f.perBox < 0) || (f.volumePerUnit !== null && f.volumePerUnit < 0)) {
            TANA.ui.toast('マイナスの値は登録できません', 'error'); return;
          }
          if (f.countMethod === 'box' && (!f.perBox || f.perBox <= 0)) {
            TANA.ui.toast('数え方が「箱＋端数」の場合は、1箱あたりの個数を入力してください', 'warn'); return;
          }
          if (f.countMethod === 'volume' && (!f.volumePerUnit || f.volumePerUnit <= 0)) {
            TANA.ui.toast('数え方が「容量」の場合は、1本あたりの容量を入力してください', 'warn'); return;
          }
          if (id) {
            var before = JSON.parse(JSON.stringify(m));
            for (var k in f) m[k] = f[k];
            var changes = TANA.store.diff(LABELS, mapForDiff(before), mapForDiff(m));
            TANA.store.log('品目マスター編集', m.id + ' ' + m.name, changes);
          } else {
            var nm = f; nm.id = TANA.store.newMasterId(); nm.isSample = false;
            TANA.store.state.master.push(nm);
            TANA.store.log('品目マスター追加', nm.id + ' ' + nm.name);
          }
          if (TANA.store.save()) { close(); master.render(); TANA.ui.toast('品目を保存しました'); }
        }
      }
    ]);
  }

  function mapForDiff(m) {
    return {
      category: U.CATEGORY[m.category] || m.category, name: m.name, maker: m.maker, spec: m.spec,
      location: m.location, countMethod: U.METHOD[m.countMethod] || m.countMethod, unit: m.unit,
      perBox: m.perBox, volumePerUnit: m.volumePerUnit, supplier: m.supplier,
      lastPrice: m.lastPrice, active: m.active === false ? '休止中' : '使用中', note: m.note
    };
  }

  function del(id) {
    var m = TANA.store.getMaster(id);
    if (!m) return;
    /* 年度で使用中かの情報表示（削除しても年度側のコピーは残る） */
    var usedYears = TANA.store.yearList().filter(function (y) {
      return TANA.store.getYear(y).rows.some(function (r) { return r.masterId === id; });
    });
    var msg = '品目「' + U.escapeHtml(m.name) + '」をマスターから削除します。' +
      (usedYears.length ? '<br>この品目は ' + usedYears.join('年・') + '年 の棚卸表で使用されていますが、各年度に保存されたデータは削除されません。' : '') +
      '<br>今後の年度で使わない場合は「休止中」への変更もご検討ください。';
    TANA.ui.confirm('品目の削除', msg, { danger: true, okLabel: '削除する' }).then(function (ok) {
      if (!ok) return;
      TANA.store.state.master = TANA.store.state.master.filter(function (x) { return x.id !== id; });
      TANA.store.log('品目マスター削除', id + ' ' + m.name);
      if (TANA.store.save()) { master.render(); TANA.ui.toast('品目を削除しました'); }
    });
  }

  TANA.master = master;
})();
