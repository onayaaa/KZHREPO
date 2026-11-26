/* ==========================================================================
   葛葉 データアーカイブ — app.js
   古典スクリプト（バンドル不要・http 無しでも動く）で、
   hash ルーティング + 絞り込み + 描画を担当する。
   ========================================================================== */
(function () {
  "use strict";

  var KZ = window.KZ || {};
  var Charts = window.KZCharts;
  var esc = Charts.esc;

  var meta = KZ.meta || {};
  var stats = KZ.stats || {};
  var partners = KZ.partners || [];
  var songs = KZ.songs || [];
  var events = KZ.events || [];
  var goods = KZ.goods || [];
  var streams = KZ.streams || null;

  var STORE_KEY = "kz-scroll";

  var state = {
    route: "summary",
    p: "",
    y: "",
    m: "",
    c: "",
    t: "",
    q: "",
    sort: "new",
    tab: "events",
    limit: 60,
    heatYear: "",
    r: "",
  };

  /* カード上で「もっと見る」を押した配信（配信ID → 1）。ページを離れると消えてよい */
  var expandedTags = Object.create(null);

  var routes = ["summary", "streams", "songs", "events", "collabs"];
  var titleMap = {
    summary: "概要",
    streams: "配信アーカイブ",
    songs: "歌",
    events: "大会・企画",
    collabs: "コラボ相手",
  };

  var PLATFORM = {
    youtube: "YouTube",
    twitch: "Twitch",
    niconico: "ニコニコ",
    abema: "ABEMA",
    twitcasting: "ツイキャス",
    x: "X",
    radiko: "radiko",
    instagram: "Instagram",
    web: "Web",
    search: "検索",
    other: "リンクなし",
  };

  var TYPE_LABEL = { live: "配信", clip: "切り抜き", short: "Shorts", song: "歌", liveshow: "ライブ", anken: "案件" };
  // 配信ページには残すが、実体が配信ではない内容はバッジを内容名にする
  var CONTENT_BADGE = { "歌": "歌", "歌ってみた": "歌", "公式番組": "公式番組", "番組": "番組", "ライブ": "ライブ" };
  var TYPE_ORDER = ["live", "clip", "short"];

  /* 大会の成績を「優勝 / 準優勝 / 3位 / 入賞 / 敗退 / その他」に分類する。
     「準優勝」は「優勝」を含むので先に判定する。 */
  var RESULT_ORDER = ["champion", "runnerup", "third", "top10", "out", "other", "unknown"];
  var RESULT_LABEL = {
    champion: "優勝",
    runnerup: "準優勝",
    third: "3位",
    top10: "4〜10位",
    out: "敗退・予選落ち",
    other: "その他",
    unknown: "記録なし",
  };
  function resultRank(result) {
    var r = String(result == null ? "" : result).trim();
    if (!r || r === "-" || r === "？" || r === "?") return "unknown";
    if (/準優勝/.test(r)) return "runnerup";
    if (/優勝|チャンピオン/.test(r) || /^1\s*位/.test(r)) return "champion";
    if (/^2\s*位/.test(r)) return "runnerup";
    if (/^3\s*位/.test(r)) return "third";
    if (/^[4-9]\s*位/.test(r) || /^10\s*位/.test(r)) return "top10";
    if (/敗退|負け|予選/.test(r)) return "out";
    return "other";
  }

  /* ------------------------------------------------------------- utilities */
  function pad2(n) {
    n = String(n);
    return n.length < 2 ? "0" + n : n;
  }

  function num(n, digits) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString("ja-JP", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits || 0,
    });
  }

  function fdate(iso) {
    if (!iso) return "—";
    return iso.slice(0, 4) + "." + iso.slice(5, 7) + "." + iso.slice(8, 10);
  }

  function dur(min) {
    if (!min) return null;
    var total = Math.round(min);
    var h = Math.floor(total / 60);
    var m = total % 60;
    if (!h) return m + " 分";
    return h + " 時間" + (m ? " " + m + " 分" : "");
  }

  function hoursText(h) {
    if (h == null || isNaN(h)) return "—";
    return h >= 1000 ? num(Math.round(h)) + " 時間" : num(h, 1) + " 時間";
  }

  function thumbFor(s) {
    if (s.p === "youtube" && s.v) return "https://i.ytimg.com/vi/" + s.v + "/mqdefault.jpg";
    return "";
  }

  function partnerLink(name) {
    return '#/streams?p=' + encodeURIComponent(name);
  }

  function emptyState(message, sub) {
    return (
      '<div class="empty">' +
      "<b>" + esc(message) + "</b>" +
      "<p>" + esc(sub || "") + "</p>" +
      '<button type="button" class="btn btn-ghost" data-act="clear">絞り込みをクリア</button>' +
      "</div>"
    );
  }

  function activeFilters() {
    var out = [];
    if (state.p && !(state.route === "events" && state.tab === "goods")) out.push({ k: "p", t: "コラボ相手", v: state.p });
    if (state.y) out.push({ k: "y", t: "年", v: state.y + " 年" });
    if (state.m) out.push({ k: "m", t: "月", v: Number(state.m) + " 月" });
    if (state.c) out.push({ k: "c", t: "内容", v: state.c });
    if (state.t) out.push({ k: "t", t: "種類", v: TYPE_LABEL[state.t] || state.t });
    if (state.r && !(state.route === "events" && state.tab === "goods")) out.push({ k: "r", t: "成績", v: RESULT_LABEL[state.r] || state.r });
    if (state.route === "songs" && state.u) out.push({ k: "u", t: "ユニット", v: state.u });
    return out;
  }

  function filterSummaryHtml() {
    var pills = activeFilters();
    if (!pills.length) return "";
    return (
      '<div class="pill-row" style="align-items:center">' +
      pills.map(function (f) {
        return (
          '<span class="tag is-accent">' + esc(f.t) + "：" + esc(f.v) +
          ' <button type="button" data-act="unset" data-k="' + f.k + '" aria-label="' + esc(f.t + "の絞り込みを解除") + '">×</button></span>'
        );
      }).join("") +
      '<button type="button" class="btn btn-ghost" style="min-height:32px;padding:2px 12px" data-act="clear">すべて解除</button>' +
      "</div>"
    );
  }

  /* -------------------------------------------------------------- url/state */
  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, "");
    var qi = raw.indexOf("?");
    var path = qi < 0 ? raw : raw.slice(0, qi);
    var query = qi < 0 ? "" : raw.slice(qi + 1);
    var out = {
      route: routes.indexOf(path) >= 0 ? path : "summary",
      p: "", y: "", m: "", c: "", t: "", u: "", q: "", r: "",
      sort: path === "collabs" ? "h" : "new",
      tab: "events",
      limit: 60,
      heatYear: "",
    };
    query.split("&").forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf("=");
      var k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
      var v = i < 0 ? "" : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " "));
      if (k === "hy") k = "heatYear";
      if (k in out) out[k] = v;
    });
    if (out.heatYear === "") out.heatYear = latestYear();
    // イベント・グッズは参加メンバーを持たないので、URL に p= が残っていても無視する
    if (out.tab === "goods") out.p = "";
    return out;
  }

  function sameState(a, b) {
    return (
      a.route === b.route && a.p === b.p && a.y === b.y && a.m === b.m &&
      a.c === b.c && a.t === b.t && a.q === b.q && a.tab === b.tab && a.r === b.r &&
      a.heatYear === b.heatYear
    );
  }

  function currentHash() {
    var parts = [];
    if (state.p) parts.push("p=" + encodeURIComponent(state.p));
    if (state.y) parts.push("y=" + encodeURIComponent(state.y));
    if (state.m) parts.push("m=" + encodeURIComponent(state.m));
    if (state.c) parts.push("c=" + encodeURIComponent(state.c));
    if (state.t) parts.push("t=" + encodeURIComponent(state.t));
    if (state.q) parts.push("q=" + encodeURIComponent(state.q));
    if (state.route === "songs" && state.u) parts.push("u=" + encodeURIComponent(state.u));
    if (state.route === "events" && state.tab !== "events") parts.push("tab=" + state.tab);
    if (state.route === "events" && state.r) parts.push("r=" + encodeURIComponent(state.r));
    if (state.route === "collabs" && state.sort !== "h") parts.push("sort=" + state.sort);
    if (state.route === "summary" && state.heatYear) parts.push("hy=" + state.heatYear);
    return "#/" + state.route + (parts.length ? "?" + parts.join("&") : "");
  }

  function latestYear() {
    var years = (stats.yearly || []).filter(function (r) { return r.n; }).map(function (r) { return r.y; });
    return String(years.length ? years[years.length - 1] : 2026);
  }

  function syncUrl() {
    var target = currentHash();
    if (location.hash !== target) {
      try {
        history.replaceState(null, "", target);
      } catch (e) {
        location.hash = target;
      }
    }
  }

  function setState(patch, opts) {
    var keys = patch ? Object.keys(patch) : [];
    var onlyMore = keys.length === 1 && keys[0] === "limit";
    Object.assign(state, patch || {});
    syncUrl();
    render();
    if (opts && opts.scroll !== false && !onlyMore) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function navigate(route, patch) {
    var next = Object.assign({}, patch || {});
    next.route = route;
    if (!("limit" in next)) next.limit = 60;
    Object.assign(state, next);
    syncUrl();
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* -------------------------------------------------------- data lazyload */
  function ensureStreams() {
    if (streams) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "assets/data/streams.js";
      s.onload = function () {
        streams = KZ.streams || [];
        resolve();
      };
      s.onerror = function () {
        reject(new Error("streams"));
      };
      document.body.appendChild(s);
    });
  }

  /* -------------------------------------------------------------- chrome */
  function renderNav() {
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === state.route) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = titleMap[state.route] + "｜葛葉 データアーカイブ";
  }

  function renderYearStrip() {
    var el = document.getElementById("year-strip");
    if (!el) return;
    // 概要は年で絞り込む画面ではないので、年ストリップを出さない
    if (state.route === "summary") {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    var years = (meta.years || []).slice();
    var html = '<button type="button" data-act="year" data-y="" aria-pressed="' + (state.y ? "false" : "true") + '">すべて</button>';
    html += years.map(function (y) {
      return '<button type="button" data-act="year" data-y="' + y + '" aria-pressed="' + (state.y === String(y) ? "true" : "false") + '">' + y + "</button>";
    }).join("");
    el.innerHTML = html;
  }

  /* ------------------------------------------------ header global search */
  var suggest = { items: [], active: -1, open: false };

  function siteSearchInput() {
    return document.getElementById("site-search");
  }

  function closeSuggest() {
    var box = document.getElementById("site-suggest");
    var input = siteSearchInput();
    suggest.open = false;
    suggest.active = -1;
    if (box) {
      box.hidden = true;
      box.innerHTML = "";
    }
    if (input) input.setAttribute("aria-expanded", "false");
  }

  function partnerHits(q) {
    var t = q.toLowerCase();
    var hits = partners.filter(function (p) {
      return p.n.toLowerCase().indexOf(t) >= 0;
    });
    hits.sort(function (a, b) {
      var pa = a.n.toLowerCase().indexOf(t) === 0 ? 0 : 1;
      var pb = b.n.toLowerCase().indexOf(t) === 0 ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return b.s - a.s;
    });
    return hits.slice(0, 5);
  }

  function streamHits(q) {
    if (!streams) return [];
    var t = q.toLowerCase();
    var out = [];
    for (var i = 0; i < streams.length && out.length < 8; i++) {
      var s = streams[i];
      if (((s.t || "") + " " + (s.c || "") + " " + (s.e || "")).toLowerCase().indexOf(t) >= 0) out.push(s);
    }
    return out;
  }

  function buildSuggest(q) {
    var items = [];
    partnerHits(q).forEach(function (p) {
      items.push({ k: "partner", label: p.n, sub: num(p.s) + " 本 / " + num(p.h, 1) + " 時間", value: p.n });
    });
    streamHits(q).forEach(function (s) {
      items.push({
        k: "stream",
        label: s.t,
        sub: fdate(s.d) + " ・ " + (s.c || s.e || ""),
        value: s.t,
      });
    });
    return items;
  }

  function drawSuggest(items, q) {
    var box = document.getElementById("site-suggest");
    var input = siteSearchInput();
    if (!box || !input) return;
    var html = "";
    var lastKind = "";
    items.forEach(function (it, i) {
      if (it.k !== lastKind) {
        html += '<div class="suggest-group" role="presentation">' +
          (it.k === "partner" ? "コラボ相手" : "配信") + "</div>";
        lastKind = it.k;
      }
      html +=
        '<button type="button" class="suggest-item' + (i === suggest.active ? " is-active" : "") +
        '" role="option" id="sug-' + i + '" aria-selected="' + (i === suggest.active ? "true" : "false") +
        '" data-act="suggest" data-i="' + i + '">' +
        '<span class="s-kind">' + (it.k === "partner" ? "相手" : "配信") + "</span>" +
        '<span class="s-label">' + esc(it.label) + "</span>" +
        '<span class="s-sub">' + esc(it.sub) + "</span></button>";
    });
    if (!items.length) {
      html = '<p class="suggest-note">' +
        (streams
          ? "「" + esc(q) + "」に一致する項目はありません。Enter で配信タイトルを検索します。"
          : "配信データを読み込んでいます…（コラボ相手は上の候補から選べます）") +
        "</p>";
    }
    if (!streams && q) html += '<p class="suggest-note">配信タイトルを読み込んでいます…</p>';
    box.innerHTML = html;
    box.hidden = false;
    input.setAttribute("aria-expanded", "true");
    suggest.open = true;
  }

  function refreshSuggest() {
    var input = siteSearchInput();
    if (!input) return;
    var q = input.value.trim();
    if (!q) {
      closeSuggest();
      return;
    }
    suggest.items = buildSuggest(q);
    suggest.active = -1;
    drawSuggest(suggest.items, q);
    if (!streams) {
      ensureStreams().then(function () {
        if (!suggest.open || !siteSearchInput()) return;
        if (siteSearchInput().value.trim() !== q) return;
        suggest.items = buildSuggest(q);
        drawSuggest(suggest.items, q);
      }).catch(function () {});
    }
  }

  function activateSuggest(i) {
    var it = suggest.items[i];
    if (!it) return false;
    var input = siteSearchInput();
    closeSuggest();
    if (it.k === "partner") {
      if (input) input.value = it.value;
      // 検索から相手を選んだときは、前の年・月・種類フィルタを持ち越さない
      var toStreams = state.route === "summary";
      navigate(toStreams ? "streams" : state.route, { p: it.value, y: "", m: "", c: "", t: "", q: "" });
    } else {
      if (input) input.value = "";
      navigate("streams", { q: it.value, p: "", y: "", m: "", c: "", t: "" });
    }
    return true;
  }

  function submitSiteSearch() {
    var input = siteSearchInput();
    if (!input) return;
    var q = input.value.trim();
    if (!q) return;
    if (suggest.active >= 0 && activateSuggest(suggest.active)) return;
    var ph = partnerHits(q);
    if (ph.length) {
      input.value = ph[0].n;
      closeSuggest();
      setPartner(ph[0].n);
      return;
    }
    closeSuggest();
    navigate("streams", { q: q, p: "", y: "", m: "", c: "", t: "" });
  }

  function renderSiteSearch() {
    var input = siteSearchInput();
    var clear = document.getElementById("site-search-clear");
    var combo = document.getElementById("site-combo");
    if (!input) return;
    if (document.activeElement !== input && input.value !== (state.p || "")) input.value = state.p || "";
    if (clear) clear.hidden = !input.value;
    if (combo) combo.classList.toggle("is-active", !!state.p);
  }

  /* ---------------------------------------------------------------- rail */
  function railGroup(title, items, act, key, active, opt) {
    if (!items || !items.length) return "";
    return (
      '<div class="rail-group"><h3>' + esc(title) + "</h3>" +
      '<div class="chip-set">' +
      items.map(function (it) {
        var value = it.v != null ? it.v : it;
        var label = it.label != null ? it.label : it;
        var n = it.n != null ? '<span class="n">' + it.n + "</span>" : "";
        var pressed = String(active || "") === String(value) ? "true" : "false";
        return (
          '<button type="button" class="chip" data-act="' + act + '" data-k="' + (key || "") +
          '" data-v="' + esc(value) + '" aria-pressed="' + pressed + '" title="' + esc(label) + '">' +
          esc(label) + n + "</button>"
        );
      }).join("") +
      "</div>" +
      (opt && opt.note ? '<p class="rail-note" style="margin-top:8px">' + esc(opt.note) + "</p>" : "") +
      "</div>"
    );
  }

  function renderRail() {
    var rail = document.getElementById("rail");
    if (!rail) return;
    var html = "";

    if (state.route === "summary") {
      html += '<div class="rail-group"><h3>このアーカイブ</h3>' +
        '<p class="rail-note">2018 年 3 月から 2026 年 11 月までの配信・楽曲・大会・コラボ相手の記録を、出典に基づいて整理しています。</p></div>' +
        '<div class="rail-group"><h3>記録の範囲</h3><p class="rail-note">' +
        esc(fdate(meta.range && meta.range[0])) + " — " + esc(fdate(meta.range && meta.range[1])) +
        '<br>配信 ' + num(meta.counts && meta.counts.live) + " 本 / 楽曲 " + num(meta.counts && meta.counts.songs) + " 曲<br>" +
        "コラボ相手 " + num(meta.counts && meta.counts.partners) + " 人</p></div>" +
        '<div class="rail-group"><h3>データ出典</h3><p class="rail-note">葛葉倉庫 2018–2026（個人管理の記録）。各動画の権利は権利者に帰属します。</p></div>';
      rail.innerHTML = html;
      return;
    }

    if (state.route === "streams") {
      var byPartner = partners.slice(0, 14).map(function (p) {
        return { v: p.n, label: p.n, n: num(p.s) };
      });
      html += railGroup("コラボ相手", byPartner, "partner", "", state.p, {
        note: "上の検索欄からも、すべてのコラボ相手を選べます。",
      });

      // 月チップ：その年に配信記録がある月だけを出す
      //（stats.monthly は n>0 の月しか持たないので、2018 の 1・2 月のような空の月は自然に落ちる）
      var monthCount = {};
      (stats.monthly || []).forEach(function (r) {
        if (state.y && r.y !== Number(state.y)) return;
        monthCount[r.m] = (monthCount[r.m] || 0) + r.n;
      });
      var months = [];
      for (var mi = 1; mi <= 12; mi++) {
        var cnt = monthCount[mi] || 0;
        if (!cnt) continue;
        months.push({ v: pad2(mi), label: mi + " 月", n: num(cnt) });
      }
      html += railGroup("月", months, "month", "", state.m);

      var contents = (stats.games || []).slice(0, 12).map(function (g) {
        return { v: g.name, label: g.name, n: num(g.count) };
      });
      if (state.c && !contents.some(function (x) { return x.v === state.c; })) {
        contents.unshift({ v: state.c, label: state.c, n: "" });
      }
      html += railGroup("内容・ゲーム", contents, "content", "", state.c);

      var typeItems = (stats.types || []).map(function (t) {
        return { v: t.k, label: TYPE_LABEL[t.k] || t.k, n: num(t.n) };
      });
      html += railGroup("種類", typeItems, "type", "", state.t);

      html += '<button type="button" class="rail-clear" data-act="clear">絞り込みをすべて解除</button>';
      rail.innerHTML = html;
      return;
    }

    if (state.route === "songs") {
      var kinds = [];
      var kindCount = {};
      songs.forEach(function (s) {
        kindCount[s.k] = (kindCount[s.k] || 0) + 1;
      });
      Object.keys(kindCount).forEach(function (k) {
        kinds.push({ v: k, label: k, n: num(kindCount[k]) });
      });
      html += railGroup("分類", kinds, "kind", "", state.c);

      var units = [];
      var unitCount = {};
      songs.forEach(function (s) {
        if (!s.e) return;
        unitCount[s.e] = (unitCount[s.e] || 0) + 1;
      });
      Object.keys(unitCount)
        .sort(function (a, b) { return unitCount[b] - unitCount[a]; })
        .slice(0, 8)
        .forEach(function (u) {
          units.push({ v: u, label: u, n: num(unitCount[u]) });
        });
      html += railGroup("ユニット", units, "unit", "", state.u || "");

      var topMembers = partners.slice(0, 10).map(function (p) {
        return { v: p.n, label: p.n, n: p.so ? num(p.so) : "" };
      });
      html += railGroup("コラボ相手", topMembers, "partner", "", state.p, {
        note: "上の検索欄からも選べます。",
      });

      html += '<button type="button" class="rail-clear" data-act="clear">絞り込みをすべて解除</button>';
      rail.innerHTML = html;
      return;
    }

    if (state.route === "events") {
      html += '<div class="rail-group"><h3>表示する記録</h3><div class="chip-set">' +
        '<button type="button" class="chip" data-act="tab" data-v="events" aria-pressed="' + (state.tab === "events" ? "true" : "false") + '">大会・企画<span class="n">' + num(events.length) + "</span></button>" +
        '<button type="button" class="chip" data-act="tab" data-v="goods" aria-pressed="' + (state.tab === "goods" ? "true" : "false") + '">イベント・グッズ<span class="n">' + num(goods.length) + "</span></button>" +
        "</div></div>";

      if (state.tab !== "goods") {
        var rc = {};
        events.forEach(function (e) {
          var rk = resultRank(e.result);
          rc[rk] = (rc[rk] || 0) + 1;
        });
        var resultItems = RESULT_ORDER.filter(function (k) { return rc[k]; }).map(function (k) {
          return { v: k, label: RESULT_LABEL[k], n: num(rc[k]) };
        });
        html += railGroup("成績", resultItems, "result", "r", state.r, {
          note: "優勝・準優勝などで絞り込めます。",
        });
      }

      if (state.tab !== "goods") {
        var memberItems = partners.slice(0, 12).map(function (p) {
          return { v: p.n, label: p.n, n: p.ev ? num(p.ev) : "" };
        });
        html += railGroup("参加メンバー", memberItems, "partner", "", state.p);
      }

      if (state.tab === "goods") {
        var kinds2 = [];
        var kc = {};
        goods.forEach(function (g) { kc[g.k] = (kc[g.k] || 0) + 1; });
        Object.keys(kc)
          .sort(function (a, b) { return kc[b] - kc[a]; })
          .forEach(function (k) { kinds2.push({ v: k, label: k, n: num(kc[k]) }); });
        html += railGroup("種類", kinds2, "kind", "", state.c);
      }

      html += '<button type="button" class="rail-clear" data-act="clear">絞り込みをすべて解除</button>';
      rail.innerHTML = html;
      return;
    }

    if (state.route === "collabs") {
      html += '<div class="rail-group"><h3>コラボ相手について</h3><p class="rail-note">' +
        "同じ配信に複数人が出演するため、共演時間の合計は実際の配信時間より大きくなります（重複あり）。</p></div>";

      var yc = {};
      partners.forEach(function (p) {
        Object.keys(p.y || {}).forEach(function (k) {
          if (p.y[k] && p.y[k][0]) yc[k] = (yc[k] || 0) + 1;
        });
      });
      var yearItems = Object.keys(yc)
        .sort()
        .reverse()
        .map(function (k) { return { v: k, label: k + " 年", n: num(yc[k]) }; });
      html += railGroup("年", yearItems, "year", "y", state.y, {
        note: "年を選ぶと、その年の共演だけを集計します。",
      });

      var recent;
      if (state.y) {
        recent = partners
          .filter(function (p) { return p.y && p.y[state.y] && p.y[state.y][0]; })
          .sort(function (a, b) { return b.y[state.y][0] - a.y[state.y][0]; })
          .slice(0, 12)
          .map(function (p) { return { v: p.n, label: p.n, n: num(p.y[state.y][0]) }; });
      } else {
        recent = partners
          .filter(function (p) { return p.f && p.f >= "2025-01-01"; })
          .slice(0, 12)
          .map(function (p) { return { v: p.n, label: p.n, n: num(p.s) }; });
      }
      html += railGroup(state.y ? "この年のよく共演" : "最近よく共演", recent, "partner", "", state.p);
      html += '<button type="button" class="rail-clear" data-act="clear">絞り込みをすべて解除</button>';
      rail.innerHTML = html;
      return;
    }
  }

  /* ------------------------------------------------------------- helpers */
  function sortStreams(list) {
    var out = list.slice();
    if (state.sort === "old") out.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    else if (state.sort === "dur") out.sort(function (a, b) { return (b.m || 0) - (a.m || 0); });
    else out.sort(function (a, b) { return a.d > b.d ? -1 : a.d < b.d ? 1 : 0; });
    return out;
  }

  function streamsFiltered() {
    var list = streams || [];
    var q = state.q.toLowerCase();
    return list.filter(function (s) {
      if (state.p && s.r.indexOf(state.p) < 0) return false;
      if (state.y && s.d.slice(0, 4) !== state.y) return false;
      if (state.m && s.d.slice(5, 7) !== pad2(state.m)) return false;
      if (state.c && s.c !== state.c) return false;
      if (state.t) {
        if (state.t === "song") {
          if (!(s.k === "live" && (s.c === "歌" || s.c === "歌ってみた"))) return false;
        } else if (state.t === "liveshow") {
          if (!(s.k === "live" && s.c === "ライブ")) return false;
        } else if (state.t === "anken") {
          if (!(s.k === "live" && s.c === "案件")) return false;
        } else if (s.k !== state.t) {
          return false;
        }
      }
      if (q) {
        var hay = (s.t + " " + s.c + " " + s.r.join(" ") + " " + s.e).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function songsFiltered() {
    var q = state.q.toLowerCase();
    return songs.filter(function (s) {
      if (state.p && s.r.indexOf(state.p) < 0) return false;
      if (state.y && s.d.slice(0, 4) !== state.y) return false;
      if (state.c && s.k !== state.c) return false;
      if (state.u && s.e !== state.u) return false;
      if (q && (s.t + " " + s.e + " " + s.r.join(" ")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.d > b.d ? -1 : a.d < b.d ? 1 : 0; });
  }

  /* 同じ曲名の演奏を 1 件にまとめる（歌ページ用）。曲ごとに歌唱日・メンバーが異なる。 */
  function songGroups(list) {
    var map = Object.create(null);
    var order = [];
    list.forEach(function (s) {
      var key = String(s.t || "").replace(/\s+/g, " ").trim();
      if (!key) key = "(無題)";
      var g = map[key];
      if (!g) {
        g = map[key] = { title: key, rows: [], first: s.d, last: s.d, kinds: [] };
        order.push(key);
      }
      g.rows.push(s);
      if (s.d < g.first) g.first = s.d;
      if (s.d > g.last) g.last = s.d;
      if (s.k && g.kinds.indexOf(s.k) < 0) g.kinds.push(s.k);
    });
    return order
      .map(function (k) {
        var g = map[k];
        g.rows.sort(function (a, b) { return a.d > b.d ? -1 : a.d < b.d ? 1 : 0; });
        return g;
      })
      .sort(function (a, b) { return a.last > b.last ? -1 : a.last < b.last ? 1 : 0; });
  }

  function eventsFiltered() {
    var q = state.q.toLowerCase();
    return events.filter(function (e) {
      if (state.p && e.members.indexOf(state.p) < 0) return false;
      if (state.y && e.date.slice(0, 4) !== state.y) return false;
      if (state.r && resultRank(e.result) !== state.r) return false;
      if (q && (e.name + " " + e.content + " " + e.team + " " + e.members.join(" ")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      var da = a.date || "0000";
      var db = b.date || "0000";
      return da > db ? -1 : da < db ? 1 : 0;
    });
  }

  function goodsFiltered() {
    var q = state.q.toLowerCase();
    return goods.filter(function (g) {
      if (state.y && g.d.slice(0, 4) !== state.y) return false;
      if (state.c && g.k !== state.c) return false;
      if (q && (g.t + " " + g.k + " " + g.n).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.d > b.d ? -1 : a.d < b.d ? 1 : 0; });
  }

  /* 年で絞り込んだときの曲数・大会数（songs / events からその場で数える） */
  var yearIndex = { ready: false, songs: {}, events: {} };
  function ensureYearIndex() {
    if (yearIndex.ready) return;
    yearIndex.ready = true;
    songs.forEach(function (s) {
      var y = String(s.d || "").slice(0, 4);
      if (!y) return;
      s.r.forEach(function (n) {
        var m = yearIndex.songs[n] || (yearIndex.songs[n] = {});
        m[y] = (m[y] || 0) + 1;
      });
    });
    events.forEach(function (e) {
      var y = String(e.date || "").slice(0, 4);
      if (!y) return;
      e.members.forEach(function (n) {
        var m = yearIndex.events[n] || (yearIndex.events[n] = {});
        m[y] = (m[y] || 0) + 1;
      });
    });
  }

  function partnerYearStat(p, y) {
    ensureYearIndex();
    var v = (p.y || {})[y];
    return {
      s: v ? v[0] : 0,
      h: v ? v[1] : 0,
      so: (yearIndex.songs[p.n] || {})[y] || 0,
      ev: (yearIndex.events[p.n] || {})[y] || 0,
    };
  }

  function partnersFiltered() {
    var q = state.q.toLowerCase();
    var y = state.y;
    var list = partners.filter(function (p) {
      if (q && p.n.toLowerCase().indexOf(q) < 0) return false;
      if (y && !partnerYearStat(p, y).s) return false;
      return true;
    });
    function metric(p, key) {
      if (key === "so" || key === "ev") return y ? partnerYearStat(p, y)[key] : key === "so" ? p.so : p.ev;
      if (y) return partnerYearStat(p, y)[key === "h" ? "h" : "s"];
      return key === "h" ? p.h : p.s;
    }
    return list.sort(function (a, b) {
      if (state.sort === "s") return metric(b, "s") - metric(a, "s");
      if (state.sort === "so") return metric(b, "so") - metric(a, "so");
      if (state.sort === "recent") return a.f > b.f ? -1 : 1;
      return metric(b, "h") - metric(a, "h");
    });
  }

  function searchField(placeholder) {
    return (
      '<label class="search-field">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13.5 13.5 18 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
      '<input id="search-input" type="search" value="' + esc(state.q) + '" placeholder="' + esc(placeholder) +
      '" aria-label="' + esc(placeholder) + '" autocomplete="off" spellcheck="false">' +
      "</label>"
    );
  }

  /* -------------------------------------------------------------- cards */
  /* コラボ相手タグ。3 人まで表示し、それを超える場合は「もっと見る」で全員表示。 */
  function streamTagsHtml(s) {
    var tags = "";
    if (s.c) tags += '<span class="tag is-plain">' + esc(s.c) + "</span>";
    // 「ソロ」は自明なのでタグからは省く（切り抜き・Shorts の下に出ないように）
    if (s.e && s.e !== "ソロ") tags += '<span class="tag is-plain">' + esc(s.e) + "</span>";
    var open = !!expandedTags[s.i];
    var list = open ? s.r : s.r.slice(0, 3);
    list.forEach(function (n) {
      tags += '<span class="tag"><button type="button" data-act="partner" data-v="' + esc(n) + '" title="' + esc(n) + "で絞り込む" + '">' + esc(n) + "</button></span>";
    });
    if (s.r.length > 3) {
      tags += '<span class="tag tag-more"><button type="button" data-act="tags" data-v="' + esc(s.i) +
        '" aria-expanded="' + open + '">' + (open ? "閉じる" : "もっと見る +" + (s.r.length - 3)) + "</button></span>";
    }
    if (!s.r.length && s.k === "live") tags += '<span class="tag is-plain">ソロ</span>';
    return tags;
  }

  function streamCard(s, idx) {
    var thumb = thumbFor(s);
    // 左上のバッジ：切り抜き / Shorts / 歌 / 公式番組 / 番組 / ライブ / 配信（案件は配信の隣に追加）
    var typeCls = s.k === "clip" ? "is-clip" : s.k === "short" ? "is-short" : CONTENT_BADGE[s.c] ? "is-content" : "is-live";
    var typeLabel = s.k === "clip" ? "切り抜き" : s.k === "short" ? "Shorts" : CONTENT_BADGE[s.c] || "配信";
    var extraBadge = s.k === "live" && s.c === "案件" ? "案件" : "";
    var d = dur(s.m);
    var tags = streamTagsHtml(s);

    return (
      '<article class="card" style="--i:' + (idx % 12) + '">' +
      '<div class="thumb">' +
      '<div class="thumb-fallback"><b>' + esc(PLATFORM[s.p] || "配信") + "</b><span>" + esc(fdate(s.d)) + "</span></div>" +
      (thumb
        ? '<img src="' + thumb + '" width="320" height="180" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="" onload="this.classList.add(\'is-loaded\')" onerror="this.remove()">'
        : "") +
      '<span class="badge-row">' +
        '<span class="badge ' + typeCls + '">' + esc(typeLabel) + "</span>" +
        (extraBadge ? '<span class="badge is-extra">' + esc(extraBadge) + "</span>" : "") +
        "</span>" +
      (d ? '<span class="badge badge-bottom-right is-time">' + esc(d) + "</span>" : "") +
      "</div>" +
      '<div class="card-body">' +
      '<div class="card-meta"><span>' + esc(fdate(s.d)) + "</span>" + (s.n ? "<span>·</span><span>" + esc(s.n.slice(0, 22)) + "</span>" : "") + "</div>" +
      '<h3 class="card-title">' +
      (s.u ? '<a href="' + esc(s.u) + '" target="_blank" rel="noopener noreferrer">' + esc(s.t) + "</a>" : esc(s.t)) +
      "</h3>" +
      '<div class="card-foot">' + tags + "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function songRow(s, idx) {
    var flags = [];
    if (s.f && s.f.movie) flags.push("動画");
    if (s.f && s.f.offline) flags.push("オフライン");
    if (s.f && s.f.online) flags.push("オンライン");
    if (s.f && s.f.cd) flags.push("CD");
    return (
      '<li class="record" style="--i:' + (idx % 12) + '">' +
      '<div class="record-top">' +
      '<span class="record-title">' +
      (s.u ? '<a href="' + esc(s.u) + '" target="_blank" rel="noopener noreferrer">▶ ' + esc(s.t) + "</a>" : esc(s.t)) +
      "</span>" +
      '<span class="record-date">' + esc(fdate(s.d)) + "</span>" +
      "</div>" +
      '<div class="record-sub">' +
      (s.k ? '<span><span class="k">分類</span><span class="v">' + esc(s.k) + "</span></span>" : "") +
      (s.e ? '<span><span class="k">ユニット</span><span class="v">' + esc(s.e) + "</span></span>" : "") +
      (s.r.length ? '<span><span class="k">メンバー</span><span class="v">' + esc(s.r.join("、")) + "</span></span>" : "") +
      (flags.length ? '<span><span class="k">展開</span><span class="v">' + esc(flags.join(" / ")) + "</span></span>" : "") +
      (s.n ? '<span><span class="k">備考</span><span class="v">' + esc(s.n) + "</span></span>" : "") +
      "</div></li>"
    );
  }

  function eventRow(e, idx) {
    var rk = resultRank(e.result);
    var resHtml = "";
    if (e.result) {
      if (rk === "champion" || rk === "runnerup" || rk === "third") {
        var cls = rk === "champion" ? "is-champion" : rk === "runnerup" ? "is-second" : "is-third";
        var label = RESULT_LABEL[rk];
        var extra = String(e.result).trim() === label ? "" : " " + esc(e.result);
        resHtml = '<span class="v result-v"><span class="result-badge ' + cls + '">' + esc(label) + "</span>" + extra + "</span>";
      } else {
        resHtml = '<span class="v">' + esc(e.result) + "</span>";
      }
    }
    return (
      '<li class="record' + (rk === "champion" ? " is-champion" : "") + '" style="--i:' + (idx % 12) + '">' +
      '<div class="record-top">' +
      '<span class="record-date">' + esc(e.dateText || fdate(e.date)) + "</span>" +
      '<span class="record-title">' +
      (e.announce ? '<a href="' + esc(e.announce) + '" target="_blank" rel="noopener noreferrer">' + esc(e.name) + "</a>" : esc(e.name)) +
      "</span>" +
      (e.playlist ? '<a class="tag is-accent" href="' + esc(e.playlist) + '" target="_blank" rel="noopener noreferrer">再生リスト</a>' : "") +
      "</div>" +
      '<div class="record-sub">' +
      (e.content ? '<span><span class="k">内容</span><span class="v">' + esc(e.content) + "</span></span>" : "") +
      (e.team ? '<span><span class="k">チーム</span><span class="v">' + esc(e.team) + "</span></span>" : "") +
      (e.result ? '<span><span class="k">成績</span>' + resHtml + "</span>" : "") +
      (e.members.length ? '<span><span class="k">メンバー</span><span class="v">' + esc(e.members.join("、")) + "</span></span>" : "") +
      (e.note ? '<span><span class="k">備考</span><span class="v">' + esc(e.note) + "</span></span>" : "") +
      "</div></li>"
    );
  }

  function goodsRow(g, idx) {
    return (
      '<li class="record" style="--i:' + (idx % 12) + '">' +
      '<div class="record-top">' +
      '<span class="record-date">' + esc(fdate(g.d)) + "</span>" +
      '<span class="record-title">' + esc(g.t) + "</span>" +
      "</div>" +
      '<div class="record-sub">' +
      (g.k ? '<span><span class="k">種類</span><span class="v">' + esc(g.k) + "</span></span>" : "") +
      (g.n ? '<span><span class="k">備考</span><span class="v">' + esc(g.n) + "</span></span>" : "") +
      "</div></li>"
    );
  }

  /* --------------------------------------------------------------- views */
  function viewSummary() {
    var c = meta.counts || {};
    var coverCount = 0, origCount = 0;
    songs.forEach(function (s) {
      if (s.k === "カバー") coverCount++;
      else if (s.k === "オリジナル") origCount++;
    });
    var peak = (meta.subscribers || []).slice().sort(function (a, b) { return b.n - a.n; })[0] || { n: 0, d: "" };
    var avg = c.live ? (c.hours / c.live) : 0;

    var kpi = [
      { label: "チャンネル登録者", value: num(peak.n), unit: "人", sub: peak.d ? fdate(peak.d) + " 時点の記録" : "記録なし" },
      { label: "配信アーカイブ", value: num(c.streams), unit: "本", sub: "うち配信 " + num(c.live) + " 本" },
      { label: "配信の合計", value: num(c.hours), unit: "時間", sub: "1 本あたり平均 " + num(avg, 1) + " 時間" },
      { label: "歌", value: num(c.songs), unit: "曲", sub: "カバー " + num(coverCount) + " / オリジナル " + num(origCount) },
      { label: "大会・企画", value: num(c.events), unit: "件", sub: "チーム戦・企画配信の記録" },
      { label: "コラボ相手", value: num(c.partners), unit: "人", sub: "配信・楽曲・大会の共演から" },
    ];

    var kpiHtml = kpi.map(function (k) {
      return '<div class="kpi"><div class="k-label">' + esc(k.label) + '</div><div class="k-value">' + k.value +
        "<small>" + esc(k.unit) + "</small></div><div class=\"k-sub\">" + esc(k.sub) + "</div></div>";
    }).join("");

    var timeline = (meta.milestones || []).map(function (m) {
      return '<li><div class="t-date">' + esc(fdate(m.d)) + '</div><div class="t-label">' + esc(m.label) + "</div></li>";
    }).join("");

    var topPartners = (partners || []).slice(0, 12).map(function (p) {
      return { name: p.n, value: p.h, count: p.s };
    });
    var maxP = topPartners.length ? topPartners[0].value : 1;

    var barRows = function (items, unit) {
      return items.map(function (it) {
        var pct = Math.max(2, (it.value / (unit === "h" ? maxP : items[0].value)) * 100);
        return (
          '<div class="bar-row">' +
          '<a class="b-name" href="' + (it.href || "#") + '" title="' + esc(it.name) + '">' + esc(it.name) + "</a>" +
          '<div class="b-track"><div class="b-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
          '<div class="b-value">' + (unit === "h" ? num(it.value, 0) + " h" : num(it.value) + " 本") + "</div>" +
          "</div>"
        );
      }).join("");
    };

    var partnerBars = barRows(
      topPartners.map(function (p) {
        return { name: p.name, value: p.value, href: partnerLink(p.name) };
      }),
      "h"
    );

    var games = (stats.games || []).slice(0, 10);
    var maxG = games.length ? games[0].h : 1;
    var gameBars = games.map(function (g) {
      var pct = Math.max(2, (g.h / maxG) * 100);
      return (
        '<div class="bar-row">' +
        '<button type="button" class="b-name" style="all:unset;cursor:pointer;font:inherit;color:inherit" data-act="content" data-v="' + esc(g.name) + '">' + esc(g.name) + "</button>" +
        '<div class="b-track"><div class="b-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '<div class="b-value">' + num(g.h, 0) + " h</div>" +
        "</div>"
      );
    }).join("");

    var links = (meta.links || []).map(function (l) {
      return '<a class="link-card" href="' + esc(l.url || "#") + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="l-label">' + esc(l.label) + '</span><span class="l-text">' + esc(l.text) + "</span></a>";
    }).join("");

    var collections = meta.collections || [];
    var gameCols = collections.filter(function (x) { return x.t === "game"; });
    var listCols = collections.filter(function (x) { return x.t !== "game"; });

    var colHtml = gameCols.map(function (x) {
      var label = x.c || x.g;
      return (
        '<a class="link-card" href="' + esc(x.u || "#") + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="l-label">' + esc(x.l ? "2023年まで" : "公式リスト") + "</span>" +
        '<span class="l-text">' + esc(label) + "</span></a>"
      );
    }).join("");
    var listHtml = listCols.map(function (x) {
      return (
        '<a class="link-card" href="' + esc(x.u || "#") + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="l-label">公式再生リスト</span><span class="l-text">' + esc(x.c) + "</span></a>"
      );
    }).join("");

    var heatYear = Number(state.heatYear || latestYear());
    var heatRows = (stats.monthly || []).filter(function (r) { return r.y === heatYear; });
    var heatSum = heatRows.reduce(function (acc, r) {
      acc.lh += r.lh; acc.n += r.n; acc.cn += r.cn; acc.sn += r.sn; return acc;
    }, { lh: 0, n: 0, cn: 0, sn: 0 });
    var heatTable =
      '<details class="disclosure" style="margin-top:12px"><summary>' + heatYear +
      " 年の数値を表で見る</summary><div class=\"disc-body\"><div class=\"table-wrap\"><table class=\"data\">" +
      "<caption>" + heatYear + " 年の月別記録（時間は配信の合計）</caption><thead><tr>" +
      '<th scope="col">月</th><th scope="col">配信時間</th><th scope="col">配信</th><th scope="col">切り抜き</th><th scope="col">Shorts</th>' +
      "</tr></thead><tbody>" +
      heatRows.map(function (r) {
        return "<tr><td>" + r.m + " 月</td><td class=\"num\">" + num(r.lh, 1) + " h</td><td class=\"num\">" +
          num(r.n) + "</td><td class=\"num\">" + num(r.cn) + "</td><td class=\"num\">" + num(r.sn) + "</td></tr>";
      }).join("") +
      '<tr><td><b>合計</b></td><td class="num"><b>' + num(heatSum.lh, 1) + ' h</b></td><td class="num"><b>' +
      num(heatSum.n) + '</b></td><td class="num"><b>' + num(heatSum.cn) + '</b></td><td class="num"><b>' +
      num(heatSum.sn) + "</b></td></tr>" +
      "</tbody></table></div></div></details>";

    var allMonthly = (stats.monthly || []).slice().sort(function (a, b) {
      return a.y * 12 + a.m - (b.y * 12 + b.m);
    });
    var monthlyTable =
      '<details class="disclosure" style="margin-top:12px"><summary>月別の数値を表で見る（全期間）</summary>' +
      '<div class="disc-body"><div class="table-wrap"><table class="data"><caption>月別の記録（' +
      allMonthly.length + ' か月分）</caption><thead><tr><th scope="col">年月</th>' +
      '<th scope="col">配信時間</th><th scope="col">配信</th><th scope="col">切り抜き</th><th scope="col">Shorts</th>' +
      "</tr></thead><tbody>" +
      allMonthly.map(function (r) {
        return "<tr><td>" + r.y + "." + pad2(r.m) + '</td><td class="num">' + num(r.lh, 1) +
          ' h</td><td class="num">' + num(r.n) + '</td><td class="num">' + num(r.cn) +
          '</td><td class="num">' + num(r.sn) + "</td></tr>";
      }).join("") +
      "</tbody></table></div></div></details>";

    return (
      '<section class="hero reveal">' +
      '<div class="kicker">Nijisanji / VTuber</div>' +
      "<h1>葛葉<span>KUZUHA &nbsp; DATA &nbsp; ARCHIVE</span></h1>" +
      '<p class="lede">配信、歌、大会、コラボ相手。2018 年から 2026 年までの記録を、ひとつのアーカイブにまとめました。気になるコラボ相手から、その人の歴史をたどれます。</p>' +
      '<div class="hero-facts">' +
      "<span>記録期間 <b>" + esc(fdate(meta.range && meta.range[0])) + " – " + esc(fdate(meta.range && meta.range[1])) + "</b></span>" +
      "<span>配信 <b>" + num(c.live) + "</b> 本</span>" +
      "<span>コラボ相手 <b>" + num(c.partners) + "</b> 人</span>" +
      "<span>更新 <b>" + esc(fdate(meta.generated)) + "</b></span>" +
      "</div>" +
      '<div class="hero-actions">' +
      '<a class="btn btn-primary" href="#/streams">配信を見る' +
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
      '<a class="btn btn-ghost" href="#/collabs">コラボ相手から探す</a>' +
      '<a class="btn btn-ghost" href="#/songs">歌をひらく</a>' +
      "</div></section>" +
      '<section class="kpi-grid reveal" aria-label="アーカイブの概要">' + kpiHtml + "</section>" +
      '<div class="two-col is-wide">' +
      '<section class="panel"><div class="panel-head"><h2>年別の配信時間</h2><span class="sub">配信＋切り抜きの合計</span></div>' +
      '<div class="chart-frame" id="chart-yearly"></div>' +
      '<p class="rail-note" style="margin-top:10px">棒を選ぶと、その年の配信一覧へ移動します。</p></section>' +
      '<section class="panel"><div class="panel-head"><h2>あゆみ</h2><span class="sub">記録に残る主な出来事</span></div>' +
      '<ol class="timeline">' + timeline + "</ol></section>" +
      "</div>" +
      '<section class="panel"><div class="panel-head"><h2>月別の配信時間</h2><span class="sub">2018.03 – 2026.11</span></div>' +
      '<div class="chart-frame" id="chart-trend"></div>' +
      '<div class="chart-legend"><span><i></i>配信の合計時間</span><span>点を選ぶと、その月の配信一覧へ移動します。</span></div>' +
      monthlyTable + "</section>" +
      '<section class="panel"><div class="panel-head"><h2>配信カレンダー</h2><span class="sub">1 日の配信時間（濃いほど長い）</span></div>' +
      '<div class="pill-row" id="heat-years" style="margin-bottom:10px"></div>' +
      '<div class="heat-wrap" id="chart-heat"></div>' + heatTable + "</section>" +
      '<div class="two-col">' +
      '<section class="panel"><div class="panel-head"><h2>よく共演する相手</h2><a class="hint" href="#/collabs">すべて見る →</a></div>' +
      '<div class="bar-list">' + partnerBars + "</div></section>" +
      '<section class="panel"><div class="panel-head"><h2>よく遊ぶゲーム</h2><span class="sub">配信の内容から</span></div>' +
      '<div class="bar-list">' + gameBars + "</div></section>" +
      "</div>" +
      '<section class="panel"><div class="panel-head"><h2>チャンネル登録者数の推移</h2><span class="sub">記録されたマイルストーン</span></div>' +
      '<div class="chart-frame" id="chart-subs"></div></section>' +
      '<section class="panel"><div class="panel-head"><h2>公式リンク</h2><span class="sub">一次情報への入口</span></div>' +
      '<div class="link-grid">' + links + "</div></section>" +
      '<details class="disclosure"><summary>アーカイブ（公式再生リスト）を開く</summary>' +
      '<div class="disc-body"><div class="link-grid">' + colHtml + listHtml + "</div></div></details>" +
      '<section class="panel"><div class="panel-head"><h2>このデータについて</h2></div>' +
      '<div class="rail-note" style="font-size:12.5px;line-height:1.9">' +
      "<p>・出典は「葛葉倉庫 2018–2026」の記録です。配信時間は各配信の尺を合計したもので、切り抜き・Shorts は別に集計しています。</p>" +
      "<p>・コラボ相手の時間は、同じ配信に複数人が出演する場合それぞれに加算しています（重複あり）。そのため合計は実際の配信時間より大きくなります。</p>" +
      "<p>・初ツイートと VTuber デビューの日付は、記録側の年表記に誤りがあったため、配信記録の開始時期に合わせて 2018 年として掲載しています。</p>" +
      "<p>・リンク切れ・非公開の動画は、配信元の表示のみでリンクが開けない場合があります。</p>" +
      "<p>・2026 年 11 月 26 日時点の記録で、進行中の月は途中までの集計です。</p>" +
      "</div></section>"
    );
  }

  function viewStreamsSkeleton() {
    return '<div class="page-head"><h1>配信アーカイブ</h1><p>配信の尺・内容・コラボ相手から、2018 年からの記録をたどれます。</p></div>' +
      '<div class="skeleton">配信データを読み込んでいます…</div>';
  }

  function viewStreams() {
    var list = streamsFiltered();
    list = sortStreams(list);
    var shown = list.slice(0, state.limit);
    var cards = shown.map(streamCard).join("");

    return (
      '<div class="page-head"><h1>配信アーカイブ</h1>' +
      "<p>配信のタイトル・サムネイル・尺・コラボ相手を一覧できます。コラボ相手や年、内容で絞り込むと、この条件は歌・大会の画面にも引き継がれます。</p></div>" +
      filterSummaryHtml() +
      '<div class="toolbar-row">' +
      searchField("タイトル・ゲーム名で検索") +
      '<span class="count-line" aria-live="polite"><b>' + num(list.length) + "</b> 件中 <b>" + num(shown.length) + "</b> 件を表示</span>" +
      '<span class="spacer"></span>' +
      '<label class="count-line" for="sort-streams">並び順</label>' +
      '<select class="select" id="sort-streams" data-act="sortsel">' +
      '<option value="new"' + (state.sort === "new" ? " selected" : "") + ">新しい順</option>" +
      '<option value="old"' + (state.sort === "old" ? " selected" : "") + ">古い順</option>" +
      '<option value="dur"' + (state.sort === "dur" ? " selected" : "") + ">配信時間が長い順</option>" +
      "</select></div>" +
      (list.length
        ? '<div class="grid-cards reveal">' + cards + "</div>" +
          (list.length > shown.length
            ? '<button type="button" class="load-more" data-act="more">さらに表示（残り ' + num(list.length - shown.length) + " 件）</button>"
            : "")
        : emptyState("条件に一致する配信がありません。", "コラボ相手や年を変えて、もう一度お試しください。"))
    );
  }

  /* 1 曲ぶんのまとめ表示：曲名・分類・歌唱の一覧（日付 / ユニット / メンバー） */
  function songGroupCard(g, idx) {
    var takes = g.rows.map(function (s) {
      var flags = [];
      if (s.f && s.f.movie) flags.push("動画");
      if (s.f && s.f.offline) flags.push("オフライン");
      if (s.f && s.f.online) flags.push("オンライン");
      if (s.f && s.f.cd) flags.push("CD");
      var meta = flags.join(" / ");
      if (s.n) meta = meta ? meta + " ・ " + s.n : s.n;
      return (
        '<li class="take">' +
        '<span class="take-date">' + esc(fdate(s.d)) + "</span>" +
        '<span class="take-unit">' + esc(s.e || "—") + "</span>" +
        '<span class="take-members">' + esc(s.r.length ? s.r.join("、") : "ソロ") + "</span>" +
        '<span class="take-meta">' + esc(meta) + "</span>" +
        (s.u
          ? '<a class="take-link" href="' + esc(s.u) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(s.t) + " の動画を開く" + '">▶</a>'
          : '<span class="take-link is-none" aria-hidden="true">—</span>') +
        "</li>"
      );
    }).join("");

    var tags = g.kinds
      .map(function (k) { return '<span class="tag is-plain">' + esc(k) + "</span>"; })
      .join("");
    var units = [];
    g.rows.forEach(function (s) {
      if (s.e && units.indexOf(s.e) < 0) units.push(s.e);
    });
    tags += units
      .map(function (u) { return '<span class="tag is-plain">' + esc(u) + "</span>"; })
      .join("");
    var span =
      g.first.slice(0, 4) === g.last.slice(0, 4)
        ? g.first.slice(0, 4)
        : g.first.slice(0, 4) + "–" + g.last.slice(0, 4);

    return (
      '<li class="record song-group" style="--i:' + (idx % 12) + '">' +
      '<div class="record-top">' +
      '<span class="record-title">' + esc(g.title) + "</span>" +
      '<span class="record-date">' + esc(span) + " ・ " + num(g.rows.length) + " 回</span>" +
      "</div>" +
      (tags ? '<div class="song-tags">' + tags + "</div>" : "") +
      '<ol class="song-takes">' + takes + "</ol>" +
      "</li>"
    );
  }

  function viewSongs() {
    var list = songsFiltered();
    var groups = songGroups(list);
    var shown = groups.slice(0, state.limit);
    var rows = shown.map(songGroupCard).join("");
    return (
      '<div class="page-head"><h1>歌</h1>' +
      "<p>歌ってみた、オリジナル曲、ユニット曲をまとめています。同じ曲は 1 件にまとめ、歌唱日・メンバーごとに並べています。</p></div>" +
      filterSummaryHtml() +
      '<div class="toolbar-row">' +
      searchField("曲名・ユニットで検索") +
      '<span class="count-line" aria-live="polite"><b>' + num(groups.length) + "</b> 曲 / <b>" + num(list.length) +
      "</b> 歌唱のうち <b>" + num(shown.length) + "</b> 曲を表示</span>" +
      '<span class="spacer"></span>' +
      '<span class="count-line">最新の歌唱順</span></div>' +
      (list.length
        ? '<ol class="record-list reveal">' + rows + "</ol>" +
          (groups.length > shown.length
            ? '<button type="button" class="load-more" data-act="more">さらに表示（残り ' + num(groups.length - shown.length) + " 曲）</button>"
            : "")
        : emptyState("条件に一致する楽曲がありません。", "分類・ユニット・コラボ相手を変えてお試しください。"))
    );
  }

  function viewEvents() {
    var isGoods = state.tab === "goods";
    var list = isGoods ? goodsFiltered() : eventsFiltered();
    var shown = list.slice(0, state.limit);
    var rows = isGoods ? shown.map(goodsRow).join("") : shown.map(eventRow).join("");
    var champions = 0;
    if (!isGoods) {
      champions = list.filter(function (e) { return resultRank(e.result) === "champion"; }).length;
    }

    return (
      '<div class="page-head"><h1>大会・企画</h1>' +
      "<p>参加した大会・企画の記録と、ライブ・グッズなどのイベント履歴です。メンバーで絞り込むと、大会と配信の両方から同じ相手をたどれます。</p></div>" +
      '<div class="pill-row" style="margin-bottom:14px" role="group" aria-label="表示する記録">' +
      '<button type="button" class="chip" data-act="tab" data-v="events" aria-pressed="' + (!isGoods) + '">大会・企画<span class="n">' + num(events.length) + "</span></button>" +
      '<button type="button" class="chip" data-act="tab" data-v="goods" aria-pressed="' + isGoods + '">イベント・グッズ<span class="n">' + num(goods.length) + "</span></button>" +
      "</div>" +
      filterSummaryHtml() +
      '<div class="toolbar-row">' +
      searchField(isGoods ? "商品名・種類で検索" : "大会名・メンバーで検索") +
      (isGoods ? "" : '<span class="count-line champion-line"><span class="result-badge is-champion">優勝</span><b>' + num(champions) + "</b> 件</span>") +
      '<span class="count-line" aria-live="polite"><b>' + num(list.length) + "</b> 件中 <b>" + num(shown.length) + "</b> 件を表示</span></div>" +
      (list.length
        ? '<ol class="record-list reveal">' + rows + "</ol>" +
          (list.length > shown.length
            ? '<button type="button" class="load-more" data-act="more">さらに表示（残り ' + num(list.length - shown.length) + " 件）</button>"
            : "")
        : emptyState("条件に一致する記録がありません。", isGoods ? "種類や年を変えてお試しください。" : "メンバーや年を変えてお試しください。"))
    );
  }

  function partnerDetail(p) {
    var y = state.y;
    var inYear = function (d) { return !y || String(d || "").slice(0, 4) === y; };
    var allList = (streams || []).filter(function (s) { return s.r.indexOf(p.n) >= 0; })
      .sort(function (a, b) { return a.d > b.d ? -1 : 1; });
    var list = y ? allList.filter(function (s) { return inYear(s.d); }) : allList;
    var recent = list.slice(0, 6);
    // 「一緒の曲」「一緒の大会」は最新順に並べ、上から新しい 6 件を見せる
    var songsWithAll = songs
      .filter(function (s) { return s.r.indexOf(p.n) >= 0 && inYear(s.d); })
      .sort(function (a, b) { return a.d > b.d ? -1 : 1; });
    var eventsWithAll = events
      .filter(function (e) { return e.members.indexOf(p.n) >= 0 && inYear(e.date); })
      .sort(function (a, b) { return (a.date || "") > (b.date || "") ? -1 : 1; });
    var songsWith = songsWithAll.slice(0, 6);
    var eventsWith = eventsWithAll.slice(0, 6);
    var st = y ? partnerYearStat(p, y) : { s: p.s, h: p.h, so: p.so, ev: p.ev };
    var firstDate = list.length ? list[list.length - 1].d : y ? "" : p.l;
    var lastDate = list.length ? list[0].d : y ? "" : p.f;

    var yearly = {};
    allList.forEach(function (s) {
      if (s.k !== "live") return;
      var yr = s.d.slice(0, 4);
      yearly[yr] = (yearly[yr] || 0) + s.m / 60;
    });
    var yKeys = Object.keys(yearly).sort();
    var maxY = Math.max.apply(null, yKeys.map(function (k) { return yearly[k]; }).concat([1]));
    var miniBars = yKeys.map(function (k) {
      return (
        '<div class="bar-row' + (y === k ? " is-on" : "") + '">' +
        '<span class="b-name">' + k + " 年</span>" +
        '<div class="b-track"><div class="b-fill" style="width:' + Math.max(2, (yearly[k] / maxY) * 100).toFixed(1) + '%"></div></div>' +
        '<div class="b-value">' + num(yearly[k], 0) + " h</div>" +
        "</div>"
      );
    }).join("");

    var yearChips = '<div class="pill-row" style="margin-top:14px" role="group" aria-label="年で絞り込む">' +
      '<button type="button" class="chip" data-act="year" data-y="" aria-pressed="' + (y ? "false" : "true") + '">全期間</button>' +
      yKeys.slice().reverse().map(function (k) {
        return (
          '<button type="button" class="chip" data-act="year" data-y="' + k + '" aria-pressed="' + (y === k ? "true" : "false") + '">' +
          k + ' 年<span class="n">' + num(yearly[k], 0) + "h</span></button>"
        );
      }).join("") +
      "</div>";

    return (
      '<div class="page-head"><h1><span class="accent">' + esc(p.n) + "</span> との記録" +
      (y ? ' <span class="year-badge">' + esc(y) + " 年</span>" : "") + "</h1>" +
      "<p>このコラボ相手と一緒に出演した配信・楽曲・大会をまとめています。共演時間は配信の尺をそのまま加算したものです。</p></div>" +
      '<div class="panel">' +
      '<div class="stat-inline" style="margin-bottom:14px">' +
      "<span>共演配信 <b>" + num(st.s) + "</b> 本</span>" +
      "<span>共演時間 <b>" + num(st.h, 1) + "</b> 時間</span>" +
      "<span>一緒の曲 <b>" + num(st.so) + "</b> 曲</span>" +
      "<span>大会 <b>" + num(st.ev) + "</b> 件</span>" +
      (firstDate ? "<span>初共演 <b>" + esc(fdate(firstDate)) + "</b></span>" : "") +
      (lastDate ? "<span>最終共演 <b>" + esc(fdate(lastDate)) + "</b></span>" : "") +
      "</div>" +
      '<div class="bar-list">' + miniBars + "</div>" +
      yearChips +
      '<div class="pill-row" style="margin-top:16px">' +
      '<button type="button" class="btn btn-primary" data-act="partner" data-v="' + esc(p.n) + '">この相手で配信を絞り込む</button>' +
      '<a class="btn btn-ghost" href="#/collabs">コラボ相手一覧に戻る</a>' +
      "</div></div>" +
      '<section><div class="section-head"><h2><span class="eyebrow">Recent streams</span>最近の共演配信</h2><span class="hint">' +
      num(list.length) + " 本のうち " + num(recent.length) + " 本</span></div>" +
      '<div class="grid-cards reveal">' + recent.map(streamCard).join("") + "</div></section>" +
      (songsWith.length
        ? '<section><div class="section-head"><h2><span class="eyebrow">Songs</span>一緒の曲</h2><span class="hint">新しい順・' +
          num(songsWithAll.length) + " 曲中 " + num(songsWith.length) + " 曲</span></div><ol class=\"record-list\">" +
          songsWith.map(songRow).join("") + "</ol></section>"
        : "") +
      (eventsWith.length
        ? '<section><div class="section-head"><h2><span class="eyebrow">Events</span>一緒の大会</h2><span class="hint">新しい順・' +
          num(eventsWithAll.length) + " 件中 " + num(eventsWith.length) + " 件</span></div><ol class=\"record-list\">" +
          eventsWith.map(eventRow).join("") + "</ol></section>"
        : "")
    );
  }

  function viewCollabs() {
    if (state.p && !streams) {
      return '<div class="page-head"><h1>コラボ相手</h1><p>記録を読み込んでいます。</p></div><div class="skeleton">コラボ相手の記録を読み込んでいます…</div>';
    }
    var selected = null;
    if (state.p) {
      selected = partners.filter(function (p) { return p.n === state.p; })[0] || null;
    }
    if (selected) return partnerDetail(selected);

    var list = partnersFiltered();
    var shown = list.slice(0, state.limit);
    var y = state.y;
    var maxH = 1;
    list.forEach(function (p) {
      var h = y ? partnerYearStat(p, y).h : p.h;
      if (h > maxH) maxH = h;
    });
    var cards = shown.map(function (p) {
      var st = y ? partnerYearStat(p, y) : { s: p.s, h: p.h, so: p.so, ev: p.ev };
      return (
        '<a class="partner-card" href="#/collabs?p=' + encodeURIComponent(p.n) + (y ? "&y=" + y : "") + '">' +
        '<span class="p-name">' + esc(p.n) + "</span>" +
        '<span class="p-stat"><b>' + num(st.h, 1) + "</b> 時間 / <b>" + num(st.s) + "</b> 本</span>" +
        '<span class="p-stat">曲 ' + num(st.so) + " / 大会 " + num(st.ev) + " / 最終 " + esc(fdate(p.f)) + "</span>" +
        '<span class="p-mini"><i style="width:' + Math.max(2, (st.h / maxH) * 100).toFixed(1) + '%"></i></span>' +
        "</a>"
      );
    }).join("");

    return (
      '<div class="page-head"><h1>コラボ相手</h1>' +
      "<p>葛葉と一緒に配信・楽曲・大会に出演した相手の一覧です。名前を選ぶと、その相手との記録だけをたどれます。年を選ぶと、その年の記録だけを集計します。</p></div>" +
      '<div class="toolbar-row">' +
      searchField("コラボ相手名で検索") +
      '<label class="count-line" for="sort-collabs">並び順</label>' +
      '<select class="select" id="sort-collabs" data-act="sortsel2">' +
      '<option value="h"' + (state.sort === "h" ? " selected" : "") + ">共演時間が多い順</option>" +
      '<option value="s"' + (state.sort === "s" ? " selected" : "") + ">共演配信が多い順</option>" +
      '<option value="so"' + (state.sort === "so" ? " selected" : "") + ">一緒の曲が多い順</option>" +
      '<option value="recent"' + (state.sort === "recent" ? " selected" : "") + ">最終共演が新しい順</option>" +
      "</select>" +
      '<span class="spacer"></span>' +
      '<span class="count-line" aria-live="polite">' +
      (y ? "<b>" + esc(y) + "</b> 年 ・ " : "") +
      "<b>" + num(list.length) + "</b> 人中 <b>" + num(shown.length) + "</b> 人を表示</span></div>" +
      (list.length
        ? '<div class="partner-grid reveal">' + cards + "</div>" +
          (list.length > shown.length
            ? '<button type="button" class="load-more" data-act="more">さらに表示（残り ' + num(list.length - shown.length) + " 人）</button>"
            : "")
        : emptyState(
            y ? y + " 年に共演したコラボ相手が見つかりません。" : "条件に一致するコラボ相手がいません。",
            y ? "年を解除すると、全期間から探せます。" : "名前の一部を入力して探すこともできます。"
          ))
    );
  }

  /* --------------------------------------------------------------- render */
  function renderContent() {
    var view = document.getElementById("view");
    if (!view) return;
    var html = "";
    if (state.route === "summary") html = viewSummary();
    else if (state.route === "streams") html = streams ? viewStreams() : viewStreamsSkeleton();
    else if (state.route === "songs") html = viewSongs();
    else if (state.route === "events") html = viewEvents();
    else if (state.route === "collabs") html = viewCollabs();
    view.innerHTML = html;

    if (state.route === "summary") mountSummaryCharts();
    if ((state.route === "streams" && !streams) || (state.route === "collabs" && state.p && !streams)) {
      ensureStreams().then(render).catch(function () {
        view.innerHTML = '<div class="empty"><b>データを読み込めませんでした。</b><p>再読み込みしてください。</p></div>';
      });
    }
  }

  function mountSummaryCharts() {
    if (Charts) {
      Charts.yearlyBars(document.getElementById("chart-yearly"), stats.yearly || []);
      Charts.trend(document.getElementById("chart-trend"), stats.monthly || []);
      Charts.subscribers(document.getElementById("chart-subs"), meta.subscribers || []);
    }
    var hy = Number(state.heatYear || latestYear());
    var heat = document.getElementById("chart-heat");
    var yearsEl = document.getElementById("heat-years");
    if (yearsEl) {
      var years = (stats.yearly || []).filter(function (r) { return r.n; }).map(function (r) { return r.y; });
      yearsEl.innerHTML = years.map(function (y) {
        return '<button type="button" class="chip" data-act="heatyear" data-v="' + y + '" aria-pressed="' +
          (hy === y ? "true" : "false") + '">' + y + "</button>";
      }).join("");
    }
    if (heat && Charts) Charts.heatmap(heat, stats.calendar || {}, hy);
  }

  function render() {
    renderNav();
    renderYearStrip();
    renderSiteSearch();
    renderRail();
    renderContent();
  }

  /* --------------------------------------------------------------- events */
  function setPartner(name) {
    var next = { p: name };
    if (state.route === "summary") next.route = "streams";
    setState(next);
  }

  function handleAction(el) {
    var act = el.getAttribute("data-act");
    var v = el.getAttribute("data-v");
    if (act === "suggest") {
      activateSuggest(Number(el.getAttribute("data-i")));
      return;
    }
    if (act === "year") {
      var y = el.getAttribute("data-y");
      if (y == null) y = el.getAttribute("data-v");
      if (state.route === "summary") {
        navigate("streams", { y: y || "", m: "" });
      } else {
        setState({ y: y === state.y ? "" : y, m: "" });
      }
    } else if (act === "partner") {
      setPartner(v === state.p ? "" : v);
    } else if (act === "month") {
      var yy = el.getAttribute("data-y");
      var mm = el.getAttribute("data-m");
      setState({ y: yy || "", m: mm || "" });
      if (state.route !== "streams") navigate("streams", { y: yy, m: mm });
    } else if (act === "content") {
      setState({ c: v === state.c ? "" : v });
      if (state.route !== "streams") navigate("streams", { c: v });
    } else if (act === "type") {
      setState({ t: v === state.t ? "" : v });
    } else if (act === "kind") {
      setState({ c: v === state.c ? "" : v });
    } else if (act === "unit") {
      setState({ u: el.getAttribute("data-v") === state.u ? "" : el.getAttribute("data-v") });
    } else if (act === "tags") {
      // カードの「もっと見る」：そのカードのタグだけを差し替える（ページ全体は再描画しない）
      if (expandedTags[v]) delete expandedTags[v];
      else expandedTags[v] = 1;
      var foot = el.closest ? el.closest(".card-foot") : null;
      var target = null;
      for (var si = 0; si < (streams || []).length; si++) {
        if (streams[si].i === v) { target = streams[si]; break; }
      }
      if (foot && target) foot.innerHTML = streamTagsHtml(target);
    } else if (act === "result") {
      setState({ r: v === state.r ? "" : v });
    } else if (act === "tab") {
      // イベント・グッズには参加メンバーが紐づかないので、切り替え時に条件を外す
      setState(v === "goods" ? { tab: v, p: "", limit: 60 } : { tab: v, limit: 60 });
    } else if (act === "heatyear") {
      state.heatYear = v;
      syncUrl();
      renderContent();
    } else if (act === "unset") {
      var k = el.getAttribute("data-k");
      var patch = { limit: 60 };
      if (k === "p") patch.p = "";
      if (k === "y") patch.y = "";
      if (k === "m") patch.m = "";
      if (k === "c") patch.c = "";
      if (k === "t") patch.t = "";
      if (k === "r") patch.r = "";
      if (k === "u") patch.u = "";
      setState(patch);
    } else if (act === "clear") {
      Object.assign(state, { p: "", y: "", m: "", c: "", t: "", q: "", u: "", r: "", limit: 60 });
      var input = siteSearchInput();
      if (input) input.value = "";
      closeSuggest();
      syncUrl();
      render();
    } else if (act === "more") {
      state.limit += 60;
      renderContent();
    } else if (act === "year-jump") {
      navigate("streams", { y: v, m: "" });
    }
  }

  function bindEvents() {
    document.addEventListener("click", function (ev) {
      var el = ev.target.closest("[data-act]");
      if (!el) return;
      var act = el.getAttribute("data-act");
      if (act === "sortsel" || act === "sortsel2") return;
      ev.preventDefault();
      handleAction(el);
    });

    document.addEventListener("change", function (ev) {
      var sel = ev.target;
      if (!sel || !sel.getAttribute) return;
      if (sel.getAttribute("data-act") === "sortsel") {
        setState({ sort: sel.value, limit: 60 });
      }
      if (sel.getAttribute("data-act") === "sortsel2") {
        var patch = { sort: sel.value, limit: 60 };
        setState(patch);
      }
    });

    var searchInput = siteSearchInput();
    if (searchInput) {
      var suggestTimer = null;
      searchInput.addEventListener("input", function () {
        var clear = document.getElementById("site-search-clear");
        if (clear) clear.hidden = !searchInput.value.trim();
        clearTimeout(suggestTimer);
        suggestTimer = setTimeout(refreshSuggest, 110);
      });
      searchInput.addEventListener("focus", function () {
        if (searchInput.value.trim()) refreshSuggest();
      });
      searchInput.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          submitSiteSearch();
          searchInput.blur();
          return;
        }
        if (ev.key === "Escape") {
          closeSuggest();
          return;
        }
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
          if (!suggest.open) refreshSuggest();
          if (!suggest.items.length) return;
          ev.preventDefault();
          var n = suggest.items.length;
          suggest.active = ev.key === "ArrowDown"
            ? (suggest.active + 1) % n
            : (suggest.active <= 0 ? n - 1 : suggest.active - 1);
          drawSuggest(suggest.items, searchInput.value.trim());
        }
      });
    }

    var searchClear = document.getElementById("site-search-clear");
    if (searchClear) {
      searchClear.addEventListener("click", function () {
        if (searchInput) searchInput.value = "";
        closeSuggest();
        if (state.p || state.q) setState({ p: "", q: "" });
      });
    }

    document.addEventListener("click", function (ev) {
      var combo = document.getElementById("site-combo");
      if (combo && !combo.contains(ev.target)) closeSuggest();
    });

    var railToggle = document.getElementById("rail-toggle");
    var rail = document.getElementById("rail");
    if (railToggle && rail) {
      railToggle.addEventListener("click", function () {
        var open = rail.classList.toggle("is-open");
        railToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    var searchTimer = null;
    document.addEventListener("input", function (ev) {
      if (ev.target.id !== "search-input") return;
      clearTimeout(searchTimer);
      var v = ev.target.value;
      searchTimer = setTimeout(function () {
        state.q = v;
        state.limit = 60;
        syncUrl();
        renderContent();
      }, 180);
    });

    window.addEventListener("hashchange", function () {
      closeSuggest();
      var parsed = parseHash();
      if (parsed.hy) parsed.heatYear = parsed.hy;
      if (sameState(parsed, state) && location.hash === currentHash()) return;
      Object.assign(state, parsed);
      render();
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }

  /* ----------------------------------------------------------------- boot */
  function boot() {
    if (Charts && Charts.installTooltips) Charts.installTooltips();
    var parsed = parseHash();
    Object.assign(state, parsed);
    if (!state.heatYear) state.heatYear = latestYear();
    var bd = document.getElementById("build-date");
    if (bd) bd.textContent = fdate(meta.generated);
    bindEvents();
    if (location.hash !== currentHash()) {
      history.replaceState(null, "", currentHash());
    }
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
