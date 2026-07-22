# 探索性讨论路由与跨框架仲裁设计说明

> 日期：2026-07-22  
> 状态：设计提案，尚未修改 Skill 实现  
> 适用范围：Superpowers、Thinking Skills 及二者同时安装的环境  
> 来源 Case：`D:\csdn\D1-D3\thinking-skills\cases\framework\exploratory-technical-discussion-over-systematized.md`

## 1. 结论

当前失败由两个相互放大的问题组成：

1. **Superpowers 的流程误触发**：`brainstorming` 把探索性技术讨论解释为准备形成设计和实施规格，过早进入 HARD-GATE。
2. **跨框架缺少 Router 仲裁**：Thinking Router 与 Superpowers Router 都在解释顶层意图，后执行或规则更严格的一方可能覆盖前一方。

只修改 Thinking Skills 不能保证问题消失。即使 Thinking Router 正确识别出探索性讨论，Superpowers 仍可能根据“问题复杂、存在设计语言”重新选择 `brainstorming`。

反过来，只修 Superpowers 可以解决当前 Case 的直接症状，但不能消除未来多个 Router 对同一请求产生冲突的系统性风险。

因此需要两层修复：

- 先收窄 Superpowers 的流程门禁，解决直接误触发；
- 再建立最小跨框架路由信封，解决 Router 所有权和协作问题。

## 2. Case 与期望行为

抽象请求：

```text
Could we add a protocol layer between the LLM and its skills,
with a dynamic ratio for each skill?
```

上下文信号：

- 用户正在进行架构探索；
- 用户询问可行性和设计方向；
- 没有要求修改文件；
- 没有要求写正式规格；
- 没有要求开始实现。

正确行为：

1. 首先回答想法是否可行。
2. 解释单一百分比缺少稳定操作语义。
3. 区分激活、上下文预算、生成影响、执行强度和评价权重。
4. 给出可讨论的协议维度或设计方案。
5. 如确有必要，在提供实质价值后最多提出一个问题。

禁止行为：

- 自动创建多步骤实施计划；
- 自动写 spec；
- 在给出初步判断前要求批准设计；
- 只提出澄清问题而没有实质回答；
- 向用户暴露无助于决策的内部 Router 轨迹。

## 3. 当前失败链

当前 Superpowers 路由主要使用：

```text
mechanical | bounded | complex | high_risk
```

探索性架构问题通常具有 material ambiguity，因此容易产生以下路径：

```text
探索性技术讨论
→ material ambiguity
→ task_class=complex
→ 选择 design/planning Process Skill
→ brainstorming
→ HARD-GATE
→ 规格、批准与实施准备
```

根本错误是把两个正交维度混在一起：

- `complex` 表达问题的复杂度；
- `exploration/design/implementation` 表达用户当前所处阶段。

问题可以非常复杂，但仍然只是讨论；问题也可以很简单，但用户明确要求形成正式设计或实施。

## 4. 设计目标

### 4.1 必须实现

- 区分探索、正式设计和实施。
- 没有 mutation 或交付意图时，不自动触发完整 Process Gate。
- 一个请求在同一个 `exclusive_group` 中最多有一个 Router owner。
- Domain Skill 可以在探索阶段直接提供价值。
- Superpowers 始终保留风险、权限和验证底线。
- 没有额外 Skill 产生正收益时，允许 `no_advisory_workflow`。
- 当前 `full` 兼容路径继续可用。

### 4.2 暂不实现

- 不实现连续小数形式的 Skill 权重。
- 不设计通用跨厂商协议标准。
- 不一次性重写所有 Superpowers Skills。
- 不把 brainstorming 扩展成新的巨型通用分析 Skill。
- 不用大型评估矩阵替代第一轮真实试用。

## 5. 最小路由信封

Thinking Router 或其他上游意图 Router 可以输出：

```yaml
protocol_version: "0.1"

router_owner: thinking-router
exclusive_group: intent-router

domain: technical
interaction_mode: exploration
mutation_intent: false
process_gate_allowed: false

recommended_skills:
  - technical-deep-dive

confidence: medium
```

### 5.1 字段定义

| 字段 | 含义 |
|---|---|
| `router_owner` | 当前顶层意图路由的所有者 |
| `exclusive_group` | 同组只能有一个有效 Router owner |
| `domain` | technical、content、learning、emotional 等领域 |
| `interaction_mode` | 当前交互阶段，而不是问题复杂度 |
| `mutation_intent` | 用户是否要求修改文件、系统或外部状态 |
| `process_gate_allowed` | 当前是否允许升级为正式设计或交付流程 |
| `recommended_skills` | 上游建议使用的 Domain Lens |
| `confidence` | 路由置信度；不能替代安全判断 |

### 5.2 Interaction Mode

第一版只支持离散状态：

```text
conversation
exploration
design
implementation
review
```

不使用数字表示阶段强度。

## 6. 最小仲裁算法

