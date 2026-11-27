# -*- coding: utf-8 -*-
"""
kzhdata/葛葉仓库 2018-2026 xlsx -> site/assets/data/*.js

用法:
  <bundled-python> tools/build_site.py

说明（中文）:
- 只读原 xlsx，不修改任何源文件。
- 输出为经典脚本（window.KZ.xxx = ...），这样 site/index.html 用 file:// 直接打开也能工作
  （file:// 下 fetch 会被 CORS 拦截）。
- 所有中文/日文日志写入 site/assets/data/build-report.txt（UTF-8），
  因为 Windows 控制台是 GBK，直接 print 会 UnicodeEncodeError。
"""
import datetime
import json
import os
import re
import sys
import traceback
import unicodedata
from collections import Counter, OrderedDict, defaultdict

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "kzhdata")
OUT_DIR = os.path.join(ROOT, "site", "assets", "data")
REPORT = []


def log(line=""):
    REPORT.append(line)


def norm(s):
    """名称归一化：NFC、去零宽字符、折叠空白。"""
    if s is None:
        return ""
    s = str(s)
    s = s.replace("\u200b", "").replace("\u202a", "").replace("\u202c", "")
    s = s.replace("\xa0", " ").replace("\u3000", " ")
    s = unicodedata.normalize("NFC", s)
    return re.sub(r"\s+", " ", s).strip()


def split_names(value):
    """拆分共演者/成员列。"""
    if value is None:
        return []
    s = norm(value)
    if not s:
        return []
    parts = re.split(r"[、,，/／;；\n]+", s)
    out = []
    for p in parts:
        p = norm(p)
        if not p:
            continue
        if p in ("葛葉", "ソロ", "コラボ", "自身"):
            continue
        if p not in out:
            out.append(p)
    return out


def to_date(value):
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value
    if value is None:
        return None
    s = norm(value)
    if not s:
        return None
    m = re.match(r"^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})", s)
    if m:
        try:
            return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    return None


def iso(d):
    return d.strftime("%Y-%m-%d") if d else ""


def cell_link(cell):
    try:
        return cell.hyperlink.target if cell.hyperlink else ""
    except Exception:
        return ""


def unwrap_url(url):
    """Google スプレッドシート由来の google.com/url?q=... リダイレクトを展開する。"""
    if not url:
        return ""
    s = str(url).strip()
    if "google.com/url" in s.lower():
        m = re.search(r"[?&]q=([^&]+)", s)
        if m:
            from urllib.parse import unquote

            return unwrap_url(unquote(m.group(1)))
    return s


def canonical_url(url, platform=None, vid=None):
    """リダイレクトを展開し、YouTube は動画 ID から正規 URL を組み立てる。"""
    s = unwrap_url(url)
    if not s:
        return ""
    if platform is None:
        platform, vid = parse_link(s)
    if platform == "youtube" and vid:
        return "https://www.youtube.com/watch?v={}".format(vid)
    return s


def parse_link(url):
    if not url:
        return "other", ""
    u = str(url).strip()
    low = u.lower()
    if "google.com/url" in low or "google.com/url?" in low:
        m = re.search(r"[?&]q=([^&]+)", u)
        if m:
            from urllib.parse import unquote

            return parse_link(unquote(m.group(1)))
    if "youtu.be/" in low:
        vid = u.split("youtu.be/", 1)[1].split("?")[0].split("&")[0].strip("/")
        return "youtube", re.sub(r"[^A-Za-z0-9_-]", "", vid)
    if "youtube.com" in low:
        m = re.search(r"(?:[?&]v=|/shorts/|/embed/|/live/|/v/)([A-Za-z0-9_-]{6,})", u)
        return "youtube", (m.group(1) if m else "")
    if "twitch.tv" in low:
        return "twitch", ""
    if "nicovideo.jp" in low:
        return "niconico", ""
    if "abema.tv" in low:
        return "abema", ""
    if "x.com" in low or "twitter.com" in low:
        return "x", ""
    if "twitcasting.tv" in low:
        return "twitcasting", ""
    if "radiko.jp" in low:
        return "radiko", ""
    if "google.com" in low:
        return "search", ""
    if "instagram.com" in low:
        return "instagram", ""
    if "tiktok.com" in low:
        return "tiktok", ""
    return "web", ""


