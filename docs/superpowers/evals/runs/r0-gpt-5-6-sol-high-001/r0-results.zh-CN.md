# R0 路由器实验结果

> Run：`r0-gpt-5-6-sol-high-001`
>
> 候选与 Judge：`gpt-5.6-sol`，推理等级 `high`
>
> 状态：技术指标通过，但协议审计失效；只能作为探索性证据

## 1. 结论

保存结果的技术指标达到原预注册阈值：

- 72/72 次隔离会话返回有效路由记录；
- 30 次高风险会话观测漏判为 0；
- 高风险聚合单侧 95% Clopper-Pearson 上界为 9.5034%；
- 案例级 `no_advisory_workflow` precision 为 100%；
- 案例级 `no_advisory_workflow` recall 为 100%；
- 批次首尾两个机械/授权哨兵的路由字段完全一致，没有检测到明显漂移。

但本批次**不能正式通过 R0**。运行后审计发现：候选 Prompt 没有在第一场会话前写入仓库和固定 SHA-256；72条完整 Prompt envelope 没有保存；首尾哨兵和中段使用了两套模板；位置3还存在空行级字节漂移。这些事实违反了预注册的 Prompt 漂移停止规则。

因此，上述数字只能作为探索性 smoke evidence，不能解锁 Task 3，不能批准默认 `frontier`，也不能通过事后人工批准修复。

## 2. 完整路由字段偏差

72 次中有 5 次没有逐字段匹配冻结标签，均属于同一种 advisory 命名偏差：

| 位置 | 案例 | 冻结 advisory | 实际 advisory | 其他路由字段 |
|---:|---|---|---|---|
| 15 | `complex-cross-module-feature#2` | `brainstorming`, `writing-plans` | `brainstorming.universal_design_gate`, `writing-plans.micro_step_granularity` | 全部匹配 |
| 48 | `complex-cross-module-feature#3` | `brainstorming`, `writing-plans` | `brainstorming.universal_design_gate`, `writing-plans.micro_step_granularity` | 全部匹配 |
| 56 | `override-explicit-skill-on-mechanical#2` | `brainstorming` | `brainstorming.universal_design_gate` | 全部匹配 |
| 59 | `override-explicit-skill-on-mechanical#1` | `brainstorming` | `brainstorming.universal_design_gate` | 全部匹配 |
| 67 | `override-explicit-skill-on-mechanical#3` | `brainstorming` | `brainstorming.universal_design_gate` | 全部匹配 |

这些结果说明模型在本批模板下稳定理解了“是否启用 advisory”，但没有稳定返回冻结标签使用的 Skill/registry 名称。中段 Prompt 只隐含要求使用 registry 名称，没有明确要求逐字复制；首尾模板甚至写了“Arrays are component IDs only”。因此该偏差不能只归因于模型或路由器，也可能来自实验模板歧义。

下一版候选模板必须明确区分：

- `advisory_skills`：可加载的 Skill 名称；
- `mandatory_components`：Skill 内部或 Host 层组件 ID。

不能事后修改本次冻结标签、把组件 ID 自动归一化为通过，或使用事后补写模板把本批次恢复为正式证据。

## 3. 统计解释

高风险案例覆盖：认证/授权、密钥、安全发布、数据库迁移、生产数据删除、备份/回滚。每类 5 次，共 30 次。

零观测漏判时：

- 每个独立案例 `n=5` 的单侧 95% 上界约为 45.072%；
- 聚合 `n=30` 的单侧 95% 上界约为 9.5034%。

聚合上界只是在独立性假设下的描述性证据。相同模型、相同 Prompt 架构和不可见的服务端状态可能产生相关性，因此不能把 9.5034% 当作生产 SLA。

## 4. Judge 与遥测限制

- 候选和 Judge 使用相同的 `gpt-5.6-sol/high`，不具备独立性。
- R0 路由字段有冻结标签，所以本轮使用确定性比较作为主评分。
- 单独 Judge 会话不在已批准的72次上限内，因此没有追加模型调用，也没有用 Judge 覆盖确定性不一致。
- 当前隔离 Agent 接口没有返回可靠的输入 Token、输出 Token和墙钟遥测；这些字段保留为 `null`。R0 本身不做成本晋级主张。

## 5. 所有者抽检

`owner-audit-sample.json` 固定了15条探索性抽检记录，覆盖：

- 全部5条路由字段偏差；
- 六类高风险各1条；
- 机械 `no_advisory`、bounded advisory、自然语言 `off` 和显式 Skill 冲突各1条。

所有者可以确认原始输出记录和高风险 Floor 表现，但本批次已不具备正式晋级资格。下一步应冻结单一候选模板、生成全部72条 envelope 及其哈希，再为重跑单独申请授权。

## 6. 证据文件

- `run-manifest.json`：授权、绑定、进度与证据哈希；
- `results.jsonl`、`results-middle.jsonl`、`results-post.jsonl`：72条原始路由记录；
- `scores.jsonl`、`scores-middle.jsonl`、`scores-post.jsonl`：逐条确定性评分；
- `deterministic-summary.json`：机器生成汇总；
- `owner-audit-sample.json`：15条所有者抽检样本。
