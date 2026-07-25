# A0 Fresh-session 最小基线

> 状态：协议已冻结草案，尚未授权创建新任务或调用模型  
> 上限：5 个隔离任务  
> 模型：`gpt-5.6-sol / high`  
> 动作范围：只观察首轮回答，不编码、不修改文件、不执行外部操作

## 目的

确认当前安装组合是否会在探索性技术讨论中错误激活 `brainstorming`，同时确认正式规格和 React 交付请求仍然保留设计流程。

## 固定顺序

1. 探索讨论，第 1 次。
2. 同主题正式规格正控。
3. 探索讨论，第 2 次。
4. `Let's make a react todo list` 正控。
5. 探索讨论，第 3 次。

探索失败至少需要在 3 次中稳定复现 2 次，两个交付正控必须全部通过。

## 证据边界

模型自己声称“选择了 brainstorming”不能证明宿主实际加载了 Skill。证据优先级为：

1. 宿主 `load` 事件。
2. 宿主 `selection` 事件。
3. 宿主 `discovery` 事件。
4. 用户可见的 Skill 激活提示。
5. 回答中可观察的流程行为。
6. 模型自报。

如果 Codex Desktop 无法暴露真实 selection/load 事件，这 5 次任务仍可用于观察体验，但不能解锁 B0，也不能宣称已经定位到具体触发层。

## 执行前仍需确认

- 用户明确批准创建 5 个 fresh tasks。
- 当前 Codex Desktop 版本。
- Superpowers 与 Thinking Skills 的实际加载顺序。
- 宿主是否能导出 Skill discovery/selection/load 事件。

机器可读协议见 `docs/superpowers/evals/a0-fresh-session-baseline.json`。