def classify(content, title):
    c = norm(content)
    t = norm(title)
    if "公式切り抜き" in c:
        return "clip"
    if c == "Shorts" or c.startswith("Shorts"):
        return "short"
    if "切り抜き" in t and c == "":
        return "clip"
    return "live"


def num(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None


# ---------------------------------------------------------------- month sheets


MONTH_HEADER = re.compile(r"^(\d{1,2})月$")
FOOTER_WORDS = ("总时间", "総時間", "总時間")


def parse_month_sheet(ws, year, month, ctx):
    """解析一个月表；返回 (streams, footer_hours)。

    - A 列：月内日；只有当天首行有值
    - B 列：标题（带 hyperlink）
    - B 为空但 C/D/F/G 有值 -> 上一条配信的分段
    - 尾部 '总时间' 行 -> 官方月合计，解析停止
    """
    streams = []
    footer = None
    cur_day = None
    cur = None
    day_seq = defaultdict(int)

    for r in range(2, ws.max_row + 1):
        ca = ws.cell(r, 1)
        cb = ws.cell(r, 2)
        cc = ws.cell(r, 3)
        cd = ws.cell(r, 4)
        ce = ws.cell(r, 5)
        cf = ws.cell(r, 6)
        cg = ws.cell(r, 7)

        a, b, c, d, e, f, g = (
            ca.value, cb.value, cc.value, cd.value, ce.value, cf.value, cg.value,
        )
        blob = " ".join(norm(x) for x in (a, b, c))
        if any(w in blob for w in FOOTER_WORDS):
            hours = None
            for cand in (d, cc.value, cd.value):
                nv = num(cand)
                if nv is not None:
                    hours = nv / 60.0
                    break
            nxt = num(ws.cell(r + 1, 4).value) if r + 1 <= ws.max_row else None
            if hours is None and nxt is not None:
                hours = nxt
            footer = round(hours, 2) if hours else None
            break

        if isinstance(a, str) and MONTH_HEADER.match(a.strip()):
            month = int(MONTH_HEADER.match(a.strip()).group(1))
            cur_day = None
            continue

        if isinstance(b, str) and b.strip() in ("标题", "タイトル"):
            continue

        av = num(a)
        if av is not None:
            day = int(av)
            if 1 <= day <= 31:
                cur_day = day
            elif not isinstance(b, (int, float)) and b in (None, ""):
                cur_day = None

        has_title = b is not None and norm(b) != ""
        has_body = any(
            x not in (None, "") and norm(x) != ""
            for x in (c, d, e, f, g)
        )

        if has_title:
            if cur_day is None:
                ctx["anomalies"].append("{} {}: 标题行缺少日期: {}".format(year, month, norm(b)[:40]))
                continue
            day_seq[cur_day] += 1
            date = datetime.date(year, month, cur_day)
            partners = split_names(f)
            st = {
                "i": "{}-{:02d}-{:02d}-{:02d}".format(year, month, cur_day, day_seq[cur_day]),
                "d": iso(date),
                "t": norm(b),
                "u": cell_link(cb),
                "m": 0.0,
                "c": norm(c),
                "e": norm(e),
                "r": partners,
                "n": norm(g),
                "k": classify(c, b),
                "g": [],
            }
            st["p"], st["v"] = parse_link(st["u"])
            st["u"] = canonical_url(st["u"], st["p"], st["v"])
            dv = num(d)
            if dv is not None:
                st["m"] += dv
            cur = st
            streams.append(st)
        elif has_body and cur is not None:
            seg = {}
            if norm(c):
                seg["c"] = norm(c)
            if norm(f):
                extra = split_names(f)
                for name in extra:
                    if name not in cur["r"]:
                        cur["r"].append(name)
            dv = num(d)
            if dv is not None:
                cur["m"] += dv
                seg["m"] = dv
            if norm(c):
                cur["g"].append(seg)
            elif dv is not None:
                cur["g"].append(seg)
        # 只有日期没有内容的行直接忽略

    return streams, footer, month


def load_workbook(path):
    return openpyxl.load_workbook(path, data_only=True)


# ------------------------------------------------------------------- sections


MILESTONE_JA = OrderedDict(
    [
        ("首次发推", "初ツイート"),
        ("Vtuber出道", "VTuberデビュー"),
        ("ChroNoiR成立", "ChroNoiR結成"),
        ("にじさんじゲーマーズ出道", "にじさんじゲーマーズデビュー"),
        # 「葛葉の日」（2023-09-28）はユーザー指定で概要から外す
        ("ド葛本社成立", "ド葛本社結成"),
        ("生日", "誕生日"),
    ]
)

# 源表中年份与其它证据冲突的几处（源表明显笔误），此处修正并在报告里列出。
# ド葛本社結成・誕生日は源表が 2023 表記だが、いずれも 2018 年の出来事として扱う。
MILESTONE_FIX = {
    "初ツイート": "2018-03-06",
    "VTuberデビュー": "2018-03-08",
    "ド葛本社結成": "2018-11-07",
    "誕生日": "2018-11-10",
}

# 概要シートの「関連サイト」見出しは中国語混在なので、站点表示用に日本語へ揃える。
LINK_LABEL_JA = {
    "YouTube": "YouTube",
    "X账号": "X（メイン）",
    "X小号": "X（サブ）",
    "X staff账号": "スタッフX",
    "Instagram": "Instagram",
    "TikTok": "TikTok",
    "旧主页": "旧公式サイト",
    "新主页": "公式サイト",
    "环球音乐主页": "レーベル",
    "非公式wiki": "非公式Wiki",
    "ChroNoiR YouTube": "ChroNoiR（YouTube）",
    "ChroNoiR X": "ChroNoiR（X）",
    "にじさんじ官网": "にじさんじ（公式）",
    "にじさんじ官方X": "にじさんじ（公式X）",
    "にじさんじ官店": "にじさんじストア",
    "にじさんじニコニコ频道": "にじさんじ（ニコニコ）",
    "ANYCOLOR官网": "ANYCOLOR",
}


def parse_overview(ws):
    milestones, links, raw = [], [], []
    for r in range(1, min(ws.max_row, 40) + 1):
        a = ws.cell(r, 1)
        b = norm(ws.cell(r, 2).value)
        dlabel = norm(ws.cell(r, 4).value)
        e = ws.cell(r, 5)
        etext = norm(e.value)
        if b:
            dt = to_date(a.value)
            raw.append((dt, b))
            if dt and b in MILESTONE_JA:
                label = MILESTONE_JA[b]
                fixed = MILESTONE_FIX.get(label)
                milestones.append({"d": fixed or iso(dt), "label": label, "src": iso(dt)})
        if dlabel and etext:
            url = canonical_url(cell_link(e))
            if not url:
                continue
            links.append({"label": LINK_LABEL_JA.get(dlabel, dlabel), "text": etext, "url": url})
    return milestones, links, raw


def parse_subscribers(ws):
    out = []
    for r in range(2, ws.max_row + 1):
        for col in range(1, 15, 2):
            nv = num(ws.cell(r, col).value)
            dv = to_date(ws.cell(r, col + 1).value)
            if nv is not None and dv is not None:
                out.append((dv, nv))
    out.sort(key=lambda x: (x[0], x[1]))
    dedup = []
    seen = set()
    for dv, nv in out:
        key = (iso(dv), nv)
        if key in seen:
            continue
        seen.add(key)
        dedup.append({"d": iso(dv), "n": int(nv)})
    return dedup


def parse_collections(ws):
    """直播合集：左侧 A/B/C 为游戏合集块，E 列另有一组「公式再生リスト」。"""
    out = []
    for r in range(2, ws.max_row + 1):
        vals = [norm(ws.cell(r, c).value) for c in range(1, 4)]
        if any(vals):
            url = canonical_url(
                cell_link(ws.cell(r, 2)) or cell_link(ws.cell(r, 3)) or cell_link(ws.cell(r, 1))
            )
            out.append({"g": vals[0], "c": vals[1], "l": vals[2], "u": url, "t": "game"})
        etext = norm(ws.cell(r, 5).value)
        if etext:
            out.append({"g": "", "c": etext, "l": "", "u": canonical_url(cell_link(ws.cell(r, 5))), "t": "list"})
    return out


def parse_songs(ws):
    songs = []
    for r in range(2, ws.max_row + 1):
        title_cell = ws.cell(r, 2)
        title = norm(title_cell.value)
        if not title:
            continue
        dt = to_date(ws.cell(r, 1).value)
        flags = {}
        for idx, key in ((7, "movie"), (8, "offline"), (9, "online"), (10, "cd")):
            v = ws.cell(r, idx).value
            if v not in (None, "") and norm(v) != "":
                flags[key] = norm(v)
        members = split_names(ws.cell(r, 5).value)
        songs.append(
            {
                "i": "sg{}".format(len(songs) + 1),
                "d": iso(dt),
                "t": title,
                "u": canonical_url(cell_link(title_cell)),
                "k": norm(ws.cell(r, 3).value),
                "e": norm(ws.cell(r, 4).value),
                "r": members,
                "n": norm(ws.cell(r, 6).value),
                "f": flags,
            }
        )
    return songs


def normalize_date_text(text):
    """大会の日付表記を YYYY.MM.DD（範囲は – 区切り）に統一する。"""
    if not text:
        return text
    t = text.strip()
    t = t.replace("年", ".").replace("月", ".").replace("日", "")
    for sep in ("~", "〜", "～", ",", "，", "、"):
        t = t.replace(sep, "–")
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"\s*\.\s*", ".", t)
    t = re.sub(r"\s*–\s*", "–", t)

    def pad(m):
        y, mo, d = m.group(1), m.group(2), m.group(3)
        return "{}.{:02d}.{:02d}".format(y, int(mo), int(d))

    def pad_ym(m):
        return "{}.{:02d}".format(m.group(1), int(m.group(2)))

    t = re.sub(r"(\d{4})\.(\d{1,2})\.(\d{1,2})", pad, t)
    t = re.sub(r"(\d{4})\.(\d{1,2})(?![\d.])", pad_ym, t)
    t = re.sub(r"(?<![\d.])\.", "", t)  # 先頭などの孤立したドット
    t = re.sub(r"\.{2,}", ".", t)
    t = re.sub(r"[–.]+$", "", t)
    return t.strip()


