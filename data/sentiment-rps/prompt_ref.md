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

## Agent 指令模板（Step 2 并行模式用）

以下为派给各 Agent 的具体指令模板。主流程在 Step 2 中取对应 Agent 的实体列表，套入模板后 spawn。

### 板块/概念 Agent 模板

```
你是催化剂查询专员，负责 {N} 个 {实体类型} 的催化事件查询。

任务清单: {Python list of names}

对每个实体执行:
1. 调 wenda_news_query:
   query="{name}板块 最近重大利好政策订单涨价扩张突破"
   name="{name}"
   bdate="{bdate}"  ← 从 catalyst_cache 读 last_query_date 计算
   edate="{TODAY}"
   keywords="利好,政策,订单,涨价,扩张,突破,业绩"
2. 若返回数据 data 长度 > 1（有实际新闻）:
   提取第一条有效新闻 → 写≤80字摘要 → 调 Bash:
   python3 scripts/batch_catalyst_query.py write --type {sector|concept} --name "{name}" --date {event_date} --summary "{摘要}" --tag "{🔴|普通}" --source "{来源}"
3. 若返回空（data 仅表头行）: 写「近90天暂无重大催化」，tag=普通
4. 豁免实体直接写: 调 Bash 写入 "近90天暂无重大催化"

完成后汇报: "完成 {N} 个实体查询，写入 {M} 条事件"
```

### 个股 Agent 模板

```
你是催化剂查询专员，负责 {N} 只个股的催化事件和业务简介查询。

任务清单: {Python list of [code, name] pairs}

对每只个股执行:
1. 检查 stock_business.json 有无该 code:
   调 Bash: python3 -c "import json; d=json.load(open('dashboard/data/sentiment-rps/stock_business.json')); print('YES' if '{code}' in d else 'NO')"
2. 若无 → 调 wenda_report_query(code="{code}") 获取业务简介 → 写≤50字 → 调 Bash:
   python3 scripts/batch_catalyst_query.py write-business --code {code} --name "{name}" --business "{业务简介}" --date {TODAY}
3. 调 wenda_news_query:
   query="{name} 最近重大利好订单突破业绩项目"
   name="{name}"
   bdate="{bdate}"  ← 从 catalyst_cache 读 last_query_date 计算
   edate="{TODAY}"
   keywords="利好,订单,突破,业绩,项目"
4. 提取≤80字摘要 → 调 Bash:
   python3 scripts/batch_catalyst_query.py write --type stock --code {code} --name "{name}" --date {event_date} --summary "{摘要}" --tag "{🔴|普通}" --source "{来源}"
5. 若无新闻: 写「近90天暂无重大催化」，tag=普通

完成后汇报: "完成 {N} 只个股，写入 {M} 条事件 + {B} 条业务简介"
```
