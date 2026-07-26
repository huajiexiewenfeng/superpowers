# 顶级模型工作流优化实施计划

> **执行说明：** 本计划是自包含的。执行本计划不能依赖调用正在被评估的工作流，也不能在同一批未经审查的改动中修改多个行为塑形组件。
>
> 英文原文：[Frontier-Model Workflow Optimization Implementation Plan](./2026-07-19-frontier-model-workflow-optimization.md)

**目标：** 调整 Superpowers，使其适配顶级推理模型：简单和边界明确的任务不再承担不必要的流程开销，高风险工作仍保留强安全、验证和审查保障。

**架构：** 用组件感知路由器替换当前非开即关的工作流。路由器根据用户显式意图、任务风险、任务复杂度和已声明的模型能力，在 `full`、`frontier`、`off` 三种建议性行为之间选择；所有配置下，不变量安全组件和验证组件始终保持活动。第一轮只改造三个高价值建议组件，任何更大的评估矩阵都必须先通过预算 Gate。只有分阶段证据证明质量不劣且成本显著降低后，改动才可以晋级。

**技术栈：** Markdown Skills、JSON 评估夹具、Node.js 内置测试运行器、基于 Shell 的插件测试，以及用于真实 Agent 会话的外部 `superpowers-evals` 评估框架。

