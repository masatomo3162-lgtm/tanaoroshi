/* tana-util.js : 共通ユーティリティ（名前空間 TANA） */
(function () {
  'use strict';
  window.TANA = window.TANA || {};

  var util = {};

  util.escapeHtml = function (s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* 数値パース：空文字は null を返す */
  util.num = function (v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  };

  /* 金額表示（通貨記号は設定から） */
  util.yen = function (n, symbol) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var sym = (symbol === undefined || symbol === null) ? '¥' : symbol;
    return sym + Math.round(n).toLocaleString('ja-JP');
  };

  /* 数量表示：整数なら整数、少数なら最大2桁 */
  util.qty = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '';
    var r = Math.round(n * 100) / 100;
    return r.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
  };

  util.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };

  util.todayISO = function () {
    var d = new Date();
    return d.getFullYear() + '-' + util.pad2(d.getMonth() + 1) + '-' + util.pad2(d.getDate());
  };

  util.nowStamp = function () {
    var d = new Date();
    return d.getFullYear() + util.pad2(d.getMonth() + 1) + util.pad2(d.getDate()) +
      '_' + util.pad2(d.getHours()) + util.pad2(d.getMinutes()) + util.pad2(d.getSeconds());
  };

  util.nowISO = function () {
    var d = new Date();
    return d.getFullYear() + '-' + util.pad2(d.getMonth() + 1) + '-' + util.pad2(d.getDate()) +
      ' ' + util.pad2(d.getHours()) + ':' + util.pad2(d.getMinutes()) + ':' + util.pad2(d.getSeconds());
  };

  util.fmtDateJP = function (iso) {
    if (!iso) return '未設定';
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    return Number(m[1]) + '年' + Number(m[2]) + '月' + Number(m[3]) + '日';
  };

  /* 月の末日 */
  util.lastDayOfMonth = function (year, month) {
    return new Date(year, month, 0).getDate();
  };

  /* CSVセル用エスケープ */
  util.csvCell = function (v) {
    if (v === null || v === undefined) v = '';
    v = String(v);
    if (/[",\r\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  };

  util.rowsToCsv = function (rows) {
    return rows.map(function (r) { return r.map(util.csvCell).join(','); }).join('\r\n');
  };

  /* ファイルダウンロード（UTF-8 BOM 付き。Excelでの文字化け対策） */
  util.downloadText = function (filename, text, mime) {
    try {
      var bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      var blob = new Blob([bom, text], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      return true;
    } catch (e) {
      console.error('ダウンロードに失敗しました', e);
      if (TANA.ui && TANA.ui.toast) TANA.ui.toast('ファイルの保存に失敗しました', 'error');
      return false;
    }
  };

  util.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  };

  var seq = 0;
  util.newId = function (prefix) {
    seq++;
    return prefix + '_' + Date.now().toString(36) + '_' + seq + '_' + Math.floor(Math.random() * 10000).toString(36);
  };

  /* 定数：ラベル辞書 */
  util.CATEGORY = {
    sale: '販売商品',
    material: '施術材料',
    consumable: '消耗品',
    other: 'その他'
  };
  util.CATEGORY_ORDER = ['sale', 'material', 'consumable', 'other'];

  util.METHOD = {
    count: '個数',
    box: '箱＋端数',
    volume: '容量(残量)',
    ratio: '残量割合'
  };

  util.PROCESSING = {
    target: '棚卸対象',
    omit: '通常量の消耗品として省略',
    used: '使用済み',
    broken: '破損',
    discard: '廃棄',
    excluded: '対象外',
    check: '要確認'
  };

  util.STATUS = {
    draft: '作成中',
    checked: '確認済み',
    finalized: '確定済み'
  };

  util.RATIO_PRESETS = [
    { key: '', label: '（未選択）', value: null },
    { key: 'none', label: '開封済みなし', value: 0 },
    { key: 'full', label: '未開封同等（1本分）', value: 1 },
    { key: 'threeQ', label: '約4分の3', value: 0.75 },
    { key: 'half', label: '約半分', value: 0.5 },
    { key: 'quarter', label: '約4分の1', value: 0.25 },
    { key: 'empty', label: 'ほぼ空', value: 0.05 },
    { key: 'custom', label: '任意の割合', value: null }
  ];

  TANA.util = util;
})();
