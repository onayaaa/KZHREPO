# 葛葉 データアーカイブ｜2018–2026

把工作区里的「葛葉倉庫 2018–2026」九个 Excel 整理成一个站点：**站内正文全为日文**，本说明用中文。
数据来源只读，不改动任何 xlsx；所有页面内容由 `tools/build_site.py` 重新生成。

---

## 1. 打开方式

- **直接打开**：双击 `site/index.html`（`file://` 即可，脚本用相对路径加载，不需要服务器）。
- **本地服务器**（推荐，避免个别浏览器对 `file://` 的限制）：

```powershell
# 用 DSH 自带的 Python
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' -m http.server 8000 --directory site
# → http://127.0.0.1:8000/
```

站点是纯静态的（无构建、无框架、无外部网络请求），`streams.js` 约 1.8 MB，进入「配信」或「コラボ相手」时懒加载。

> 用 `file://` 直接双击时，Chrome 会因 CORS 拒绝加载本地 woff2（字体回退到系统字体，功能不受影响）；想看到完整的自托管字体效果，请用上面的本地服务器方式打开。

## 2. 目录结构

```
KZHREPO/
├─ 葛葉仓库2018.xlsx … 2026.xlsx     数据源（只读，未改动）
├─ site/                              ← GitHub Pages 里公开的就是这个目录
│  ├─ index.html                     单页外壳
│  ├─ 404.html                       未找到页面（GitHub Pages 会用它）
│  ├─ robots.txt
│  ├─ .nojekyll                       跳过 Jekyll 处理
│  └─ assets/
│     ├─ css/site.css                设计令牌 + 全部组件样式（含自托管字体 @font-face）
│     ├─ fonts/*.woff2               自托管的拉丁字体（Russo One / Chakra Petch）
│     ├─ js/app.js                   路由、筛选、渲染（IIFE，无依赖）
│     ├─ js/charts.js                手写 SVG 图表（折线 / 柱 / 日历热力 / 订阅者）
│     └─ data/*.js                   生成的数据（window.KZ.*）+ build-report.txt
├─ tools/build_site.py               xlsx → 站点数据（openpyxl）
├─ .github/workflows/pages.yml       push 到 main 时重建数据并发布到 GitHub Pages
├─ design-system/kuzuha-archive/     ui-ux-pro-max 产物（MASTER.md / tokens.css / tokens.json）
└─ README.md
```

## 3. 功能对照

> 站点正文里原「共演者」一词已按要求统一改为「コラボ相手」；本说明为中文，仍用「共演者」指代同一概念。

| 需求 | 实现 |
| --- | --- |
| 歌 / 大会 / 直播 都能按共演者筛选 | 顶栏全局搜索（输入即出候选：コラボ相手 905 人 + 配信タイトル，↑↓ 选择、Enter 确定）+ 侧栏 chip + 卡片上的相手标签；`?p=相手` 在配信、歌、大会三个视图间共享 |
| 直播显示封面和标题 | 每条配信 16:9 封面（YouTube `mqdefault`，非 YouTube 或失效时用渐变色兜底）+ 标题 + 时长 + 日期 + 内容/组合标签 |
| 歌按共演者筛选 | 「歌」页侧栏：分類 / ユニット / 共演者 Top10 + 搜索 |
| 大会按共演者筛选 | 「大会・企画」页：参加メンバー / グッズ種類 + 搜索（含 220 件グッズ）。注意：切到「イベント・グッズ」标签后不再显示「参加メンバー」（グッズ没有参与人员），搜索框也改为按商品名・種類检索 |
| 歌以曲为单位合并 | 同一曲名合成 1 条记录，标题下列出每次演唱的日期 / ユニット / メンバー / 展开（動画・CD 等）+ 视频链接；分页按曲数计 |
| コラボ相手主页 | `#/collabs?p=叶`：共演本数 / 时间 / 曲 / 大会 / 初共演 / 最終共演 / 年别柱 / 最近 6 本 / 一緒の曲・大会（都取最新的 6 条，按日期从新到旧） |
| コラボ相手按年筛选 | `#/collabs?y=2025`：侧栏「年」chip；列表与个人页的共演本数、时间、曲、大会都按该年重新统计（数据在 `partners.js` 的 `y` 字段 + `songs/events` 现算） |
| 配信卡片的共演者完整显示 | 卡片默认显示前 3 位共演者，超出时出现「もっと見る +N」，点击展开该卡全部标签，再点「閉じる」收起（只替换这张卡的标签区，不整页重绘） |
| 大会優勝强调与筛选 | 優勝行整行红底描边 + 实心「優勝」徽章，準優勝 / 3位 分级配色；工具栏显示「優勝 N 件」；侧栏「成績」可按 優勝 / 準優勝 / 3位 / 4〜10位 / 敗退・予選落ち / その他 / 記録なし 七类筛选（`?r=champion`，グッズ标签页忽略该条件） |

