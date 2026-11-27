# 维护者说明（中文）

面向站点维护者：数据怎么来、怎么重建、怎么发布。读者版说明见 [README.md](README.md)（中文）
和 [README.ja.md](README.ja.md)（日文）。

---

## 1. 目录结构

```
KZHREPO/
├─ kzhdata/                         数据源（只读，脚本不写回）
│  └─ 葛葉仓库2018.xlsx … 2026.xlsx
├─ site/                              ← GitHub Pages 公开的就是这个目录
│  ├─ index.html                     单页外壳（中日双语，ja 默认）
│  ├─ 404.html / robots.txt / .nojekyll
│  └─ assets/
│     ├─ css/site.css                设计令牌 + 组件样式 + Geist @font-face
│     ├─ fonts/geist-latin.woff2     拉丁可变字体（29 KB，自托管）
│     ├─ js/app.js                   路由、筛选、渲染（IIFE，无依赖）
│     ├─ js/i18n.js                  中日文案字典 + 语言切换
│     ├─ js/icons.js                 Reicon 图标（构建产物，勿手改）
│     ├─ js/charts.js                手写 SVG 图表（折线 / 柱 / 热力 / 登録者）
│     └─ data/*.js                   生成数据（window.KZ.*）+ build-report.txt
├─ tools/build_site.py               xlsx → 站点数据（openpyxl）
├─ tools/build_icons.mjs             从 npm reicon 生成 icons.js（node）
├─ .github/workflows/pages.yml       push 到 main/master 时重建并发布
├─ design-system/kuzuha-archive/     ui-ux-pro-max 产物（MASTER.md / tokens.css / tokens.json）
└─ README.md / README.ja.md / MAINTAINER.md
```

本地预览（不要直接双击，字体在 `file://` 下会被 CORS 拦掉）：

```powershell
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' -m http.server 8000 --directory site
# → http://127.0.0.1:8000/
```

## 2. 重新生成数据

```powershell
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' tools/build_site.py
```

- 约 10 秒；只读 `kzhdata/` 下的 9 个 xlsx，输出到 `site/assets/data/`。
- 需要 `openpyxl`（DSH 捆绑 Python 已带；CI 里 `pip install openpyxl`）。
- 失败时写 `site/assets/data/build-error.txt`（含 traceback）。
- 每次都会重写 `build-report.txt`：解析情况、年度校验、共演者校对、数据质量、里程碑、输出文件。

## 3. 数据口径（改脚本前必读）

1. **月表 D 列单位是「分」**。2026-01-01 三行 187.75+38.217+0.767=226.73 分=3.766 h，与「直播2026」网格当日一致。解析时按分钟累加，最后 ÷60。
2. **月表末尾有页脚行**：B=`2026/01再生リスト`、C=`总时间：`、D=12913.2(分)、下一行 D=215.22(小时)。遇到含「总时间／総時間」的行必须停止，否则时长翻倍。
3. 日期列 A 只在该日首行有值；B 有值＝新配信，B 空但 C/D/F 有值＝上一条的分段，要合并到上一条。
4. 2018 年有一个合并 sheet `201803~06`（正则 `^\d{6}~\d{2}$`，月份取 `int(name[4:6])`），sheet 内有 `3月/4月…` 段头，会继续切换月份。
5. **歌 / 大会企画 / グッズ&イベント / 直播合集 / 概要 / 订阅推移 是累计表**：必须「后写覆盖前写」，取最晚文件（2026 册）。取第一个非空会得到 252 首歌、123 条大会的旧值。
6. 直播合集 sheet 是双区块：A/B/C＝游戏合集，E 列＝「公式再生リスト」（`t:"game"|"list"`）。
7. 直播20XX 网格只含本配信、且当月网格可能排除切り抜き，所以站内时长一律**按 type=live 行自算**，不用网格。

### 年度校验（build-report 第三节，差异突变＝解析错）

| 年 | 站内 vs「直播时间」表 |
| --- | --- |
| 2018 | +8.1%（官方未计 3–5 月） |
| 2019 | +1.3% |
| 2020 | +0.5% |
| 2021 | +0.0% |
| 2022 | −0.0% |
| 2023 | +1.4% |
| 2024 | +1.0% |
| 2025 | +3.7% |
| 2026 | 本配信 1387.4 h，与官方完全一致 |

共演者校对只比 2023–2026（「联动」表只有 2023+）；联动表与自算口径不同（自算按配信全尺×每位移，偏大），只作参考。

### 数据更新

数据源统一放在 `kzhdata/`（脚本按 `DATA_DIR` 读取，见 `tools/build_site.py:27`）。把旧的 xlsx 放回仓库根目录不会被读取。

