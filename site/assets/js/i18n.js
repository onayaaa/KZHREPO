/* ==========================================================================
   葛葉 データアーカイブ — i18n.js
   界面文案（UI chrome）だけを翻訳する。配信タイトル・曲名・大会名・人名など
   データ本体は常に日本語の原文をそのまま表示する。
   ========================================================================== */
window.KZI18N = (function () {
  "use strict";

  var DICT = {
    ja: {
      "doc.title": "{page}｜葛葉 データアーカイブ",
      "skip": "本文へ移動",
      "noscript": "JavaScript を有効にしてください。",
      "nav.summary": "概要",
      "nav.streams": "配信",
      "nav.songs": "歌",
      "nav.events": "大会・企画",
      "nav.collabs": "コラボ相手",
      "nav.label": "主要ナビゲーション",
      "nav.open": "メニュー",
      "nav.close": "メニューを閉じる",

      "page.summary": "概要",
      "page.streams": "配信アーカイブ",
      "page.songs": "歌",
      "page.events": "大会・企画",
      "page.collabs": "コラボ相手",

      "lang.label": "表示言語",
      "lang.ja": "日本語",
      "lang.zh": "中文",

      "search.open": "検索を開く",
      "search.placeholder": "コラボ相手・配信を検索",
      "search.clear": "検索をクリア",
      "search.group.partner": "コラボ相手",
      "search.group.stream": "配信",
      "search.none": "「{q}」に一致する項目はありません。",
      "search.loading": "配信タイトルを読み込んでいます…",
      "search.placeholder.streams": "配信タイトル・ゲーム名で検索",
      "search.placeholder.songs": "曲名・ユニットで検索",
      "search.placeholder.events": "大会名・メンバーで検索",
      "search.placeholder.collabs": "コラボ相手名で検索",
      "search.placeholder.goods": "内容で検索",

      "filter.year": "年",
      "filter.month": "月",
      "filter.partner": "コラボ相手",
      "filter.content": "内容",
      "filter.type": "種類",
      "filter.result": "成績",
      "filter.member": "参加メンバー",
      "filter.kind": "種類",
      "filter.category": "分類",
      "filter.unit": "ユニット",
      "filter.event": "イベント",
      "filter.clear": "クリア",
      "filter.all": "すべて",
      "filter.yearValue": "{y} 年",
      "filter.monthValue": "{m}月",
      "field.note": "備考",
      "field.team": "チーム名",

      "tab.events": "大会・企画",
      "tab.goods": "イベント・グッズ",

      "sort.label": "並び順",
      "sort.new": "新しい順",
      "sort.old": "古い順",
      "sort.dur": "配信時間が長い順",
      "sort.songs": "最新の歌唱順",
      "sort.h": "共演時間が多い順",
      "sort.s": "共演配信が多い順",
      "sort.so": "一緒の曲が多い順",
      "sort.recent": "最終共演が新しい順",

      "count.streams": "{total} 本中 {shown} 本を表示",
      "count.events": "{total} 件中 {shown} 件を表示",
      "count.goods": "{total} 件中 {shown} 件を表示",
      "count.total": "{total} 件",
      "count.songs": "{groups} 曲 / {list} 歌唱のうち {shown} 曲を表示",
      "count.partners": "{total} 人中 {shown} 人を表示",
      "count.yearPartners": "{y} 年 ・ {total} 人中 {shown} 人を表示",
      "count.champions": "優勝 {n} 件",

      "more.tags": "ほか {n} 人",
      "more.tagsClose": "閉じる",
      "loadmore": "さらに表示（残り {n} 件）",
      "video.watch": "動画を見る",

      "empty.streams": "条件に一致する配信がありません。",
      "empty.songs": "条件に一致する楽曲がありません。",
      "empty.events": "条件に一致する記録がありません。",
      "empty.partners": "条件に一致するコラボ相手がいません。",
      "empty.partnersYear": "{y} 年に共演したコラボ相手が見つかりません。",
      "empty.clear": "絞り込みをクリア",

      "unit.hours": "時間",
      "unit.minutes": "分",
      "unit.people": "人",
      "unit.songs": "曲",
      "unit.events": "件",
      "unit.times": "回",

      "solo": "ソロ",
      "flag.movie": "動画",
      "flag.offline": "オフライン",
      "flag.online": "オンライン",
      "flag.cd": "CD",

      "result.champion": "優勝",
      "result.runnerup": "準優勝",
      "result.third": "3位",
      "result.top10": "4〜10位",
      "result.out": "敗退・予選落ち",
      "result.other": "その他",
      "result.unknown": "記録なし",

      "type.live": "配信",
      "type.bangumi": "番組",
      "type.clip": "切り抜き",
      "type.short": "Shorts",
      "type.song": "歌",
      "type.liveshow": "ライブ",
      "type.anken": "案件",

      "kpi.subscribers": "チャンネル登録者",
      "kpi.streams": "配信アーカイブ",
      "kpi.hours": "配信の合計",
      "kpi.songs": "歌",
      "kpi.events": "大会・企画",
      "kpi.partners": "コラボ相手",

      "section.yearly": "年別の配信時間",
      "section.timeline": "記念日",
      "section.trend": "月別の配信時間",
      "section.calendar": "配信カレンダー",
      "section.partners": "よく共演する相手",
      "section.games": "よく遊ぶゲーム",
      "section.subs": "チャンネル登録者数の推移",
      "section.links": "公式リンク",
      "section.collections": "再生リスト",
      "section.allPartners": "すべて見る",

      "table.show": "数値を表で見る",
      "table.showAll": "月別の数値",
      "table.collection": "アーカイブ（公式再生リスト）を開く",
      "table.year": "年",
      "table.month": "月",
      "table.monthOfYear": "{y} 年の月別記録",
      "table.monthOnly": "月別の記録（{n} か月分）",
      "table.hours": "配信時間",
      "table.live": "配信",
      "table.clip": "切り抜き",
      "table.short": "Shorts",
      "table.total": "合計",
      "table.ym": "年月",

      "heat.less": "すくない",
      "heat.more": "おおい",
      "heat.aria": "{y} 年の配信カレンダー。1 日ごとの配信時間を色の濃さで示しています。",
      "chart.yearly.aria": "年別の配信時間",
      "chart.trend.aria": "月別の配信時間の推移",
      "chart.subs.aria": "チャンネル登録者数の推移。線にカーソルを合わせると、その日付の登録者数を表示します。",
      "chart.monthTip": "{y}年{m}月 / {h} 時間（{n} 本）",
      "chart.dayTip": "{y}年{m}月{d}日 / {h} 時間（{n} 本）",
      "chart.yearTip": "{y}年 / 合計 {h} 時間 / 配信 {lh} 時間 / {n} 本",
      "chart.subsTip": "{d} / {n} 人",
      "chart.subsEmpty": "登録者数の記録がありません。",

      "partner.title": "{name} との記録",
      "partner.liveCount": "共演配信",
      "partner.hours": "共演時間",
      "partner.songs": "一緒の曲",
      "partner.events": "大会",
      "partner.first": "初共演",
      "partner.last": "最終共演",
      "partner.filter": "この相手で配信を絞り込む",
      "partner.back": "コラボ相手一覧に戻る",
      "partner.recent": "最近の共演配信",
      "partner.recentCount": "{total} 本のうち {shown} 本",
      "partner.songsTitle": "一緒の曲",
      "partner.eventsTitle": "一緒の大会",
      "partner.newest": "新しい順 ・ {total} 件中 {shown} 件",
      "partner.allYears": "全期間",
      "partner.yearOption": "{y} 年",

      "collection.until2023": "2023年まで",
      "collection.official": "公式リスト",
      "collection.playlist": "公式再生リスト",

      "footer.note": "非公式アーカイブ ／ データ出典：葛葉倉庫 2018–2026 ／ 各動画・楽曲の権利は権利者に帰属します。",
      "footer.updated": "最終更新",
      "footer.repo": "GitHub リポジトリ",
      "skeleton.streams": "配信データを読み込んでいます…",
      "skeleton.partners": "コラボ相手の記録を読み込んでいます…",
      "misc.timesSep": " ・ ",
    },

    zh: {
      "doc.title": "{page}｜葛葉 数据档案",
      "skip": "跳到正文",
      "noscript": "请启用 JavaScript。",
      "nav.summary": "概要",
      "nav.streams": "直播",
      "nav.songs": "歌曲",
      "nav.events": "大会·企划",
      "nav.collabs": "联动对象",
      "nav.label": "主导航",
      "nav.open": "菜单",
      "nav.close": "关闭菜单",

      "page.summary": "概要",
      "page.streams": "直播档案",
      "page.songs": "歌曲",
      "page.events": "大会·企划",
      "page.collabs": "联动对象",

      "lang.label": "界面语言",
      "lang.ja": "日本語",
      "lang.zh": "中文",

      "search.open": "打开搜索",
      "search.placeholder": "搜索联动对象·直播",
      "search.clear": "清除搜索",
      "search.group.partner": "联动对象",
      "search.group.stream": "直播",
      "search.none": "未找到与「{q}」匹配的项目。",
      "search.loading": "正在加载直播标题…",
      "search.placeholder.streams": "搜索直播标题·游戏名",
      "search.placeholder.songs": "搜索曲名·组合",
      "search.placeholder.events": "搜索大会名·成员",
      "search.placeholder.collabs": "搜索联动对象名",
      "search.placeholder.goods": "搜索内容",

      "filter.year": "年份",
      "filter.month": "月份",
      "filter.partner": "联动对象",
      "filter.content": "内容",
      "filter.type": "类型",
      "filter.result": "成绩",
      "filter.member": "参与成员",
      "filter.kind": "类型",
      "filter.category": "分类",
      "filter.unit": "组合",
      "filter.event": "活动",
      "filter.clear": "清除",
      "filter.all": "全部",
      "filter.yearValue": "{y} 年",
      "filter.monthValue": "{m}月",
      "field.note": "备注",
      "field.team": "队伍名",

      "tab.events": "大会·企划",
      "tab.goods": "活动·周边",

      "sort.label": "排序",
      "sort.new": "最新优先",
      "sort.old": "最早优先",
      "sort.dur": "直播时长降序",
      "sort.songs": "最新演唱优先",
      "sort.h": "联动时长降序",
      "sort.s": "联动直播数降序",
      "sort.so": "共同歌曲数降序",
      "sort.recent": "最近联动优先",

      "count.streams": "显示 {total} 次中的 {shown} 次",
      "count.events": "显示 {total} 个中的 {shown} 个",
      "count.goods": "显示 {total} 个中的 {shown} 个",
      "count.total": "{total} 条",
      "count.songs": "{groups} 首 / {list} 次演唱中显示 {shown} 首",
      "count.partners": "共 {total} 人，显示 {shown} 人",
      "count.yearPartners": "{y} 年 ・ 共 {total} 人，显示 {shown} 人",
      "count.champions": "{n} 个冠军",

      "more.tags": "另 {n} 人",
      "more.tagsClose": "收起",
      "loadmore": "加载更多（剩余 {n} 条）",
      "video.watch": "观看视频",

      "empty.streams": "没有符合条件的直播。",
      "empty.songs": "没有符合条件的歌曲。",
      "empty.events": "没有符合条件的记录。",
      "empty.partners": "没有符合条件的联动对象。",
      "empty.partnersYear": "没有找到 {y} 年的联动对象。",
      "empty.clear": "清除筛选",

      "unit.hours": "小时",
      "unit.minutes": "分钟",
      "unit.people": "人",
      "unit.songs": "首",
      "unit.events": "个",
      "unit.times": "次",

      "solo": "单人",
      "flag.movie": "视频",
      "flag.offline": "线下",
      "flag.online": "线上",
      "flag.cd": "CD",

      "result.champion": "冠军",
      "result.runnerup": "亚军",
      "result.third": "第 3 名",
      "result.top10": "4～10 名",
      "result.out": "淘汰·预选落败",
      "result.other": "其他",
      "result.unknown": "无记录",

      "type.live": "直播",
      "type.bangumi": "节目",
      "type.clip": "切片",
      "type.short": "Shorts",
      "type.song": "歌曲",
      "type.liveshow": "演唱会",
      "type.anken": "商业合作",

      "kpi.subscribers": "频道订阅者",
      "kpi.streams": "直播档案",
      "kpi.hours": "直播总时长",
      "kpi.songs": "歌曲",
      "kpi.events": "大会·企划",
      "kpi.partners": "联动对象",

      "section.yearly": "年度直播时长",
      "section.timeline": "纪念日",
      "section.trend": "月度直播时长",
      "section.calendar": "直播日历",
      "section.partners": "常联动对象",
      "section.games": "常玩游戏",
      "section.subs": "频道订阅数变化",
      "section.links": "官方链接",
      "section.collections": "播放列表",
      "section.allPartners": "查看全部",

      "table.show": "查看数据表",
      "table.showAll": "月度数据",
      "table.collection": "打开档案（官方播放列表）",
      "table.year": "年",
      "table.month": "月",
      "table.monthOfYear": "{y} 年月度记录",
      "table.monthOnly": "月度记录（共 {n} 个月）",
      "table.hours": "直播时长",
      "table.live": "直播",
      "table.clip": "切片",
      "table.short": "Shorts",
      "table.total": "合计",
      "table.ym": "年月",

      "heat.less": "较少",
      "heat.more": "较多",
      "heat.aria": "{y} 年直播日历。以颜色深浅表示每日直播时长。",
      "chart.yearly.aria": "年度直播时长",
      "chart.trend.aria": "月度直播时长走势",
      "chart.subs.aria": "频道订阅数变化。将鼠标移到线上可查看对应日期的人数。",
      "chart.monthTip": "{y}年{m}月 / {h} 小时（{n} 场）",
      "chart.dayTip": "{y}年{m}月{d}日 / {h} 小时（{n} 场）",
      "chart.yearTip": "{y}年 / 合计 {h} 小时 / 直播 {lh} 小时 / {n} 场",
      "chart.subsTip": "{d} / {n} 人",
      "chart.subsEmpty": "没有订阅者记录。",

      "partner.title": "与 {name} 的联动记录",
      "partner.liveCount": "联动直播",
      "partner.hours": "联动时长",
      "partner.songs": "共同歌曲",
      "partner.events": "大会",
      "partner.first": "首次联动",
      "partner.last": "最近联动",
      "partner.filter": "只看与该对象的直播",
      "partner.back": "返回联动对象列表",
      "partner.recent": "最近联动直播",
      "partner.recentCount": "{total} 条中的 {shown} 条",
      "partner.songsTitle": "共同歌曲",
      "partner.eventsTitle": "共同大会",
      "partner.newest": "最新优先 ・ {total} 条中的 {shown} 条",
      "partner.allYears": "全部时期",
      "partner.yearOption": "{y} 年",

      "collection.until2023": "至 2023 年",
      "collection.official": "官方列表",
      "collection.playlist": "官方播放列表",

      "footer.note": "非官方档案 ／ 数据来源：葛葉倉庫 2018–2026 ／ 视频与歌曲权利归各自权利人所有。",
      "footer.updated": "最后更新",
      "footer.repo": "GitHub 仓库",
      "skeleton.streams": "正在加载直播数据…",
      "skeleton.partners": "正在加载联动对象记录…",
      "misc.timesSep": " ・ ",
    },
  };

  var lang = "ja";
  try {
    var saved = localStorage.getItem("kz-lang");
    if (saved === "zh" || saved === "ja") lang = saved;
  } catch (e) {}

  function t(key, vars) {
    var d = DICT[lang] || DICT.ja;
    var s = d[key];
    if (s == null) s = DICT.ja[key];
    if (s == null) return key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] != null ? String(vars[k]) : "";
      });
    }
    return s;
  }

  function applyStatic(root) {
    var r = root || document;
    if (r.querySelectorAll) {
      r.querySelectorAll("[data-i18n]").forEach(function (el) {
        el.textContent = t(el.getAttribute("data-i18n"));
      });
      r.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
        el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
      });
      r.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
        el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
      });
    }
    if (document.documentElement) document.documentElement.lang = lang === "zh" ? "zh-CN" : "ja";
    var toggle = document.getElementById("lang-toggle");
    if (toggle) {
      toggle.setAttribute("aria-label", t("lang.label"));
      toggle.querySelectorAll("[data-lang]").forEach(function (el) {
        el.classList.toggle("is-on", el.getAttribute("data-lang") === lang);
      });
    }
  }

  function set(next) {
    lang = next === "zh" ? "zh" : "ja";
    try {
      localStorage.setItem("kz-lang", lang);
    } catch (e) {}
    applyStatic();
    if (typeof window.KZ_onLangChange === "function") window.KZ_onLangChange(lang);
  }

  window.KZ_onLangChange = null;

  return {
    get lang() {
      return lang;
    },
    t: t,
    set: set,
    applyStatic: applyStatic,
    dict: DICT,
  };
})();