其他：年条（2018–2026）、URL 状态可分享（`#/streams?p=叶&y=2025&t=clip&q=…`）、概要页（6 个 KPI、年别柱图、あゆみ、月别折线、日历热力 + 数值表、よく共演する相手、よく遊ぶゲーム、登録者推移、官方链接、再生リスト）、60 条分页、无结果空状态。

交互细节：
- 概要页是总览页，不显示顶部年份条；年份筛选只出现在配信 / 歌 / 大会 / コラボ相手 四个浏览页。概要页 KPI 的第一张卡是「チャンネル登録者」。
- 概要页的成对卡片（年別の配信時間 / あゆみ、よく共演する相手 / よく遊ぶゲーム）高度一致；月份筛选只列出该年有配信记录的月份（如 2018 年从 3 月开始，1・2 月不出现）。
- 左侧筛选栏在桌面端独立滚动（`position: sticky` + `max-height: calc(100vh - header)` + `overflow-y: auto`），长筛选不再被视口截断；移动端仍是下拉抽屉。
- 订阅数折线只画线、不画数据点；鼠标/手指移到线上时显示该日期的竖线与人数（tooltip 跟随指针），移开即隐藏（图表下方另有「最新」与记录件数说明）。
- 顶栏搜索同时覆盖两类对象：输入后先列「コラボ相手」（按前缀优先、本数降序），再列「配信」标题（也匹配游戏名/企划名）；Enter 有候选时选当前项，无候选时若是相手名就进相手页，否则跳「配信」并按标题搜索；Esc 关闭、右侧 × 清空。
- 「歌」页的備考（メモ）不再截断：长文本换行显示全文；同日多分段仍按演唱记录逐条列出（日期 / ユニット / メンバー / 備考 / 视频）。
- 配信卡片的共演者默认只列 3 位（避免标题区被挤爆）；人数更多时显示「もっと見る +N」，展开后这张卡的标签全部列出并出现「閉じる」，状态记在 `expandedTags`，不重绘整页。
- 配信卡片左上角的徽章按实际内容区分：生放送是实心红「配信」；「切り抜き」「Shorts」单独标注；内容为「歌」「公式番組」「番組」「ライブ」的条目留在配信页里但徽章显示内容名（暗底粉字描边）；「歌ってみた」归到「歌」；「案件」在「配信」徽章旁再挂一个中性色「案件」徽章。切り抜き / Shorts 卡片下方的「ソロ」标签已去掉（配信卡片仍保留，表示单人配信）。
- 配信页侧栏「種類」除 配信 / 切り抜き / Shorts 外，还能按内容筛「歌」（含 歌ってみた，125 件）「ライブ」（40 件）「案件」（70 件）；URL 对应 `?t=song`、`?t=liveshow`、`?t=anken`。这些条目同时也计入「配信」。
- 大会・企画页的「イベント・グッズ」标签只保留「種類」筛选：グッズ没有参与人员，所以切换过去时侧栏不出现「参加メンバー」，搜索框改为「商品名・種類で検索」，URL 里残留的 `p=` 也会被忽略。
- 「コラボ相手」个人页的「一緒の曲」「一緒の大会」按日期从新到旧排序，只列最新 6 条，标题右侧标注「新しい順・N 曲中 6 曲」（时间段跟随年份筛选，选某一年时只看该年）。
- 大会・企画页把「成績」也纳入筛选：優勝行整行红色强调、实心「優勝」徽章，準優勝 / 3位 依次减弱；侧栏「成績」七个分类（優勝 40 / 準優勝 32 / 3位 9 / 4〜10位 / 敗退・予選落ち / その他 / 記録なし 41）。工具栏同时显示当前筛选结果里的「優勝 N 件」。
- 黑 + 红配色：底 `#08070A`、卡 `#141114`、主色 `#E11D48`、强调 `#FF3B5C`、热力色阶 `#171215 → #FF3B5C`；配信徽标为实心红，切り抜き / Shorts 用中性色以便区分。