def parse_events(ws):
    events = []
    for r in range(2, ws.max_row + 1):
        name = norm(ws.cell(r, 2).value)
        if not name:
            continue
        raw = ws.cell(r, 1).value
        date = to_date(raw)
        if isinstance(raw, datetime.datetime):
            date_text = "{}.{:02d}.{:02d}".format(raw.year, raw.month, raw.day)
        elif isinstance(raw, datetime.date):
            date_text = "{}.{:02d}.{:02d}".format(raw.year, raw.month, raw.day)
        else:
            date_text = norm(raw)
            date_text = re.sub(r"\s+00:00:00$", "", date_text)
            date_text = normalize_date_text(date_text)
        if not date_text and date:
            date_text = iso(date)
        events.append(
            {
                "i": "ev{}".format(len(events) + 1),
                "dateText": date_text,
                "date": iso(date),
                "name": name,
                "content": norm(ws.cell(r, 3).value),
                "team": norm(ws.cell(r, 4).value),
                "result": norm(ws.cell(r, 5).value),
                "members": split_names(ws.cell(r, 6).value),
                "note": norm(ws.cell(r, 7).value),
                "announce": canonical_url(cell_link(ws.cell(r, 2))),
                "playlist": canonical_url(cell_link(ws.cell(r, 8))),
            }
        )
    return events