- **新增配信**：改对应年册的月度 sheet，追加行，日期只写当日首行，保留「总时间」页脚行。
- **歌／大会／グッズ／合集／概要／订阅推移**：只能改最新一册（`kzhdata/葛葉仓库2026.xlsx`），改旧册会被覆盖。
- **新增一年（如 2027）**：新建文件之外，还要改 `tools/build_site.py` 里 5 处硬编码：`range(2018, 2027)` 位于 542 / 612 / 628 / 700 行，以及文件头注释和报告标题的「2018-2026」。
- 同一月份不要同时出现在两本年册（脚本按册子年份解析、跨文件不去重，会双份）；月份 sheet 必须放在同年册。
- 更新后看三处：命令行计数、`build-report.txt` 第三节（差异突变）、第五节（无时长/无链接/ID 唯一=否）。

当前结果：**5465 streams（3774 配信 / 478 番組 / 985 切り抜き / 102 Shorts）、13677 h（配信のみ）、376 歌（246 组/126 唱）、215 大会企画、120 合集、221 グッズ（うち 193 件が og:image 取得済み）、905 コラボ相手**；区间 2018-03-08〜2026-11-28。

## 4. 里程碑修正

源表 4 处年份疑似笔误，脚本按证据修正并在报告里保留原值：

| 展示 | 源表 |
| --- | --- |
| 2018-03-06 初ツイート | 2024-03-06 |
| 2018-03-08 VTuberデビュー | 2023-03-08 |
| 2018-11-07 ド葛本社結成 | 2023-11-07 |
| 2018-11-10 誕生日 | 2023-11-10 |

另：`葛葉の日` 已按要求从里程碑移除。

## 5. 前端结构

- `app.js`：hash 路由（`#/summary|streams|songs|events|collabs`）+ URL 状态 `?p=&y=&m=&c=&t=&r=&q=`；`ensureStreams()` 懒加载 1.84 MB 的 `streams.js`；所有点击走 document 级 `[data-act]` 委托。
- **筛选栏**（`#filter-bar`）：每个筛选项是一个 `.filter` 按钮 + `.filter-panel` 菜单，年月为二级菜单（`.filter-sub`）。多级菜单带开启延时 120ms、关闭延时 250ms 与安全三角区（`pointInTriangle`，鼠标从父项移向子菜单时保持打开）。
- `i18n.js`：`window.KZI18N`，字典 `dict.ja / dict.zh`，`t(key, {var})` 插值；`localStorage["kz-lang"]` 记忆语言；`applyStatic()` 处理 `[data-i18n]`、`[data-i18n-aria]`、`[data-i18n-placeholder]`。**只翻译界面**，视频标题、人名、曲名、分类等数据字段保持日语原文。
- `icons.js`：`window.KZ_ICON_DATA` + `window.KZIcon(name, cls)`，24×24 viewBox、1.5px 线条、`currentColor`。由 `tools/build_icons.mjs` 从 npm `reicon` 生成——加图标时改脚本里的名字列表再跑：
  ```powershell
  & 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' tools/build_icons.mjs
  ```
- `charts.js`：`KZCharts.trend / yearlyBars / heatmap / subscribers / installTooltips`，纯手写 SVG，无第三方库、无渐变（深色实线 + 单一强调色）。
- 筛选完全在前端内存里做（5465 条量级足够），改样式只动 `site.css`。
- **配色**：黑底中性（`--bg #0a0a0a`、`--ink #f2f2f2`、`--line #272727`）+ 单一强调色 `--accent #e5484d`；热力图 6 档 `--heat-0..5` = `#2b2b2b #414141 #5c5c5c #7d7d7d #a5a5a5 #e5484d`（0 = 当天没有配信，明显可见但很暗）。全站无渐变、无阴影；`color-scheme: dark`。
- **外部链接**：梗概页「公式リンク」只显示账号/频道名（`l.text`），不再叠加网站名；周边页商品名有超链接时渲染成 `.record-title a`（`goods` 数据里的 `u` 字段来自 xlsx B 列超链接）。
- **缩略图（og:image 直连，グッズ与大会共用）**：`tools/build_site.py` 的 `attach_og_images()` 为商品（`goods[].u`）与大会・企画（`events[].announce` → `playlist`）各抓一次页面，取出 `og:image` / `twitter:image` 的绝对 URL 存进 `m` 字段，缓存于 `tools/og-images.json`（键＝页面 URL，值为 `{src, ts, status}`）。**不下载图片**，前端 `thumbHtml()` 直接 `<img src>` 并带 `referrerpolicy="no-referrer"`；失败时 `onerror` 换成灰色占位块。缓存里 `status=fail` 的记录 7 天后重试；全量重抓：
  ```powershell
  & '<python>' tools/build_site.py --refresh-og-images
  ```
  构建报告的「八、画像（og:image）」会分别给出商品与大会的取得数与失败主机 Top5。图片版权归各权利者，本站为非官方存档，只做缩略图引用。
