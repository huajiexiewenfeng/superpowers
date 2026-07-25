# A0 探索路由本地预基线

> Run：`a0-exploratory-routing-red-001`
>
> 状态：Superpowers 侧评测合同与确定性 RED 已提交冻结；跨仓库正式冻结和真实宿主调用基线尚未完成

## 结论

当前 A0 夹具已经能表达「探索讨论」与「正式设计/交付」的不同预期，runner 也能在不泄漏金标的前提下评分这些声明：

- Thinking Skills runner 的 24 项测试全部通过。Route 必须穷举自报的 `advisory_components`；Integration 的 trace 必须走独立 evaluator 通道，绑定 case/run/Prompt/response/adapter/event hash，按 `discovered → selected → loaded` 校验生命周期，要求 domain 集合精确匹配，并让 forbidden Skill 跨 role 在 selection 阶段就失败；带 `human_rubric` 的回答只会进入 `needs_review`，partial coverage 和缺实验身份的 legacy run 都不会产生分数提升。
- Superpowers 的确定性 policy-table 进入目标 RED：当前规则仍把探索 case 的 `brainstorming` 选入 advisory，实际结果为 `selected_advisory_workflow`。
- 同主题正式规格和 React todo 两个确定性正控继续选择 `brainstorming`，所以失败不是通过全局关闭 brainstorming 制造出来的。
- A0 案例已拆到独立夹具 `tests/frontier-routing/a0-exploratory-routing-cases.json`；原 R0 `routing-cases.json` 恢复冻结哈希，旧实验契约不再被 A0 污染。
- Superpowers 侧的设计、夹具、测试和本地证据已由提交 `5c5f9f92c2a019173a6fa35174205f5d4cbb43cf` 保存，可以恢复该侧的精确字节。
- `brainstorming`、`using-superpowers`、`thinking-router` 与 `technical-deep-dive` 的目标行为文件均未修改；两个 Superpowers Skill 的仓库与安装副本逐字节一致。

## 证据边界

这次 RED 只证明冻结夹具中的当前 policy-table 缺少探索阶段的 activation predicate。它不证明 Codex 宿主在真实会话中已经发现、选择或加载了 Skill，也不能用模型自报 route 代替宿主事件。

当前文件记录了 Superpowers 与 Thinking Skills 工作树的 SHA-256，并把 A0 与旧 R0 夹具隔离。Superpowers 侧已有可恢复提交；但尚未归档 Thinking Skills 对应 source snapshot/patch，也没有保存原始 TAP stdout/stderr。哈希可以暴露外部仓库漂移，但不能独立恢复其未提交字节。因此它仍不是完整的跨仓库正式冻结 run。

正式 A0 仍需：隔离并归档实验 arm；绑定模型、推理等级、宿主版本、插件组合与加载顺序；冻结 candidate Prompt、case 顺序和 judge 协议；在 fresh sessions 中保存原始回答与 host-adapter discovery/selection/load 事件；探索误触发至少稳定复现 2/3，且两个正控保持通过。

## Gate

`B0` 未解锁。下一步需要单独授权外部 `superpowers-evals` 的设置和模型调用；在获得上述正式证据前，不修改 brainstorming、using-superpowers 或 technical-deep-dive 的行为。
