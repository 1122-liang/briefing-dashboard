# 盘后主线分析 — Prompt 参考附件

> 自动化 Prompt 中通过「参考 prompt_ref.md」引用本文档。
> 更新本文后无需修改 Prompt。

## 催化剂摘要格式

每条 ≤80字，格式: "{日期简述} {事件内容}"
- 业绩: "Q2净利3.1-3.6亿同比+276%, 光模块订单大增带动毛利率提升"
- 政策: "AI芯片出口管制升级至第三国, 国内封测需求有望转移"
- 订单: "中标12亿信创服务器项目(BMC芯片), 预计Q4交付"
- 技术: "CPO硅光方案通过客户验证, 东吴首予增持评级"
- 无催化: "近90天暂无重大催化"
- 🔴 前缀：政策级别变动 / 订单≥1亿 / 技术重大突破 / 业绩超预期50%+

## 个股业务简介格式

格式: "{一句话业务}。关联: {板块1}, {概念1}"
示例: "国内封测龙头, 主营芯片封装测试, 深度绑定华为/AMD供应链。关联: 半导体, 先进封装概念, AI芯片"
≤50字。

---

# 催化剂查询工具：scripts/catalyst_query.py

数据源 **neodata 财经资讯搜索**。返回域名全部为 `gu.qq.com`（腾讯自选股），实测零 `.gov.cn`，
无合规风险。已替代原先的第三方通达信连接器数据源（其未授权、每次运行触发登录窗，已弃用）。

## 凭证

Token 缓存于 `~/.workbuddy/skills/.neodata_token`，**有效期 12 小时**（每日运行必过期）。

| 场景 | 操作 |
|---|---|
| 检查 | `python3 scripts/catalyst_query.py check-token`（退出码 0=有效 / 2=过期或缺失） |
| 刷新 | 先调 `connect_cloud_service` 取 clientTempToken，再 `catalyst_query.py save-token --token "<值>"` |

`connect_cloud_service` 为宿主内置能力，**不依赖任何连接器授权**，无弹窗。

## 批量查询（Step 2 主用）

```bash
python3 scripts/catalyst_query.py batch --names "焦炭,氨纶,果蔬加工" --type sector \
    --since-from-cache --today {TODAY} --max-new 2
```

`--since-from-cache` 由脚本自动推导每个实体的查询起点，Agent 无需读缓存算日期：

| 条件 | since | since_mode |
|---|---|---|
| 缓存无该实体 | TODAY − 3 | `bootstrap_no_history` |
| TODAY − last_query_date > 7 天（历史缺口） | TODAY − 3 | `bootstrap_gap_Nd` |
| 其余 | last_query_date + 1 | `incremental` |
| last_query_date == TODAY | TODAY | `already_queried_today` |

缺口超阈值时按 3 日回看处理，**不回补历史缺口**（避免一次性写入二十余天旧闻）。
可用参数：`--bootstrap-days`（默认 3）、`--max-gap-days`（默认 7）、`--since`（显式覆盖全部实体）。

## 输出契约

顶层：`ok` / `entity_type` / `count` / `ok_count` / `fail_count` / `with_new_count` /
`today` / `token_status` / `since_from_cache` / `cache_entities` / `results[]`

`results[]` 每项：`entity` / `since` / `since_mode` / `raw_count` / `dedup_count` /
`gov_filtered` / `new_count` / `items[]`

`items[]` 每项：`date` / `datetime` / `title` / `tag` / `domain` / `url` / `content` / `is_new`

脚本内已完成 4 层精炼，Agent 无需解析原始 JSON：
1. 按 `publishTime` 倒序重排（neodata 返回是相关性序，非时间序）
2. 去重（标题归一化 + 同日）
3. 合规过滤（丢弃 `.gov.cn` / `.gov` / `.mil`）
4. 正文裁剪至 300 字

## 判定规则

- `new_count > 0` → 取 `items[0]`（`is_new=true`，最新增量）的 date + title/content 生成 ≤80 字摘要
- `new_count == 0` → 写 `--date {TODAY} --summary "近90天暂无重大催化" --tag "普通"`

> ⚠️ `"近90天暂无重大催化"` 是 `scripts/generate_mainline_report.py`、`fix_mainline_report.py`
> 等下游脚本依赖的**精确字面量**，不得改写为「今日无新增催化」等变体。

## 退出码

