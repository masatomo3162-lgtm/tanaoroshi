/* tana-calc.js : 換算・金額・集計・入力チェック（DOM非依存） */
(function () {
  'use strict';
  var U = TANA.util;
  var calc = {};

  /* 換算数量：数え方に応じて計算。未入力なら null */
  calc.convQty = function (r) {
    var n = U.num;
    switch (r.countMethod) {
      case 'count':
        return n(r.qty);
      case 'box': {
        var b = n(r.boxes), l = n(r.loose);
        if (b === null && l === null) return null;
        var per = n(r.perBox);
        if (per === null || per <= 0) return null; /* 1箱の個数が未設定では換算不能 */
        return (b || 0) * per + (l || 0);
      }
      case 'volume': {
        var full = n(r.qty);            /* 未開封の本数 */
        var rem = n(r.remainVol);       /* 開封済みの残量 */
        if (full === null && rem === null) return null;
        var cap = n(r.volumePerUnit);
        var part = 0;
        if (rem !== null) {
          if (cap === null || cap <= 0) return null; /* 容量未設定では換算不能 */
          part = rem / cap;
        }
        return Math.round(((full || 0) + part) * 100) / 100;
      }
      case 'ratio': {
        var fullQ = n(r.qty);           /* 未開封の本数 */
        var ratio = n(r.ratioValue);    /* 開封済み1本分の残量割合 */
        if (fullQ === null && ratio === null) return null;
        return Math.round(((fullQ || 0) + (ratio || 0)) * 100) / 100;
      }
      default:
        return n(r.qty);
    }
  };

  /* 調整後数量：基準日と実地日の差を反映 */
  calc.hasAdjust = function (r) {
    return (U.num(r.adjAdd) || 0) !== 0 || (U.num(r.adjUse) || 0) !== 0 || (U.num(r.adjOther) || 0) !== 0;
  };

  /* 調整の方向：実地棚卸日が基準日「以前」なら +1（従来式）、
     基準日より「後」なら -1（仕入と使用の加減が逆転する）。
     ・実地日≦基準日：基準日在庫 ＝ 数えた数 ＋ その後の仕入 − その後の使用
     ・実地日＞基準日：基準日在庫 ＝ 数えた数 − その間の仕入 ＋ その間の使用 */
  calc.adjDir = function (yearObj) {
    if (!yearObj || !yearObj.baseDate || !yearObj.actualDate) return 1;
    return (yearObj.actualDate > yearObj.baseDate) ? -1 : 1;
  };

  /* 現在使用される計算式の説明文（画面表示用） */
  calc.adjFormulaText = function (dir) {
    return (dir === -1)
      ? '調整後数量＝換算数量 −追加仕入 ＋使用販売 ＋その他（実地日が基準日より後のため加減が逆になります）'
      : '調整後数量＝換算数量 ＋追加仕入 −使用販売 ＋その他';
  };

  calc.adjustedQty = function (r, dir) {
    var c = calc.convQty(r);
    if (c === null) return null;
    if (!calc.hasAdjust(r)) return c;
    var d = (dir === -1) ? -1 : 1;
    var v = c + d * (U.num(r.adjAdd) || 0) - d * (U.num(r.adjUse) || 0) + (U.num(r.adjOther) || 0);
    return Math.round(v * 100) / 100;
  };

  calc.roundAmount = function (v, mode) {
    if (mode === 'ceil') return Math.ceil(v);
    if (mode === 'round') return Math.round(v);
    return Math.floor(v); /* 既定：切り捨て */
  };

  /* 金額：調整後数量 × 単価。数量または単価未入力なら null */
  calc.amount = function (r, rounding, dir) {
    var q = calc.adjustedQty(r, dir);
    var p = U.num(r.unitPrice);
    if (q === null || p === null) return null;
    return calc.roundAmount(q * p, rounding || 'floor');
  };

  /* 集計：処理区分が「棚卸対象」の行のみ合計へ */
  calc.totals = function (yearObj, rounding) {
    var t = { sale: 0, material: 0, consumable: 0, other: 0, total: 0,
      itemCount: 0, entered: 0, notEntered: 0 };
    if (!yearObj) return t;
    var dir = calc.adjDir(yearObj);
    yearObj.rows.forEach(function (r) {
      t.itemCount++;
      var amt = calc.amount(r, rounding, dir);
      var q = calc.convQty(r);
      var p = U.num(r.unitPrice);
      if (r.processing === 'target') {
        if (q !== null && p !== null) t.entered++; else t.notEntered++;
        if (amt !== null) {
          var cat = (t[r.category] !== undefined) ? r.category : 'other';
          t[cat] += amt;
          t.total += amt;
        }
      } else {
        /* 対象外の行は入力済み扱い（数える必要がない） */
        t.entered++;
      }
    });
    return t;
  };

  /* 前年度比較 */
  calc.compare = function (cur, prev, rounding) {
    var a = calc.totals(cur, rounding);
    var b = calc.totals(prev, rounding);
    function row(key) {
      var diff = a[key] - b[key];
      var rate = (b[key] !== 0) ? Math.round(diff / b[key] * 1000) / 10 : null;
      return { prev: b[key], cur: a[key], diff: diff, rate: rate };
    }
    return {
      sale: row('sale'), material: row('material'),
      consumable: row('consumable'), other: row('other'), total: row('total')
    };
  };

  /* ---------- 入力チェック ----------
     errors  : 保存/確定を止める重大な問題
     warnings: 保存は許可し、注意表示する問題 */
  calc.validate = function (yearObj, prevYearObj, forFinalize) {
    var errors = [], warnings = [];
    if (!yearObj) return { errors: ['年度が選択されていません'], warnings: [] };

    if (!yearObj.baseDate) {
      (forFinalize ? errors : warnings).push('棚卸基準日が未入力です');
    }
    if (!yearObj.actualDate) {
      warnings.push('実地棚卸日が未入力です');
    }

    var seen = {};
    var dir = calc.adjDir(yearObj);
    yearObj.rows.forEach(function (r, idx) {
      var label = '「' + r.name + '」';
      var q = calc.convQty(r);
      var p = U.num(r.unitPrice);

      /* マイナスは保存不可のエラー */
      var negs = ['qty', 'boxes', 'loose', 'remainVol', 'unitPrice', 'ratioValue'];
      negs.forEach(function (k) {
        var v = U.num(r[k]);
        if (v !== null && v < 0) {
          errors.push(label + (k === 'unitPrice' ? '：単価がマイナスです' : '：数量がマイナスです'));
        }
      });
      var adjQ = calc.adjustedQty(r, dir);
      if (adjQ !== null && adjQ < 0) errors.push(label + '：調整後数量がマイナスです');

      /* 入力範囲のエラー */
      var rv = U.num(r.ratioValue);
      if (r.countMethod === 'ratio' && rv !== null && rv > 1) {
        errors.push(label + '：残量割合は0〜1の範囲で入力してください（現在 ' + rv + '）');
      }
      var rem = U.num(r.remainVol), cap = U.num(r.volumePerUnit);
      if (r.countMethod === 'volume' && rem !== null && cap !== null && cap > 0 && rem > cap) {
        errors.push(label + '：残量（' + rem + 'ml）が1本あたりの容量（' + cap + 'ml）を超えています');
      }
      /* 整数チェック（箱数・端数・未開封本数） */
      var intFields = [];
      if (r.countMethod === 'box') intFields = [['boxes', '箱数'], ['loose', '端数']];
      if (r.countMethod === 'volume' || r.countMethod === 'ratio') intFields = [['qty', '未開封本数']];
      intFields.forEach(function (f) {
        var v = U.num(r[f[0]]);
        if (v !== null && v % 1 !== 0) errors.push(label + '：' + f[1] + 'は整数で入力してください（現在 ' + v + '）');
      });
      /* 数え方に必要な設定の必須チェック */
      if (r.processing === 'target') {
        if (r.countMethod === 'box') {
          var pb = U.num(r.perBox);
          if (pb === null || pb <= 0) {
            errors.push(label + '：数え方が「箱＋端数」ですが、1箱あたりの個数が未設定です（行の編集から設定できます）');
          }
        }
        if (r.countMethod === 'volume') {
          var vpu = U.num(r.volumePerUnit);
          if (vpu === null || vpu <= 0) {
            errors.push(label + '：数え方が「容量」ですが、1本あたりの容量が未設定です（行の編集から設定できます）');
          }
        }
      }

      if (r.processing === 'target') {
        if (q === null) warnings.push(label + '：数量が未入力です');
        if (p === null) warnings.push(label + '：単価が未入力です');
        /* 前年度比の単価変動（±30%超で警告） */
        if (prevYearObj && p !== null) {
          for (var j = 0; j < prevYearObj.rows.length; j++) {
            var pr = prevYearObj.rows[j];
            if (pr.masterId === r.masterId) {
              var pp = U.num(pr.unitPrice);
              if (pp !== null && pp > 0) {
                var rate = (p - pp) / pp;
                if (Math.abs(rate) > 0.3) {
                  warnings.push(label + '：単価が前年度から大きく変化しています（' +
                    (rate > 0 ? '+' : '') + Math.round(rate * 100) + '%）。単価変更理由の記入を推奨します');
                }
              }
              break;
            }
          }
        }
      }
      if (r.processing === 'check') {
        (forFinalize ? errors : warnings).push(label + '：処理区分が「要確認」のままです');
      }
      if (r.processing === 'omit' && !r.omitReason) {
        warnings.push(label + '：省略理由が未入力です');
      }
      /* 同一品目の重複登録 */
      if (r.masterId) {
        if (seen[r.masterId]) warnings.push(label + '：同じ品目が重複登録されています');
        seen[r.masterId] = true;
      }
    });

    if (forFinalize) {
      var t = calc.totals(yearObj, (TANA.store && TANA.store.state) ? TANA.store.state.settings.rounding : 'floor');
      if (t.total === 0) errors.push('合計金額が0円のままです。数量と単価を確認してください');
      if (t.notEntered > 0) warnings.push('未入力の品目が ' + t.notEntered + ' 件残っています');
    }
    return { errors: errors, warnings: warnings };
  };

  TANA.calc = calc;
})();
