/* ==========================================================================
   葛葉 データアーカイブ — app.js
   古典スクリプト（バンドル不要・file:// でも動く）。hash ルーティング、
   絞り込み、描画、言語切替を担当する。
   ========================================================================== */
(function () {
  "use strict";

  var KZ = window.KZ || {};
  var Charts = window.KZCharts;
  var I18N = window.KZI18N;
  var ICON = window.KZIcon || function () { return ""; };
  var esc = Charts.esc;

  /* 静的資産のキャッシュ版数（index.html の ?v= と揃える。
     前端ファイルを変更したら index.html とここを同時に +1 する） */
  var ASSET_V = "5";

  function t(key, vars) {
    return I18N ? I18N.t(key, vars) : key;
  }

  var meta = KZ.meta || {};
  var stats = KZ.stats || {};
  var partners = KZ.partners || [];
  var songs = KZ.songs || [];
  var events = KZ.events || [];
  var goods = KZ.goods || [];
  var streams = KZ.streams || null;

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
    n: "",
  };

  /* カード上で「ほか N 人」を押した配信（配信ID → 1） */
  var expandedTags = Object.create(null);

  var routes = ["summary", "streams", "songs", "events", "collabs"];

  var RESULT_ORDER = ["champion", "runnerup", "third", "top10", "out", "other", "unknown"];

  /* 大会の成績を分類する。「準優勝」は「優勝」を含むので先に判定する。 */
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
    if (!min) return "";
    var total = Math.round(min);
    var h = Math.floor(total / 60);
    var m = total % 60;
    if (!h) return m + " " + t("unit.minutes");
    return h + " " + t("unit.hours") + (m ? " " + m + " " + t("unit.minutes") : "");
  }

  function hoursText(h, digits) {
    if (h == null || isNaN(h)) return "—";
    var d = digits == null ? (h >= 1000 ? 0 : 1) : digits;
    return num(h, d) + " " + t("unit.hours");
  }

  function thumbFor(s) {
    if (s.p === "youtube" && s.v) return "https://i.ytimg.com/vi/" + s.v + "/maxresdefault.jpg";
    return "";
  }

  function typeLabelOf(s) {
    if (s.k === "clip") return t("type.clip");
    if (s.k === "short") return t("type.short");
    if (s.c === "歌" || s.c === "歌ってみた") return t("type.song");
    if (s.c === "ライブ") return t("type.liveshow");
    if (s.c === "案件") return t("type.anken");
    if (s.c === "公式番組" || s.c === "番組") return t("type.bangumi");
    if (s.k === "live") return t("type.live");
    return s.c || t("type.live");
  }

  function partnerLink(name) {
    return "#/streams?p=" + encodeURIComponent(name);
  }

  function emptyState(message, showClear) {
    return (
      '<div class="empty">' +
      "<p>" + esc(message) + "</p>" +
      (showClear ? '<button type="button" class="btn-text" data-act="clear">' + esc(t("empty.clear")) + "</button>" : "") +
      "</div>"
    );
  }

  function hasFilters() {
    if (state.p && !(state.route === "events" && state.tab === "goods")) return true;
    return !!(state.y || state.m || state.c || state.t || state.r || state.u || state.n || state.q);
  }

  /* -------------------------------------------------------------- url/state */
  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, "");
    var qi = raw.indexOf("?");
    var path = qi < 0 ? raw : raw.slice(0, qi);
    var query = qi < 0 ? "" : raw.slice(qi + 1);
    var out = {
      route: routes.indexOf(path) >= 0 ? path : "summary",
      p: "", y: "", m: "", c: "", t: "", u: "", q: "", r: "", n: "",
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
    if (out.tab === "goods") out.p = "";
    return out;
  }

  function sameState(a, b) {
    return (
      a.route === b.route && a.p === b.p && a.y === b.y && a.m === b.m &&
      a.c === b.c && a.t === b.t && a.q === b.q && a.tab === b.tab && a.r === b.r &&
      a.u === b.u && a.n === b.n &&
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
    if (state.route === "songs" && state.n) parts.push("n=" + encodeURIComponent(state.n));
    if (state.route === "events" && state.tab !== "events") parts.push("tab=" + state.tab);
    if (state.route === "events" && state.r) parts.push("r=" + encodeURIComponent(state.r));
    if (state.route === "collabs" && state.sort !== "h") parts.push("sort=" + state.sort);
    if (state.route === "summary" && state.heatYear) parts.push("hy=" + state.heatYear);
    return "#/" + state.route + (parts.length ? "?" + parts.join("&") : "");
  }

  function latestYear() {
    var years = (stats.yearly || [])
      .filter(function (r) { return r.n; })
      .map(function (r) { return r.y; });
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
      s.src = "assets/data/streams.js?v=" + ASSET_V;
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
  function renderChrome() {
    if (document.querySelectorAll) {
      document.querySelectorAll("[data-nav]").forEach(function (a) {
        if (a.getAttribute("data-nav") === state.route) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
    }
    document.title = t("doc.title", { page: t("page." + state.route) });
  }

  /* ------------------------------------------------------ mobile nav drawer */
  var navState = { open: false, lastFocus: null };

  function setNav(open) {
    var nav = document.getElementById("site-nav");
    var toggle = document.getElementById("nav-toggle");
    var scrim = document.getElementById("nav-scrim");
    if (!nav || !toggle) return;
    var next = !!open;
    if (next === navState.open) return;
    navState.open = next;
    if (next) navState.lastFocus = document.activeElement;
    if (nav.classList) nav.classList.toggle("is-open", next);
    if (scrim && scrim.classList) scrim.classList.toggle("is-open", next);
    if (document.body && document.body.classList) {
      document.body.classList.toggle("is-nav-open", next);
    }
    toggle.setAttribute("aria-expanded", String(next));
    // data-i18n-aria も切り替えておくと、言語切替後の applyStatic でも文言が揃う。
    toggle.setAttribute("data-i18n-aria", next ? "nav.close" : "nav.open");
    toggle.setAttribute("aria-label", t(next ? "nav.close" : "nav.open"));
    if (next) {
      var first = nav.querySelector ? nav.querySelector("a") : null;
      if (first && first.focus) first.focus();
    } else {
      var back = navState.lastFocus;
      navState.lastFocus = null;
      if (back && back.focus && back !== document.body) back.focus();
    }
  }

  /* ------------------------------------------------ header global search */
  var suggest = { items: [], active: -1, open: false };

  function siteSearchInput() {
    return document.getElementById("site-search");
  }

  function searchBox() {
    return document.getElementById("search-box");
  }

  function openSearch() {
    var box = searchBox();
    var toggle = document.getElementById("search-toggle");
    if (!box) return;
    box.hidden = false;
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    var input = siteSearchInput();
    if (input && input.focus) input.focus();
  }

  function closeSearch() {
    closeSuggest();
    var box = searchBox();
    var toggle = document.getElementById("search-toggle");
    if (box) box.hidden = true;
    if (toggle) toggle.setAttribute("aria-expanded", "false");
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
    if (input && input.setAttribute) input.setAttribute("aria-expanded", "false");
  }

  function partnerHits(q) {
    var needle = q.toLowerCase();
    var hits = partners.filter(function (p) {
      return p.n.toLowerCase().indexOf(needle) >= 0;
    });
    hits.sort(function (a, b) {
      var pa = a.n.toLowerCase().indexOf(needle) === 0 ? 0 : 1;
      var pb = b.n.toLowerCase().indexOf(needle) === 0 ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return b.s - a.s;
    });
    return hits.slice(0, 5);
  }

  function streamHits(q) {
    if (!streams) return [];
    var needle = q.toLowerCase();
    var out = [];
    for (var i = 0; i < streams.length && out.length < 8; i++) {
      var s = streams[i];
      if (((s.t || "") + " " + (s.c || "") + " " + (s.e || "")).toLowerCase().indexOf(needle) >= 0) out.push(s);
    }
    return out;
  }

  function buildSuggest(q) {
    var items = [];
    partnerHits(q).forEach(function (p) {
      items.push({ k: "partner", label: p.n, sub: num(p.s) + " " + t("unit.times") + " ・ " + hoursText(p.h, 1), value: p.n });
    });
    streamHits(q).forEach(function (s) {
      items.push({ k: "stream", label: s.t, sub: fdate(s.d) + " ・ " + (s.c || s.e || ""), value: s.t });
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
        html +=
          '<div class="suggest-group" role="presentation">' +
          esc(it.k === "partner" ? t("search.group.partner") : t("search.group.stream")) +
          "</div>";
        lastKind = it.k;
      }
      html +=
        '<button type="button" class="suggest-item' + (i === suggest.active ? " is-active" : "") +
        '" role="option" id="sug-' + i + '" aria-selected="' + (i === suggest.active ? "true" : "false") +
        '" data-act="suggest" data-i="' + i + '">' +
        '<span class="s-label">' + esc(it.label) + "</span>" +
        '<span class="s-sub">' + esc(it.sub) + "</span></button>";
    });
    if (!items.length) html = '<p class="suggest-note">' + esc(t("search.none", { q: q })) + "</p>";
    if (!streams && q) html += '<p class="suggest-note">' + esc(t("search.loading")) + "</p>";
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
      ensureStreams()
        .then(function () {
          if (!suggest.open || !siteSearchInput()) return;
          if (siteSearchInput().value.trim() !== q) return;
          suggest.items = buildSuggest(q);
          drawSuggest(suggest.items, q);
        })
        .catch(function () {});
    }
  }

  function activateSuggest(i) {
    var it = suggest.items[i];
    if (!it) return false;
    var input = siteSearchInput();
    closeSuggest();
    if (it.k === "partner") {
      if (input) input.value = it.value;
      var toStreams = state.route === "summary";
      navigate(toStreams ? "streams" : state.route, { p: it.value, y: "", m: "", c: "", t: "", q: "" });
    } else {
      if (input) input.value = "";
      navigate("streams", { q: it.value, p: "", y: "", m: "", c: "", t: "" });
    }
    closeSearch();
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
      closeSearch();
      setPartner(ph[0].n);
      return;
    }
    closeSuggest();
    closeSearch();
    navigate("streams", { q: q, p: "", y: "", m: "", c: "", t: "" });
  }

  function renderSiteSearch() {
    var clear = document.getElementById("site-search-clear");
    var input = siteSearchInput();
    if (clear) clear.hidden = !(input && input.value);
  }

  /* ----------------------------------------------------------- filter bar */
  function hoverable() {
    try {
      return !!(window.matchMedia && window.matchMedia("(hover: hover) and (min-width: 1024px)").matches);
    } catch (e) {
      return false;
    }
  }

  function monthsForYear(y) {
    var h = {};
    (stats.monthly || []).forEach(function (r) {
      if (y && r.y !== Number(y)) return;
      h[r.m] = (h[r.m] || 0) + r.n;
    });
    var out = [];
    for (var i = 1; i <= 12; i++) {
      var n = h[i] || 0;
      if (!n) continue;
      out.push({ v: pad2(i), n: n });
    }
    return out;
  }

  function filterGroups() {
    var groups = [];
    if (state.route === "streams") {
      var years = (meta.years || []).map(function (y) {
        var h = 0;
        (stats.monthly || []).forEach(function (r) {
          if (r.y === Number(y)) h += r.n;
        });
        return { v: String(y), n: h };
      });
      groups.push({ act: "year", key: "y", label: t("filter.year"), items: years, sub: true });

      groups.push({ act: "month", key: "m", label: t("filter.month"), items: monthsForYear(state.y), pad: true });

      var partnerItems = partners.slice(0, 14).map(function (p) {
        return { v: p.n, n: p.s };
      });
      if (state.p && !partnerItems.some(function (x) { return x.v === state.p; })) {
        partnerItems.unshift({ v: state.p, n: 0 });
      }
      groups.push({ act: "partner", key: "p", label: t("filter.partner"), items: partnerItems });

      var contents = (stats.games || []).slice(0, 12).map(function (g) {
        return { v: g.name, n: g.count };
      });
      if (state.c && !contents.some(function (x) { return x.v === state.c; })) {
        contents.unshift({ v: state.c, n: 0 });
      }
      groups.push({ act: "content", key: "c", label: t("filter.content"), items: contents });

      var types = (stats.types || []).map(function (x) {
        return { v: x.k, n: x.n, label: t("type." + x.k) };
      });
      groups.push({ act: "type", key: "t", label: t("filter.type"), items: types });
      return groups;
    }

    if (state.route === "songs") {
      var kindCount = {};
      songs.forEach(function (s) {
        kindCount[s.k] = (kindCount[s.k] || 0) + 1;
      });
      var kinds = Object.keys(kindCount).map(function (k) {
        return { v: k, n: kindCount[k] };
      });
      groups.push({ act: "kind", key: "c", label: t("filter.category"), items: kinds });

      var unitCount = {};
      songs.forEach(function (s) {
        if (!s.e) return;
        unitCount[s.e] = (unitCount[s.e] || 0) + 1;
      });
      var units = Object.keys(unitCount)
        .sort(function (a, b) { return unitCount[b] - unitCount[a]; })
        .slice(0, 8)
        .map(function (u) { return { v: u, n: unitCount[u] }; });
      if (state.u && !units.some(function (x) { return x.v === state.u; })) units.unshift({ v: state.u, n: 0 });
      groups.push({ act: "unit", key: "u", label: t("filter.unit"), items: units });

      // 備考（＝歌ったイベント）で絞り込む。空欄の行は「イベントなし」なので一覧に出さない。
      var noteCount = {};
      songs.forEach(function (s) {
        var note = s.n || "";
        if (!note) return;
        noteCount[note] = (noteCount[note] || 0) + 1;
      });
      var notes = Object.keys(noteCount)
        .sort(function (a, b) { return noteCount[b] - noteCount[a] || (a < b ? -1 : 1); })
        .map(function (k) { return { v: k, n: noteCount[k] }; });
      if (state.n && !notes.some(function (x) { return x.v === state.n; })) {
        notes.unshift({ v: state.n, n: 0 });
      }
      groups.push({ act: "event", key: "n", label: t("filter.event"), items: notes });

      var top = partners
        .filter(function (p) { return p.so > 0; })
        .sort(function (a, b) { return b.so - a.so || b.s - a.s; })
        .slice(0, 10)
        .map(function (p) {
          return { v: p.n, n: p.so };
        });
      if (state.p && !top.some(function (x) { return x.v === state.p; })) top.unshift({ v: state.p, n: 0 });
      groups.push({ act: "partner", key: "p", label: t("filter.partner"), items: top });
      return groups;
    }

    if (state.route === "events") {
      if (state.tab !== "goods") {
        var rc = {};
        events.forEach(function (e) {
          var rk = resultRank(e.result);
          rc[rk] = (rc[rk] || 0) + 1;
        });
        var resultItems = RESULT_ORDER.filter(function (k) { return rc[k]; }).map(function (k) {
          return { v: k, n: rc[k], label: t("result." + k) };
        });
        groups.push({ act: "result", key: "r", label: t("filter.result"), items: resultItems });

        var cc = {};
        events.forEach(function (e) {
          if (!e.content) return;
          cc[e.content] = (cc[e.content] || 0) + 1;
        });
        var contentItems = Object.keys(cc)
          .sort(function (a, b) { return cc[b] - cc[a] || (a < b ? -1 : 1); })
          .slice(0, 14)
          .map(function (k) { return { v: k, n: cc[k] }; });
        if (state.c && !contentItems.some(function (x) { return x.v === state.c; })) {
          contentItems.unshift({ v: state.c, n: 0 });
        }
        groups.push({ act: "content", key: "c", label: t("filter.content"), items: contentItems });

        var members = partners.slice(0, 12).map(function (p) {
          return { v: p.n, n: p.ev || 0 };
        });
        if (state.p && !members.some(function (x) { return x.v === state.p; })) members.unshift({ v: state.p, n: 0 });
        groups.push({ act: "partner", key: "p", label: t("filter.member"), items: members });
      } else {
        var gk = {};
        goods.forEach(function (g) {
          gk[g.k] = (gk[g.k] || 0) + 1;
        });
        var gItems = Object.keys(gk)
          .sort(function (a, b) { return gk[b] - gk[a]; })
          .map(function (k) { return { v: k, n: gk[k] }; });
        groups.push({ act: "kind", key: "c", label: t("filter.kind"), items: gItems });
      }
      return groups;
    }

    if (state.route === "collabs") {
      var yc = {};
      partners.forEach(function (p) {
        Object.keys(p.y || {}).forEach(function (k) {
          if (p.y[k] && p.y[k][0]) yc[k] = (yc[k] || 0) + 1;
        });
      });
      var ys = Object.keys(yc)
        .sort()
        .reverse()
        .map(function (k) { return { v: k, n: yc[k] }; });
      groups.push({ act: "year", key: "y", label: t("filter.year"), items: ys });

      var recent;
      if (state.y) {
        recent = partners
          .filter(function (p) { return p.y && p.y[state.y] && p.y[state.y][0]; })
          .sort(function (a, b) { return b.y[state.y][0] - a.y[state.y][0]; })
          .slice(0, 12)
          .map(function (p) { return { v: p.n, n: p.y[state.y][0] }; });
      } else {
        recent = partners
          .filter(function (p) { return p.f && p.f >= "2025-01-01"; })
          .slice(0, 12)
          .map(function (p) { return { v: p.n, n: p.s }; });
      }
      groups.push({ act: "partner", key: "p", label: t("filter.partner"), items: recent });
      return groups;
    }

    return groups;
  }

  function filterValueLabel(group) {
    var v = state[group.key] || "";
    if (!v) return "";
    if (group.act === "year") return String(v);
    if (group.act === "month") return t("filter.monthValue", { m: Number(v) });
    if (group.act === "type") return t("type." + v);
    if (group.act === "result") return t("result." + v);
    return v;
  }

  function optionHtml(group, item) {
    var selected = String(state[group.key] || "") === String(item.v);
    var label = item.label != null ? item.label : item.v;
    if (group.pad) label = String(Number(item.v));
    var hasSub = !!(group.sub && item.v);
    return (
      '<button type="button" class="fopt" data-act="' + group.act + '" data-k="' + group.key +
      '" data-v="' + esc(item.v) + '"' +
      (group.act === "year" ? ' data-y="' + esc(item.v) + '"' : "") +
      (group.act === "month" ? ' data-m="' + esc(item.v) + '" data-y="' + esc(state.y) + '"' : "") +
      (hasSub ? ' data-sub="1"' : "") +
      ' aria-pressed="' + selected + '">' +
      '<span class="fopt-label">' + esc(String(label)) + "</span>" +
      (hasSub ? '<span class="chev is-right">' + ICON("chevron-down") + "</span>" : "") +
      (item.n ? '<span class="n" aria-hidden="true">' + num(item.n) + "</span>" : "") +
      "</button>"
    );
  }

  function groupHtml(group, idx) {
    var id = "fp-" + group.key + "-" + idx;
    var val = filterValueLabel(group);
    var items = [{ v: "", label: t("filter.all"), n: 0 }].concat(group.items);
    return (
      '<div class="filter" data-fg="' + idx + '" data-key="' + group.key + '">' +
      '<button type="button" class="filter-btn" aria-expanded="false" aria-controls="' + id + '">' +
      '<span class="f-label">' + esc(group.label) + "</span>" +
      (val ? '<span class="filter-val">' + esc(val) + "</span>" : "") +
      '<span class="chev">' + ICON("chevron-down") + "</span></button>" +
      '<div class="filter-panel" id="' + id + '" role="group" aria-label="' + esc(group.label) + '" hidden>' +
      items.map(function (item) { return optionHtml(group, item); }).join("") +
      "</div>" +
      '<div class="filter-sub" role="group" aria-label="' + esc(t("filter.month")) + '" hidden></div>' +
      "</div>"
    );
  }

  function renderFilters() {
    var bar = document.getElementById("filter-bar");
    if (!bar) return;
    closeMenu();
    if (state.route === "summary") {
      bar.hidden = true;
      bar.innerHTML = "";
      return;
    }
    bar.hidden = false;
    var groups = filterGroups();
    bar.innerHTML =
      groups.map(groupHtml).join("") +
      (hasFilters()
        ? '<button type="button" class="filter-clear" data-act="clear">' + esc(t("filter.clear")) + "</button>"
        : "");
  }

  /* ------------------------------------------------------------ menu logic */
  var menu = { el: null, sub: null, subItem: null, anchor: null, openT: 0, closeT: 0, subT: 0 };

  function clearTimers() {
    clearTimeout(menu.openT);
    clearTimeout(menu.closeT);
    clearTimeout(menu.subT);
    menu.openT = 0;
    menu.closeT = 0;
    menu.subT = 0;
  }

  function closeMenu() {
    clearTimers();
    if (menu.el) {
      var btn = menu.el.querySelector(".filter-btn");
      var panel = menu.el.querySelector(".filter-panel");
      var sub = menu.el.querySelector(".filter-sub");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (panel) panel.hidden = true;
      if (sub) {
        sub.hidden = true;
        sub.innerHTML = "";
      }
      menu.el.classList.remove("is-open");
    }
    menu.el = null;
    menu.sub = null;
    menu.subItem = null;
    menu.anchor = null;
  }

  function openMenu(el, anchor) {
    if (menu.el && menu.el !== el) closeMenu();
    clearTimers();
    var btn = el.querySelector(".filter-btn");
    var panel = el.querySelector(".filter-panel");
    if (!btn || !panel) return;
    menu.el = el;
    btn.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    el.classList.add("is-open");
    if (anchor) menu.anchor = { x: anchor.x, y: anchor.y };
  }

  function positionSub(sub, panel) {
    var left = 248;
    sub.style.left = left + "px";
    sub.style.top = "8px";
    try {
      if (panel && panel.getBoundingClientRect) {
        var pr = panel.getBoundingClientRect();
        if (pr.width) left = pr.width + 8;
      }
      sub.style.left = left + "px";
      if (sub.getBoundingClientRect && window.innerWidth) {
        var sr = sub.getBoundingClientRect();
        if (sr.width && sr.right > window.innerWidth - 16) sub.style.left = -sr.width - 8 + "px";
      }
    } catch (e) {}
  }

  function openSub(item, anchor) {
    if (!menu.el || !item) return;
    var sub = menu.el.querySelector(".filter-sub");
    if (!sub) return;
    var y = item.getAttribute("data-y") || state.y || "";
    var months = monthsForYear(y);
    sub.innerHTML =
      '<button type="button" class="fopt" data-act="month" data-y="' + esc(y) + '" data-m="" aria-pressed="false">' +
      '<span class="fopt-label">' + esc(t("filter.all")) + "</span></button>" +
      months
        .map(function (m) {
          var selected = state.y === y && state.m === m.v;
          return (
            '<button type="button" class="fopt" data-act="month" data-y="' + esc(y) + '" data-m="' + m.v +
            '" aria-pressed="' + selected + '"><span class="fopt-label">' + Number(m.v) + "月" +
            '</span><span class="n">' + num(m.n) + "</span></button>"
          );
        })
        .join("");
    sub.hidden = false;
    positionSub(sub, menu.el.querySelector(".filter-panel"));
    menu.sub = sub;
    menu.subItem = item;
    if (anchor) menu.anchor = { x: anchor.x, y: anchor.y };
  }

  function closeSub() {
    if (!menu.el) return;
    var sub = menu.el.querySelector(".filter-sub");
    if (sub) {
      sub.hidden = true;
      sub.innerHTML = "";
    }
    menu.sub = null;
    menu.subItem = null;
  }

  function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
    function sign(x1, y1, x2, y2, x3, y3) {
      return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    }
    var d1 = sign(px, py, ax, ay, bx, by);
    var d2 = sign(px, py, bx, by, cx, cy);
    var d3 = sign(px, py, cx, cy, ax, ay);
    var hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    var hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  function inSafeTriangle(px, py) {
    if (!menu.sub || !menu.anchor || menu.sub.hidden) return false;
    var r;
    try {
      r = menu.sub.getBoundingClientRect();
    } catch (e) {
      return false;
    }
    if (!r || !r.width) return false;
    return pointInTriangle(px, py, menu.anchor.x, menu.anchor.y, r.left, r.top, r.left, r.bottom);
  }

  window.KZMenu = { pointInTriangle: pointInTriangle, inSafeTriangle: inSafeTriangle };

  function scheduleClose() {
    clearTimeout(menu.closeT);
    menu.closeT = setTimeout(function () {
      menu.closeT = 0;
      closeMenu();
    }, 250);
  }

  function cancelClose() {
    clearTimeout(menu.closeT);
    menu.closeT = 0;
  }

  function bindFilterMenus() {
    var bar = document.getElementById("filter-bar");
    if (!bar) return;

    bar.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".filter-btn");
      if (!btn) return;
      ev.preventDefault();
      var el = btn.closest(".filter");
      if (menu.el === el) closeMenu();
      else openMenu(el, { x: ev.clientX, y: ev.clientY });
    });

    bar.addEventListener("pointerover", function (ev) {
      if (!hoverable() || !menu.el) return;
      var item = ev.target.closest(".fopt[data-sub]");
      if (!item || item === menu.subItem) return;
      var x = ev.clientX;
      var y = ev.clientY;
      clearTimeout(menu.subT);
      menu.subT = setTimeout(function () {
        if (!menu.el) return;
        openSub(item, { x: x, y: y });
      }, 120);
    });

    bar.addEventListener("pointermove", function (ev) {
      if (!menu.sub || !menu.anchor || !hoverable()) return;
      if (ev.target.closest && ev.target.closest(".filter-sub")) cancelClose();
      var item = ev.target.closest(".fopt[data-sub]");
      if (item && menu.el) menu.anchor = { x: ev.clientX, y: ev.clientY };
    });

    bar.addEventListener("pointerout", function (ev) {
      if (!hoverable() || !menu.el) return;
      var el = menu.el;
      var to = ev.relatedTarget;
      if (to && el.contains(to)) return;
      if (to && to.closest && to.closest(".filter") === el) return;
      scheduleClose();
    });

    document.addEventListener("pointermove", function (ev) {
      if (!menu.closeT) return;
      if (inSafeTriangle(ev.clientX, ev.clientY)) {
        cancelClose();
        return;
      }
      var target = ev.target;
      var inside =
        (target.closest && target.closest(".filter") === menu.el) ||
        (target.closest && target.closest(".filter-sub"));
      if (inside) cancelClose();
    });

    document.addEventListener("click", function (ev) {
      if (!menu.el) return;
      if (ev.target.closest && ev.target.closest("#filter-bar")) return;
      closeMenu();
    });

    document.addEventListener("keydown", function (ev) {
      if (!menu.el) return;
      var active = document.activeElement;
      if (!active || !menu.el.contains(active)) return;
      var panel = menu.el.querySelector(".filter-panel");
      var sub = menu.el.querySelector(".filter-sub");
      var options = panel ? Array.prototype.slice.call(panel.querySelectorAll(".fopt")) : [];
      var subOptions = sub && !sub.hidden ? Array.prototype.slice.call(sub.querySelectorAll(".fopt")) : [];

      if (ev.key === "Escape") {
        ev.preventDefault();
        var btn = menu.el.querySelector(".filter-btn");
        closeMenu();
        if (btn && btn.focus) btn.focus();
        return;
      }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        var pool = subOptions.length && sub.contains(active) ? subOptions : options;
        if (!pool.length) return;
        ev.preventDefault();
        var i = pool.indexOf(active);
        var next = ev.key === "ArrowDown" ? (i + 1) % pool.length : i <= 0 ? pool.length - 1 : i - 1;
        pool[next].focus();
        return;
      }
      if (ev.key === "ArrowRight") {
        var cur = active.closest ? active.closest(".fopt[data-sub]") : null;
        if (!cur) return;
        ev.preventDefault();
        openSub(cur, { x: 0, y: 0 });
        var first = menu.el.querySelector(".filter-sub .fopt");
        if (first && first.focus) first.focus();
        return;
      }
      if (ev.key === "ArrowLeft") {
        if (!sub || sub.hidden) return;
        ev.preventDefault();
        var item = menu.subItem;
        closeSub();
        if (item && item.focus) item.focus();
      }
    });
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
        } else if (state.t === "bangumi") {
          if (!(s.k === "live" && (s.c === "公式番組" || s.c === "番組"))) return false;
        } else if (state.t === "live") {
          if (!(s.k === "live" && s.c !== "公式番組" && s.c !== "番組" && s.c !== "歌" && s.c !== "歌ってみた")) return false;
        } else if (s.k !== state.t) {
          return false;
        }
      }
      if (q && (s.t + " " + s.c + " " + s.r.join(" ") + " " + s.e).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function songsFiltered() {
    var q = state.q.toLowerCase();
    return songs
      .filter(function (s) {
        if (state.p && s.r.indexOf(state.p) < 0) return false;
        if (state.y && s.d.slice(0, 4) !== state.y) return false;
        if (state.c && s.k !== state.c) return false;
        if (state.u && s.e !== state.u) return false;
        if (state.n && (s.n || "") !== state.n) return false;
        if (q && (s.t + " " + s.e + " " + (s.n || "") + " " + s.r.join(" ")).toLowerCase().indexOf(q) < 0) return false;
        return true;
      })
      .sort(function (a, b) { return a.d > b.d ? -1 : a.d < b.d ? 1 : 0; });
  }

  /* 同じ曲名の歌唱を 1 件にまとめる（歌ページ用） */
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
    return events
      .filter(function (e) {
        if (state.p && e.members.indexOf(state.p) < 0) return false;
        if (state.y && e.date.slice(0, 4) !== state.y) return false;
        if (state.r && resultRank(e.result) !== state.r) return false;
        if (state.c && e.content !== state.c) return false;
        if (q && (e.name + " " + e.content + " " + e.team + " " + e.members.join(" ")).toLowerCase().indexOf(q) < 0) return false;
        return true;
      })
      .sort(function (a, b) {
        var da = a.date || "0000";
        var db = b.date || "0000";
        return da > db ? -1 : da < db ? 1 : 0;
      });
  }

  function goodsFiltered() {
    var q = state.q.toLowerCase();
    return goods
      .filter(function (g) {
        if (state.y && g.d.slice(0, 4) !== state.y) return false;
        if (state.c && g.k !== state.c) return false;
        if (q && (g.t + " " + g.k + " " + g.n).toLowerCase().indexOf(q) < 0) return false;
        return true;
      })
      .sort(function (a, b) { return a.d > b.d ? -1 : a.d < b.d ? 1 : 0; });
  }

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
      if (y) {
        if (key === "so" || key === "ev") return partnerYearStat(p, y)[key];
        return partnerYearStat(p, y)[key === "h" ? "h" : "s"];
      }
      if (key === "so") return p.so;
      if (key === "ev") return p.ev;
      return key === "h" ? p.h : p.s;
    }
    return list.sort(function (a, b) {
      if (state.sort === "s") return metric(b, "s") - metric(a, "s");
      if (state.sort === "so") return metric(b, "so") - metric(a, "so");
      if (state.sort === "recent") return a.f > b.f ? -1 : 1;
      return metric(b, "h") - metric(a, "h");
    });
  }

  /* --------------------------------------------------------- markup helpers */
  function pageHead(titleKey, metaText) {
    return (
      '<div class="page-head"><h1>' + esc(t(titleKey)) + "</h1>" +
      (metaText ? '<span class="page-meta">' + esc(metaText) + "</span>" : "") +
      "</div>"
    );
  }

  function searchField(placeholder) {
    return (
      '<label class="search-field">' +
      ICON("search") +
      '<input id="search-input" type="search" value="' + esc(state.q) + '" placeholder="' + esc(placeholder) +
      '" aria-label="' + esc(placeholder) + '" autocomplete="off" spellcheck="false">' +
      "</label>"
    );
  }

  function searchPlaceholder() {
    if (state.route === "streams") return t("search.placeholder.streams");
    if (state.route === "songs") return t("search.placeholder.songs");
    if (state.route === "events") {
      return t(state.tab === "goods" ? "search.placeholder.goods" : "search.placeholder.events");
    }
    if (state.route === "collabs") return t("search.placeholder.collabs");
    return t("search.placeholder");
  }

  function selectHtml(id, act, options, value) {
    return (
      '<span class="select-wrap"><select class="select" id="' + id + '" data-act="' + act + '">' +
      options
        .map(function (o) {
          return '<option value="' + o.v + '"' + (o.v === value ? " selected" : "") + ">" + esc(o.label) + "</option>";
        })
        .join("") +
      "</select>" +
      ICON("chevron-down", "chev") +
      "</span>"
    );
  }

  function chipsHtml(items, act, current) {
    return (
      '<div class="chips">' +
      items
        .map(function (it) {
          return (
            '<button type="button" class="chip" data-act="' + act + '" data-v="' + esc(it.v) +
            '" aria-pressed="' + (String(current || "") === String(it.v)) + '">' + esc(it.label) +
            (it.n != null ? '<span class="n">' + esc(it.n) + "</span>" : "") + "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  /* ---------------------------------------------------------------- cards */
  function streamTagsHtml(s) {
    var names = expandedTags[s.i] ? s.r : s.r.slice(0, 3);
    var parts = names.map(function (n) {
      return '<button type="button" class="p-link" lang="ja" data-act="partner" data-v="' + esc(n) + '">' + esc(n) + "</button>";
    });
    if (s.r.length > 3) {
      var open = !!expandedTags[s.i];
      parts.push(
        '<button type="button" class="more-tags" data-act="tags" data-v="' + esc(s.i) +
        '" aria-expanded="' + open + '">' +
        esc(open ? t("more.tagsClose") : t("more.tags", { n: num(s.r.length - 3) })) + "</button>"
      );
    }
    return parts.join('<span class="sep" aria-hidden="true">・</span>');
  }

  function streamCard(s) {
    var url = s.u || "";
    var thumb = thumbFor(s);
    var typeLabel = typeLabelOf(s);
    var media;
    if (thumb) {
      media =
        '<a class="card-media" href="' + esc(url || "#") + '" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">' +
        '<span class="card-placeholder">' + ICON("play") + "<span>" + esc(typeLabel) + "</span></span>" +
        '<img src="' + thumb + '" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt=""' +
        ' onload="this.classList.add(\'is-loaded\')"' +
        ' onerror="this.onerror=null;this.src=this.src.replace(\'/maxresdefault.jpg\',\'/hqdefault.jpg\');this.onerror=function(){this.remove();};"' +
        "></a>";
    } else {
      media =
        '<span class="card-media"><span class="card-placeholder">' + ICON("play") + "<span>" +
        esc(typeLabel) + "</span></span></span>";
    }

    var meta = [esc(fdate(s.d))];
    if (s.m) meta.push(esc(dur(s.m)));
    meta.push(esc(typeLabel));

    return (
      '<article class="card">' + media +
      '<div class="card-body">' +
      "<h3 class=\"card-title\" lang=\"ja\">" +
      (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.t) + "</a>" : esc(s.t)) +
      "</h3>" +
      '<p class="card-meta">' + meta.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</p>" +
      '<p class="card-partners">' + streamTagsHtml(s) + "</p>" +
      (url
        ? '<div class="card-actions"><a class="card-watch" href="' + esc(url) +
          '" target="_blank" rel="noopener noreferrer">' + esc(t("video.watch")) + ICON("arrow-up-right") + "</a></div>"
        : "") +
      "</div></article>"
    );
  }

  function songRow(s) {
    var parts = [];
    if (s.f && s.f.movie) parts.push(t("flag.movie"));
    if (s.f && s.f.offline) parts.push(t("flag.offline"));
    if (s.f && s.f.online) parts.push(t("flag.online"));
    if (s.f && s.f.cd) parts.push(t("flag.cd"));
    var notes = parts.join(" / ");
    if (s.n) notes = notes ? notes + " ・ " + s.n : s.n;
    return (
      '<li class="take">' +
      '<span class="take-date">' + esc(fdate(s.d)) + "</span>" +
      '<span class="take-unit" lang="ja">' + esc(s.e && s.e !== "ソロ" ? s.e : "") + "</span>" +
      '<span class="take-members" lang="ja">' + esc(s.r.length ? s.r.join("、") : "") + "</span>" +
      '<span class="take-meta">' + esc(notes) + "</span>" +
      (s.u
        ? '<a class="take-play" href="' + esc(s.u) + '" target="_blank" rel="noopener noreferrer" aria-label="' +
          esc(s.t) + " " + esc(t("video.watch")) + '">' + ICON("play") + "</a>"
        : '<span class="take-play is-none" aria-hidden="true"></span>') +
      "</li>"
    );
  }

  function songGroupCard(g) {
    var facts = [];
    if (g.kinds.length) facts.push(g.kinds.join(" / "));
    var span =
      g.first.slice(0, 4) === g.last.slice(0, 4)
        ? g.first.slice(0, 4)
        : g.first.slice(0, 4) + "–" + g.last.slice(0, 4);
    facts.push(span);
    facts.push(num(g.rows.length) + " " + t("unit.times"));
    return (
      '<li class="song">' +
      '<div class="song-head"><h2 class="song-title" lang="ja">' + esc(g.title) + "</h2>" +
      '<span class="song-facts">' + esc(facts.join(" ・ ")) + "</span></div>" +
      '<ol class="takes">' + g.rows.map(songRow).join("") + "</ol></li>"
    );
  }

  function eventRow(e) {
    var rk = resultRank(e.result);
    var resultHtml = "";
    if (e.result) {
      resultHtml =
        '<span class="record-result' + (rk === "champion" ? " is-champion" : "") + '" lang="ja">' +
        esc(String(e.result).trim()) + "</span>";
    }
    return (
      '<li class="record' + (rk === "champion" ? " is-champion" : "") + '">' +
      '<span class="record-date">' + esc(e.dateText || fdate(e.date)) + "</span>" +
      '<div class="record-main">' +
      '<h3 class="record-title" lang="ja">' +
      (e.announce ? '<a href="' + esc(e.announce) + '" target="_blank" rel="noopener noreferrer">' + esc(e.name) + "</a>" : esc(e.name)) +
      "</h3>" + resultHtml +
      (e.playlist
        ? '<a class="record-link" href="' + esc(e.playlist) + '" target="_blank" rel="noopener noreferrer">' +
          esc(t("section.collections")) + "</a>"
        : "") +
      "</div>" +
      '<p class="record-sub">' +
      (e.content ? '<span><span class="k">' + esc(t("filter.content")) + '</span><span class="v">' + esc(e.content) + "</span></span>" : "") +
      (e.team ? '<span><span class="k">' + esc(t("filter.unit")) + '</span><span class="v">' + esc(e.team) + "</span></span>" : "") +
      (e.members.length ? '<span><span class="k">' + esc(t("filter.member")) + '</span><span class="v">' + esc(e.members.join("、")) + "</span></span>" : "") +
      (e.note ? '<span><span class="k">' + esc(t("field.note")) + '</span><span class="v">' + esc(e.note) + "</span></span>" : "") +
      "</p></li>"
    );
  }

  function goodsRow(g) {
    return (
      '<li class="record">' +
      '<span class="record-date">' + esc(fdate(g.d)) + "</span>" +
      '<div class="record-main"><h3 class="record-title" lang="ja">' +
      (g.u
        ? '<a href="' + esc(g.u) + '" target="_blank" rel="noopener noreferrer">' + esc(g.t) + "</a>"
        : esc(g.t)) +
      "</h3></div>" +
      '<p class="record-sub">' +
      (g.k ? '<span><span class="k">' + esc(t("filter.kind")) + '</span><span class="v" lang="ja">' + esc(g.k) + "</span></span>" : "") +
      (g.n ? '<span><span class="k">' + esc(t("field.note")) + '</span><span class="v" lang="ja">' + esc(g.n) + "</span></span>" : "") +
      "</p></li>"
    );
  }

  /* --------------------------------------------------------------- views */
  function viewSummary() {
    var c = meta.counts || {};
    var peak = (meta.subscribers || []).slice().sort(function (a, b) { return b.n - a.n; })[0] || { n: 0 };

    var kpi = [
      { label: t("kpi.subscribers"), value: num(peak.n), unit: t("unit.people") },
      { label: t("kpi.streams"), value: num(c.streams), unit: t("unit.events") },
      { label: t("kpi.hours"), value: num(c.hours), unit: t("unit.hours") },
      { label: t("kpi.songs"), value: num(c.songs), unit: t("unit.songs") },
      { label: t("kpi.events"), value: num(c.events), unit: t("unit.events") },
      { label: t("kpi.partners"), value: num(c.partners), unit: t("unit.people") },
    ];

    var kpiHtml = kpi
      .map(function (k) {
        return (
          '<div class="kpi"><div class="kpi-value">' + k.value + "<small>" + esc(k.unit) +
          '</small></div><div class="kpi-label">' + esc(k.label) + "</div></div>"
        );
      })
      .join("");

    var timeline = (meta.milestones || [])
      .map(function (m) {
        return '<li><span class="t-date">' + esc(fdate(m.d)) + '</span><span class="t-label">' + esc(m.label) + "</span></li>";
      })
      .join("");

    var topPartners = (partners || []).slice(0, 12).map(function (p) {
      return { name: p.n, value: p.h, href: partnerLink(p.n) };
    });
    var maxP = topPartners.length ? topPartners[0].value : 1;
    var partnerBars = topPartners
      .map(function (it) {
        var pct = Math.max(2, (it.value / (maxP || 1)) * 100);
        return (
          '<div class="bar-row">' +
          '<a class="b-name" lang="ja" href="' + esc(it.href) + '" title="' + esc(it.name) + '">' + esc(it.name) + "</a>" +
          '<span class="b-track"><span class="b-fill" style="width:' + pct.toFixed(1) + '%"></span></span>' +
          '<span class="b-value">' + esc(hoursText(it.value, 0)) + "</span></div>"
        );
      })
      .join("");

    var games = (stats.games || []).slice(0, 10);
    var maxG = games.length ? games[0].h : 1;
    var gameBars = games
      .map(function (g) {
        var pct = Math.max(2, (g.h / (maxG || 1)) * 100);
        return (
          '<div class="bar-row">' +
          '<button type="button" class="b-name" lang="ja" data-act="content" data-v="' + esc(g.name) + '">' + esc(g.name) + "</button>" +
          '<span class="b-track"><span class="b-fill" style="width:' + pct.toFixed(1) + '%"></span></span>' +
          '<span class="b-value">' + esc(hoursText(g.h, 0)) + "</span></div>"
        );
      })
      .join("");

    var links = (meta.links || [])
      .map(function (l) {
        return (
          '<a class="link-row" href="' + esc(l.url || "#") + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="link-name">' + esc(l.text || l.label) + "</span>" + ICON("arrow-up-right") + "</a>"
        );
      })
      .join("");

    var collections = meta.collections || [];
    var colHtml = "";
    var listHtml = "";

    var heatYear = Number(state.heatYear || latestYear());
    var heatRows = (stats.monthly || []).filter(function (r) { return r.y === heatYear; });
    var heatSum = heatRows.reduce(
      function (acc, r) {
        acc.lh += r.lh;
        acc.n += r.n;
        acc.cn += r.cn;
        acc.sn += r.sn;
        return acc;
      },
      { lh: 0, n: 0, cn: 0, sn: 0 }
    );
    var tableHead =
      '<thead><tr><th scope="col">' + esc(t("table.month")) + '</th><th scope="col" class="num">' + esc(t("table.hours")) +
      '</th><th scope="col" class="num">' + esc(t("table.live")) + '</th><th scope="col" class="num">' + esc(t("table.clip")) +
      '</th><th scope="col" class="num">' + esc(t("table.short")) + "</th></tr></thead>";

    var heatTable =
      '<details class="disclosure"><summary>' + ICON("chevron-down", "chev") + esc(t("table.show")) + "</summary>" +
      '<div class="disc-body"><div class="table-wrap"><table class="table">' +
      "<caption>" + esc(t("table.monthOfYear", { y: heatYear })) + "</caption>" + tableHead + "<tbody>" +
      heatRows
        .map(function (r) {
          return (
            "<tr><td>" + r.m + '</td><td class="num">' + num(r.lh, 1) + '</td><td class="num">' + num(r.n) +
            '</td><td class="num">' + num(r.cn) + '</td><td class="num">' + num(r.sn) + "</td></tr>"
          );
        })
        .join("") +
      '<tr><td><b>' + esc(t("table.total")) + '</b></td><td class="num"><b>' + num(heatSum.lh, 1) +
      '</b></td><td class="num"><b>' + num(heatSum.n) + '</b></td><td class="num"><b>' + num(heatSum.cn) +
      '</b></td><td class="num"><b>' + num(heatSum.sn) + "</b></td></tr>" +
      "</tbody></table></div></div></details>";

    var monthlyTable = "";

    return (
      '<h1 class="sr-only">' + esc(t("page.summary")) + "</h1>" +
      '<section class="kpis" aria-label="' + esc(t("page.summary")) + '">' + kpiHtml + "</section>" +
      '<section class="section"><div class="section-head"><h2>' + esc(t("section.yearly")) + "</h2></div>" +
      '<div class="chart" id="chart-yearly"></div></section>' +
      '<section class="section"><div class="section-head"><h2>' + esc(t("section.timeline")) + "</h2></div>" +
      '<ol class="timeline">' + timeline + "</ol></section>" +
      '<section class="section"><div class="section-head"><h2>' + esc(t("section.trend")) + "</h2></div>" +
      '<div class="chart" id="chart-trend"></div>' + "</section>" +
      '<section class="section"><div class="section-head"><h2>' + esc(t("section.calendar")) + "</h2></div>" +
      '<div class="chips" id="heat-years" style="margin-bottom:var(--s5)"></div>' +
      '<div class="heat-wrap" id="chart-heat"></div>' + heatTable + "</section>" +
      '<div class="two-col">' +
      '<section class="section"><div class="section-head"><h2>' + esc(t("section.partners")) + "</h2>" +
      '<a class="section-link" href="#/collabs">' + esc(t("section.allPartners")) + "</a></div>" +
      '<div class="bar-list">' + partnerBars + "</div></section>" +
      '<section class="section"><div class="section-head"><h2>' + esc(t("section.games")) + "</h2></div>" +
      '<div class="bar-list">' + gameBars + "</div></section></div>" +
      '<section class="section"><div class="section-head"><h2>' + esc(t("section.subs")) + "</h2></div>" +
      '<div class="chart" id="chart-subs"></div></section>' +
      '<section class="section"><div class="section-head"><h2>' + esc(t("section.links")) + "</h2></div>" +
      '<div class="links">' + links + "</div></section>"
    );
  }

  function viewStreamsSkeleton() {
    return pageHead("page.streams") + '<div class="skeleton">' + esc(t("skeleton.streams")) + "</div>";
  }

  function viewStreams() {
    var list = sortStreams(streamsFiltered());
    var shown = list.slice(0, state.limit);
    var sorts = [
      { v: "new", label: t("sort.new") },
      { v: "old", label: t("sort.old") },
      { v: "dur", label: t("sort.dur") },
    ];

    return (
      pageHead("page.streams") +
      '<div class="toolbar">' + searchField(searchPlaceholder()) +
      '<span class="count-line" aria-live="polite">' +
      esc(t("count.streams", { total: num(list.length), shown: num(shown.length) })) + "</span>" +
      '<span class="spacer"></span>' +
      '<span class="sort"><span class="sr-only">' + esc(t("sort.label")) + "</span>" +
      selectHtml("sort-streams", "sortsel", sorts, state.sort) + "</span></div>" +
      (list.length
        ? '<div class="card-grid">' + shown.map(streamCard).join("") + "</div>" +
          (list.length > shown.length
            ? '<button type="button" class="load-more" data-act="more">' +
              esc(t("loadmore", { n: num(list.length - shown.length) })) + "</button>"
            : "")
        : emptyState(t("empty.streams"), hasFilters()))
    );
  }

  function viewSongs() {
    var list = songsFiltered();
    var groups = songGroups(list);
    var shown = groups.slice(0, state.limit);

    return (
      pageHead("page.songs") +
      '<div class="toolbar">' + searchField(searchPlaceholder()) +
      '<span class="count-line" aria-live="polite">' +
      esc(t("count.songs", { groups: num(groups.length), list: num(list.length), shown: num(shown.length) })) +
      '</span><span class="spacer"></span>' +
      '<span class="count-line">' + esc(t("sort.songs")) + "</span></div>" +
      (list.length
        ? '<ol class="records">' + shown.map(songGroupCard).join("") + "</ol>" +
          (groups.length > shown.length
            ? '<button type="button" class="load-more" data-act="more">' +
              esc(t("loadmore", { n: num(groups.length - shown.length) })) + "</button>"
            : "")
        : emptyState(t("empty.songs"), hasFilters()))
    );
  }

  function viewEvents() {
    var isGoods = state.tab === "goods";
    var list = isGoods ? goodsFiltered() : eventsFiltered();
    var shown = list.slice(0, state.limit);
    var champions = isGoods ? 0 : list.filter(function (e) { return resultRank(e.result) === "champion"; }).length;

    return (
      pageHead("page.events") +
      '<div class="tabs" role="group" aria-label="' + esc(t("page.events")) + '">' +
      '<button type="button" class="tab" data-act="tab" data-v="events" aria-pressed="' + (!isGoods) + '">' +
      esc(t("tab.events")) + "</button>" +
      '<button type="button" class="tab" data-act="tab" data-v="goods" aria-pressed="' + isGoods + '">' +
      esc(t("tab.goods")) + "</button></div>" +
      '<div class="toolbar">' + searchField(searchPlaceholder()) +
      '<span class="count-line" aria-live="polite">' +
      esc(t(isGoods ? "count.goods" : "count.events", { total: num(list.length), shown: num(shown.length) })) +
      (isGoods
        ? ""
        : '<span class="sep">·</span><span class="count-accent">' +
          esc(t("count.champions", { n: num(champions) })) + "</span>") +
      "</span></div>" +
      (list.length
        ? '<ol class="records">' + shown.map(isGoods ? goodsRow : eventRow).join("") + "</ol>" +
          (list.length > shown.length
            ? '<button type="button" class="load-more" data-act="more">' +
              esc(t("loadmore", { n: num(list.length - shown.length) })) + "</button>"
            : "")
        : emptyState(t("empty.events"), hasFilters()))
    );
  }

  function partnerDetail(p) {
    var y = state.y;
    var inYear = function (d) { return !y || String(d || "").slice(0, 4) === y; };
    var allList = (streams || [])
      .filter(function (s) { return s.r.indexOf(p.n) >= 0; })
      .sort(function (a, b) { return a.d > b.d ? -1 : 1; });
    var list = y ? allList.filter(function (s) { return inYear(s.d); }) : allList;
    var recent = list.slice(0, 6);
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
    var miniBars = yKeys
      .map(function (k) {
        return (
          '<div class="bar-row">' +
          '<span class="b-name">' + k + "</span>" +
          '<span class="b-track"><span class="b-fill" style="width:' +
          Math.max(2, (yearly[k] / maxY) * 100).toFixed(1) + '%"></span></span>' +
          '<span class="b-value">' + esc(hoursText(yearly[k], 0)) + "</span></div>"
        );
      })
      .join("");

    var yearItems = [{ v: "", label: t("partner.allYears") }].concat(
      yKeys.slice().reverse().map(function (k) {
        return { v: k, label: t("partner.yearOption", { y: k }) };
      })
    );

    return (
      '<div class="page-head"><h1>' + esc(t("partner.title", { name: p.n })) + "</h1>" +
      (y ? '<span class="page-meta">' + esc(t("partner.yearOption", { y: y })) + "</span>" : "") + "</div>" +
      '<div class="stat-line">' +
      "<span>" + esc(t("partner.liveCount")) + " <b>" + num(st.s) + "</b></span>" +
      "<span>" + esc(t("partner.hours")) + " <b>" + esc(hoursText(st.h, 1)) + "</b></span>" +
      "<span>" + esc(t("partner.songs")) + " <b>" + num(st.so) + "</b></span>" +
      "<span>" + esc(t("partner.events")) + " <b>" + num(st.ev) + "</b></span>" +
      (firstDate ? "<span>" + esc(t("partner.first")) + " <b>" + esc(fdate(firstDate)) + "</b></span>" : "") +
      (lastDate ? "<span>" + esc(t("partner.last")) + " <b>" + esc(fdate(lastDate)) + "</b></span>" : "") +
      "</div>" +
      chipsHtml(yearItems, "year", state.y) +
      '<div class="bar-list" style="margin-top:var(--s6)">' + miniBars + "</div>" +
      '<div class="detail-actions">' +
      '<button type="button" class="btn btn-primary" data-act="partner" data-v="' + esc(p.n) + '">' +
      esc(t("partner.filter")) + "</button>" +
      '<a class="btn-text" href="#/collabs">' + esc(t("partner.back")) + "</a></div>" +
      '<section class="section"><div class="section-head"><h2>' + esc(t("partner.recent")) + "</h2>" +
      '<span class="section-link">' + esc(t("partner.recentCount", { total: num(list.length), shown: num(recent.length) })) +
      "</span></div>" + '<div class="card-grid">' + recent.map(streamCard).join("") + "</div></section>" +
      (songsWith.length
        ? '<section class="section"><div class="section-head"><h2>' + esc(t("partner.songsTitle")) +
          '</h2><span class="section-link">' +
          esc(t("partner.newest", { total: num(songsWithAll.length), shown: num(songsWith.length) })) +
          '</span></div><ol class="takes">' + songsWith.map(songRow).join("") + "</ol></section>"
        : "") +
      (eventsWith.length
        ? '<section class="section"><div class="section-head"><h2>' + esc(t("partner.eventsTitle")) +
          '</h2><span class="section-link">' +
          esc(t("partner.newest", { total: num(eventsWithAll.length), shown: num(eventsWith.length) })) +
          '</span></div><ol class="records">' + eventsWith.map(eventRow).join("") + "</ol></section>"
        : "")
    );
  }

  function viewCollabs() {
    if (state.p && !streams) {
      return pageHead("page.collabs") + '<div class="skeleton">' + esc(t("skeleton.partners")) + "</div>";
    }
    var selected = null;
    if (state.p) selected = partners.filter(function (p) { return p.n === state.p; })[0] || null;
    if (selected) return partnerDetail(selected);

    var list = partnersFiltered();
    var shown = list.slice(0, state.limit);
    var y = state.y;
    var maxH = 1;
    list.forEach(function (p) {
      var h = y ? partnerYearStat(p, y).h : p.h;
      if (h > maxH) maxH = h;
    });
    var rows = shown
      .map(function (p) {
        var st = y ? partnerYearStat(p, y) : { s: p.s, h: p.h, so: p.so, ev: p.ev };
        return (
          '<a class="partner-row" href="#/collabs?p=' + encodeURIComponent(p.n) + (y ? "&y=" + y : "") + '">' +
          '<span class="p-name" lang="ja">' + esc(p.n) + "</span>" +
          '<span class="p-metrics">' + esc(hoursText(st.h, 1)) + " ・ " + num(st.s) + " " + esc(t("unit.times")) + "</span>" +
          '<span class="p-more">' + esc(t("partner.songs")) + " " + num(st.so) + " ・ " + esc(t("partner.events")) + " " +
          num(st.ev) + " ・ " + esc(fdate(p.f)) + "</span>" +
          '<span class="p-bar"><i style="width:' + Math.max(2, (st.h / maxH) * 100).toFixed(1) + '%"></i></span></a>'
        );
      })
      .join("");

    var sorts = [
      { v: "h", label: t("sort.h") },
      { v: "s", label: t("sort.s") },
      { v: "so", label: t("sort.so") },
      { v: "recent", label: t("sort.recent") },
    ];

    return (
      pageHead("page.collabs") +
      '<div class="toolbar">' + searchField(searchPlaceholder()) +
      '<span class="count-line" aria-live="polite">' +
      esc(y ? t("count.yearPartners", { y: y, total: num(list.length), shown: num(shown.length) })
            : t("count.partners", { total: num(list.length), shown: num(shown.length) })) +
      '</span><span class="spacer"></span>' +
      '<span class="sort"><span class="sr-only">' + esc(t("sort.label")) + "</span>" +
      selectHtml("sort-collabs", "sortsel2", sorts, state.sort) + "</span></div>" +
      (list.length
        ? '<div class="partners">' + rows + "</div>" +
          (list.length > shown.length
            ? '<button type="button" class="load-more" data-act="more">' +
              esc(t("loadmore", { n: num(list.length - shown.length) })) + "</button>"
            : "")
        : emptyState(y ? t("empty.partnersYear", { y: y }) : t("empty.partners"), hasFilters()))
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
      ensureStreams()
        .then(render)
        .catch(function () {
          view.innerHTML = '<div class="empty"><p>' + esc(t("skeleton.streams")) + "</p></div>";
        });
    }
  }

  function mountSummaryCharts() {
    if (Charts) {
      Charts.yearlyBars(document.getElementById("chart-yearly"), stats.yearly || [], latestYear());
      Charts.trend(document.getElementById("chart-trend"), stats.monthly || []);
      Charts.subscribers(document.getElementById("chart-subs"), meta.subscribers || []);
    }
    var hy = Number(state.heatYear || latestYear());
    var heat = document.getElementById("chart-heat");
    var yearsEl = document.getElementById("heat-years");
    if (yearsEl) {
      var years = (stats.yearly || []).filter(function (r) { return r.n; }).map(function (r) { return r.y; });
      yearsEl.innerHTML = years
        .map(function (y) {
          return (
            '<button type="button" class="chip" data-act="heatyear" data-v="' + y + '" aria-pressed="' +
            (hy === y) + '">' + y + "</button>"
          );
        })
        .join("");
    }
    if (heat && Charts) Charts.heatmap(heat, stats.calendar || {}, hy);
  }

  function render() {
    renderChrome();
    renderSiteSearch();
    renderFilters();
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
      if (y == null) y = el.getAttribute("data-v") || "";
      if (state.route === "summary") navigate("streams", { y: y, m: "" });
      else setState({ y: y === state.y ? "" : y, m: "" });
    } else if (act === "partner") {
      var name = v || "";
      if (state.route === "collabs" && name && state.p === name) {
        navigate("streams", { p: name, y: "", m: "", c: "", t: "", q: "", u: "", r: "" });
      } else {
        setPartner(name === state.p ? "" : name);
      }
    } else if (act === "month") {
      var yy = el.getAttribute("data-y") || "";
      var mm = el.getAttribute("data-m") || "";
      if (state.route !== "streams") navigate("streams", { y: yy, m: mm });
      else setState({ y: yy, m: mm });
    } else if (act === "content") {
      if (state.route === "events") setState({ c: v === state.c ? "" : v, limit: 60 });
      else if (state.route !== "streams") navigate("streams", { c: v === state.c ? "" : v, p: "", y: "", m: "", t: "" });
      else setState({ c: v === state.c ? "" : v });
    } else if (act === "type") {
      setState({ t: v === state.t ? "" : v });
    } else if (act === "kind") {
      setState({ c: v === state.c ? "" : v });
    } else if (act === "unit") {
      setState({ u: v === state.u ? "" : v });
    } else if (act === "event") {
      setState({ n: v === state.n ? "" : v, limit: 60 });
    } else if (act === "tags") {
      if (expandedTags[v]) delete expandedTags[v];
      else expandedTags[v] = 1;
      var foot = el.closest ? el.closest(".card-partners") : null;
      var target = null;
      for (var si = 0; si < (streams || []).length; si++) {
        if (streams[si].i === v) { target = streams[si]; break; }
      }
      if (foot && target) foot.innerHTML = streamTagsHtml(target);
    } else if (act === "result") {
      setState({ r: v === state.r ? "" : v });
    } else if (act === "tab") {
      setState(v === "goods" ? { tab: v, p: "", limit: 60 } : { tab: v, limit: 60 });
    } else if (act === "heatyear") {
      state.heatYear = v;
      syncUrl();
      renderContent();
    } else if (act === "clear") {
      Object.assign(state, { p: "", y: "", m: "", c: "", t: "", q: "", u: "", r: "", n: "", limit: 60 });
      var input = siteSearchInput();
      if (input) input.value = "";
      closeSuggest();
      syncUrl();
      render();
    } else if (act === "more") {
      state.limit += 60;
      renderContent();
    }
    if (act !== "suggest" && act !== "more" && act !== "tags" && act !== "heatyear") closeMenu();
  }

  function bindNav() {
    var toggle = document.getElementById("nav-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        setNav(!navState.open);
      });
    }
    var scrim = document.getElementById("nav-scrim");
    if (scrim) {
      scrim.addEventListener("click", function () {
        setNav(false);
      });
    }
    var nav = document.getElementById("site-nav");
    if (nav) {
      nav.addEventListener("click", function (ev) {
        var a = ev.target && ev.target.closest ? ev.target.closest("a") : null;
        if (a) setNav(false);
      });
    }
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && navState.open) setNav(false);
    });
    window.addEventListener("resize", function () {
      if (navState.open && window.innerWidth >= 768) setNav(false);
    });
  }

  function bindEvents() {
    document.addEventListener("click", function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-act]") : null;
      if (!el) return;
      var act = el.getAttribute("data-act");
      if (act === "sortsel" || act === "sortsel2") return;
      ev.preventDefault();
      handleAction(el);
    });

    document.addEventListener("change", function (ev) {
      var sel = ev.target;
      if (!sel || !sel.getAttribute) return;
      if (sel.getAttribute("data-act") === "sortsel") setState({ sort: sel.value, limit: 60 });
      if (sel.getAttribute("data-act") === "sortsel2") setState({ sort: sel.value, limit: 60 });
    });

    var toggle = document.getElementById("search-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var box = searchBox();
        if (box && !box.hidden) closeSearch();
        else openSearch();
      });
    }

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
          return;
        }
        if (ev.key === "Escape") {
          closeSuggest();
          if (!searchInput.value) closeSearch();
          return;
        }
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
          if (!suggest.open) refreshSuggest();
          if (!suggest.items.length) return;
          ev.preventDefault();
          var n = suggest.items.length;
          suggest.active =
            ev.key === "ArrowDown" ? (suggest.active + 1) % n : suggest.active <= 0 ? n - 1 : suggest.active - 1;
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
      var search = document.getElementById("search");
      if (search && !search.contains(ev.target)) closeSuggest();
    });

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

    bindFilterMenus();
    bindNav();

    window.addEventListener("hashchange", function () {
      closeSuggest();
      closeMenu();
      setNav(false);
      var parsed = parseHash();
      if (sameState(parsed, state) && location.hash === currentHash()) return;
      Object.assign(state, parsed);
      render();
      window.scrollTo({ top: 0, behavior: "auto" });
    });

    window.KZ_onLangChange = function () {
      I18N.applyStatic();
      closeMenu();
      render();
    };

    var toggleEl = document.getElementById("lang-toggle");
    if (toggleEl) {
      toggleEl.addEventListener("click", function () {
        if (I18N) I18N.set(I18N.lang === "zh" ? "ja" : "zh");
      });
    }
  }

  /* ----------------------------------------------------------------- boot */
  function setStaticIcons() {
    var st = document.getElementById("search-toggle");
    if (st) st.innerHTML = ICON("search");
    var sc = document.getElementById("site-search-clear");
    if (sc) sc.innerHTML = ICON("x");
    var nt = document.getElementById("nav-toggle");
    if (nt) nt.innerHTML = ICON("menu");
  }

  function boot() {
    if (I18N) I18N.applyStatic();
    setStaticIcons();
    if (Charts && Charts.installTooltips) Charts.installTooltips();
    Object.assign(state, parseHash());
    if (!state.heatYear) state.heatYear = latestYear();
    var bd = document.getElementById("build-date");
    if (bd) bd.textContent = fdate(meta.generated);
    bindEvents();
    if (location.hash !== currentHash()) {
      try {
        history.replaceState(null, "", currentHash());
      } catch (e) {}
    }
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