```text
1. 建立 Policy Floor
2. 检查是否已有有效 intent-router owner
3. 若存在，接受其 domain、interaction_mode 和 mutation_intent
4. 若不存在，Superpowers 执行 fallback 意图判断
5. 独立计算 task_class 和风险等级
6. 根据 interaction_mode 判断 Process Gate 是否允许激活
7. 选择 Domain Skill 和必要的 Process Skill
8. 执行、验证并记录粗粒度结果
9. 无正收益 advisory 时返回 no_advisory_workflow
```

### 6.1 所有权规则

- `exclusive_group=intent-router` 中只能有一个 owner。
- Thinking Router 已提供有效信封时，Superpowers 不重新解释领域和交互阶段。
- Superpowers 仍可因安全、发布、迁移、秘密、破坏性操作或回滚风险提高 `effective_profile`。
- 上游 Router 无权降低宿主权限、政策门禁或高风险底线。
- 信封缺失、失效或字段冲突时，Superpowers 使用保守 fallback。

## 7. Superpowers 修改

### 7.1 扩展路由记录

在现有字段之外增加：

```yaml
interaction_mode: conversation | exploration | design | implementation | review
mutation_intent: true | false
process_gate_allowed: true | false
router_owner: string | null
```

现有字段继续保留：

```yaml
requested_profile: full | frontier | off
effective_profile: full | frontier | off
task_class: mechanical | bounded | complex | high_risk
mandatory_components: []
advisory_components: []
outcome: full_v6_1_1 | selected_advisory_workflow | no_advisory_workflow
```

### 7.2 新增探索规则

```text
interaction_mode=exploration
AND mutation_intent=false
AND process_gate_allowed=false
```

满足时：

- 不推断 `brainstorming`；
- 不推断 `writing-plans`；
- 不推断 `test-driven-development`；
- 不创建 spec 或 implementation plan；
- 可以选择 `technical-deep-dive` 等 Domain Skill；
- Domain Skill 没有正收益时允许 `no_advisory_workflow`；
- 必须先提供实质回答，再决定是否提出一个后续问题。

### 7.3 修改 complex 的含义

`task_class=complex` 只表示：

- 存在实质歧义；
- 跨模块；
- 所有权不清晰；
- 多阶段集成。

它不再自动表示：

- 用户要求形成设计；
- 用户要求写规格；
- 用户准备实施；
- brainstorming 应取得控制权。

Process Skill 必须同时满足阶段和激活条件。

## 8. Brainstorming 修改

### 8.1 收窄触发条件

第一版把 brainstorming 定位为正式设计流程，而不是所有创意讨论的默认入口。

建议激活条件：

```yaml
activate_when:
  - 用户明确要求形成设计
  - 用户明确要求写规格
  - 用户要求实现，但关键需求或架构仍不明确
  - 用户显式请求 brainstorming
```

建议排除条件：

```yaml
do_not_activate_when:
  - 只询问可行性
  - 讨论原理、方向或权衡
  - mutation_intent=false
  - interaction_mode=conversation
  - interaction_mode=exploration
```

### 8.2 收窄 HARD-GATE

现有“所有 project 都必须先设计并批准”的规则改为：

```text
只有进入 design-for-delivery 或 specify 模式后，
才禁止实施并要求先完成设计确认。
```

HARD-GATE 继续保护真实实施任务，但不能阻止探索性讨论先提供分析价值。

### 8.3 暂不增加庞大 explore 模式

探索性技术讨论已经可以由基础模型或 Domain Skill 完成。第一版不把 brainstorming 扩展成另一个技术分析框架。

如果后续实验表明 brainstorming 的轻量 ideation 能产生独有收益，再增加无文档、无审批、不得自动升级的 `explore` 模式。

## 9. Thinking Skills 修改

### 9.1 Thinking Router

除 Domain Skill 外，同时输出：

- `router_owner`；
- `exclusive_group`；
- `interaction_mode`；
- `mutation_intent`；
- `process_gate_allowed`；
- `confidence`。

“技术问题”不能自动等于“技术实施工作流”。

### 9.2 Technical Deep Dive

明确三种行为：

| 模式 | 行为 |
|---|---|
| `exploration` | 先给判断和方案，提供价值后最多追问一个问题 |
| `design` | 目标、约束、方案、权衡和验证，但不自动实施 |
| `implementation` | 进入项目变更流程并遵守相应门禁 |

探索模式禁止自动创建实施计划或规格文件。

## 10. 路由矩阵

| Interaction Mode | Mutation Intent | Task Class | 默认流程 |
|---|---:|---|---|
| conversation | false | 任意非高风险 | Domain Lens 或 no advisory |
| exploration | false | bounded/complex | Domain Lens；不启动 Process Gate |
| design | false | bounded/complex | 按需 brainstorming specify；不实施 |
| implementation | true | bounded | 紧凑计划和风险驱动测试 |
| implementation | true | complex | brainstorming/specify、计划和目标测试 |
| 任意 | 任意 | high_risk | 强制 `effective_profile=full` 和完整风险底线 |