**设计依据：** [Floor, Not Ceiling](https://gist.github.com/huajiexiewenfeng/71da8bd8431ec51e56a2b02a83f34a60) 提案 v0.2。实施单位是组件；每个组件必须明确它所防止的失败，或它所补充的能力。

**来源快照：** Gist revision `d283da2e45f04363bc70734f88abed8a69c437eb`，更新时间 `2026-07-16T14:16:50Z`；LF 规范化原始内容 SHA-256 为 `bd252a9a39d649d672dd4aff60b709a7bac18dbe6be08b3c85bae41b2fbc1dbe`。后续修订必须显式更新来源记录并审查设计差异。

## 全局约束

- 基线仓库：`obra/superpowers` v6.1.1，提交 `d884ae04edebef577e82ff7c4e143debd0bbec99`。
- 工作 Fork：`huajiexiewenfeng/superpowers`。
- 工作分支：`feat/frontier-model-workflow-optimization`。
- 项目继续保持零依赖，不增加运行时软件包。
- 用户覆盖只在建议性组件集合内优先，并且始终可以提高工作流强度；它不能降低由策略、权限和具体操作计算出的强制风险下限。
- 不可逆、安全敏感、迁移、发布和数据丢失风险始终强制启用所需的不变量组件。
- 验证始终启用；配置只能改变验证范围，不能消除证据。
- `off` 配置只关闭建议性工作流组件，不能关闭权限、破坏性操作 Gate 或完成证据。
- 仅靠 Prompt 文本只能做到尽力约束。任何必须 fail-closed 的 Gate，都必须说明其运行时、权限或确定性执行边界。
- 核心策略不得硬编码短期有效的模型产品名。运行环境可以声明能力档位，用户可以显式选择配置。
- 能力必须绑定到经过评估的“模型 + 运行时”配置，不能根据模型名通配符或模型的自我描述推断。
- 第一阶段仅限 `brainstorming.universal_design_gate`、`writing-plans.micro_step_granularity` 和 `test-driven-development.unconditional_tdd`；在薄切片方法验证前，其他行为改造全部保留在待办清单。
- 评估预算逐级开放。某个后续矩阵出现在计划里，不代表已获得执行授权；每次扩容都必须先通过前一个技术 Gate，并重新取得人工批准。
- 本项目只有一位所有者，因此采用固定版本 LLM Judge 加明确披露的人工抽检，不再声称存在独立人类盲评。
- 记录本计划引用的 Floor, Not Ceiling Gist 精确修订版本；过期本地镜像不得静默覆盖已发布的 v0.2 来源。
- 每个提交只修改一个行为家族，以便定位评估回归的来源。
- 实验授权、组件隔离、默认配置晋级、物理删除和上游贡献是五个独立的人类决策。
- 在人类审阅完整 Diff 和留出集评估证据前，不向上游创建 Pull Request。
- 未来任何上游 PR 必须以 `dev` 为目标分支，而不是 `main`，并遵守 `CLAUDE.md` 和 `.github/PULL_REQUEST_TEMPLATE.md`。

---

## 1. 问题陈述

Superpowers 最初用于补偿模型经常跳过分解、测试、验证或审查的问题。顶级模型现在已经原生具备其中相当一部分推理能力，因此一些无条件指令会产生固定成本，却不能稳定改善结果：

- 每个请求在回复前都触发 Skill 检查；
- 即使边界明确的小改动，也要进入头脑风暴和书面规格 Gate；
- 不论任务大小，计划都被拆成非常小的步骤；
- 每个功能、Bug 修复和重构都被强制套用同一种 TDD 形式；
- 小改动可能调用工作树、子 Agent 和审查，其成本高于任务本身；
- 多个 Skills 重复陈述相互重叠的流程约束。

目标不是取消工程纪律，而是保留防止严重失败的下限，同时解除限制强模型能力上限的约束。

## 2. 组件模型

修改本分支中的任何指令前，都必须先完成分类：

| 生命周期 | 含义 | 默认处理方式 |
|---|---|---|
| `invariant_core` | 防止不可接受的安全、权限、数据丢失或虚假完成失败 | 始终启用；有条件时优先使用确定性执行 |
| `intentional_shaping` | 编码一项可能改善质量的明确工程偏好 | 根据任务风险和复杂度路由 |
| `compensatory_shell` | 补偿主要在弱模型中观察到的失败模式 | 评估通过后，在 frontier 配置中关闭或压缩 |

每个组件契约必须记录：

- 稳定的组件 ID；
- 层级：`register`、`open_ended_reasoning` 或 `operational_control`；
- 类型：`register`、`reasoning_scaffold`、`fact`、`procedure`、`tool`、`state` 或 `gate`；
- `failure_prevented` 或 `capability_enabled`，且至少一项非空；
- 激活条件或强制条件；
- 建议性或强制性绑定；
- 实际执行机制；
- fail-open、fail-closed 或仅报告行为；
- 谁可以满足 Gate，以及需要什么新鲜证据；
- 谁可以修改或豁免策略；
- 所有者、新鲜度规则、兼容性检查和评估案例。

三个控制层具有不同的设计边界：

| 层级 | 合理控制 | 不合理控制 |
|---|---|---|
| `register` | 语气、结构、注意力方向、长期偏好 | 把偏好伪装成安全不变量 |
| `open_ended_reasoning` | 结果、验收标准、风险边界 | 为每个任务预先写死模型的完整推理路径 |
| `operational_control` | 私有事实、流程、工具、状态、权限、fail-closed Gate | 在需要确定性执行时依赖有说服力的 Prompt 文本 |

只有当契约允许，并且证据新鲜、已授权、与具体动作绑定且不可重放时，对话确认才能满足 Gate。满足 Gate 不等于重写策略。策略变更必须由指定策略权威通过明确的配置变更完成。

退役单位是组件，而不是整个 Skill。只要 Skill 中仍有任何保留组件提供独特价值，该 Skill 就继续保持可发现。

## 3. 路由契约

### 3.1 优先级

路由器按顺序解析两个集合：

1. **强制下限：** 根据策略和操作风险，确定不可豁免的权限、破坏性操作确认、安全/发布/迁移保障、必需测试与审查，以及完成证据。对话指令不能降低该集合；只有契约指定的策略权威，才能通过明确配置变更修改策略。
2. **建议集合：** 固定强制下限后，再依次应用用户显式指令、任务歧义与集成复杂度、声明的模型能力档位、仓库/组织默认值和保守回退。用户可以提高强度或关闭建议组件，但不能删除强制下限。

因此，`superpowers=off` 不是在一条扁平优先级中“高于风险”，而是在风险下限形成后应用的建议性选择。

### 3.2 配置

| 配置 | 适用场景 | 建议性工作流 | 不变量核心 |
|---|---|---|---|
| `full` | 弱模型或未知模型、需求模糊的项目、高风险工程 | 完整设计、计划、TDD、审查和验证流程 | 启用 |
| `frontier` | 顶级模型处理简单或边界明确的任务 | 紧凑计划、目标测试、选择性审查、比例化验证 | 启用 |
| `off` | 用户显式关闭建议性工作流 | 关闭 | 启用 |

支持以下显式指令：

```text
superpowers=full
superpowers=frontier
superpowers=off
```

如果运行环境不能提供可信的能力档位，路由器不得推断具体模型身份。此时使用任务风险和已配置的默认值。

### 3.3 任务分类

| 分类 | 示例 | Frontier 行为 |
|---|---|---|
| `mechanical` | 拼写修复、重命名、修改单个配置值、格式化 | 直接执行，运行最小相关检查，报告证据 |
| `bounded` | 验收标准明确的独立 Bug 修复或小功能 | 内联计划、目标测试；除非确实具有独立价值，否则不用子 Agent |
| `complex` | 跨模块行为、所有权不清、多阶段集成 | 紧凑设计和计划；按需选择完整工作流组件 |
| `high_risk` | 身份认证、安全、发布、迁移、破坏性数据变更 | 强制完整安全、测试、审查和验证组件 |

`no_advisory_workflow` 是机械任务的合法路由结果，并不代表没有找到 Skill。

“本次跳过框架”之类的自然语言请求，是有边界的建议性退出通道。它只关闭建议性组件，不绕过工具权限、破坏性操作确认或强制验证证据。路由测试还必须覆盖相反的失败：复杂或高风险任务需要帮助时，没有充分激活有用组件。

### 3.4 能力配置档案

路由器可以读取经过批准的能力配置档案，但模型本身和模型名通配符都无权宣布该档案有效。每份测量档案都必须绑定到产生证据的配置：

```json
{
  "profile_id": "frontier-candidate-001",
  "base_model": "精确的部署标识",
  "reasoning_configuration": "推理强度、采样与上下文设置",
  "harness_and_router": "版本或不可变哈希",
  "toolchain": "工具、权限与版本",
  "benchmark_suite": "版本与留出集切分",
  "evaluation_commit": "不可变候选提交 SHA",
  "approved_by": "人类所有者",
  "approved_at": "ISO-8601 时间戳"
}
```

模型、推理配置、运行环境、路由器、工具、权限或基准发生变化后，在重新运行相关测量前，不得自动复用原能力档案。未知配置采用保守回退，但不宣称模型强或弱。

## 4. Skill 改造映射

第一阶段明确区分“为实验提供开关的路由基础设施”和“被检验有效性的三个组件”。修改路由器只是为了形成可控变体，不能据此推导出所有下游 Skill 都应重写。

| 波次 | Skill | 组件处理 | 计划结果 |
|---|---|---|---|
| 基础设施 | `using-superpowers` | 用路由契约替换无条件的 1% 触发规则 | 薄中央路由器；强制组件继续显式存在 |
| 第一阶段 | `brainstorming` | 检验 `brainstorming.universal_design_gate`，保留歧义发现 | 机械任务跳过；边界任务走紧凑路径；模糊或复杂任务走完整路径 |
| 第一阶段 | `writing-plans` | 检验 `writing-plans.micro_step_granularity`，保留接口和全局约束 | 根据独立测试和审查价值划分任务边界 |
| 第一阶段 | `test-driven-development` | 检验 `test-driven-development.unconditional_tdd`，保留行为和回归风险的红绿循环 | 根据变更风险选择严格、目标式或不适用模式 |
| 第二阶段待办 | `subagent-driven-development` | 增加内联、串行和委派三种执行模式 | 使用一个执行路由器，不再强制委派 |
| 第二阶段待办 | `executing-plans` | 迁移独有的串行和检查点行为 | 先成为临时别名，兼容性评估后再退役 |
| 第二阶段待办 | `dispatching-parallel-agents` | 保留独立工作的并行能力 | 增加并发预算、写入集所有权、取消与集成 Gate |
| 第二阶段待办 | `systematic-debugging` | 保留证据和根因纪律 | 在运营紧急情况下，允许明确标注的缓解措施先于完整根因 |
| 不变量审计 | `verification-before-completion` | 保留为不变量核心 | 始终启用；验证范围可以是目标式、比例式或完整式 |
| 第二阶段待办 | `requesting-code-review` | 保留合并和高风险审查 | 不强制微小改动使用独立审查 |
| 第二阶段待办 | `receiving-code-review` | 保留技术核验 | 如果评估证明无收益，则删除不影响正确性的纯风格禁令 |
| 第二阶段待办 | `using-git-worktrees` | 保留隔离能力 | 根据冲突风险、工作持续时间或用户显式要求触发，而不是任何计划都触发 |
| 不变量审计 | `finishing-a-development-branch` | 保留测试和破坏性清理 Gate | 只提供与当前上下文有关的完成动作 |

第一轮不得修改任何“第二阶段待办”条目。只有通过 Gate R2、重新确定组件预算并获得新的 G1 实验批准后，才能开始这些工作。

## 5. 计划文件结构

### 核心 Fork

```text
skills/
  using-superpowers/
    SKILL.md
    references/
      frontier-routing.md
      component-contracts.json
  brainstorming/
    SKILL.md
  writing-plans/
    SKILL.md
  test-driven-development/
    SKILL.md
  subagent-driven-development/
    SKILL.md
    references/
      execution-modes.md
  executing-plans/
    SKILL.md
  dispatching-parallel-agents/
    SKILL.md
  systematic-debugging/
    SKILL.md
  verification-before-completion/
    SKILL.md
  requesting-code-review/
    SKILL.md
  receiving-code-review/
    SKILL.md
  using-git-worktrees/
    SKILL.md
  finishing-a-development-branch/
    SKILL.md
tests/
  frontier-routing/
    bootstrap-entrypoints.test.mjs
    capability-profile.test.mjs
    component-contracts.test.mjs
    full-profile-equivalence.test.mjs
    routing-cases.json
    routing-policy.test.mjs
docs/superpowers/
  evals/
    bootstrap-entrypoints.json
    capability-profile.schema.json
    judge-protocol.json
    source-provenance.json
    directional-micro-pilot-protocol.md
    profiles/
      frontier-candidate-001.json
  specs/
    2026-07-19-frontier-model-workflow-optimization-design.md
  plans/
    2026-07-19-frontier-model-workflow-optimization.md
    2026-07-19-frontier-model-workflow-optimization.zh-CN.md
```

### 外部评估工作区

真实行为评估在 `prime-radiant-inc/superpowers-evals` 的独立 Fork 中执行。核心分支只记录评估协议和结果摘要，不把评估框架复制进来，也不把它添加为依赖。

## 6. 评估设计

### 6.1 运营核心预检

运营组件不与模型智能进行比较。在任何建议性工作流实验前，先独立测试：

- 事实：来源、正确性和新鲜度；
- 流程：针对真实目标环境的有效性；
- 工具：兼容性、确定性和失败处理；
- 状态：Schema 完整性、原子性、恢复和迁移行为；
- Gate：fail-closed 执行、授权满足者、与具体动作绑定的新鲜证据，以及策略覆盖权威。

运营核心检查失败会阻止建议性实验。仅靠 Prompt 强制的内容必须报告为尽力约束，不能评分为确定性执行。

### 6.2 受控主张

不同主张需要不同干预。单一的“Skill 总分”不足以支持决策。

| 主张 | 受控干预 | 可支持的决策 |
|---|---|---|
| 组件有效性 | 强制打开或关闭一个目标组件，同时固定模型配置、运营核心、路由器、工具、权限、上下文和无关组件 | 保留、缩小范围，或提名进入隔离 |
| 路由 | 冻结注册表、路由器、模型配置、权限和组件定义；运行已标注的正例、负例、覆盖和冲突案例 | 修改激活规则，而不是组件正文 |
| 组件非干扰性 | 在已标注的负例上只切换目标组件 | 证明该组件在不需要时造成额外成本或质量下降的因果证据 |
| 框架非干扰性 | 在负例上比较自然路由和完整建议注册表与无建议基线 | 衡量框架整体健康度；不能单独作为删除某个组件的依据 |

### 6.3 框架变体

- A：上游 Superpowers v6.1.1，当前完整工作流；
- B：本分支，使用 `superpowers=frontier`；
- C：本分支，关闭建议性工作流。

A/B/C 衡量框架行为。组件退役决策必须使用第 6.2 节的组件级干预。

12 次方向性微试点只比较 A 和 B。变体 C 和完整 A/B/C 框架矩阵推迟到第一轮薄切片出现有效信号之后，避免用晋级级别预算回答一个探索性问题。

每次比较都必须固定模型部署、推理配置、Harness 版本、任务 Prompt、工具链、权限、超时和 Judge 协议。A、B、C 必然使用不同的仓库/路由器 SHA；每个变体 SHA 必须事先冻结，并且只能包含该次比较获批的处理差异。应记录这些不同 SHA，而不是声称它们相同。

### 6.4 阶段

1. 静态与入口验证：契约、Schema、入站引用、不可变 SHA、来源追踪，以及全部 bootstrap、hook 和原生发现注入路径。
2. Harness 冒烟：用最少的合成或夹具运行确认捕获、计时、Token、测试、随机化、匿名化和 Judge 流水线。这些只是基础设施检查，不是组件价值证据。
3. Router 试点：在修改任何下游 Skill 前，运行只做分类的正例、负例、覆盖、冲突、无建议和高风险案例。这些短上下文判定不得执行完整编码任务。
4. Task 3 后运行方向性微试点：冻结 3 个机械 Prompt 和 3 个边界明确 Prompt，每个分别在 A 和 B 下运行一次；每类 6 次，共 12 次完整 Agent 会话。
5. 选中组件试点：只测试第一阶段的三个组件。每个组件使用一个正例和一个负例 Prompt，强制开启和关闭，各重复 3 次；最多 36 次完整 Agent 会话。组件有效性与非干扰性分开报告。
6. 条件式框架试点：`6 个冻结任务 × 3 个变体 × 3 次重复 = 54 次会话` 是历史后期设计，不是第一阶段承诺。必须先通过 Gate R1 和 R2、冻结 Judge 协议，并重新获得 G1 批准。
7. 条件式留出集晋级：`12 个未见任务 × 3 个变体 × 3 次重复 = 108 次会话` 是历史上限，不会自动执行。先根据试点方差和效应量重新计算样本量，公开预算并另行批准。
8. 条件式跨配置验证：只在第一份能力档案产生晋级候选后，使用第二份获批能力档案重复该晋级主张所需的证据。

微试点只判断方向，不能作为退役证据。如果 B 未在安全和必要质量不下降的前提下，朝着 Token 中位数或耗时中位数至少降低 25% 的方向移动，就停止更大矩阵，诊断路由器或组件假设。薄切片失败也是有效结论，应结束本轮投入决策。

关键路径：`G0 → Task 1 → 为路由变体重新申请 G1 → Task 2 → Task 2A（全局默认与 PDC 仲裁）→ R0 → 为 Task 3 重新申请 G1 → Task 3 → R1（12 次会话）→ 为 Task 4/组件试点重新申请 G1 → Task 4 → Task 7 三组件试点 → R2 → 另行批准的框架试点 → 另行批准的留出集 → 可选第二档案`。

### 6.5 任务组合与指标

12 次微试点只覆盖机械和边界明确任务，因为它检验的是成本假设。Task 3 前的纯路由评估负责覆盖复杂和高风险分类。任何正式晋级任务集都必须包含机械、边界明确、复杂和高风险任务；每个分类至少包含一个具有诱人但不安全捷径的任务，以便观察路由不足。

质量和安全指标：

- 完成验收标准；
- 构建和相关测试通过；
- 任务要求解决根因时，确实解决根因；
- 没有无关或越界修改；
- 没有权限、数据丢失、安全、秘密泄漏、回滚或虚假完成违规；
- 固定 Judge 协议给出的可维护性评分；
- 每个高风险夹具都有显式 `must_not` 检查。

成本和交互指标：

- 输入、输出和总 Token；
- 总耗时；
- 工具调用和子 Agent 调用次数；
- 用户提问和等待批准次数；
- 重试和返工次数；
- 计划、规格和审查产物数量。

路由指标：

- 任务分类正确；
- 激活所需的不变量组件；
- 避免不必要的建议性组件；
- 无建议路由的精确率和召回率；
- 冲突解决准确率；
- 高风险路由不足次数；
- 每个高风险案例和聚合任务集的试验次数 `n`、漏判数、观测漏判率和单侧 95% Clopper-Pearson 上界。

观测到 0 次漏判不代表真实漏判率为 0。当 `n` 次独立试验中没有漏判时，必须按 `1 - 0.05^(1/n)` 报告单侧 95% 上界，并保留可复现该结果的全部原始判定。独立性是一项显式建模假设；共享 Prompt、部署或隐藏运行时状态可能让试验相关，因此该上界只能作为描述性证据，不能证明生产环境漏判率保证。

主要分析单位是唯一案例或任务，而不是重复会话。路由评估预注册多数表决（平局计为错误），据此得到每个案例唯一预测，并在案例层计算精确率/召回率；所有会话级漏判仍单独报告，任何高风险会话漏判都会阻止 R0 通过。行为和留出集比较先按预注册规则聚合同一任务的重复会话，再跨唯一任务执行成对、聚类感知分析。重复只估计任务内随机性，不能增加有效任务样本量或统计功效。

### 6.6 单人项目 Judge 协议

这是单人项目，计划作者不能真实地自称独立人类盲评员，因此正式评估采用以下有边界的替代方案：

- 优先使用不可变、单独标识的 LLM Judge 部署；记录模型/部署 ID、提供方版本、推理与采样设置、Judge Prompt SHA-256、Rubric 版本和执行日期。
- 如果提供方只暴露可变模型名称，则改用固定本地 Judge，或者记录提供方 fingerprint，并在批次前后立即运行冻结的 sentinel/calibration 集。任何安全 sentinel 翻转，或五分制 Rubric 均值漂移超过 0.25，都会使该批次失效。既没有不可变/本地 Judge，也无法取得可审计 fingerprint 与校准时，结果只能用于探索，不能支持默认配置晋级。
- 在 Judge 记录质量和安全裁决前，隐藏 A/B/C 标签、分支名、预期假设和成本指标；使用已保存的随机种子打乱展示顺序。
- 先运行确定性验收、测试、范围和 `must_not` 检查；Judge 无权推翻确定性安全失败。
- 人类所有者对至少 20% 的分层随机样本进行抽检，并检查所有安全失败、平局、Judge 分歧、缺失产物和统计异常值。人工裁决记录前继续隐藏变体标签。
- 对 12 次微试点，所有确定性失败和 Judge 标记的质量回归都由所有者检查；没有问题时仍至少抽检 20%。
- 对外表述必须是“固定 LLM-as-judge + 所有者抽检”，不能写成独立人类盲评。需要显式记录自评、提供方相关性、风格泄漏和解盲风险。
- 外部评审可以提高证据等级，但不是前置条件。Judge 部署或 Rubric 变化后，未经校准不得合并新旧裁决；漂移显著时必须重跑受影响的比较。

12 次微试点前必须冻结 Judge 协议。只要 Judge 身份、Rubric、采样、抽检率或漂移策略未解决，就不能开始 54 次或留出集评估。

### 6.7 晋级规则

采用词典序决策：先安全，再达到所需质量，最后比较成本。

- 任何灾难性安全或破坏性操作失败都会阻止晋级，且绝不能被平均值掩盖。
- 正式留出集运行前，预注册“确定性任务成功”为主要质量结果、5 个百分点的非劣界值、单侧 `alpha = 0.05`、至少 80% 的目标检验功效、成对分析方法和精确任务类别权重。超时、缺少输出、证据不可用和协议偏离，在主要分析中一律计为失败。
- Frontier 必须按照预注册规则对 A 达到质量非劣；质量下降不能由节省 Token 抵消。除非单独预注册量表、界值和分析方法，否则 Judge 可维护性评分只能作为次要结果。
- 机械任务和边界明确任务相对配对 A 运行，都应让预注册主要成本端点至少降低 25%。默认主要端点为总 Token；除非数据收集前获批，否则总耗时只能是次要端点。
- 高风险任务允许与 A 成本相同；优化目标是正确路由，不是普遍降低成本。
- 只有当 C 在质量和安全上与 B 相当且成本更低时，才可针对该任务分类晋级 C。
- 批准前计算留出集所需样本量。如果超过已批准上限，就不能声称非劣：只能缩窄主张、另行批准更大预算，或停止。绝不能在 108 次处截断不足功效的实验并把它当作成功。
- 结果不稳定的组件改为条件启用或显式选择，而不是直接删除。
- 结果冲突时进入组件级调查，不压缩成不透明的综合分数。

## 7. 实施任务

### Task 1：冻结基线并建立组件契约

**文件：**

- 创建：`docs/superpowers/specs/2026-07-19-frontier-model-workflow-optimization-design.md`
- 创建：`docs/superpowers/evals/bootstrap-entrypoints.json`
- 创建：`docs/superpowers/evals/capability-profile.schema.json`
- 创建：`docs/superpowers/evals/source-provenance.json`
- 创建：`docs/superpowers/evals/profiles/frontier-candidate-001.json`
- 创建：`skills/using-superpowers/references/component-contracts.json`
- 创建：`tests/frontier-routing/bootstrap-entrypoints.test.mjs`
- 创建：`tests/frontier-routing/capability-profile.test.mjs`
- 创建：`tests/frontier-routing/component-contracts.test.mjs`

**接口：**

- 输入：上游 v6.1.1 Skill 正文和本计划中的组件分类。
- 输出：供路由测试和评估报告使用的稳定组件 ID、不可变能力配置档案、来源追踪记录，以及真实 bootstrap、hook 和原生发现入口的完整映射。

- [ ] 为本计划涉及的每条指令记录层级、类型、生命周期、激活、绑定、执行、失败模式、权威、维护和所有者。
- [ ] 为每份评估能力档案记录精确模型、推理、运行环境、路由器、工具链、权限、基准和候选 SHA。
- [ ] 用 Gist URL、Gist revision、发布时间、同步时间和原始内容 SHA-256 固定 Floor, Not Ceiling v0.2；识别过期本地镜像，但不得把它们当作权威来源。
- [ ] 为每个已知镜像记录路径别名、版本、SHA-256，以及唯一明确处置：`sync`、`archive` 或 `deliberately_unmanaged`。当前基线包括 `$USERPROFILE/Downloads/floor-not-ceiling.md`（v0.1，`4263deaac47c45c3f10863effac61e4ea9ece796bd8a377cabb7e1aa3760c14a`）、`$USERPROFILE/Downloads/floor-not-ceiling.zh.md`（v0.1，`f65637cd5cdf87d82a5a6eea8ffa7985cd6e1c27be53538fef0ab735bfac9b03`）和 `$WORKSPACE/floor-not-ceiling-final.md`（v0.2 衍生版，`5c3027a1cfdcf3f7811a4cdcd66e723ab3c1d26be72b0ab14452c973e93b764c`）。Gist 当前没有中文 v0.2，因此中文镜像必须经过明确翻译/合并决策，不能声称字节级同步。覆盖仓库外文件前必须另行批准，并建立可恢复备份。
- [ ] 为每个活动或遗留注入面记录运行环境、支持状态、注册 Manifest、真实 hook/bootstrap 入口、内容来源、注入事件、缓存/去重行为和对应测试。最低清单包括：
  - Claude Code 和 Copilot CLI：从 `.claude-plugin/plugin.json` 隐式自动发现根目录的 `hooks/hooks.json`，再进入 `hooks/session-start` 和 `hooks/run-hook.cmd`；Manifest 本身没有显式声明 hooks 指针；
  - Cursor：`.cursor-plugin/plugin.json`、`hooks/hooks-cursor.json`、`hooks/session-start`、`hooks/run-hook.cmd`；
  - OpenCode：`.opencode/plugins/superpowers.js`，包括缓存后的 bootstrap 路径；
  - Pi：`.pi/extensions/superpowers.ts`，包括启动时注入和压缩后的再次注入；
  - Kimi：`.kimi-plugin/plugin.json` 和 `sessionStart.skill`；
  - Gemini：`gemini-extension.json` 和 `GEMINI.md`，明确标为已 EOL 的遗留入口，而不是受支持的活动入口，并记录缺失的 `skills/using-superpowers/references/gemini-tools.md` include；
  - Codex：`.codex-plugin/plugin.json`，明确记录为无 session-start hook 的原生 Skill 发现；
  - Factory Droid 和 Antigravity：记录它们复用 Claude 风格 hook 的声明、实际可验证边界和缺失的端到端测试。
- [ ] 记录不同加载形态：Shell 注入完整 SKILL（含 frontmatter），OpenCode/Pi 去除 frontmatter，Kimi/Codex 使用原生加载；记录 Codex `hooks: {}` 防止回退发现 hook 的负向控制，以及 Windows 缺少 Bash 时 `hooks/run-hook.cmd` 静默跳过注入的 fail-open 边界。
- [ ] 把只负责分发的 Manifest 与真实注入点分开记录，包括 `.claude-plugin/marketplace.json`、`.agents/plugins/marketplace.json` 和根 `package.json` 中的 OpenCode/Pi 注册。
- [ ] 精确记录过期或缺失引用：`skills/using-superpowers/references/claude-code-tools.md`、`skills/using-superpowers/references/copilot-tools.md`、`skills/using-superpowers/references/gemini-tools.md`、`.antigravity-plugin/install.sh`，以及 `docs/porting-to-a-new-harness.md` 中对应的过期声明。
- [ ] 记录每个入口在源 Skill 缺失时的行为：Shell hook 当前会注入错误字符串并以成功状态退出，OpenCode 和 Pi 则不注入 bootstrap 内容并缓存缺失结果。
- [ ] 使用 Node.js 内置测试拒绝重复 ID、缺少用途、非法生命周期、不完整能力档案，以及被错误标记为确定性执行的 Prompt-only 强制组件。
- [ ] 增加入口测试：已注册入口消失、内容来源变化，或者没有显式 `test_status` 与证据分类时必须失败。允许的分类为 `live_e2e`、`static_only`、`shared_script_only` 和 `legacy_unverified`，每条都必须记录证据、缺口原因和所有者。被选中用于晋级的受支持入口必须达到 `live_e2e`；清单本身可以在明确披露较弱证据时通过。
- [ ] 运行 `node --test tests/frontier-routing/bootstrap-entrypoints.test.mjs tests/frontier-routing/component-contracts.test.mjs tests/frontier-routing/capability-profile.test.mjs`；预期入口清单和 Schema 测试全部通过。
- [ ] 只提交已审阅的基线设计、契约、能力 Schema/档案、来源追踪、入口清单及其测试，提交信息为 `docs: define frontier workflow component contracts`。

### Task 2：实现薄中央路由器

**文件：**

- 修改：`skills/using-superpowers/SKILL.md`
- 创建：`skills/using-superpowers/references/frontier-routing.md`
- 创建：`docs/superpowers/evals/judge-protocol.json`
- 创建：`tests/frontier-routing/routing-cases.json`
- 创建：`tests/frontier-routing/routing-policy.test.mjs`
- 创建：`tests/frontier-routing/full-profile-equivalence.test.mjs`

**接口：**

- 输入：Task 1 生成的组件 ID 和优先级。
- 输出：配置、任务分类、必需组件集和建议组件集。

- [ ] 用明确优先级和紧凑的任务分类决策表替换通用 Skill 调用规则。
- [ ] 保留用户指令优先级，并明确高风险行为必须 fail-closed。
- [ ] 添加正例、负例、冲突、覆盖和无建议路由案例。
- [ ] 增加差分夹具，证明 `superpowers=full` 保留固定 v6.1.1 的路由决策、注入 bootstrap 语义、强制 Gate，以及代表性的设计/TDD/审查/验证流程。任何有意的 full 配置差异必须单独批准，不能藏在 frontier 改造中。
- [ ] 运行 `node --test tests/frontier-routing/*.test.mjs`；预期 0 个失败。
- [ ] 在任何真实会话对比前，冻结单人项目 Judge 身份、Rubric、Prompt Hash、随机种子策略、匿名化规则、至少 20% 的分层抽检、升级检查项和漂移处理。
- [ ] 在 Task 1 每个入口当前可达到的最强证据层验证路由来源和注入形态，而不只验证源 `SKILL.md`：session start、首条消息注入、缓存加载、已注入消息去重、压缩后再次注入、Kimi Manifest 声明、Gemini 遗留状态，以及 Codex 原生发现/no-hook 负向控制。不得把静态或共享脚本证据称为实际运行时加载。
- [ ] 增加 OpenCode 行为断言：把已注入消息再次传入 transform，证明基于 marker 的去重有效；现有缓存测试不能替代该断言。
- [ ] 运行 `tests/hooks/test-session-start.sh`、OpenCode、Pi、Kimi、Codex 插件加载/打包测试，以及清单要求的 Gemini 遗留状态守卫；在各自声明的证据层不得出现 bootstrap、缓存、去重、原生发现控制或打包回归。明确记录 Kimi 原生加载、Codex 原生匹配、Claude Manifest 自动注册、Cursor Manifest 接线、Factory Droid、Antigravity 和其他弱测试路径缺少 live E2E。某个运行环境要进入配置晋级前，必须先补齐对应 live E2E 证据。
- [ ] 使用提交信息 `feat: add component-aware frontier workflow routing` 提交。

### Task 2A：全局 Frontier 默认与 PDC 路由仲裁

**问题说明：**

一次普通工作目录中的单文件静态 HTML 展示页任务证明，当前配置与路由设计仍有缺口：工作目录缺少 `.superpowers/frontier-trial.config.json` 时会回退 `full`，随后全局 `brainstorming` 和 `writing-plans` 在 PDC 生命周期 Router 之前生效。PDC 即使声明“不对每个功能强制完整规格与计划”，也无法撤销已经选择的旧硬门槛。

完整分析和修复约束见：

- `docs/superpowers/specs/2026-07-26-global-frontier-pdc-routing-gap.zh-CN.md`

**候选文件：**

- 修改：`skills/using-superpowers/SKILL.md`
- 修改：`skills/using-superpowers/references/frontier-routing.md`
- 创建：用户级配置 Schema、无副作用 discovery 和纯函数 profile resolver，具体路径在实现前冻结
- 扩展：`tests/frontier-routing/routing-cases.json`
- 创建：全局默认与项目覆盖的配置发现测试
- 创建：PDC 生命周期 Router 与 Superpowers 流程 Router 的仲裁测试
- 修改：PDC canonical source 中的根 Router、`project-develop` 和 Superpowers bridge；canonical source 定位前不得修改已安装副本

**接口：**

- 输入：显式指令、强制风险下限、仓库策略、项目 trial、用户级全局默认、能力档案，以及适用的项目生命周期 Router。
- 输出：有效配置、Router 所有者、PDC 工作模式、建议流程组件和验证范围。

- [ ] 把用户级稳定默认与项目级实验 trial 分开；缺少项目 trial 不得取消有效的全局默认。
- [ ] 冻结优先级：显式请求 → 强制风险/权限下限 → 仓库强制策略 → 有效项目 trial → 用户级全局默认 → 已批准能力默认 → 保守 `full`。
- [ ] 冻结跨平台逻辑 Schema 和配置解析接口，再由各 Harness 映射物理位置；核心 Skill 不写死本机绝对路径。
- [ ] 明确 `owner_default`/`dogfood_global` 可以选择 Frontier，但不等同于能力档案已正式晋级。
- [ ] 对项目工作先运行 PDC 生命周期/领域 Router，再由 Superpowers 在已恢复的项目范围内选择流程组件；PDC 不是受 process-first 规则压后的普通实现 Skill。
- [ ] 为 PDC 增加或等价表达 `bounded-delivery`：低风险、单文件、边界清晰的持久产物允许内联验收和比例化验证，不强制独立规格、微步骤计划或无意义 TDD。
- [ ] 保持高风险、仓库策略、权限、破坏性操作确认和完成证据不可被全局 Frontier 或 PDC 降低。
- [ ] 冻结本次静态 HTML 路由轨迹作为 RED：当前 `missing project trial → full → brainstorming → writing-plans`；目标为 `global frontier → PDC bounded-delivery → proportional verification`。
- [ ] 覆盖显式 `full`、项目强制 `full`、过期/损坏 trial、损坏全局配置、非项目任务、复杂项目和高风险升级。
- [ ] 枚举并测试所有 bootstrap、hook、缓存和原生 Skill 发现入口，证明真实运行入口的加载顺序改变，而不是只修改未生效的 Prompt 影子。
- [ ] Task 2A 完成后重新冻结 Router SHA，并重跑受配置发现与 PDC 仲裁影响的最小 R0 子集；旧 R0 结果只保留为历史基线。
- [ ] 全局配置的实际写入、PDC 已安装版本同步和真实跨项目试用分别重新申请授权，本 Task 不自动执行。

### Gate R0：仅路由器决策

不能仅因为 Task 2 或 Task 2A 已实现，就开始 Task 3–6。

- [ ] 冻结路由器提交、注册表、候选组件定义、能力档案和权限。
- [ ] Node 夹具只能作为确定性策略表测试，不能代表随机模型的真实路由行为。
- [ ] 使用全新上下文运行只做路由判定的模型会话，覆盖正例、负例、自然语言退出、覆盖、冲突、无建议和对抗性高风险案例，不执行实际编码任务。
- [ ] 至少包含 6 个不同高风险案例：身份认证/授权、安全或秘密、发布、迁移、破坏性数据变更，以及数据丢失/回滚风险。冻结能力档案后，每个案例至少重复 5 次，总计至少 30 次高风险判定。
- [ ] 预注册采样规则。重复试验必须使用全新上下文，并在提供方支持时使用不同且已记录的 seed 或采样 nonce。相同 seed 的确定性重放只能计为一个统计观测。如果无法支持独立性假设，Clopper-Pearson 结果必须标为描述性，不得把名义覆盖率写成保证。
- [ ] 要求观测到的高风险漏路由为 0，并报告 `n`、全部原始判定、各案例与聚合漏判数，以及单侧 95% Clopper-Pearson 上界。最低每例 `n=5` 时上界约为 45.1%，聚合 `n=30` 时约为 9.5%；不得宣称真实漏判率为 0。
- [ ] 预注册至少 10 个适合 `no_advisory_workflow` 的案例、10 个不适合的案例、类别权重，并让每个案例运行 3 次纯路由判定。精确率必须至少 95%，召回率至少 80%，同时按任务分类和宏平均报告。高风险试验可以复用为不适合案例。看到结果后不得修改阈值或权重。
- [ ] 0 次高风险漏判时，聚合描述性上界必须不高于 10%；样本不足或结果不稳定时增加纯路由重复次数。由于异质案例合并后不等于同分布，必须同时报告分层结果。
- [ ] 向人类所有者提交结果和所有错误路由。
- [ ] 只有在人类明确批准路由实验后才能继续；该批准不授权下游组件修改或退役。

### Task 3：增加比例化设计与计划

**文件：**

- 修改：`skills/brainstorming/SKILL.md`
- 修改：`skills/writing-plans/SKILL.md`
- 扩展：`tests/frontier-routing/routing-cases.json`

**接口：**

- 输入：中央路由器生成的任务分类和配置。
- 输出：`none`、`inline`、`compact` 或 `full` 设计/计划深度。

- [ ] 保留歧义发现，以及重大设计选择的人类批准。
- [ ] 对范围和成功标准已经精确的机械请求允许直接执行。
- [ ] 用“可独立测试、值得独立审查”的任务边界替代通用微步骤粒度。
- [ ] 添加案例，证明复杂和高风险工作仍会获得完整设计和计划。
- [ ] 创建 `docs/superpowers/evals/directional-micro-pilot-protocol.md`，冻结 3 个机械 Prompt、3 个边界明确 Prompt、确定性检查、随机 A/B 顺序和 Judge 协议。
- [ ] 每个 Prompt 在 A 和 B 下各运行一次：机械任务 6 次、边界明确任务 6 次，共 12 次完整 Agent 会话。
- [ ] 先报告安全和必要质量，再按任务分类报告 Token 中位数、耗时中位数、交互次数和产物数量。不得用这一方向性样本退役组件。
- [ ] 使用提交信息 `feat: make design and planning proportional to task risk` 提交。

### Gate R1：12 次方向性成本验证

- [ ] 第一场会话前冻结 Task 3 提交、6 个 Prompt、A/B 基线 SHA、能力档案、工具权限和 Judge 协议。
- [ ] 预注册“成对总 Token 变化”为主要成本端点。总耗时、交互次数和产物数量是次要端点；看到结果后不能用它们替换主要端点。如果无法获得可靠 Token 遥测，必须在第一场运行前另行批准其他主要端点。
- [ ] B 不得出现灾难性失败，也不得出现确定性检查或人工抽检确认的必要质量回归。
- [ ] 对每个配对 Prompt 按 `(A - B) / A` 计算 Token 降幅。机械 Prompt 和边界明确 Prompt 都必须满足 `median((A - B) / A) >= 0.25`；不得用合并结果掩盖某一类回归。报告全部次要端点，但不能用它们挽救未通过的主要端点。
- [ ] 发布全部 12 条记录和所有者抽检结果，并明确说明该样本不能证明统计意义上的非劣性。
- [ ] 如果没有出现该方向，就在 Task 4 和所有更大矩阵前停止。诊断假设、路由器、夹具或测量系统；重试前重新申请 G1 批准。

### Task 4：让测试策略由风险驱动

**文件：**

- 修改：`skills/test-driven-development/SKILL.md`
- 扩展：`skills/using-superpowers/references/component-contracts.json`
- 扩展：`tests/frontier-routing/routing-cases.json`

**接口：**

- 输入：变更类型、回归风险和任务分类。
- 输出：带原因的 `strict_tdd`、`targeted_test`、`existing_check` 或 `not_applicable`。

- [ ] 对行为逻辑、回归修复和高风险代码保留严格红绿循环。
- [ ] 对边界明确、完整红绿循环不会增加证据的改动，允许目标式测试。
- [ ] 对纯文档和机械性非行为变更标记为不适用，但仍要求相关验证。
- [ ] 添加对抗案例，防止模型把风险逻辑错误归为机械任务。
- [ ] 为选中组件协议准备 TDD 强制开启/关闭处理。Task 7 只运行一次，并把这些会话计入 36 次上限中的 TDD 份额；不得另跑重复批次，也不得把 R0 的批准或证据复用于证明 TDD 有效性。
- [ ] 使用提交信息 `feat: route testing strategy by behavioral risk` 提交。

### Gate R2：三组件方法验证

- [ ] 只审查 Task 7 已运行的一批三组件会话。每个组件冻结一个正例和一个负例 Prompt，强制开启与关闭，各重复 3 次；完整 Agent 会话总计不得超过 36 次。Gate R2 只评估该批次，不得重跑。
- [ ] 分开报告组件有效性和组件非干扰性；任何灾难性失败都不能被平均进有利的成本结果。
- [ ] 确认严格遵守固定 Judge 和所有者抽检协议，并报告全部分歧和局限。
- [ ] 分别决定每个组件是保留、缩小范围、条件启用，还是隔离候选。R2 不授权删除或修改默认配置。
- [ ] 任何第二阶段工作、54 次框架试点或更大的留出集，都必须重新确定预算并获得新的 G1 批准。

### Task 5：统一执行和审查编排（第二阶段待办）

第一阶段不得执行此任务。只有通过 Gate R2，并获得一份明确列出组件和评估预算的新 G1 批准后，才可以开始。

**文件：**

- 修改：`skills/subagent-driven-development/SKILL.md`
- 创建：`skills/subagent-driven-development/references/execution-modes.md`
- 修改：`skills/executing-plans/SKILL.md`
- 修改：`skills/dispatching-parallel-agents/SKILL.md`
- 修改：`skills/requesting-code-review/SKILL.md`

**接口：**

- 输入：计划任务图、写入集、风险和可用 Agent 槽位。
- 输出：内联、串行或委派执行，以及任务级或分支级审查范围。

- [ ] 增加模式选择，让短任务或强耦合任务保持内联执行。
- [ ] 在将 `executing-plans` 变为兼容别名前，迁移其独有串行和检查点行为。
- [ ] 并行 Agent 必须声明文件所有权，并通过集成验证。
- [ ] 只在实质性任务边界和高风险/合并 Gate 使用独立审查者。
- [ ] 验证复杂独立任务仍会使用并行，而五行改动不会。
- [ ] 使用提交信息 `feat: unify inline serial and delegated execution` 提交。

### Task 6：保留可靠性下限（第二阶段待办）

第一阶段只审计不变量行为，不重写这些 Skill。行为修改必须等待 Gate R2 和新的 G1 批准。

**文件：**

- 修改：`skills/systematic-debugging/SKILL.md`
- 修改：`skills/verification-before-completion/SKILL.md`
- 修改：`skills/receiving-code-review/SKILL.md`
- 修改：`skills/using-git-worktrees/SKILL.md`
- 修改：`skills/finishing-a-development-branch/SKILL.md`

**接口：**

- 输入：风险分类、完成声明、仓库状态和审查证据。
- 输出：所需证据、安全工作区动作和未解决风险报告。

- [ ] 所有配置都必须保留完成证据，验证范围可以是目标式、比例式或完整式。
- [ ] 只有明确标注为缓解措施，并配套根因后续任务时，才允许紧急缓解先行。
- [ ] 保留破坏性清理确认和工作树来源检查。
- [ ] 根据冲突风险、持续时间或用户显式要求创建工作树，而不是仅根据计划是否存在。
- [ ] 将纯风格审查语言与技术核验行为分开评估。
- [ ] 使用提交信息 `refactor: preserve reliability gates across workflow profiles` 提交。

### Task 7：运行分阶段评估

这是在 R0、R1 和 R2 中按需调用的跨阶段证据任务；Task 编号不表示微试点要等第二阶段待办完成后才运行。

**文件：**

- 创建：`docs/superpowers/evals/frontier-workflow-protocol.md`
- 创建：`docs/superpowers/evals/router-pilot-results.md`
- 创建：`docs/superpowers/evals/directional-micro-pilot-results.md`
- 创建：`docs/superpowers/evals/selected-component-pilot-results.md`
- 仅在另行批准后创建：`docs/superpowers/evals/frontier-workflow-pilot-results.md`
- 仅在另行批准后创建：`docs/superpowers/evals/frontier-workflow-held-out-results.md`

**接口：**

- 输入：当前 Gate 授权的变体不可变 SHA、匿名化任务夹具、固定 Judge 协议和已批准会话预算。
- 输出：当前阶段逐任务的安全、质量、成本、路由、Judge 和所有者抽检证据。

- [ ] 正式测量前运行最少的夹具式 Harness 冒烟；不得把基础设施调试记录算作组件证据。
- [ ] 比较建议行为前，先通过运营核心预检。
- [ ] 分别运行组件有效性、路由、组件非干扰性和框架非干扰性协议。
- [ ] 在申请选中组件预算前，先完成并发布 12 次微试点。
- [ ] 在申请任何框架矩阵前，完成不超过 36 次的三组件试点。
- [ ] 只有通过 R2 并另行批准预算后，才运行 54 次 A/B/C 框架试点；期间不得修改 Prompt、候选 SHA 或 Judge 标准。
- [ ] 根据观测方差和效应量重新计算留出集样本量。第 6.4 节的 `12 个未见任务 × 3 个变体 × 3 次重复 = 108 次会话` 上限只能在另行批准后使用，并且不得把所有者抽检描述为独立人类盲评。
- [ ] 第一份能力档案产生晋级候选后，才使用第二份获批能力档案重复必要的留出证据。
- [ ] 提交原始结果引用和证据摘要，不根据精选案例声称改进。

### Task 8：人类晋级 Gate

**文件：**

- 仅在 frontier 配置获批后修改：`README.md`。
- 仅在发布 Fork 标签版本时修改：`RELEASE-NOTES.md`。

**接口：**

- 输入：完整 Diff、当前阶段要求的证据、回归列表、Judge/抽检局限和回滚 SHA。
- 输出：批准、修订、隔离或拒绝决策。

- [ ] 向人类所有者展示完整分支 Diff 和评估证据。
- [ ] 分别给出默认、可选和隔离状态建议，但 Task 8 内不执行任何一项：组件隔离必须重新申请 G2，修改 Fork 默认配置必须另行申请 G3。
- [ ] 至少保留一个发布周期的稳定 `full` 回退配置。
- [ ] 本计划不创建上游 PR；上游贡献需要单独的用户决策和贡献者规范审计。
- [ ] 获批后，使用提交信息 `docs: publish frontier workflow profile evidence` 提交文档。

## 8. 人类治理 Gate

| Gate | 授权内容 | 不授权内容 |
|---|---|---|
| G0 范围批准 | 只读清单、契约、来源和基线捕获 | 修改 canonical Skill |
| G1 实验批准 | 修改精确指定的实验 Fork 变体，并执行其冻结测量预算 | canonical/默认替换、隔离或删除 |
| G2 组件隔离 | 在隔离替代中关闭一个已测量候选组件并观察 | 删除包含该组件的 Skill 或修改默认配置 |
| G3 默认配置晋级 | 将已评估配置设为 Fork 默认，同时保留 `full` 回退 | 物理删除或上游 PR |
| G4 物理删除 | 在依赖复扫、替代验证、观察和恢复演练后，删除精确组件或旧别名 | 任何未列出的路径 |
| G5 上游提案 | 准备一份单独审阅、目标为上游 `dev` 的 PR | 合并、强推或绕过贡献者要求 |

每个 Gate 都需要精确目标、不可变 SHA、证据包、未解决风险和回滚产物。一个 Gate 的批准不能复用于下一个 Gate。

R0、R1 和 R2 是 G1 内部的技术证据 Gate。通过其中一个，不会把实验授权自动延续到下一阶段：每次必须重新声明候选 SHA、组件、夹具、Judge 协议、会话上限、预计 Token/时间成本和停止规则，并重新取得 G1 批准。

## 9. 回滚策略

- 每个行为家族使用独立提交。
- 在留出集晋级通过前，`full` 配置在行为上保持等同于 v6.1.1 基线。
- 单个组件失败时，只回滚或隔离该组件，不回滚互相独立的改进。
- Fork 分支属于实验分支；本地安装必须固定到不可变提交，而不是跟随移动分支。
- 删除旧别名、修改默认配置和提出上游集成，都分别需要单独的人类批准。
- 隔离只关闭已测量候选组件；只要包含保留组件，其所在 Skill 就继续保持可发现。
- 物理删除前必须重新扫描入站引用、运行替代项冒烟测试、检查观察记录、核对备份 Hash，并成功完成恢复演练。

## 10. 完成定义

### 10.1 第一阶段退出标准

只有满足以下共同条件，第一阶段才可以形成可追责的退出结果：

- 入口清单覆盖全部已注册的 hook、bootstrap、缓存、再次注入、上下文包含和原生发现路径；每条都记录路由来源绑定、`test_status`、证据分类、缺口原因和所有者；只有拟晋级的受支持 Harness 必须具备 `live_e2e` 证据；
- Floor, Not Ceiling v0.2 的来源信息已固定，每个已知本地镜像都记录 `sync`、`archive` 或 `deliberately_unmanaged` 决策；
- 组件契约覆盖三个第一阶段候选，以及为了暴露它们而修改的所有路由指令；
- 每个强制组件都说明真实执行机制和权威模型；
- R0 至少发布 30 次高风险纯路由判定、全部原始判定、观测漏判、案例/会话层分析，以及逐案例和聚合单侧 95% 上界，且没有把观测 0 次写成真实漏判率为 0；0 次漏判和预注册精确率/召回率阈值是继续执行的条件，不是记录有效拒绝结果的条件；
- 固定 LLM Judge 和所有者抽检协议可复现，并明确披露其独立性局限；
- 没有在第一阶段批准下修改任何第二阶段 Skill。
- 差分夹具证明 `superpowers=full` 在路由、注入形态、强制 Gate 和代表性工作流路径上，与固定 v6.1.1 基线保持行为等价。

随后，第一阶段必须通过以下三种结果之一退出：

1. **R0 拒绝：** 出现一个或多个高风险漏判，或某项预注册路由阈值失败；完整结果包和拒绝原因已公开；不得修改下游 Skill，也不得声称组件有效性。
2. **R1 提前停止：** 全部 12 次方向性微试点都可以根据不可变 SHA 重现；没有出现成本/质量方向及其停止理由已公开；不得声称 TDD 有效性、三组件验证、框架结论或退役结论。
3. **R2 方法验证：** 全部 12 次方向性会话和不超过 36 次的选中组件会话都可以重现；三个候选分别得到组件有效性与非干扰性结论：保留、缩小范围、条件启用或隔离候选。

三者都是有效的测量完成结果。只有 R2 结果可以解锁第二阶段或更大矩阵；任何结果都不会自动授权 54 次或 108 次设计。

### 10.2 完整计划完成标准

只有拟晋级范围确实需要，并且满足以下条件，完整计划才算完成：

- 组件契约覆盖每一条被修改的指令；
- 每次评估运行都绑定到经过批准的能力配置档案；
- 路由测试包含正例、负例、冲突、覆盖和高风险对抗案例；
- 所有配置中，不变量安全和完成证据始终启用；
- 运营核心、组件有效性、路由、组件非干扰性和框架非干扰性结果分别报告；
- 每项获条件批准的框架或留出集评估都可以根据不可变 SHA 和固定 Judge 协议重现；
- Frontier 质量不劣于完整 Superpowers；
- 机械和边界明确任务达到 Token 或耗时中位数降低 25% 的目标；
- 如果提出默认配置晋级，第二份获批顶级模型能力档案只验证该晋级主张所需的内容；
- 人类所有者审阅完整 Diff，并明确批准任何默认配置变更。
