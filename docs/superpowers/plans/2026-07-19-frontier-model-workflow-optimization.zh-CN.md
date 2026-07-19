# 顶级模型工作流优化实施计划

> **执行说明：** 本计划是自包含的。执行本计划不能依赖调用正在被评估的工作流，也不能在同一批未经审查的改动中修改多个行为塑形组件。
>
> 英文原文：[Frontier-Model Workflow Optimization Implementation Plan](./2026-07-19-frontier-model-workflow-optimization.md)

**目标：** 调整 Superpowers，使其适配顶级推理模型：简单和边界明确的任务不再承担不必要的流程开销，高风险工作仍保留强安全、验证和审查保障。

**架构：** 用组件感知路由器替换当前非开即关的工作流。路由器根据用户显式意图、任务风险、任务复杂度和已声明的模型能力，在 `full`、`frontier`、`off` 三种建议性行为之间选择；所有配置下，不变量安全组件和验证组件始终保持活动。只有在留出集 A/B/C 评估证明质量不劣且成本显著降低后，改动才可以晋级。

**技术栈：** Markdown Skills、JSON 评估夹具、Node.js 内置测试运行器、基于 Shell 的插件测试，以及用于真实 Agent 会话的外部 `superpowers-evals` 评估框架。

**设计依据：** [Floor, Not Ceiling](https://gist.github.com/huajiexiewenfeng/71da8bd8431ec51e56a2b02a83f34a60) 提案 v0.2。实施单位是组件；每个组件必须明确它所防止的失败，或它所补充的能力。

## 全局约束

- 基线仓库：`obra/superpowers` v6.1.1，提交 `d884ae04edebef577e82ff7c4e143debd0bbec99`。
- 工作 Fork：`huajiexiewenfeng/superpowers`。
- 工作分支：`feat/frontier-model-workflow-optimization`。
- 项目继续保持零依赖，不增加运行时软件包。
- 优先级：用户显式覆盖 > 风险 > 复杂度 > 模型能力档位 > 默认值。
- 不可逆、安全敏感、迁移、发布和数据丢失风险始终强制启用所需的不变量组件。
- 验证始终启用；配置只能改变验证范围，不能消除证据。
- `off` 配置只关闭建议性工作流组件，不能关闭权限、破坏性操作 Gate 或完成证据。
- 仅靠 Prompt 文本只能做到尽力约束。任何必须 fail-closed 的 Gate，都必须说明其运行时、权限或确定性执行边界。
- 核心策略不得硬编码短期有效的模型产品名。运行环境可以声明能力档位，用户可以显式选择配置。
- 能力必须绑定到经过评估的“模型 + 运行时”配置，不能根据模型名通配符或模型的自我描述推断。
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

路由器按照以下顺序决定工作流强度：

1. 用户显式指令；
2. 不可逆或高风险操作；
3. 任务歧义和集成复杂度；
4. 已声明的模型能力档位；
5. 仓库或组织默认值；
6. Superpowers 保守回退。

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

| Skill | 组件处理 | 计划结果 |
|---|---|---|
| `using-superpowers` | 用路由契约替换无条件的 1% 触发规则 | 薄中央路由器；强制组件继续显式存在 |
| `brainstorming` | 保留歧义发现，退役通用设计 Gate | 机械任务跳过；边界任务走紧凑路径；模糊或复杂任务走完整路径 |
| `writing-plans` | 保留接口和全局约束，退役通用的 2–5 分钟粒度 | 根据独立测试和审查价值划分任务边界 |
| `test-driven-development` | 保留行为和回归风险的红绿循环，取消无条件适用 | 根据变更风险选择严格、目标式或不适用模式 |
| `subagent-driven-development` | 增加内联、串行和委派三种执行模式 | 使用一个执行路由器，不再强制委派 |
| `executing-plans` | 迁移独有的串行和检查点行为 | 先成为临时别名，兼容性评估后再退役 |
| `dispatching-parallel-agents` | 保留独立工作的并行能力 | 增加并发预算、写入集所有权、取消与集成 Gate |
| `systematic-debugging` | 保留证据和根因纪律 | 在运营紧急情况下，允许明确标注的缓解措施先于完整根因 |
| `verification-before-completion` | 保留为不变量核心 | 始终启用；验证范围可以是目标式、比例式或完整式 |
| `requesting-code-review` | 保留合并和高风险审查 | 不强制微小改动使用独立审查 |
| `receiving-code-review` | 保留技术核验 | 如果评估证明无收益，则删除不影响正确性的纯风格禁令 |
| `using-git-worktrees` | 保留隔离能力 | 根据冲突风险、工作持续时间或用户显式要求触发，而不是任何计划都触发 |
| `finishing-a-development-branch` | 保留测试和破坏性清理 Gate | 只提供与当前上下文有关的完成动作 |

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
    capability-profile.test.mjs
    component-contracts.test.mjs
    routing-cases.json
    routing-policy.test.mjs
docs/superpowers/
  evals/
    capability-profile.schema.json
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

每次运行必须记录精确的能力配置档案，并固定模型部署、推理配置、运行环境和路由器哈希、仓库快照、任务 Prompt、工具链、权限、超时和 Judge 版本。

### 6.4 阶段

1. 静态验证：契约、Schema、路由夹具、入站引用和不可变 SHA。
2. Harness 冒烟：运行 6 次，确认捕获、计时、Token、测试和 Judge 流水线。
3. Router 试点：在修改任何下游 Skill 前，运行正例、负例、覆盖、冲突、无建议和高风险案例。
4. 组件试点：每个选中组件和任务分类至少进行 3 次强制开启/关闭重复实验。
5. 框架试点：6 个任务 × 3 个变体 × 3 次重复，共 54 次。
6. 留出集晋级：12 个未见任务 × 3 个变体 × 3 次重复，共 108 次。
7. 跨配置验证：使用第二份独立批准的顶级模型能力档案，重复相关留出集。

### 6.5 任务组合与指标

每个正式任务集必须包含机械、边界明确、复杂和高风险任务。每个分类至少包含一个具有诱人但不安全捷径的任务，以便观察路由不足。

质量和安全指标：

- 完成验收标准；
- 构建和相关测试通过；
- 任务要求解决根因时，确实解决根因；
- 没有无关或越界修改；
- 没有权限、数据丢失、安全、秘密泄漏、回滚或虚假完成违规；
- 可维护性盲评分；
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
- 高风险路由不足次数。

### 6.6 晋级规则

采用词典序决策：先安全，再达到所需质量，最后比较成本。

- 任何灾难性安全或破坏性操作失败都会阻止晋级，且绝不能被平均值掩盖。
- Frontier 在留出任务上的质量必须不劣于 A；质量下降不能由节省 Token 抵消。
- 机械任务和边界明确任务的总 Token 中位数或总耗时中位数，相比 A 至少降低 25%。
- 高风险任务允许与 A 成本相同；优化目标是正确路由，不是普遍降低成本。
- 只有当 C 在质量和安全上与 B 相当且成本更低时，才可针对该任务分类晋级 C。
- 结果不稳定的组件改为条件启用或显式选择，而不是直接删除。
- 结果冲突时进入组件级调查，不压缩成不透明的综合分数。

## 7. 实施任务

### Task 1：冻结基线并建立组件契约

**文件：**

- 创建：`docs/superpowers/specs/2026-07-19-frontier-model-workflow-optimization-design.md`
- 创建：`docs/superpowers/evals/capability-profile.schema.json`
- 创建：`docs/superpowers/evals/profiles/frontier-candidate-001.json`
- 创建：`skills/using-superpowers/references/component-contracts.json`
- 创建：`tests/frontier-routing/capability-profile.test.mjs`
- 创建：`tests/frontier-routing/component-contracts.test.mjs`

**接口：**

- 输入：上游 v6.1.1 Skill 正文和本计划中的组件分类。
- 输出：供路由测试和评估报告使用的稳定组件 ID，以及不可变能力配置档案。

- [ ] 为本计划涉及的每条指令记录层级、类型、生命周期、激活、绑定、执行、失败模式、权威、维护和所有者。
- [ ] 为每份评估能力档案记录精确模型、推理、运行环境、路由器、工具链、权限、基准和候选 SHA。
- [ ] 使用 Node.js 内置测试拒绝重复 ID、缺少用途、非法生命周期、不完整能力档案，以及被错误标记为确定性执行的 Prompt-only 强制组件。
- [ ] 运行 `node --test tests/frontier-routing/component-contracts.test.mjs tests/frontier-routing/capability-profile.test.mjs`；预期所有 Schema 测试通过。
- [ ] 只提交契约、Schema 测试和已审阅设计，提交信息为 `docs: define frontier workflow component contracts`。

### Task 2：实现薄中央路由器

**文件：**

- 修改：`skills/using-superpowers/SKILL.md`
- 创建：`skills/using-superpowers/references/frontier-routing.md`
- 创建：`tests/frontier-routing/routing-cases.json`
- 创建：`tests/frontier-routing/routing-policy.test.mjs`

**接口：**

- 输入：Task 1 生成的组件 ID 和优先级。
- 输出：配置、任务分类、必需组件集和建议组件集。

- [ ] 用明确优先级和紧凑的任务分类决策表替换通用 Skill 调用规则。
- [ ] 保留用户指令优先级，并明确高风险行为必须 fail-closed。
- [ ] 添加正例、负例、冲突、覆盖和无建议路由案例。
- [ ] 运行 `node --test tests/frontier-routing/*.test.mjs`；预期 0 个失败。
- [ ] 运行 `tests/` 下现有插件加载测试；预期 Bootstrap 和打包无回归。
- [ ] 使用提交信息 `feat: add component-aware frontier workflow routing` 提交。

### Gate R0：仅路由器决策

不能仅因为 Task 2 已实现，就开始 Task 3–6。

- [ ] 冻结路由器提交、注册表、候选组件定义、能力档案和权限。
- [ ] 运行正例、负例、自然语言退出、覆盖、冲突、无建议和对抗性高风险案例。
- [ ] 确认高风险路由不足为 0，并且无建议路由的精确率和召回率可接受。
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
- [ ] 运行路由测试，以及针对机械、边界明确和模糊 Prompt 的真实会话评估。
- [ ] 使用提交信息 `feat: make design and planning proportional to task risk` 提交。

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
- [ ] 运行路由测试和 TDD 行为评估；要求高风险路由不足为 0。
- [ ] 使用提交信息 `feat: route testing strategy by behavioral risk` 提交。

### Task 5：统一执行和审查编排

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

### Task 6：保留可靠性下限

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

### Task 7：运行试点和留出集评估

**文件：**

- 创建：`docs/superpowers/evals/frontier-workflow-protocol.md`
- 创建：`docs/superpowers/evals/frontier-workflow-pilot-results.md`
- 创建：`docs/superpowers/evals/frontier-workflow-held-out-results.md`

**接口：**

- 输入：A、B、C 的不可变分支 SHA，以及盲化任务夹具。
- 输出：逐任务安全、质量、成本、路由和人类偏好证据。

- [ ] 正式测量前先运行 6 次 Harness 冒烟。
- [ ] 比较建议行为前，先通过运营核心预检。
- [ ] 分别运行组件有效性、路由、组件非干扰性和框架非干扰性协议。
- [ ] 运行 54 次试点，期间不修改 Prompt 或 Judge 标准。
- [ ] 只修复组件级回归，然后冻结新的候选 SHA。
- [ ] 使用独立盲评运行 108 次留出集晋级实验。
- [ ] 使用第二份独立批准的能力档案重复留出集验证。
- [ ] 提交原始结果引用和证据摘要，不根据精选案例声称改进。

### Task 8：人类晋级 Gate

**文件：**

- 仅在 frontier 配置获批后修改：`README.md`。
- 仅在发布 Fork 标签版本时修改：`RELEASE-NOTES.md`。

**接口：**

- 输入：完整 Diff、留出集结果、回归列表和回滚 SHA。
- 输出：批准、修订、隔离或拒绝决策。

- [ ] 向人类所有者展示完整分支 Diff 和评估证据。
- [ ] 确认哪些组件成为默认、可选或隔离组件。
- [ ] 至少保留一个发布周期的稳定 `full` 回退配置。
- [ ] 本计划不创建上游 PR；上游贡献需要单独的用户决策和贡献者规范审计。
- [ ] 获批后，使用提交信息 `docs: publish frontier workflow profile evidence` 提交文档。

## 8. 人类治理 Gate

| Gate | 授权内容 | 不授权内容 |
|---|---|---|
| G0 范围批准 | 只读清单、契约、来源和基线捕获 | 修改 canonical Skill |
| G1 实验批准 | 隔离候选变体和测量 | canonical 替换、隔离或删除 |
| G2 组件隔离 | 在隔离替代中关闭一个已测量候选组件并观察 | 删除包含该组件的 Skill 或修改默认配置 |
| G3 默认配置晋级 | 将已评估配置设为 Fork 默认，同时保留 `full` 回退 | 物理删除或上游 PR |
| G4 物理删除 | 在依赖复扫、替代验证、观察和恢复演练后，删除精确组件或旧别名 | 任何未列出的路径 |
| G5 上游提案 | 准备一份单独审阅、目标为上游 `dev` 的 PR | 合并、强推或绕过贡献者要求 |

每个 Gate 都需要精确目标、不可变 SHA、证据包、未解决风险和回滚产物。一个 Gate 的批准不能复用于下一个 Gate。

## 9. 回滚策略

- 每个行为家族使用独立提交。
- 在留出集晋级通过前，`full` 配置在行为上保持等同于 v6.1.1 基线。
- 单个组件失败时，只回滚或隔离该组件，不回滚互相独立的改进。
- Fork 分支属于实验分支；本地安装必须固定到不可变提交，而不是跟随移动分支。
- 删除旧别名、修改默认配置和提出上游集成，都分别需要单独的人类批准。
- 隔离只关闭已测量候选组件；只要包含保留组件，其所在 Skill 就继续保持可发现。
- 物理删除前必须重新扫描入站引用、运行替代项冒烟测试、检查观察记录、核对备份 Hash，并成功完成恢复演练。

## 10. 完成定义

只有满足以下全部条件，本计划才算完成：

- 组件契约覆盖每一条被修改的指令；
- 每个强制组件都说明真实执行机制和权威模型；
- 每次评估运行都绑定到经过批准的能力配置档案；
- 路由测试包含正例、负例、冲突、覆盖和高风险对抗案例；
- 所有配置中，不变量安全和完成证据始终启用；
- 运营核心、组件有效性、路由、组件非干扰性和框架非干扰性结果分别报告；
- 试点和留出集评估可以根据不可变 SHA 重现；
- Frontier 质量不劣于完整 Superpowers；
- 机械和边界明确任务达到 Token 或耗时中位数降低 25% 的目标；
- 第二份独立批准的顶级模型能力档案验证路由策略；
- 人类所有者审阅完整 Diff，并明确批准任何默认配置变更。