- **コラボ相手页 CTA**：`data-act="partner"` 在 `route==="collabs" && state.p===v` 时改为 `navigate("streams",{p:...,其余清空})`，否则会把自己这个筛选 toggle 掉。
- **热力图 tooltip**：用 `chart.dayTip`（`{y}年{m}月{d}日 / {h} 時間（{n} 本）`），与趋势图的 `chart.monthTip` 分开。
- **筛选菜单第一行**：每个菜单的第一项固定为「すべて／全部」（`groupHtml` 里 `{ v: "", label: t("filter.all") }`），不要再留空标签。
- **種類的划分**：`stats.types` 里 live / bangumi / song / clip / short 互斥，五者相加 = streams 总数（当前 3774 + 478 + 126 + 985 + 102 = 5465）；ライブ / 案件 是 live 的内容子类，与 live 重叠。`meta.counts.live` 与 `hours` 为**不含番組・歌**的口径，所以「配信の合計」= 13677 h。`公式番組` 与 `番組` 在 `typeLabelOf` 里都归为 `type.bangumi`；`歌` / `歌ってみた` 都归为 `type.song`。
- **大会日期**：`tools/build_site.py` 的 `normalize_date_text()` 把 `2019年11月23日~24日` 统一成 `2019.11.23–24`（`~〜～,，` → `–`，月日补零），前端只显示 `dateText`；改源表写法后重跑构建即可。
- **大会内容筛选**：events 页侧栏「内容」按 `e.content` 计数生成 chip（act `content` / key `c`），`handleAction` 在 `state.route==="events"` 时只 `setState`，不要 navigate 到 streams。
- **概要页表格**：只保留「配信カレンダー」下的月度表（`heatTable`）；「月別の配信時間」下的重复月表已移除。数值列 `<th class="num">` 与 `td.num` 同为右对齐 + `tabular-nums`，否则表头与数字错位。
- **不写「ソロ」**：组合/成员为空时留空（`take-unit`、`take-members`），卡片不再补「ソロ」标签；视频标题里原文出现的「ソロ」不动。
- **卡片上的「ほか N 人」**：`.more-tags` 常显（不要加 hover 才出现的 opacity），点开显示全部共演者。
- **书体切换**：`html:lang(zh)` 把 `--font` 换成 `--font-zh`（Noto Sans SC → Microsoft YaHei → PingFang SC …），避免中文用日文字形；数据文本（配信标题、人名、曲名、成绩、游戏名、備考）都带 `lang="ja"`，由 `html [lang="ja"] { font-family: var(--font-ja) }` 保持日文书体。新增数据字段的模板记得补 `lang="ja"`。
- **歌页活动筛选**：`songs[].n`（備考＝唱这首歌的活动）生成 `act:"event" / key:"n"` 的筛选组，URL 为 `#/songs?n=…`；`state.n` 要同时登记进 `parseHash` 默认值、`sameState`、`currentHash`、`hasFilters`、`handleAction`（`event` 分支）和 `clear`。没有備考的行只在不筛选时出现。
- **移动端抽屉导航**：`#nav-toggle`（≤767px 才显示，Reicon `menu` 图标）+ `#nav-scrim` + `#site-nav.is-open`；`setNav(open)` 负责 class、`aria-expanded`、`body.is-nav-open`（锁滚动）、焦点进出；`bindNav()` 绑定汉堡、遮罩、导航链接、Esc、`resize`（≥768 自动关闭），`hashchange` 里也会 `setNav(false)`。
- **封面**：`thumbFor()` 输出 `maxresdefault.jpg`（1280×720），`streamCard` 的 `onerror` 先换成 `hqdefault`、再失败就移除 `<img>` 露出占位层。高分屏清晰度依赖这一步，不要改回 `mqdefault`。
- **资源版本串**：`index.html` 里 `site.css?v=N`、各 `*.js?v=N`，`app.js` 顶部的 `ASSET_V = "N"` 用于 `streams.js?v=`。**每次改前端资源后把两处同时 +1**（HTML 的 `?v=` 与 `ASSET_V`，当前为 14），否则浏览器可能拿到旧的 css/js，出现「只更新了一半」的假象。

## 6. 字体与图标

- **Geist**（DESIGN.md 指定）：`site/assets/fonts/geist-latin.woff2`（可变字体，29 KB，latin 子集），`site.css` 顶部 `@font-face` + `--font` 首位。`index.html` 已无任何 Google Fonts 外链。
- 日本語・中国語とも Web フォントは積まない（CJK 1 ウェイト約 1 MB）：`--font-ja` = Noto Sans JP → Hiragino Sans → Yu Gothic UI → Meiryo、`--font-zh` = Noto Sans SC → Microsoft YaHei → PingFang SC → Hiragino Sans GB のシステムフォントで使い分ける。
- 图标：Reicon（`reicon@1.2.5`），本地生成，无 CDN 请求；线宽 1.5px，看板尺寸 24×24，显示时统一 `.icon` 18px。
- 想换成 Web 字体：把 woff2 放进 `site/assets/fonts/`，在 `site.css` 顶部加 `@font-face` 并把对应变量前移即可。