## 4. 数据口径（重要）

1. **时长单位是「分」**。月表 D 列 `187.75` 表示 187.75 分钟；月表末尾有页脚行（B=`2026/01再生リスト`、C=`总时间：`），解析在页脚前停止，否则时长翻倍。
2. **日期只在当日首行**，其余行是分段（同日多游戏）；B 列为空但 C/D/F 有值 → 合并进上一条。
3. **汇总表是累计表**（歌 / 大会企划 / グッズ&イベント / 直播合集 / 概要），取最晚文件覆盖前一份；「直播合集」sheet 是双区块（A/B/C 游戏合集 + E 列公式再生リスト）。
4. **2018 合并表** `201803~06`：sheet 名正则 `^\d{6}~\d{2}$`，月份取 `int(name[4:6])`，行内 `3月/4月…` 段头继续切换月份。
5. **共演时长 = 配信全尺 × 每位移**，多人配信会重复计入，所以「共演时间」大于实际时长；「联动20XX」表的数值口径不同（偏小），只作报告对照，不作为站点数据。
6. **里程碑修正**：源表把初ツイート写成 2024-03-06、VTuberデビュー写成 2023-03-08，与订阅数据（2018-03 起）矛盾，站点改为 2018-03-06 / 2018-03-08；ド葛本社結成改为 2018-11-07、誕生日改为 2018-11-10（源表均写 2023）；「葛葉の日」按要求不再显示。修正处均在报告中标注原始日期。源表「狗」列按要求忽略。
7. 链接统一解包 `google.com/url?q=` 跳转，YouTube 一律还原为 `youtube.com/watch?v=ID`（2230 条被还原）。

### 年度校验（与源表「直播时间」对比）

| 年 | 配信 | 官方 | 差 |
| --- | --- | --- | --- |
| 2018 | 383.6 h | 355.0 h | +8.1%（官方未计 3–5 月） |
| 2019 | 1239.5 h | 1224.0 h | +1.3% |
| 2020 | 1959.8 h | 1951.0 h | +0.5% |
| 2021 | 1875.4 h | 1875.0 h | +0.0% |
| 2022 | 1515.9 h | 1516.0 h | −0.0% |
| 2023 | 1681.6 h | 1677.5 h | +1.4% |
| 2024 | 1832.8 h | 1832.2 h | +1.0% |
| 2025 | 1940.7 h | 1924.5 h | +3.7% |
| 2026 | 1387.4 h | 1387.4 h | 0（含切り抜き总 1470.5 h） |

总量：5461 条（配信 4376 / 公式切り抜き 983 / Shorts 102），配信 13817 小时，375 歌，213 大会企画，220 グッズ&イベント，120 再生リスト，905 共演者。

## 5. 重新生成数据

```powershell
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' tools/build_site.py
# build ok: 5461 streams, 375 songs, 213 events, 905 partners
```

脚本会重写 `site/assets/data/*.js` 与 `build-report.txt`（含逐月条数、年度校验、共演者 Top20、质量统计、异常列表）。控制台是 GBK，脚本所有日志写文件，避免中文输出报错。

## 6. 设计系统

由 `ui-ux-pro-max` 技能生成：

- `search.py --design-system "vtuber streamer archive data hub entertainment dark"` → Minimalism/Swiss + 蓝色，判定与语境不符；
- 重跑 `"gaming streamer archive dashboard dark neon" --variance 8 --motion 6 --density 7` → **Gaming** 色板命中：`#0F0F23` 底 / `#1E1C35` 卡 / `#7C3AED` 主 / `#A78BFA` 次 / `#F43F5E` 强调；
- `--domain chart` → Heat Map（需数值图例、不可只靠颜色）+ Line + Bullet；`--domain typography` → Japanese Elegant（Noto Sans JP 覆盖假名，Chakra Petch 无假名故作补充）。
- 字体：Russo One（拉丁标题/数字）+ Chakra Petch（拉丁正文）+ Noto Sans JP（日文）。
- 产物落在 `design-system/kuzuha-archive/`；站点 CSS 的 `:root` 直接继承其令牌。

**2026-11-26 主题改版**：按用户要求把主色改为黑 + 红，弃用 Gaming 色板的紫。新令牌已回写 `tokens.css` / `tokens.json`，与 `site/assets/css/site.css` 的 `:root` 一致：
`primary #E11D48` / `secondary #FB7185` / `accent #FF3B5C` / `background #08070A` / `card #141114` / `border #7A1229` / `ring #E11D48` / 前景 `#F3EEF0`。字体不变。

