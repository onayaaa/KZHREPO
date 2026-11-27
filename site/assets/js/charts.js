/* ==========================================================================
   葛葉 データアーカイブ — charts.js
   SVG 手描きのチャート群（外部ライブラリなし）。
   配色: DESIGN.md に合わせ、灰階 + 単一の強調色のみ（グラデーションなし）。
   ========================================================================== */
window.KZCharts = (function () {
  "use strict";

  var W = 820;
  var ACCENT = "#c0182b";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function T(key, vars) {
    return window.KZI18N ? window.KZI18N.t(key, vars) : key;
  }

  function num(n, digits) {
    if (n == null || isNaN(n)) return "—";
    var d = digits == null ? 0 : digits;
    return Number(n).toLocaleString("ja-JP", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  }

  function hours(h) {
    if (h == null || isNaN(h)) return "—";
    return h >= 1000 ? num(Math.round(h)) : num(h, h < 10 ? 1 : 0);
  }

  function monthKey(y, m) {
    return y + "-" + (m < 10 ? "0" + m : "" + m);
  }

  /* ------------------------------------------------------- 月別推移ライン */
  function trend(el, monthly) {
    if (!el) return;
    var rows = (monthly || []).slice().sort(function (a, b) {
      return a.y * 12 + a.m - (b.y * 12 + b.m);
    });
    if (!rows.length) return;

    var first = rows[0];
    var last = rows[rows.length - 1];
    var start = first.y * 12 + first.m;
    var end = last.y * 12 + last.m;
    var span = Math.max(1, end - start);
    var byKey = {};
    rows.forEach(function (r) {
      byKey[monthKey(r.y, r.m)] = r;
    });

    var maxH = 0;
    rows.forEach(function (r) {
      if (r.lh > maxH) maxH = r.lh;
    });
    maxH = Math.max(40, Math.ceil(maxH / 50) * 50);

    var padL = 48;
    var padR = 16;
    var padT = 16;
    var padB = 32;
    var height = 280;
    var iw = W - padL - padR;
    var ih = height - padT - padB;

    function x(i) {
      return padL + (iw * i) / span;
    }
    function y(v) {
      return padT + ih - (ih * v) / maxH;
    }

    var pts = [];
    for (var i = 0; i <= span; i++) {
      var absM = start + i;
      var yy = Math.floor((absM - 1) / 12);
      var mm = absM - yy * 12;
      var rec = byKey[monthKey(yy, mm)];
      pts.push({ x: x(i), y: y(rec ? rec.lh : 0), rec: rec, yy: yy, mm: mm });
    }

    var line = pts
      .map(function (p, idx) {
        return (idx ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1);
      })
      .join(" ");
    var area =
      line + " L" + x(span).toFixed(1) + " " + y(0) + " L" + x(0).toFixed(1) + " " + y(0) + " Z";

    var ticks = [];
    var tickStep = maxH / 4;
    for (var t = 0; t <= 4; t++) ticks.push(Math.round(tickStep * t));

    var years = {};
    rows.forEach(function (r) {
      years[r.y] = true;
    });

    var gridSvg = ticks
      .map(function (v) {
        return (
          '<line class="grid-line" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v).toFixed(1) +
          '" y2="' + y(v).toFixed(1) + '"/>' +
          '<text x="' + (padL - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + num(v) + "h</text>"
        );
      })
      .join("");

    var yearMarks = Object.keys(years)
      .sort()
      .map(function (yy) {
        var idx = parseInt(yy, 10) * 12 + 1 - start;
        if (idx < 0) {
          if (parseInt(yy, 10) !== first.y) return "";
          idx = 0;
        }
        var px = x(Math.min(idx, span));
        var nearRight = px > W - 44;
        return (
          '<line class="grid-line" x1="' + px.toFixed(1) + '" x2="' + px.toFixed(1) + '" y1="' + padT +
          '" y2="' + (padT + ih) + '"/>' +
          '<text x="' + (nearRight ? px - 4 : px + 4).toFixed(1) + '" y="' + (height - 10) + '"' +
          (nearRight ? ' text-anchor="end"' : "") + ">" + yy + "</text>"
        );
      })
      .join("");

    var dots = pts
      .map(function (p) {
        if (!p.rec) return "";
        var tip = T("chart.monthTip", { y: p.yy, m: p.mm, h: num(p.rec.lh, 1), n: num(p.rec.n) });
        return (
          '<a href="#/streams?y=' + p.yy + "&m=" + p.mm + '" data-act="month" data-y="' + p.yy +
          '" data-m="' + p.mm + '" tabindex="-1" aria-hidden="true">' +
          '<circle class="hit" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="9"/>' +
          '<circle class="dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3" ' +
          'data-tip="' + esc(tip) + '"><title>' + esc(tip) + "</title></circle></a>"
        );
      })
      .join("");

    el.innerHTML =
      '<svg viewBox="0 0 ' + W + " " + height + '" role="img" aria-label="' + esc(T("chart.trend.aria")) + '">' +
      gridSvg +
      yearMarks +
      '<path class="series-area" d="' + area + '"/>' +
      '<path class="series-line" d="' + line + '"/>' +
      dots +
      "</svg>";
  }

  /* --------------------------------------------------------- 年別バー */
  function yearlyBars(el, yearly, currentYear) {
    if (!el || !yearly || !yearly.length) return;
    var rows = yearly.filter(function (r) {
      return r.n;
    });
    if (!rows.length) return;
    var max = Math.max.apply(null, rows.map(function (r) { return r.h; }));
    max = Math.max(100, Math.ceil(max / 100) * 100);
    var w = 72;
    var gap = 20;
    var padT = 16;
    var padB = 32;
    var padL = 8;
    var height = 200;
    var ih = height - padT - padB;
    var width = Math.max(W, rows.length * (w + gap) + padL * 2);

    var bars = rows
      .map(function (r, i) {
        var h = (ih * r.h) / max;
        var bx = padL + i * (w + gap) + gap / 2;
        var by = padT + ih - h;
        var tip = T("chart.yearTip", { y: r.y, h: num(r.h, 0), lh: num(r.lh, 0), n: num(r.n) });
        var cls = "bar" + (String(r.y) === String(currentYear) ? " is-on" : "");
        return (
          '<a href="#/streams?y=' + r.y + '" data-act="year" data-y="' + r.y + '" aria-label="' + esc(tip) + '">' +
          '<rect class="' + cls + '" x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + w +
          '" height="' + h.toFixed(1) + '" rx="8" data-tip="' + esc(tip) + '"/>' +
          '<text x="' + (bx + w / 2).toFixed(1) + '" y="' + (padT + ih + 20) + '" text-anchor="middle">' + r.y + "</text>" +
          "</a>"
        );
      })
      .join("");

    el.innerHTML =
      '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' + esc(T("chart.yearly.aria")) + '">' +
      '<line class="axis-line" x1="0" x2="' + width + '" y1="' + (padT + ih) + '" y2="' + (padT + ih) + '"/>' +
      bars +
      "</svg>";
  }

  /* ------------------------------------------------------------ カレンダー */
  function heatLevel(h) {
    if (!h) return 0;
    if (h < 1) return 1;
    if (h < 2.5) return 2;
    if (h < 4.5) return 3;
    if (h < 7) return 4;
    return 5;
  }

  function heatmap(el, calendar, year) {
    if (!el) return;
    var start = new Date(Date.UTC(year, 0, 1));
    var end = new Date(Date.UTC(year, 11, 31));
    var startDow = start.getUTCDay();
    var dayMs = 86400000;
    var totalDays = Math.round((end - start) / dayMs) + 1;
    var totalCells = startDow + totalDays;
    var weeks = Math.ceil(totalCells / 7);

    var cells = "";
    var cols = "";
    var colList = [];
    var maxH = 0;
    var lastUsedWk = -1;

    for (var wkol = 0; wkol < weeks; wkol++) {
      var col = "";
      for (var d = 0; d < 7; d++) {
        var idx = wkol * 7 + d;
        if (idx < startDow || idx >= startDow + totalDays) {
          col += '<span class="heat-cell is-empty"></span>';
          continue;
        }
        var dayNo = idx - startDow + 1;
        var dt = new Date(start.getTime() + (dayNo - 1) * dayMs);
        var iso = dt.toISOString().slice(0, 10);
        var rec = calendar[iso];
        var h = rec ? rec[0] : 0;
        var n = rec ? rec[1] : 0;
        if (rec) lastUsedWk = wkol;
        if (h > maxH) maxH = h;
        var label = T("chart.dayTip", {
          y: year,
          m: dt.getUTCMonth() + 1,
          d: dt.getUTCDate(),
          h: num(h, 1),
          n: num(n),
        });
        var dayLabel = dt.getUTCDate();
        col +=
          '<span class="heat-cell" aria-hidden="true" data-l="' + heatLevel(h) + '"' +
          (rec ? ' data-tip="' + esc(label) + '" data-date="' + iso + '"' : "") +
          '><span class="sr-only">' + esc(dayLabel) + "</span></span>";
      }
      colList.push('<div class="heat-col">' + col + "</div>");
    }

    // 記録が終わる週より後ろは空列になるので落とす（月末で止まっている年の右側が
    // 空白のまま横スクロールできてしまうのを防ぐ）。
    if (lastUsedWk >= 0) weeks = Math.min(weeks, lastUsedWk + 1);
    cols = colList.slice(0, weeks).join("");

    var monthLabels = "";
    for (var mi = 0; mi < 12; mi++) {
      var firstOfMonth = new Date(Date.UTC(year, mi, 1));
      var dayIdx = Math.round((firstOfMonth - start) / dayMs) + startDow;
      var wk = Math.floor(dayIdx / 7);
      if (wk + 1 > weeks) continue;
      monthLabels += '<span style="grid-column:' + (wk + 1) + '">' + (mi + 1) + "</span>";
    }

    el.innerHTML =
      '<div class="heat-months" aria-hidden="true" style="grid-template-columns:repeat(' + weeks +
      ',16px)">' + monthLabels + "</div>" +
      '<div class="heat-grid" role="img" aria-label="' + esc(T("heat.aria", { y: year })) +
      '" style="grid-template-columns:repeat(' + weeks + ',16px)">' + cols + "</div>" +
      '<div class="heat-legend"><span>' + esc(T("heat.less")) + "</span>" +
      [0, 1, 2, 3, 4, 5]
        .map(function (l) {
          return '<span class="sw" style="background:var(--heat-' + l + ')"></span>';
        })
        .join("") +
      "<span>" + esc(T("heat.more", { h: num(maxH, 1) })) + "</span></div>";
  }

  /* ------------------------------------------------- 登録者数の推移ライン */
  function subscribers(el, subs) {
    if (!el) return;
    if (!subs || subs.length < 2) {
      el.innerHTML = '<p class="skeleton">' + esc(T("chart.subsEmpty")) + "</p>";
      return;
    }
    var rows = subs.slice().sort(function (a, b) {
      return a.d < b.d ? -1 : 1;
    });
    var maxN = rows[rows.length - 1].n;
    var padL = 48;
    var padR = 16;
    var padT = 16;
    var padB = 28;
    var height = 220;
    var iw = W - padL - padR;
    var ih = height - padT - padB;
    var t0 = new Date(rows[0].d).getTime();
    var t1 = new Date(rows[rows.length - 1].d).getTime();
    var span = Math.max(1, t1 - t0);

    var pts = rows.map(function (r) {
      var t = new Date(r.d).getTime();
      return {
        x: padL + (iw * (t - t0)) / span,
        y: padT + ih - (ih * r.n) / maxN,
        r: r,
      };
    });

    var line = pts
      .map(function (p, i) {
        return (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1);
      })
      .join(" ");

    var ticks = [0, 0.25, 0.5, 0.75, 1]
      .map(function (f) {
        var v = maxN * f;
        var txt =
          v >= 1000000 ? (v / 1000000).toFixed(2) + "M" : v >= 1000 ? Math.round(v / 1000) + "k" : Math.round(v);
        return (
          '<text x="' + (padL - 8) + '" y="' + (padT + ih - ih * f + 4).toFixed(1) + '" text-anchor="end">' + txt + "</text>" +
          '<line class="grid-line" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + ih - ih * f).toFixed(1) +
          '" y2="' + (padT + ih - ih * f).toFixed(1) + '"/>'
        );
      })
      .join("");

    el.innerHTML =
      '<svg viewBox="0 0 ' + W + " " + height + '" role="img" aria-label="' + esc(T("chart.subs.aria")) + '">' +
      ticks +
      '<path class="series-line" d="' + line + '" style="stroke-width:1.5"/>' +
      '<g class="sub-hover" aria-hidden="true">' +
      '<line class="hover-line" x1="0" x2="0" y1="' + padT + '" y2="' + (padT + ih) + '"/>' +
      '<circle class="hover-dot" r="4" cx="0" cy="0"/>' +
      "</g>" +
      '<rect class="hover-layer" x="' + padL + '" y="' + padT + '" width="' + iw + '" height="' + ih +
      '" fill="transparent" pointer-events="all"/>' +
      "</svg>";

    var svg = el.querySelector ? el.querySelector("svg") : null;
    var layer = svg && svg.querySelector(".hover-layer");
    var hl = svg && svg.querySelector(".hover-line");
    var hd = svg && svg.querySelector(".hover-dot");

    function move(ev) {
      if (!svg || !hl || !hd) return;
      // 文書レベルのツールチップ監視に潰されないよう、ここで止める
      if (ev.stopPropagation) ev.stopPropagation();
      var box = svg.getBoundingClientRect();
      if (!box.width) return;
      var x = (ev.clientX - box.left) * (W / box.width);
      var best = pts[0];
      var bd = Infinity;
      pts.forEach(function (p) {
        var d = Math.abs(p.x - x);
        if (d < bd) {
          bd = d;
          best = p;
        }
      });
      hl.setAttribute("x1", best.x.toFixed(1));
      hl.setAttribute("x2", best.x.toFixed(1));
      hl.style.opacity = 1;
      hd.setAttribute("cx", best.x.toFixed(1));
      hd.setAttribute("cy", best.y.toFixed(1));
      hd.style.opacity = 1;
      showText(T("chart.subsTip", { d: best.r.d, n: num(best.r.n) }), ev.clientX, ev.clientY);
    }

    function leave() {
      if (hl) hl.style.opacity = 0;
      if (hd) hd.style.opacity = 0;
      hideTip();
    }

    if (layer) {
      layer.addEventListener("mousemove", move);
      layer.addEventListener("mouseleave", leave);
      layer.addEventListener(
        "touchstart",
        function (ev) {
          var t = ev.touches && ev.touches[0];
          if (t) move({ clientX: t.clientX, clientY: t.clientY });
        },
        { passive: true }
      );
      layer.addEventListener("touchend", leave);
    }
  }

  /* ------------------------------------------------------------ tooltip */
  function tipEl() {
    return document.getElementById("tooltip");
  }

  function showText(text, clientX, clientY) {
    var box = tipEl();
    if (!box || !text) return;
    box.textContent = text;
    box.classList.add("is-on");
    box.style.left = Math.round(clientX) + "px";
    box.style.top = Math.round(clientY) + "px";
  }

  function showTip(target, clientX, clientY) {
    var box = tipEl();
    var text = target.getAttribute("data-tip");
    if (!box || !text) return;
    box.textContent = text;
    box.classList.add("is-on");
    var x = clientX;
    var y = clientY;
    if (x == null) {
      var r = target.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top - 6;
    }
    box.style.left = Math.round(x) + "px";
    box.style.top = Math.round(y) + "px";
  }

  function hideTip() {
    var box = tipEl();
    if (box) box.classList.remove("is-on");
  }

  function installTooltips() {
    document.addEventListener("mouseover", function (ev) {
      var t = ev.target.closest && ev.target.closest("[data-tip]");
      if (!t) return;
      showTip(t, ev.clientX, ev.clientY);
    });
    document.addEventListener("mousemove", function (ev) {
      var t = ev.target.closest && ev.target.closest("[data-tip]");
      if (!t) return hideTip();
      showTip(t, ev.clientX, ev.clientY);
    });
    document.addEventListener("mouseout", function (ev) {
      var t = ev.target.closest && ev.target.closest("[data-tip]");
      if (t) hideTip();
    });
    document.addEventListener("focusin", function (ev) {
      var t = ev.target.closest && ev.target.closest("[data-tip]");
      if (t) showTip(t, null, null);
    });
    document.addEventListener("focusout", hideTip);
    window.addEventListener("scroll", hideTip, { passive: true });
  }

  return {
    trend: trend,
    yearlyBars: yearlyBars,
    heatmap: heatmap,
    subscribers: subscribers,
    installTooltips: installTooltips,
    hideTip: hideTip,
    num: num,
    hours: hours,
    esc: esc,
    ACCENT: ACCENT,
  };
})();
