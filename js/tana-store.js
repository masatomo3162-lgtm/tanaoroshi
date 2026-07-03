/* tana-store.js : データ保存層（localStorage / 履歴 / バックアップ） */
(function () {
  'use strict';
  var U = TANA.util;
  var KEY = 'tana_v1_data'; /* 他アプリと衝突しない専用キー */
  var SCHEMA = 1;
  var VERSION = '1.0.2';

  var store = {
    state: null,
    saveFailed: false
  };

  store.VERSION = VERSION;
  store.KEY = KEY;

  store.defaultSettings = function () {
    return {
      storeName: '',
      storeAddress: '',
      ownerName: '',
      authorName: '',
      fiscalMonth: 12,          /* 決算月 */
      taxMode: 'incl',          /* incl:税込経理 / excl:税抜経理（表示） */
      rounding: 'floor',        /* floor:切り捨て / round:四捨五入 / ceil:切り上げ */
      currency: '¥',
      autoSave: true
    };
  };

  store.defaultData = function () {
    return {
      schemaVersion: SCHEMA,
      appVersion: VERSION,
      settings: store.defaultSettings(),
      master: [],
      years: {},
      history: [],
      masterSeq: 0
    };
  };

  /* ---------- 読み込み / 保存 ---------- */

  store.load = function () {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {
      console.error('localStorage を読み込めません', e);
    }
    if (!raw) {
      store.state = store.defaultData();
      return store.state;
    }
    try {
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !data.settings) throw new Error('形式不正');
      /* 既定値の補完（将来のスキーマ追加に備える） */
      var def = store.defaultSettings();
      for (var k in def) { if (data.settings[k] === undefined) data.settings[k] = def[k]; }
      data.master = data.master || [];
      data.years = data.years || {};
      data.history = data.history || [];
      data.masterSeq = data.masterSeq || 0;
      store.state = data;
      store.migrate(); /* 旧バージョン保存データの移行（必要な場合のみ動作） */
    } catch (e) {
      console.error('保存データの読み込みに失敗しました。初期状態で起動します。', e);
      store.state = store.defaultData();
      if (TANA.ui && TANA.ui.toast) TANA.ui.toast('保存データが壊れていたため初期状態で起動しました', 'error');
    }
    return store.state;
  };

  /* 保存。容量超過などの失敗時は false を返し、画面に警告する */
  store.save = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(store.state));
      if (store.saveFailed) {
        store.saveFailed = false;
        if (TANA.ui && TANA.ui.setSaveError) TANA.ui.setSaveError(false);
      }
      return true;
    } catch (e) {
      store.saveFailed = true;
      console.error('データ保存に失敗しました', e);
      var quota = (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'));
      var msg = quota
        ? '保存容量の上限を超えたため保存できませんでした。設定画面からJSONバックアップを取り、不要な過去年度を削除してください。'
        : 'データの保存に失敗しました。JSONバックアップを取ってからブラウザを確認してください。';
      if (TANA.ui && TANA.ui.toast) TANA.ui.toast(msg, 'error', 8000);
      if (TANA.ui && TANA.ui.setSaveError) TANA.ui.setSaveError(true);
      return false;
    }
  };

  /* ---------- 履歴（実操作から記録） ---------- */

  store.log = function (action, target, changes, reason) {
    store.state.history.unshift({
      ts: U.nowISO(),
      operator: (store.state.settings.authorName || '未設定'),
      action: action,
      target: target || '',
      changes: changes || [],
      reason: reason || ''
    });
    /* 履歴は最大2000件（容量保護。古いものから削除） */
    if (store.state.history.length > 2000) store.state.history.length = 2000;
  };

  /* 変更差分を作る：fields = [{key, label, before, after}] */
  store.diff = function (labels, before, after) {
    var out = [];
    for (var k in labels) {
      var b = before ? before[k] : undefined;
      var a = after ? after[k] : undefined;
      if (b === undefined || b === null) b = '';
      if (a === undefined || a === null) a = '';
      if (String(b) !== String(a)) out.push({ field: labels[k], before: String(b), after: String(a) });
    }
    return out;
  };

  /* ---------- 品目マスター ---------- */

  store.newMasterId = function () {
    store.state.masterSeq = (store.state.masterSeq || 0) + 1;
    return 'M' + ('0000' + store.state.masterSeq).slice(-4);
  };

  store.getMaster = function (id) {
    for (var i = 0; i < store.state.master.length; i++) {
      if (store.state.master[i].id === id) return store.state.master[i];
    }
    return null;
  };

  /* ---------- 年度 ---------- */

  store.getYear = function (y) { return store.state.years[String(y)] || null; };

  store.yearList = function () {
    return Object.keys(store.state.years).sort(function (a, b) { return Number(b) - Number(a); });
  };

  store.prevYearOf = function (y) {
    var ys = Object.keys(store.state.years).map(Number).filter(function (n) { return n < Number(y); });
    if (!ys.length) return null;
    return store.state.years[String(Math.max.apply(null, ys))];
  };

  /* マスター情報を年度行スナップショットへコピー */
  store.rowFromMaster = function (m) {
    return {
      rowId: U.newId('R'),
      masterId: m.id,
      category: m.category,
      name: m.name,
      maker: m.maker || '',
      spec: m.spec || '',
      location: m.location || '',
      countMethod: m.countMethod || 'count',
      unit: m.unit || '個',
      perBox: m.perBox || null,
      volumePerUnit: m.volumePerUnit || null,
      /* 数量入力値 */
      qty: null, boxes: null, loose: null, remainVol: null,
      ratioType: '', ratioValue: null,
      /* 単価情報（初期値：マスターの前回仕入単価） */
      unitPrice: (m.lastPrice === null || m.lastPrice === undefined) ? null : m.lastPrice,
      lastPurchaseDate: '', supplier: m.supplier || '',
      invoiceNo: '', priceBasis: '', priceChangeReason: '',
      /* 処理区分 */
      processing: 'target', omitReason: '',
      /* 基準日と実地日の差の調整 */
      adjAdd: null, adjUse: null, adjOther: null, adjReason: '',
      note: '',
      updatedAt: U.nowISO()
    };
  };

  store.createYear = function (year, baseDate, copyMode) {
    var y = String(year);
    if (store.state.years[y]) return null;
    var rows = [];
    if (copyMode === 'prev') {
      var prev = store.prevYearOf(y);
      if (prev) {
        rows = prev.rows.map(function (r) {
          var n = JSON.parse(JSON.stringify(r));
          n.rowId = U.newId('R');
          n.qty = null; n.boxes = null; n.loose = null; n.remainVol = null;
          n.ratioType = ''; n.ratioValue = null;
          n.adjAdd = null; n.adjUse = null; n.adjOther = null; n.adjReason = '';
          n.invoiceNo = ''; n.priceChangeReason = '';
          n.processing = (r.processing === 'target' || r.processing === 'omit') ? r.processing : 'target';
          n.note = '';
          n.updatedAt = U.nowISO();
          return n;
        });
      }
    } else if (copyMode === 'master') {
      rows = store.state.master
        .filter(function (m) { return m.active !== false; })
        .map(store.rowFromMaster);
    }
    var obj = {
      year: y,
      baseDate: baseDate || '',
      actualDate: '',
      status: 'draft',
      createdAt: U.nowISO(),
      finalizedAt: '',
      rows: rows
    };
    store.state.years[y] = obj;
    store.log('年度作成', y + '年度', [{ field: '品目コピー', before: '', after: copyMode === 'prev' ? '前年度から' : copyMode === 'master' ? 'マスターから' : 'なし' }]);
    return obj;
  };

  /* ---------- バックアップ / 復元 ---------- */

  store.backupJSON = function () {
    var payload = {
      app: 'tana-inventory',
      appVersion: VERSION,
      schemaVersion: SCHEMA,
      exportedAt: U.nowISO(),
      data: store.state
    };
    var name = 'tana_backup_' + U.nowStamp() + '.json';
    return U.downloadText(name, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8') ? name : null;
  };

  /* 復元前チェック：形式が正しければ {ok:true, data} */
  store.parseBackup = function (text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: 'JSONとして読み込めません' }; }
    var data = null;
    if (obj && obj.app === 'tana-inventory' && obj.data && obj.data.settings) data = obj.data;
    else if (obj && obj.settings && obj.years !== undefined) data = obj; /* 生データ形式も許容 */
    if (!data) return { ok: false, error: 'このアプリのバックアップ形式ではありません' };
    if (data.schemaVersion && data.schemaVersion > SCHEMA) {
      return { ok: false, error: 'より新しいバージョンのデータのため復元できません' };
    }
    return { ok: true, data: data };
  };

  store.restore = function (data) {
    store.state = data;
    /* 既定値補完 */
    var def = store.defaultSettings();
    store.state.settings = store.state.settings || {};
    for (var k in def) { if (store.state.settings[k] === undefined) store.state.settings[k] = def[k]; }
    store.state.master = store.state.master || [];
    store.state.years = store.state.years || {};
    store.state.history = store.state.history || [];
    store.state.masterSeq = store.state.masterSeq || 0;
    store.log('バックアップ復元', '全データ');
    store.migrate(); /* 旧版（1.0.0）バックアップの復元にも対応。migrate内で保存される */
    return store.save();
  };

  store.resetAll = function () {
    store.state = store.defaultData();
    store.log('全データ初期化', '全データ');
    return store.save();
  };

  /* ---------- CSV出力 ---------- */

  store.exportMasterCSV = function () {
    var head = ['品目ID', '区分', '品名', 'メーカー', '規格・容量', '保管場所', '数え方', '単位',
      '1箱あたりの個数', '1本あたりの容量', '通常の仕入先', '前回仕入単価', '状態', '備考'];
    var rows = [head];
    store.state.master.forEach(function (m) {
      rows.push([m.id, U.CATEGORY[m.category] || m.category, m.name, m.maker, m.spec, m.location,
        U.METHOD[m.countMethod] || m.countMethod, m.unit, m.perBox, m.volumePerUnit,
        m.supplier, m.lastPrice, m.active === false ? '休止中' : '使用中', m.note]);
    });
    return U.downloadText('tana_master_' + U.nowStamp() + '.csv', U.rowsToCsv(rows), 'text/csv;charset=utf-8');
  };

  store.exportYearCSV = function (year) {
    var y = store.getYear(year);
    if (!y) return false;
    var s = store.state.settings;
    var head = ['年度', '棚卸基準日', '実地棚卸日', '状態', '品目ID', '区分', '品名', 'メーカー', '規格・容量', '保管場所',
      '数え方', '数量入力値', '箱数', '端数', '残量', '残量割合', '単位', '換算数量',
      '調整後数量', '追加仕入数量', '使用・販売数量', 'その他調整数', '調整理由',
      '単価', '金額', '最終仕入日', '仕入先', '納品書・請求書番号', '単価の根拠', '単価変更理由',
      '処理区分', '省略理由', '備考'];
    var rows = [head];
    var dir = TANA.calc.adjDir(y);
    y.rows.forEach(function (r) {
      var conv = TANA.calc.convQty(r);
      var adj = TANA.calc.adjustedQty(r, dir);
      var amt = TANA.calc.amount(r, s.rounding, dir);
      rows.push([y.year, y.baseDate, y.actualDate, U.STATUS[y.status],
        r.masterId, U.CATEGORY[r.category] || r.category, r.name, r.maker, r.spec, r.location,
        U.METHOD[r.countMethod] || r.countMethod, r.qty, r.boxes, r.loose, r.remainVol,
        r.ratioValue, r.unit, conv === null ? '' : conv,
        adj === null ? '' : adj, r.adjAdd, r.adjUse, r.adjOther, r.adjReason,
        r.unitPrice, amt === null ? '' : amt, r.lastPurchaseDate, r.supplier, r.invoiceNo,
        r.priceBasis, r.priceChangeReason,
        U.PROCESSING[r.processing] || r.processing, r.omitReason, r.note]);
    });
    var t = TANA.calc.totals(y, s.rounding);
    rows.push([]);
    rows.push(['分類別合計', '販売商品棚卸高', t.sale, '施術材料棚卸高', t.material, '消耗品棚卸高', t.consumable, 'その他棚卸高', t.other, '全体の参考合計', t.total]);
    return U.downloadText('tana_year_' + year + '_' + U.nowStamp() + '.csv', U.rowsToCsv(rows), 'text/csv;charset=utf-8');
  };

  /* ---------- サンプルデータ ---------- */

  store.hasSample = function () {
    var m = store.state.master.some(function (x) { return x.isSample; });
    var y = Object.keys(store.state.years).some(function (k) { return store.state.years[k].isSample; });
    return m || y;
  };

  /* ---------- 旧バージョン保存データの移行 ----------
     Ver.1.0.0 の残量割合方式は初期値 ratioType:'full', ratioValue:1 だったため、
     未入力のつもりの品目が1本分として計上されていた。
     ・サンプル年度：アプリが作った初期値と断定できるため未入力へ自動変換
     ・利用者の通常年度：本当に「1本分」を選んだ可能性と区別できないため
       自動変更せず、対象品目名を警告として一度だけ表示する */
  store.migrate = function () {
    var data = store.state;
    var from = data.appVersion || '1.0.0';
    if (from === VERSION) return false; /* 移行済み。二重実行しない */

    var changed = false;
    if (from === '1.0.0') {
      var converted = 0;
      var noticeItems = [];
      Object.keys(data.years || {}).forEach(function (k) {
        var y = data.years[k];
        (y.rows || []).forEach(function (r) {
          var isOldDefault = r.countMethod === 'ratio' &&
            (r.qty === null || r.qty === undefined) &&
            r.ratioType === 'full' && r.ratioValue === 1;
          if (!isOldDefault) return;
          if (y.isSample) {
            r.ratioType = ''; r.ratioValue = null; /* 未入力へ */
            converted++;
          } else {
            noticeItems.push(k + '年「' + r.name + '」');
          }
        });
      });
      if (converted || noticeItems.length) {
        store.log('データ移行（Ver.1.0.0→' + VERSION + '）',
          'サンプル年度の残量割合 ' + converted + ' 行を未入力へ変換' +
          (noticeItems.length ? '／要確認 ' + noticeItems.length + ' 行' : ''));
      }
      if (noticeItems.length) {
        data.migrationNotice = { fromVersion: '1.0.0', items: noticeItems, shown: false };
      }
      changed = true;
    }

    data.appVersion = VERSION; /* 移行済みフラグ（以後この処理は動かない） */
    store.save();
    return changed;
  };

  store.createSample = function () {
    /* 利用者データが存在する場合は作成しない（既存年度の上書き事故を防ぐ） */
    var hasUserMaster = store.state.master.some(function (m) { return !m.isSample; });
    var hasUserYear = Object.keys(store.state.years).some(function (k) { return !store.state.years[k].isSample; });
    var conflictYear = !!(store.state.years['2025'] || store.state.years['2026']);
    if (hasUserMaster || hasUserYear || conflictYear) {
      var reasons = [];
      if (hasUserMaster) reasons.push('サンプル以外の品目マスター');
      if (hasUserYear) reasons.push('サンプル以外の年度');
      if (!hasUserYear && conflictYear) reasons.push('既存の2025／2026年度');
      return { ok: false, reason: reasons.join('、') + 'が存在するため' };
    }
    var defs = [
      { category: 'sale', name: '店販シャンプー（サンプル）', maker: 'サンプル化粧品', spec: '300ml', location: '店頭棚', countMethod: 'count', unit: '本', supplier: '○○商会', lastPrice: 1200 },
      { category: 'sale', name: '店販整髪料 グリース（サンプル）', maker: 'サンプル化粧品', spec: '90g', location: '店頭棚', countMethod: 'count', unit: '個', supplier: '○○商会', lastPrice: 950 },
      { category: 'material', name: '業務用シャンプー（サンプル）', maker: '業務用品メーカー', spec: '1,000ml', location: 'シャンプー台下', countMethod: 'volume', unit: '本', volumePerUnit: 1000, supplier: '△△問屋', lastPrice: 1800 },
      { category: 'material', name: 'カラー剤 1剤 ナチュラルブラック（サンプル）', maker: '業務用品メーカー', spec: '80g', location: '薬剤棚', countMethod: 'ratio', unit: '本', supplier: '△△問屋', lastPrice: 620 },
      { category: 'material', name: 'パーマ液 1剤（サンプル）', maker: '業務用品メーカー', spec: '400ml', location: '薬剤棚', countMethod: 'ratio', unit: '本', supplier: '△△問屋', lastPrice: 1100 },
      { category: 'consumable', name: 'カミソリ替刃（サンプル）', maker: '刃物メーカー', spec: '10枚入', location: 'ワゴン引き出し', countMethod: 'box', unit: '枚', perBox: 10, supplier: '△△問屋', lastPrice: 65 },
      { category: 'consumable', name: 'ネックペーパー（サンプル）', maker: '衛生用品メーカー', spec: '100枚巻', location: '倉庫', countMethod: 'count', unit: 'ロール', supplier: '△△問屋', lastPrice: 380 },
      { category: 'consumable', name: 'タオル 白（サンプル）', maker: '', spec: '約34×85cm', location: '倉庫', countMethod: 'count', unit: '枚', supplier: '□□タオル店', lastPrice: 220 },
      { category: 'other', name: '分類不明の品目（サンプル）', maker: '', spec: '', location: '', countMethod: 'count', unit: '個', supplier: '', lastPrice: 100 }
    ];
    var masters = defs.map(function (d) {
      var m = {
        id: store.newMasterId(),
        category: d.category, name: d.name, maker: d.maker || '', spec: d.spec || '',
        location: d.location || '', countMethod: d.countMethod, unit: d.unit,
        perBox: d.perBox || null, volumePerUnit: d.volumePerUnit || null,
        supplier: d.supplier || '', lastPrice: d.lastPrice,
        active: true, note: '動作確認用サンプル', isSample: true
      };
      store.state.master.push(m);
      return m;
    });

    /* 前年度（2025年）：入力済み・確定済みのサンプル */
    var y25 = {
      year: '2025', baseDate: '2025-12-31', actualDate: '2025-12-30',
      status: 'finalized', createdAt: U.nowISO(), finalizedAt: '2026-01-05 10:00:00',
      isSample: true,
      rows: masters.map(function (m, i) {
        var r = store.rowFromMaster(m);
        var q = [4, 3, 2, 6, 2, null, 5, 30, 1][i];
        if (m.countMethod === 'count') r.qty = q;
        if (m.countMethod === 'volume') { r.qty = q; r.remainVol = 400; }
        if (m.countMethod === 'ratio') { r.qty = q; r.ratioType = 'half'; r.ratioValue = 0.5; }
        if (m.countMethod === 'box') { r.boxes = 1; r.loose = 5; }
        r.lastPurchaseDate = '2025-11-20';
        return r;
      })
    };
    store.state.years['2025'] = y25;

    /* 今年度（2026年）：一部入力済みの作成中サンプル */
    var y26 = {
      year: '2026', baseDate: '2026-12-31', actualDate: '',
      status: 'draft', createdAt: U.nowISO(), finalizedAt: '',
      isSample: true,
      rows: y25.rows.map(function (r, i) {
        var n = JSON.parse(JSON.stringify(r));
        n.rowId = U.newId('R');
        n.qty = null; n.boxes = null; n.loose = null; n.remainVol = null;
        n.ratioType = ''; n.ratioValue = null;
        n.lastPurchaseDate = ''; n.note = '';
        if (i === 0) n.qty = 5;
        if (i === 5) { n.boxes = 2; n.loose = 3; }
        n.updatedAt = U.nowISO();
        return n;
      })
    };
    store.state.years['2026'] = y26;
    store.log('サンプルデータ作成', '品目9件・2025/2026年度');
    return { ok: true };
  };

  store.deleteSample = function () {
    /* サンプル品目のIDを控えてからマスターを削除 */
    var sampleIds = {};
    store.state.master.forEach(function (m) { if (m.isSample) sampleIds[m.id] = true; });
    var mBefore = store.state.master.length;
    store.state.master = store.state.master.filter(function (m) { return !m.isSample; });

    /* サンプル年度：サンプル品目の行だけ削除し、利用者が追加した行は保護する。
       ・利用者の行が残る年度 → 通常年度として残す（isSample解除）
       ・サンプル行しかなかった年度 → 年度ごと削除 */
    var removedYears = [], keptYears = [];
    Object.keys(store.state.years).forEach(function (k) {
      var y = store.state.years[k];
      if (!y.isSample) return;
      var before = y.rows.length;
      y.rows = y.rows.filter(function (r) { return !(r.masterId && sampleIds[r.masterId]); });
      if (y.rows.length > 0) {
        y.isSample = false; /* 利用者データが残るため通常年度に切り替え */
        keptYears.push(k + '年（利用者追加分 ' + y.rows.length + ' 行を保持）');
      } else {
        delete store.state.years[k];
        removedYears.push(k);
      }
    });
    store.log('サンプルデータ削除',
      '品目' + (mBefore - store.state.master.length) + '件・削除年度[' + removedYears.join(',') + ']' +
      (keptYears.length ? '・保持[' + keptYears.join(' / ') + ']' : ''));
    return store.save();
  };

  TANA.store = store;
})();