无障碍：跳转链接、`aria-current`、chip 用 `aria-pressed`、图表 `role="img"` + `aria-label`、折线与热力图都提供「表で見る」数值替代、`prefers-reduced-motion` 关闭入场动画、键盘焦点态可见。

## 7. 已知限制

- 2026 年 12 月无记录、11 月未结束，数据截至 2026-11-26。
- 371 条配信无时长（源表 `-`/`?`），卡片不显示时长角标。
- 18 条无链接；旧直播的平台链接可能失效（如 twitcasting / 已删除的 X 帖）。
- YouTube 封面在视频下架后会加载失败，此时显示渐变占位（不发请求重试）。
- 约 300 位只共演过 1 次的名字可能是同一人的写法差异（源表未规范化），站点原样呈现。

## 8. 发布到 GitHub Pages（外部可访问）

站点是纯静态的，**不需要服务器、数据库或构建服务**。仓库里已经准备好发布所需的全部文件：

| 文件 | 作用 |
| --- | --- |
| `.github/workflows/pages.yml` | push 到 `main` 时：装 openpyxl → 跑 `tools/build_site.py` → 把 `site/` 作为 Pages 产物发布 |
| `site/.nojekyll` | 关掉 Jekyll（否则以 `_` 开头的文件会被丢掉） |
| `site/404.html` | 404 页（自动套用站点的黑红风格） |
| `site/robots.txt` | 允许抓取 |
| `site/assets/fonts/` | 自托管字体，**已移除 Google Fonts 外链**（中国大陆可正常显示） |

### 8.1 第一次发布

1. 在 GitHub 新建仓库（Public），把整个工作区推上去（`.tmp/` 可选删除；9 个 xlsx 建议一起提交，CI 会重新生成数据）：

```powershell
git init
git add .
git commit -m "葛葉 データアーカイブ"
git branch -M main
git remote add origin https://github.com/<你的账号>/<仓库名>.git
git push -u origin main
```

2. 仓库 → Settings → Pages → **Source 选「GitHub Actions」**（不要选 Deploy from a branch）。
3. 回到 Actions 标签，等 `Deploy to GitHub Pages` 跑完（首次约 1 分钟）。
4. 访问 `https://<你的账号>.github.io/<仓库名>/`。仓库名若为 `<账号>.github.io`，则直接是根域。

> 不想用 Actions 也可以：把 `site/` 里的内容推到 `gh-pages` 分支，Pages 的 Source 选「Deploy from a branch → gh-pages / root」。这样每次更新要手动 build + 手动推。

### 8.2 之后的更新

- 改 xlsx → `git push` → CI 自动重建数据并重新发布，不需要手动跑任何命令。
- 想先本地看效果：跑 `python tools/build_site.py`，再 `python -m http.server 8000 --directory site`。
- GitHub Pages 的缓存是 `max-age=600`（10 分钟），刚发布后看不到变化属正常；强制刷新用 Ctrl+F5。

### 8.3 自定义域名（可选）

1. 域名商处加 CNAME 指向 `<账号>.github.io`。
2. 仓库 → Settings → Pages → Custom domain 填入域名（会生成 `site/CNAME`）。
3. 勾选 Enforce HTTPS。
   - 域名解析到 GitHub Pages 即**不需要 ICP 备案**（服务器在境外）。

### 8.4 体积与流量

- 站内首屏：`index.html` + CSS + JS + 除 `streams.js` 外的数据 ≈ 0.45 MB（gzip 约 110 KB）。
- `streams.js` 只在进入「配信 / コラボ相手」时加载：1.84 MB（gzip 369 KB）。
- 字体：拉丁 4 个 woff2 共约 37 KB；日文不下载 Web 字体，用 OS 标准字体（Windows 的 Yu Gothic / macOS 的 Hiragino / Android 的 Noto Sans CJK），避免每个字重 1 MB 以上的 CJK 字体拖慢首屏。
- 图片不占仓库：封面直接引用 YouTube 的 `i.ytimg.com`。

### 8.5 上线前检查清单

- [ ] `site/index.html` 里没有 Google Fonts 等外部字体请求（已清理）
- [ ] 手机打开一次，确认侧栏抽屉、卡片、图表都能用
- [ ] 页脚「このデータについて」写明非官方、データ出典
- [ ] 若用自定义域名：DNS 生效 + HTTPS 已签发