## 7. 发布到 GitHub Pages

| 文件 | 作用 |
| --- | --- |
| `.github/workflows/pages.yml` | push 到 main/master：装 openpyxl → 跑 `tools/build_site.py` → 发布 `site/` |
| `site/.nojekyll` | 跳过 Jekyll |
| `site/404.html` / `site/robots.txt` | 404 页 / 抓取允许 |

### 首次发布

```powershell
cd D:\DSH\KZHREPO
git init
git add .
git commit -m "葛葉 データアーカイブ"
git branch -M main
git remote add origin https://github.com/<账号>/<仓库名>.git
git push -u origin main
```

1. 先在 GitHub 建**空仓库**（不要勾 README/.gitignore/License）。
2. 仓库 → Settings → Pages → Source 选 **GitHub Actions**。
3. Actions 里等 `Deploy to GitHub Pages` 变绿，地址是 `https://<账号>.github.io/<仓库名>/`。

**报 `Get Pages site failed … Not Found`**：说明 Pages 还没启用。二选一：
1. 手动开：Settings → Pages → Source = GitHub Actions → Re-run failed jobs；
2. workflow 里 `configure-pages` 已带 `enablement: true`，重新 push / Re-run 即会自动启用（Organization 禁止成员开启 Pages 时会失败，需管理员）。

**如果 Pages 之前是 branch 模式**，必须手动切成 GitHub Actions，`enablement` 不覆盖旧配置。

### 之后的更新

改 `kzhdata/` 里的 xlsx → `git push` → CI 自动重建并发布。GitHub Pages 缓存 `max-age=600`（10 分钟），刚发布看不到变化属正常，Ctrl+F5。

**改了 css / js 时**：把 `site/index.html` 里所有 `?v=N` 与 `app.js` 顶部的 `ASSET_V` 同时 +1，再提交。否则 CDN/浏览器可能继续用旧文件，出现「HTML 是新的、样式还是旧的」这种半更新状态。

### 自定义域名（可选）

1. 域名商加 CNAME 指向 `<账号>.github.io`。
2. Settings → Pages → Custom domain 填域名（会生成 `site/CNAME`）。
3. 勾选 Enforce HTTPS。境外服务器**不需要 ICP 备案**。

### 体积

- 首屏（不含 `streams.js`）≈ 0.5 MB，gzip ≈ 120 KB；`streams.js` 1.84 MB，gzip 369 KB。
- 字体 29 KB + 图标 19 KB；封面直连 `i.ytimg.com`，不占仓库。
- 仓库：xlsx 4.7 MB + site 2.33 MB。

## 8. 已知限制

- 非官方数据；名字变体未合并（报告第七节列出只出现 1 次的 300 人）。
- 「联动」表与站内自算时长口径不同，站内数字偏大。
- 封面取自 YouTube `maxresdefault`（1280×720）；取不到时依次降级 `hqdefault`、占位块。非 YouTube 平台的配信只有占位。
- 手机端导航是抽屉（`#nav-toggle`）；`html`/`body` 设了 `overflow-x: clip`，新增横向滚动容器时请放在 `.heat-wrap` / `.table-wrap` 这类局部容器里，不要让它撑破页面。
- 2026 年数据截止 2026-11-28。

## 9. 改完后的自检

```powershell
# 语法
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' --check site/assets/js/app.js
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' --check site/assets/js/charts.js
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' --check site/assets/js/i18n.js
# 重建 + 看报告
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' tools/build_site.py
# 本地打开
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' -m http.server 8000 --directory site
```

- `site.css` 花括号数量平衡、页面无 `undefined`/`NaN` 出现，基本就没问题。
- 改了文案：确认 `i18n.js` 里 ja / zh 两份字典键一致（`.tmp\i18n_check.js` 会扫 `t("…")` 与 `data-i18n` 是否缺键）。
- 真实渲染回归：`.tmp\domtest` 下有 jsdom 脚本（`jsdom_test.js` / `menu_test.js` / `i18n_routes_test.js` / `fix_test.js` / `fix2_test.js`），需先 `python -m http.server 8899 --directory site`，再用捆绑 node 在该目录内执行。
- 注意：不要用 PowerShell `Get-Content/Set-Content` 改含中文或日文的 UTF-8 文件（会按 GBK 重编码），只用编辑器/工具写。
