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
│  ├─ index.html                     单页外壳
│  ├─ 404.html / robots.txt / .nojekyll
│  └─ assets/
│     ├─ css/site.css                设计令牌 + 组件样式 + 自托管字体 @font-face
│     ├─ fonts/*.woff2               拉丁字体（Russo One / Chakra Petch，共 37 KB）
│     ├─ js/app.js                   路由、筛选、渲染（IIFE，无依赖）
│     ├─ js/charts.js                手写 SVG 图表（折线 / 柱 / 热力 / 登録者）
│     └─ data/*.js                   生成数据（window.KZ.*）+ build-report.txt
├─ tools/build_site.py               xlsx → 站点数据（openpyxl）
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

当前结果：**5461 streams（4376 配信 / 983 切り抜き / 102 Shorts）、13817 h、375 歌（246 组）、213 大会企画、120 合集、220 グッズ、905 コラボ相手**；区间 2018-03-08〜2026-11-26。

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
- `charts.js`：`KZCharts.trend / yearlyBars / heatmap / subscribers / installTooltips`，纯手写 SVG，无第三方库。
- 筛选完全在前端内存里做（5461 条量级足够），改样式只动 `site.css`。

## 6. 字体

- 拉丁字体自托管（`site/assets/fonts/`），`index.html` 里已无任何 Google Fonts 外链。
- 日文不下载 Web 字体：Noto Sans JP 一个权重就约 1.1 MB，改为 `Noto Sans JP → Hiragino Sans → Yu Gothic UI → Meiryo` 系统字体栈。
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

### 自定义域名（可选）

1. 域名商加 CNAME 指向 `<账号>.github.io`。
2. Settings → Pages → Custom domain 填域名（会生成 `site/CNAME`）。
3. 勾选 Enforce HTTPS。境外服务器**不需要 ICP 备案**。

### 体积

- 首屏（不含 `streams.js`）≈ 0.45 MB，gzip ≈ 110 KB；`streams.js` 1.84 MB，gzip 369 KB。
- 字体 37 KB；封面直连 `i.ytimg.com`，不占仓库。
- 仓库：xlsx 4.7 MB + site 2.33 MB。

## 8. 已知限制

- 非官方数据；名字变体未合并（报告第七节列出只出现 1 次的 300 人）。
- 「联动」表与站内自算时长口径不同，站内数字偏大。
- 封面取自 YouTube `mqdefault`，非 YouTube 平台或视频失效时用渐变兜底。
- 2026 年数据截止 2026-11-26。

## 9. 改完后的自检

```powershell
# 语法
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' --check site/assets/js/app.js
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' --check site/assets/js/charts.js
# 重建 + 看报告
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' tools/build_site.py
# 本地打开
& 'C:\Users\xxx\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' -m http.server 8000 --directory site
```

`site.css` 花括号数量平衡、页面无 `undefined`/`NaN` 出现，基本就没问题。