def parse_goods(ws):
    out = []
    for r in range(2, ws.max_row + 1):
        cell = ws.cell(r, 2)
        title = norm(cell.value)
        if not title:
            continue
        out.append(
            {
                "d": iso(to_date(ws.cell(r, 1).value)) or norm(ws.cell(r, 1).value),
                "t": title,
                "k": norm(ws.cell(r, 3).value),
                "n": norm(ws.cell(r, 4).value),
                "u": canonical_url(cell_link(cell)),
            }
        )
    return out


def parse_live_time(ws):
    """直播时间 表：年合计，用于校验。返回 {year: hours_total}"""
    years = {}
    hdr = [norm(c.value) for c in ws[1]]
    for i, h in enumerate(hdr):
        m = re.match(r"^(\d{4})", h)
        if m:
            years[int(m.group(1))] = i
    totals = {}
    for r in range(2, ws.max_row + 1):
        label = norm(ws.cell(r, 1).value)
        if label in ("合计", "合計", "总计"):
            for y, col in years.items():
                v = num(ws.cell(r, col + 1).value)
                if v is not None:
                    totals[y] = v
    return totals


def parse_renzoku(ws):
    """联动20XX：返回 {name: hours}"""
    out = {}
    for r in range(2, ws.max_row + 1):
        name = norm(ws.cell(r, 1).value)
        if not name:
            continue
        v = num(ws.cell(r, 14).value)
        if v is None:
            vals = [num(ws.cell(r, c).value) for c in range(2, 14)]
            vals = [x for x in vals if x is not None]
            v = sum(vals) if vals else None
        if v is not None and v > 0 and name not in ("ソロ", "コラボ"):
            out[name] = out.get(name, 0.0) + v
    return out