## 11. 回归测试

### 11.1 失败 Case

```yaml
id: exploratory-protocol-feasibility
prompt: >-
  Could we add a protocol layer between the LLM and its skills,
  with a dynamic ratio for each skill?
context:
  interaction: ongoing architecture discussion
  requested_artifact: none
  requested_mutation: false
expected_route:
  interaction_mode: exploration
  mutation_intent: false
  process_gate_allowed: false
  task_class: complex
  effective_profile: frontier
  advisory_components:
    - technical-deep-dive
must_not_select:
  - brainstorming
  - writing-plans
  - test-driven-development
```

输出验收：

- 首轮出现直接可行性判断；
- 解释比例语义；
- 提供协议维度或替代方案；
- 不创建计划或 spec；
- 不要求先批准设计；
- 最多在提供价值后追问一个问题。

### 11.2 正向控制

```yaml
id: explicit-design-for-delivery
prompt: >-
  请把这个 Skill 协议设计成可实施方案，写正式规格，
  获得确认后再准备开发。
expected_route:
  interaction_mode: design
  mutation_intent: true
  process_gate_allowed: true
  advisory_components:
    - brainstorming
```

该用例必须保留正式设计门禁，证明优化没有通过关闭 brainstorming 来获得表面成功。

### 11.3 安装组合

同一组 Case 至少验证：

1. 仅 Superpowers；
2. 仅 Thinking Skills；
3. Thinking Skills + Superpowers。

组合安装时必须证明只有一个 `intent-router` owner。

## 12. 试用记录

在现有真实任务日志中增加：

```yaml
router_owner: thinking-router | using-superpowers | null
interaction_mode: string
mutation_intent: boolean
process_gate_allowed: boolean
selected_routers: []
clarifying_questions_before_first_value: integer
plan_or_spec_created: boolean
```

继续保留：

- 结果满意度；
- 流程是否过重；
- 是否返工；
- 验证结果；
- 高风险漏路由；
- token、时间和交互次数（可获得时）。

真实试用证据用于发现问题和生成局部假设，不直接支持 profile 正式晋级。

## 13. 实施顺序

### Step 1：冻结回归

- 把失败 Case 加入 Superpowers 路由测试。
- 加入显式设计请求正向控制。
- 测试先证明当前实现会误触发或缺少所需字段。

### Step 2：扩展 Superpowers 路由

- 新增 interaction 和 mutation 字段。
- 让 `complex` 与 Process Gate 解耦。
- 加入探索阶段负向选择规则。

### Step 3：收窄 Brainstorming

- 修改 frontmatter 和激活规则。
- 将 HARD-GATE 限定到 design-for-delivery。
- 保留正式设计与实施前的可靠性保护。

### Step 4：扩展 Thinking Router

- 输出最小路由信封。
- 为 technical-deep-dive 增加阶段行为契约。

### Step 5：集成仲裁

- Superpowers 接受已有 Router owner。
- 增加重复 Router、冲突信封和缺失信封测试。

### Step 6：真实试用

- 先运行 5～10 个真实探索性讨论任务。
- 任意高风险漏路由立即回退 `superpowers=full`。
- 连续两次明确质量回归时停止自动 frontier。
- 根据真实失败形成下一条局部假设，不自动扩大实验矩阵。

## 14. 验收标准

### 探索场景

- 探索性技术问题不会自动进入规格流程。
- 首轮回答在追问前提供可独立成立的价值。
- 不创建无请求的计划、spec 或任务清单。
- Domain Skill 能成为 lead，Process Skill 可以不激活。

### 交付场景

- 明确设计请求仍触发 brainstorming 正式流程。
- 明确实现请求在设计不足时仍受到必要门禁保护。
- 高风险任务始终强制 `full`。
- 权限、破坏性操作确认和完成证据不受 advisory 路由影响。

### 跨框架场景

- 一个 `exclusive_group` 中最多一个 Router owner。
- Thinking Router 的探索判断不会被 Superpowers 静默覆盖。
- Superpowers 可以提高安全强度，但不能把 exploration 静默升级为 specification。
- 单独安装和组合安装均有可复现路由记录。

## 15. 推荐决策

本问题应作为当前 Phase 1 中 `brainstorming.universal_design_gate` 的核心负向 Case，而不是另起一个大规模框架重构项目。

下一次实现只处理：

1. 探索阶段识别；
2. mutation intent；
3. brainstorming 门禁收窄；
4. 单一 intent-router owner；
5. 对应正负回归。

不在这一批实现连续权重、通用协议平台或其他下游 Skill 重写。

最终原则：

> Domain 判断“这是什么问题”；Interaction Mode 判断“用户现在处于什么阶段”；Process Gate 判断“是否应该升级为交付流程”；Policy Floor 决定“哪些边界无论如何都不能关闭”。