| 码 | 含义 | Agent 动作 |
|:--:|---|---|
| 0 | 成功（new_count 可为 0） | 正常处理 |
| 2 | 凭证缺失/过期 | 刷新凭证后重试 |
| 3 | 接口/网络失败（已重试 2×3s） | 降级 WebSearch |
| 4 | 参数错误 | 修正命令 |

## 降级路径

neodata 不可用时改用 WebSearch 逐实体查询：

```
query = "{name} 板块 最近 利好 订单 涨价 业绩"   ← 严禁包含「政策」二字
```

**为何禁用「政策」**：实测含「政策」关键词时约 60% 结果落在 `.gov.cn`
（托育服务 3/5、果蔬加工 3/5 命中政府公文），违反项目合规铁律；不含时 0/14。
降级时须丢弃所有 `.gov.cn` 结果，`--source` 记为 `"WebSearch"`。

---

# 缓存清理：scripts/batch_catalyst_query.py clean（Step 3 用）

```
python3 scripts/batch_catalyst_query.py clean --date {TODAY}
```

输出 JSON：`ok` / `today` / `cutoff` / `before` / `after` / `removed_stale` /
`removed_dup` / `sectors` / `concepts`。退出码 0=成功，1=缓存不存在或读取失败。

**必须用本命令，不要现场手写 Python 做去重。**

## 为何禁止手写（2026-09-01 事故）

去重键是 **四键**：`entity_type` + `entity_name` + `event_date` + `event_summary`。

`entity_name` **不可省**。不同实体会写出**完全相同的摘要字面量** —— 典型是两个板块
同时判定「近90天暂无重大催化」，摘要一字不差。此时三键去重会跨实体误删，
2026-09-01「代糖概念」即因此丢失（当时与「血氧仪」同摘要）。

该事故的现场至今仍存于缓存中（`concept / 20260901 / "近90天暂无重大催化"` 涉及血氧仪、
代糖概念两个实体），只要再有脚本按三键去重就会重演。

## 两条附带规则

1. **`keep="last"`**：重复写入时以新行的 `last_query_date` 为准。若保留旧行，
   `last_query_date` 不会前进到 TODAY，Step 7「`last_query_date == TODAY`」校验会误判
   该实体缺失，进而触发 Step 2 重查并陷入循环。
2. **90 天清理须保留「最近查询过」的行**：判据是
   `event_date >= cutoff` **或** `last_query_date >= cutoff`。
   仅按 `event_date` 清理，会把刚写入的增量水位（`last_query_date=TODAY` 但事件较老）
   在同一轮运行的后续写入中清掉。

改动本命令的去重/清理逻辑后，须跑回归测试确认三条不变量：

```
python3 scripts/test_catalyst_cache_dedup.py     # 13 项断言，退出码 0=通过
```

---

# Agent 指令模板（Step 2 并行模式用）

## 板块/概念 Agent 模板

```
你是催化剂查询专员，负责 {N} 个 {实体类型} 的催化事件查询。

任务清单: {Python list of names}
当日日期 TODAY={YYYYMMDD}

执行步骤:
1. 一次性批量查询（不要逐实体单独调用）:
   python3 scripts/catalyst_query.py batch --names "<用逗号连接的全部实体名>" \
       --type {sector|concept} --since-from-cache --today {TODAY} --max-new 2
   输出为 JSON, 含 results[] 数组, 每项有 entity / new_count / items[]。

2. 遍历 results, 对每个实体:
   - new_count > 0 → 取 items[0]（is_new=true, 最新增量）的 title + content,
     生成 ≤80 字催化摘要（按 prompt_ref.md「催化剂摘要格式」）,
     重大事件加 🔴 前缀, 然后写缓存:
     python3 scripts/batch_catalyst_query.py write --type {sector|concept} \
         --name "{entity}" --date {items[0].date} --summary "{摘要}" --tag "{🔴|普通}" --source "neodata"
   - new_count == 0 → 写:
     python3 scripts/batch_catalyst_query.py write --type {sector|concept} \
         --name "{entity}" --date {TODAY} --summary "近90天暂无重大催化" --tag "普通" --source "neodata"

3. 脚本 ok=false 或 fail_count>0 时, 对失败实体改用 WebSearch 降级
   （query 严禁含「政策」二字, 丢弃 .gov.cn 结果, --source 记 "WebSearch"）。

完成后汇报: "完成 {N} 个实体查询，写入 {M} 条事件（其中 {K} 条有实际催化）"
```

## 个股模板

**已废弃。** 主流程 Step 2 明确规定「个股不查询催化」，报告中的 `new_stocks`
仅含 `code/name/red_level/sector_l3`，无需任何催化或业务简介查询。