# --------------------------------------------------------------------- build


def main():
    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)

    ctx = {"anomalies": [], "errors": []}
    streams = []
    songs = []
    events = []
    goods = []
    collections = []
    milestones = []
    links = []
    subscribers = []
    official_hours = {}
    renzoku_hours = {}
    file_info = []

    for year in range(2018, 2027):
        path = os.path.join(DATA_DIR, "葛葉仓库{}.xlsx".format(year))
        if not os.path.exists(path):
            ctx["errors"].append("缺少文件: kzhdata/葛葉仓库{}.xlsx".format(year))
            continue
        wb = load_workbook(path)
        months_found = []
        month_keys = []
        for name in wb.sheetnames:
            if re.match(r"^\d{6}$", name):
                month_keys.append((int(name[4:6]), name))
            elif re.match(r"^\d{6}~\d{2}$", name):
                # 2018 的合并表 201803~06：从 3 月开始
                month_keys.append((int(name[4:6]), name))
        month_keys.sort()
        year_streams = 0
        for idx, (m, name) in enumerate(month_keys):
            ws = wb[name]
            got, footer, _ = parse_month_sheet(ws, year, m, ctx)
            streams.extend(got)
            year_streams += len(got)
            months_found.append("{}:{}".format(name, len(got)))
            if footer:
                official_hours[(year, m)] = footer
        # 歌 / 大会企划 / グッズ / 直播合集 是累计表：越晚的文件越全，后写覆盖前写
        if "歌" in wb.sheetnames:
            songs = parse_songs(wb["歌"])
        if "大会企画" in wb.sheetnames:
            events = parse_events(wb["大会企画"])
        if "グッズ&イベント" in wb.sheetnames:
            goods = parse_goods(wb["グッズ&イベント"])
        if "直播合集" in wb.sheetnames:
            collections = parse_collections(wb["直播合集"])
        if "概要" in wb.sheetnames:
            milestones, links, _raw = parse_overview(wb["概要"])
        if "订阅推移" in wb.sheetnames:
            latest_subs = parse_subscribers(wb["订阅推移"])
            if len(latest_subs) >= len(subscribers):
                subscribers = latest_subs
        if "直播时间" in wb.sheetnames:
            for y, h in parse_live_time(wb["直播时间"]).items():
                official_hours[("year", y)] = h
        for name in wb.sheetnames:
            if name.startswith("联动"):
                for k, v in parse_renzoku(wb[name]).items():
                    renzoku_hours[k] = renzoku_hours.get(k, 0.0) + v
        file_info.append(
            {
                "file": "kzhdata/葛葉仓库{}.xlsx".format(year),
                "months": ", ".join(months_found),
                "streams": year_streams,
            }
        )
        wb.close()

    # ------------------------------------------------------------ normalize
    streams.sort(key=lambda s: (s["d"], s["i"]))
    for s in streams:
        s["m"] = round(s["m"], 2) if s["m"] else 0.0
    songs.sort(key=lambda x: x["d"])
    events.sort(key=lambda x: x["date"] or x["dateText"])
    goods.sort(key=lambda x: x["d"], reverse=True)
    subscribers.sort(key=lambda x: (x["d"], x["n"]))

    # ------------------------------------------------------------- aggregates
    live = [s for s in streams if s["k"] == "live"]
    clips = [s for s in streams if s["k"] == "clip"]
    shorts = [s for s in streams if s["k"] == "short"]

    monthly = OrderedDict()
    for y in range(2018, 2027):
        for m in range(1, 13):
            monthly[(y, m)] = {"h": 0.0, "lh": 0.0, "n": 0, "cn": 0, "sn": 0, "chat": 0}
    for s in streams:
        y, m = int(s["d"][:4]), int(s["d"][5:7])
        cell = monthly[(y, m)]
        cell["n"] += 1
        cell["h"] += s["m"] / 60.0
        if s["k"] == "live":
            cell["lh"] += s["m"] / 60.0
        elif s["k"] == "clip":
            cell["cn"] += 1
        elif s["k"] == "short":
            cell["sn"] += 1

    yearly = OrderedDict()
    for y in range(2018, 2027):
        rows = [s for s in streams if s["d"][:4] == str(y)]
        yearly[y] = {
            "h": round(sum(r["m"] for r in rows) / 60.0, 1),
            "lh": round(sum(r["m"] for r in rows if r["k"] == "live") / 60.0, 1),
            "n": len(rows),
            "live": sum(1 for r in rows if r["k"] == "live"),
        }

    calendar = {}
    for s in live:
        if not s["m"]:
            continue
        cell = calendar.setdefault(s["d"], [0.0, 0])
        cell[0] += s["m"] / 60.0
        cell[1] += 1
    calendar = {k: [round(v[0], 2), v[1]] for k, v in sorted(calendar.items())}

    game_counter = Counter()
    game_hours = defaultdict(float)
    for s in live:
        key = s["c"] or "未分類"
        game_counter[key] += 1
        game_hours[key] += s["m"] / 60.0
    games = [
        {"name": n, "count": game_counter[n], "h": round(game_hours[n], 1)}
        for n in sorted(game_counter, key=lambda n: (-game_hours[n], -game_counter[n]))
    ][:24]

    partner_map = defaultdict(
        lambda: {"n": "", "s": 0, "h": 0.0, "so": 0, "ev": 0, "l": "", "f": "", "y": defaultdict(lambda: [0, 0.0])}
    )
    for s in streams:
        for name in s["r"]:
            p = partner_map[name]
            p["n"] = name
            p["s"] += 1
            p["y"][s["d"][:4]][0] += 1
            if s["k"] == "live":
                p["h"] += s["m"] / 60.0
                p["y"][s["d"][:4]][1] += s["m"] / 60.0
            if not p["l"] or s["d"] < p["l"]:
                p["l"] = s["d"]
            if s["d"] > p["f"]:
                p["f"] = s["d"]
    for sg in songs:
        for name in sg["r"]:
            partner_map[name]["so"] += 1
            p = partner_map[name]
            if not p["l"] or sg["d"] < p["l"]:
                p["l"] = sg["d"]
    for ev in events:
        for name in ev["members"]:
            partner_map[name]["ev"] += 1
    partners = sorted(
        (
            {
                "n": p["n"],
                "s": p["s"],
                "h": round(p["h"], 1),
                "so": p["so"],
                "ev": p["ev"],
                "l": p["l"],
                "f": p["f"],
                "y": {str(k): [v[0], round(v[1], 1)] for k, v in sorted(p["y"].items())},
            }
            for p in partner_map.values()
        ),
        key=lambda x: (-x["h"], -x["s"], x["n"]),
    )

    dates = [s["d"] for s in streams]
    meta = {
        "generated": iso(datetime.date.today()),
        "range": [min(dates) if dates else "", max(dates) if dates else ""],
        "years": [y for y in range(2018, 2027)],
        "counts": {
            "streams": len(streams),
            "live": len(live),
            "clips": len(clips),
            "shorts": len(shorts),
            "songs": len(songs),
            "events": len(events),
            "goods": len(goods),
            "collections": len(collections),
            "partners": len(partners),
            "hours": round(sum(s["m"] for s in live) / 60.0),
        },
        "milestones": sorted(milestones, key=lambda x: x["d"]),
        "links": links,
        "collections": collections,
        "subscribers": subscribers,
    }

    # 種類フィルタ用の内容グループ（歌ってみた は 歌 にまとめる）
    song_group = [x for x in streams if x["k"] == "live" and x["c"] in ("歌", "歌ってみた")]
    liveshow_group = [x for x in streams if x["k"] == "live" and x["c"] == "ライブ"]
    anken_group = [x for x in streams if x["k"] == "live" and x["c"] == "案件"]
    # 「公式番組」「番組」「歌」は配信ではないので独立した種類にする
    bangumi_group = [x for x in streams if x["k"] == "live" and x["c"] in ("公式番組", "番組")]
    SONG_CONTENTS = ("歌", "歌ってみた")
    BANGUMI_CONTENTS = ("公式番組", "番組")
    live_only = [x for x in live if x["c"] not in BANGUMI_CONTENTS and x["c"] not in SONG_CONTENTS]
    meta["counts"]["live"] = len(live_only)
    meta["counts"]["hours"] = round(sum(s["m"] for s in live_only) / 60.0)

    CONTENT_TYPES = (
        ("song", song_group),
        ("liveshow", liveshow_group),
        ("anken", anken_group),
        ("bangumi", bangumi_group),
    )

    stats = {
        "monthly": [
            {
                "y": y,
                "m": m,
                "h": round(monthly[(y, m)]["h"], 2),
                "lh": round(monthly[(y, m)]["lh"], 2),
                "n": monthly[(y, m)]["n"],
                "cn": monthly[(y, m)]["cn"],
                "sn": monthly[(y, m)]["sn"],
            }
            for (y, m) in sorted(monthly)
            if monthly[(y, m)]["n"]
        ],
        "yearly": [{"y": y, **v} for y, v in yearly.items() if v["n"]],
        "calendar": calendar,
        "games": games,
        "types": [
            {"k": "live", "n": len(live_only), "h": round(sum(s["m"] for s in live_only) / 60.0, 1)},
            {"k": "clip", "n": len(clips), "h": round(sum(s["m"] for s in clips) / 60.0, 1)},
            {"k": "short", "n": len(shorts), "h": round(sum(s["m"] for s in shorts) / 60.0, 1)},
        ] + [
            {"k": key, "n": len(group), "h": round(sum(s["m"] for s in group) / 60.0, 1)}
            for key, group in CONTENT_TYPES
        ],
    }

    # ------------------------------------------------------------------ write
    write_js("meta.js", "meta", meta)
    write_js("stats.js", "stats", stats)
    write_js("partners.js", "partners", partners)
    write_js("songs.js", "songs", songs)
    write_js("events.js", "events", events)
    write_js("goods.js", "goods", goods)
    write_js("streams.js", "streams", streams)

    # ----------------------------------------------------------------- report
    log("葛葉仓库 2018-2026 → 站点数据 构建报告")
    log("生成时间: {}".format(meta["generated"]))
    log("数据区间: {} 〜 {}".format(meta["range"][0], meta["range"][1]))
    log("")
    log("== 一、各文件解析情况 ==")
    for fi in file_info:
        log("  {file}: {streams} 条 | 月表 {months}".format(**fi))
    log("")
    log("== 二、总量 ==")
    log("  总条目: {streams}".format(**meta["counts"]))
    log("  配信: {live} / 公式切り抜き: {clips} / Shorts: {shorts}".format(**meta["counts"]))
    log("  配信总时长: {hours} 小时".format(**meta["counts"]))
    log("  歌: {songs} / 大会企划: {events} / 直播合集: {collections} / グッズ&イベント: {goods}".format(**meta["counts"]))
    log("  共演者(去重): {partners}".format(**meta["counts"]))
    log("")
    log("== 三、年度校验（与「直播时间」表对比）==")
    for y, v in yearly.items():
        if not v["n"]:
            continue
        off = official_hours.get(("year", y))
        diff = ""
        if off:
            d = (v["h"] - off) / off * 100 if off else 0
            diff = " | 官方 {:>8.1f} | 差 {:+.1f}%".format(off, d)
        log(
            "  {}: {:>4} 条 (配信 {:>3}) | 总 {:>8.1f} h | 配信 {:>8.1f} h{}".format(
                y, v["n"], v["live"], v["h"], v["lh"], diff
            )
        )
    log("")
    log("== 四、共演者 Top20（2023-2026 与「联动20XX」合计对比，口径不同仅供参考）==")
    recent = defaultdict(float)
    for s in streams:
        if s["k"] != "live" or s["d"] < "2023-01-01":
            continue
        for name in s["r"]:
            recent[name] += s["m"] / 60.0
    for p in partners[:20]:
        rz = renzoku_hours.get(p["n"])
        mine = recent.get(p["n"], 0.0)
        note = ""
        if rz:
            d = (mine - rz) / rz * 100 if rz else 0
            note = " | 2023-now {:>7.1f} h / 联动表 {:>7.1f} h / 差 {:+.0f}%".format(mine, rz, d)
        log("  {:<22} {:>8.1f} h {:>4} 配信 {:>3} 曲 {:>3} 大会{}".format(
            p["n"], p["h"], p["s"], p["so"], p["ev"], note))
    log("")
    log("== 五、数据质量 ==")
    ids = [s["i"] for s in streams]
    log("  ID 唯一: {}".format("是" if len(ids) == len(set(ids)) else "否 ({} 重复)".format(len(ids) - len(set(ids)))))
    log("  无链接条目: {}".format(sum(1 for s in streams if not s["u"])))
    log("  无时长条目: {}".format(sum(1 for s in streams if not s["m"])))
    log("  YouTube 链接: {} 条, 成功取出 videoId: {} 条".format(
        sum(1 for s in streams if s["p"] == "youtube"),
        sum(1 for s in streams if s["p"] == "youtube" and s["v"]),
    ))
    plat = Counter(s["p"] for s in streams)
    log("  平台分布: " + ", ".join("{}={}".format(k, v) for k, v in plat.most_common()))
    dates_all = [s["d"] for s in streams if s["d"]]
    log("  日期范围: {} 〜 {}".format(min(dates_all), max(dates_all)))
    bad = [s for s in streams if s["r"] and any(n == "葛葉" for n in s["r"])]
    log("  共演者中残留「葛葉」: {}".format(len(bad)))
    log("")
    log("== 六、里程碑（源表 vs 展示） ==")
    for ms in meta["milestones"]:
        fix = "" if ms["d"] == ms["src"] else "  ← 源表为 {}，按其它证据修正".format(ms["src"])
        log("  {} {}{}".format(ms["d"], ms["label"], fix))
    log("")
    log("== 七、异常与提示 ==")
    if ctx["anomalies"]:
        for a in ctx["anomalies"][:60]:
            log("  - " + a)
        if len(ctx["anomalies"]) > 60:
            log("  … 另有 {} 条".format(len(ctx["anomalies"]) - 60))
    else:
        log("  无")
    if ctx["errors"]:
        log("  错误:")
        for e in ctx["errors"]:
            log("    " + e)
    oncers = [p["n"] for p in partners if p["s"] == 1 and p["so"] == 0 and p["ev"] == 0]
    log("  仅出现 1 次的共演者(可能是名字变体): {} 人".format(len(oncers)))
    if oncers:
        log("    " + "、".join(oncers[:40]))
    log("")
    log("== 八、输出文件 ==")
    for name in ("meta.js", "stats.js", "partners.js", "songs.js", "events.js", "goods.js", "streams.js"):
        p = os.path.join(OUT_DIR, name)
        log("  {:<12} {:>8} KB".format(name, round(os.path.getsize(p) / 1024.0, 1)))

    with open(os.path.join(OUT_DIR, "build-report.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(REPORT))
    print("build ok: {} streams, {} songs, {} events, {} partners".format(
        len(streams), len(songs), len(events), len(partners)))


def write_js(filename, var, data):
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("/* generated by tools/build_site.py - do not edit */\n")
        fh.write("window.KZ = window.KZ || {};\n")
        fh.write("window.KZ.{} = ".format(var))
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        err = traceback.format_exc()
        try:
            with open(os.path.join(OUT_DIR, "build-error.txt"), "w", encoding="utf-8") as fh:
                fh.write(err)
        except Exception:
            pass
        sys.stderr.write("build failed\n")
        sys.exit(1)
