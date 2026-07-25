# 探索性讨论路由与跨框架仲裁统一方案

> 状态：待评审（已确认 B0 的可见触发与用户仲裁方向）
> 日期：2026-07-22
> 来源：合并自两个独立 session 的方案
> - `2026-07-22-thinking-skills-optimization-design.md`（Thinking Skills 视角，下称「方案一」）
> - `2026-07-22-exploratory-discussion-routing-arbitration.zh-CN.md`（跨框架仲裁视角，下称「方案二」）
>
> 适用范围：Superpowers、Thinking Skills 及二者同时安装的环境
> 目标仓库：`D:\csdn\D1-D3\thinking-skills` 与 Superpowers 仓库

## 1. 摘要与合并原则

两个方案针对同一根因——把「问题复杂度」和「用户所处阶段」混为一谈，导致探索性技术讨论被升级为正式规格流程——但在 schema 与实施顺序上互相冲突。本文档以方案一为主干（任务画像 schema、评测先行），并入方案二的独有价值（brainstorming 门禁收窄、Router 所有权规则、正负回归 case），冲突处的裁决记录在第 2 节。

核心判断（两方案共识）：

> Thinking Skills 可以识别「用户在做什么」，但不能仅靠 `SKILL.md` 文本强制其他框架如何行动。Domain 判断「这是什么问题」；Objective 判断「用户现在处于什么阶段」；Process Skill 根据任务事实自行判断前置条件；Policy Floor 决定「哪些边界无论如何都不能关闭」。

## 2. 冲突裁决记录

评审时请重点确认以下裁决是否成立。

### 2.1 任务画像 schema：采用 `objective + mutation + artifact`

- 方案一：`objective`（converse/explore/decide/deliver/review）+ `mutation`（none/requested/unknown）。
- 方案二：`interaction_mode`（conversation/exploration/design/implementation/review）+ `mutation_intent`（boolean）+ `process_gate_allowed`（boolean）。

**裁决：以方案一为基础，并补充正交的 `artifact + artifact_sink`。** 理由：

1. `process_gate_allowed` 让 Router 声明流程许可，越权。Router 只有报告任务事实的资格；是否触发门禁应由 Process Skill 或 Arbiter 根据事实自行判断。
2. 三态 `mutation`（含 `unknown`）比 boolean 更能处理歧义，boolean 会把「尚不明确」强行折叠成 false。
3. 两套枚举语义几乎一一对应（exploration→explore、design→decide、implementation→deliver），保留一套即可。
4. `objective=decide` 不能区分普通方案选择与正式规格请求；`artifact` 表达产物类型，`artifact_sink` 区分聊天输出与工作区/外部变更，避免把「写规格」错误记为 `mutation=unknown`。

### 2.2 实施顺序：严格 RED 后立即修复误触发

- 方案一：先修 benchmark 泄漏建立可信基线，变更集 A 通过前不动 Superpowers。
- 方案二：先冻结回归，随即修改 Superpowers 路由与 brainstorming 门禁。

**裁决：采用严格的 `A0 → B0` 顺序，而不是同一批行为变更。** 方案二的反驳成立：误触发已经在真实对话中发生，不能等待完整跨框架协议才处理。但方案一「没有可信 RED 基线就无法判断是否修对」同样成立。因此：

1. `A0` 先冻结原始对话、证明当前版本会误触发，并修复评测泄漏；
2. `B0` 紧接着只修 brainstorming 的发现/激活边界与用户仲裁；
3. `B1` 再调整 Task Profile、Thinking Router 和 `technical-deep-dive`；
4. `C` 最后实现 registry、owner 与运行时适配器。

`A0` 与 `B0` 可以属于同一里程碑，但不得属于同一不可分辨的提交或评测 arm。第一个 B0 行为修改发生前，A0 的失败结果、模型、宿主、Prompt 和文件哈希必须冻结。

### 2.3 brainstorming 前置条件：补上「正式设计但暂不实施」

- 方案一 registry 草案中 brainstorming 的 precondition 仅 `objective: [deliver]`，会挡掉「只要正式设计、暂不实施」的请求。
- 方案二允许「用户明确要求形成设计/写规格」激活。

**裁决：precondition 改为 `objective ∈ [decide, deliver]`，且 `decide` 分支要求用户显式请求正式设计产物**（规格、可实施方案），而不是任何架构比较讨论都激活。普通 `decide`（方案比较、采用决策）由 `technical-deep-dive` 的 Decide 模式承担。

### 2.4 其他保留项

- 方案二的 `router_owner + exclusive_group` 所有权机制保留，命名并入统一 schema。
- brainstorming 激活默认可见；显式意图直接启用并提示，推断出来的重大流程升级允许用户确认或退出；探索讨论不弹出前置确认。
- 方案二 §11.1 回归 case 中 `effective_profile: frontier` 依赖 Superpowers 具体版本 profile 规则，降级为「待核实」（见第 13 节），断言先只覆盖路由与组件选择。
- 方案二 §11.2 正向控制没有区分聊天中的规格文本与写入仓库的规格文件。统一 schema 下显式写入仓库的 case 为 `objective=decide, mutation=requested, artifact=spec, artifact_sink=workspace`；若只要求在聊天中给出规格，则为 `mutation=none, artifact_sink=chat`，见 §10.3。

## 3. 背景与失败链

抽象 case：

```text
Could we add a protocol layer between the LLM and its skills,
with a dynamic ratio for each skill?
```

上下文信号：用户在进行架构探索，询问可行性与方向；未要求修改文件、写规格或开始实现。

当前失败链（Superpowers 侧）：

```text
探索性技术讨论
→ material ambiguity
→ task_class=complex
→ 选择 design/planning Process Skill
→ brainstorming
→ HARD-GATE
→ 规格、批准与实施准备
```

根本错误是把两个正交维度混在一起：`complex` 表达问题复杂度，`explore/decide/deliver` 表达用户当前阶段。问题可以非常复杂但仍然只是讨论；也可以很简单但用户明确要求交付。

同时 Thinking Skills 侧存在独立问题：benchmark runner 把 `expected_route` 注入被测 Prompt，scorer 只做字符串包含检查，评测结果不可信（已核实，见第 13 节）。

问题分三层：

- **领域路由**：该用哪个 Domain Skill。
- **任务阶段**：当前是探索、决策、交付还是评审。
- **跨框架仲裁**：多个 Router/Domain/Process/Policy 同时出现时由谁裁决。

## 4. 目标与非目标

### 4.1 目标

- 正确区分探索性技术讨论与设计/实现请求。
- 在追问前提供可独立成立的首轮价值。
- 保留正式设计和实施任务所需的流程门禁与安全底线。
- 建立不泄漏答案、能验证路由与行为的 benchmark。
- 让 Process Skill 的实际激活对用户可见，并为推断触发提供比例合适的确认或退出机制。
- 组合安装时同一 `exclusive_group` 只有一个 Router owner。
- 维持 Thinking Skills 领域中立与轻量；Superpowers 保留风险、权限和验证底线。

### 4.2 非目标

- 不实现连续小数形式的 Skill 权重（伪精确）。
- 不用 Prompt 强制实现安全、权限或不可逆操作边界。
- 不让任何 Router 成为所有框架的总控制器。
- 不一次性重写 Thinking Skills 或 Superpowers。
- 不把 brainstorming 扩展成通用技术分析 Skill。
- 不为每个 Skill 或每次普通路由都弹出确认；只有流程升级才进入用户仲裁。
- 不设计通用跨厂商协议标准。

## 5. 统一任务画像 Schema

Router（Thinking Router 或其他上游意图 Router）输出：

```yaml
protocol_version: "0.1"

router_owner: thinking-router
exclusive_group: intent-router

task_profile:
  domain: technical
  objective: explore
  mutation: none
  artifact: analysis
  artifact_sink: chat
  confidence: high

route:
  primary: technical-deep-dive
  secondary: null
```

字段定义：

| 字段 | 可选值 | 含义 |
|---|---|---|
| `router_owner` | Router id | 当前顶层意图路由的所有者 |
| `exclusive_group` | 组 id | 同组只能有一个有效 owner |
| `domain` | technical、content、learning、emotional、meta、none | 用户的主领域 |
| `objective` | converse、explore、decide、deliver、review | 用户当前要完成什么 |
| `mutation` | none、requested、unknown | 是否要求修改文件、系统或外部状态 |
| `artifact` | none、analysis、decision、spec、plan、implementation | 用户明确要求的主要产物；不从技术名词自动推断 |
| `artifact_sink` | chat、workspace、external、unknown | 产物应只出现在对话、写入工作区，还是影响外部系统 |
| `confidence` | high、medium、low | 分类置信度；不能替代安全判断 |
| `primary` | Skill id 或 `no-skill` | 主 Domain Skill |
| `secondary` | Skill id 或 null | 最多一个辅助 Skill |

明确不设 `process_gate_allowed`：Router 报告事实，门禁判断由消费方（Process Skill 前置条件或 Runtime Arbiter）完成。

阶段第一版只用离散状态，不用数字表示阶段强度或 Skill 比例。若未来实验数字权重，必须绑定具体维度（context budget、load order、review count、evaluator weight、输出篇幅分配），且数字不得改变安全、权限和不可逆操作边界。

### 5.1 Arbiter 激活决策

Task Profile 是事实画像；Process Skill 是否实际启用由 Arbiter 另行产生激活决策：

```yaml
skill_activation:
  skill: brainstorming
  state: inactive        # inactive | suggested | active | required
  source: inferred       # explicit | inferred | policy
  visibility: announce   # hidden | announce | confirm
  consent: opt_out       # none | opt_in | opt_out
  reason_code: deliver_with_unresolved_design
```

字段规则：

- `state=inactive`：不加载 Skill；不需要向用户展示内部路由。
- `state=suggested`：尚未加载，等待用户 opt-in 后才能变为 `active`。
- `state=active`：已经选择；`announce` 不阻塞继续工作，`opt_out` 允许用户要求退回普通讨论。
- `state=required`：只能由宿主政策、仓库权威或真实安全边界赋值；普通 Skill 和模型自报不得产生该状态。
- `skill` 必须使用当前注册表中的精确可发现标识符，组合安装时包含 namespace。
- `reason_code` 使用有限枚举供评测和日志使用，不记录用户原文。

## 6. Router 规则

- 「讨论、分析、评估一个实现想法」默认 `explore` 或 `decide`，不是 `deliver`。
- 「实现、修改、创建文件、提交代码、发布」才是 `deliver` 或 `mutation=requested` 信号。
- 技术名词决定 domain，不自动决定 objective。
- `no-skill` 表示不使用 Domain Lens，不代表关闭宿主安全和权限边界。
- Router 只产出画像和路由，不执行 Domain Skill 的实质分析。
- 内部路由记录默认不出现在用户可见回答中。

内部记录示例：

```text
Domain: technical
Objective: explore
Mutation: none
Confidence: high
Primary: technical-deep-dive
Secondary: none
Reason: User asks for feasibility analysis and has not requested changes.
Next: Load technical-deep-dive in explore mode.
```

## 7. 仲裁算法与所有权

```text
1. 建立宿主 Policy Floor
2. 检查是否已有有效 intent-router owner；同一 exclusive_group 只保留一个
3. 若存在，接受其 task_profile（domain、objective、mutation、artifact、artifact_sink）
4. 若不存在、失效或字段冲突，Superpowers 执行保守 fallback 意图判断
5. 独立计算 task_class 和风险等级（不受上游 Router 影响）
6. 过滤不满足 preconditions 的 Process Skill
7. 为候选 Process Skill 产生 `skill_activation` 决策
8. 按 `visibility + consent` 执行提示、确认或软退出
9. 选择 Domain Skill 及其工作模式
10. 执行生成或变更动作
11. 运行 Output Contract / Verifier
12. 无正收益 advisory 时返回 no_advisory_workflow；记录匿名化 trace
```

所有权规则：

- Thinking Router 已提供有效画像时，Superpowers 不重新解释领域和阶段。
- Superpowers 仍可因安全、发布、迁移、秘密、破坏性操作或回滚风险提高 `effective_profile`。
- 上游 Router 无权降低宿主权限、政策门禁或高风险底线。
- Superpowers 可以提高安全强度，但不能把 explore 静默升级为规格流程。
- `router_owner` 只拥有画像字段；Process Skill 激活状态由宿主 Arbiter 决定。Phase C 之前该规则只是同一模型内部约定，不声称具备跨插件强制力。

## 8. Domain Skill：`technical-deep-dive` 工作模式

### 8.1 模式定义

**Explore**（可行性、原理、方向、初步架构讨论）：先给判断和关键理由；提供 2–3 个方向或解释；只在答案会被关键未知项改变时追问，最多一个问题且放在首轮实质分析之后；不创建实施计划、规格文件或 mutation 动作。

**Decide**（架构选择、采用决策、正式设计比较）：明确目标、约束和成功标准；比较方案、权衡、风险和失败模式；给出推荐及可能推翻推荐的条件；提供验证路径但不默认修改项目。

**Deliver**（用户明确要求实现、修改、迁移或交付）：遵守宿主项目流程、权限和变更门禁；必要时加载设计、计划、测试和验证 Skill；以可验证的变更结果为完成标准。

**Review**（审查代码、架构、方案或变更）：findings first；区分事实、推断和未知项；不自动实施修复，除非用户明确授权。

### 8.2 Core Process 调整

现有八步 Core Process 保留为方法工具箱，前面增加：

```text
Choose the lightest mode that satisfies the user's objective.
Explore mode may answer directly without producing a formal artifact.
Deliver mode may activate project workflow gates.
```

### 8.3 首轮价值契约（Explore 模式 Output Contract）

```text
判断 -> 关键理由 -> 备选方向 -> 可选的一个校准问题
```

禁止：

```text
创建计划 -> 只问问题 -> 等用户回答后才给判断
```

## 9. Superpowers 修改

### 9.1 扩展路由记录

在现有字段之外增加（命名与统一 schema 对齐）：

```yaml
objective: converse | explore | decide | deliver | review
mutation: none | requested | unknown
artifact: none | analysis | decision | spec | plan | implementation
artifact_sink: chat | workspace | external | unknown
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

### 9.2 探索阶段负向选择规则

```text
objective=explore AND mutation=none AND artifact ∈ [none, analysis]
```

满足时：不推断 `brainstorming`、`writing-plans`、`test-driven-development`；不创建 spec 或 implementation plan；可以选择 `technical-deep-dive` 等 Domain Skill；Domain Skill 无正收益时允许 `no_advisory_workflow`；必须先提供实质回答，再决定是否提出一个后续问题。

### 9.3 解耦 `complex` 与 Process Gate

`task_class=complex` 只表示：存在实质歧义、跨模块、所有权不清晰、多阶段集成。它不再自动表示用户要求形成设计、写规格、准备实施，或 brainstorming 应取得控制权。Process Skill 必须同时满足阶段（objective）和自身激活条件。

### 9.4 Brainstorming 发现与激活边界

定位：正式设计流程，而不是所有创意讨论的默认入口。B0 优先修复「错误进入 Skill」，不先重写 Skill 被正确激活后的完整设计方法。

```yaml
activate_when:
  - objective=deliver（实现请求但关键需求或架构不明确）
  - objective=decide 且 artifact ∈ [spec, plan]
  - 用户显式请求 brainstorming

do_not_activate_when:
  - objective ∈ [converse, explore]
  - 只询问可行性、原理、方向或权衡
  - mutation=none 且用户未请求设计产物
```

B0 的最小修改顺序：

1. 先收窄 discovery description 与激活前置条件；
2. 用真实宿主 session 观察是否仍因 `task_class=complex` 被 Router 选中；
3. 只有仍误触发时，才修改 `using-superpowers` 的 complex advisory 选择；
4. 每一步都使用同一组负向与正向 case，不能把两项行为修改混成一个不可归因的 arm。

当前 HARD-GATE 在 B0 中保持不变，但其作用域从「任何可能相关的创意请求」变为「`skill_activation.state ∈ [active, required]` 且 brainstorming 已实际加载」。`suggested` 和 `inactive` 均不得触发 HARD-GATE、创建 spec 或转入 `writing-plans`。

如果修改 `brainstorming/SKILL.md` 的 frontmatter 或正文导致字节变化，就不能继续把该路径声明为精确的 `full_v6_1_1`。实现前必须二选一：仅在 frontier 的 Arbiter 层改变选择，保持 full 不变；或明确建立 `full_vNext` 兼容基线并运行完整正向回归。

第一版不给 brainstorming 增加庞大 explore 模式。若后续实验表明轻量 ideation 有独有收益，再设计无文档、无审批、不得自动升级的独立模式。

### 9.5 可见触发与用户仲裁

激活显示规则：

| 场景 | 激活决策 | 用户体验 |
|---|---|---|
| 用户显式请求 brainstorming | `active + explicit + announce + none` | 简短显示后直接进入 |
| 明确交付且关键设计未定 | `active + inferred + announce + opt_out` | 显示原因与影响，不额外阻塞；用户可退回普通讨论 |
| 是否需要正式设计仍不明确 | `suggested + inferred + confirm + opt_in` | 先给初步价值，再询问是否升级 |
| `converse/explore` 且未请求设计产物 | `inactive` | 不弹前置确认；回答后可提供可选入口 |
| 仓库政策明确要求正式设计 | `required + policy + announce + none` | 显示政策来源；普通 advisory off-ramp 不关闭该政策 |

普通用户默认看到语义化说明，而不是内部 Router 轨迹：

```text
这个请求涉及正式交付，但关键设计仍未确定。
我将先进入设计确认流程，不立即修改文件；如果你想先自由讨论，可以直接告诉我。
```

需要阻塞确认时：

```text
这个问题可能需要升级为正式设计流程。
影响：会先澄清约束、比较方案并确认设计，不立即实施。
你希望现在进入，还是先继续自由讨论？
```

Dogfood/调试模式可以额外显示 Skill id、`reason_code` 和激活来源，但不得展示隐藏推理内容。

HARD-GATE 继续保护真实实施任务，但不能阻止探索性讨论先提供分析价值。第一版不给 brainstorming 增加庞大 explore 模式；如后续实验表明其轻量 ideation 有独有收益，再增加无文档、无审批、不得自动升级的 explore 模式。

## 10. 评测与回归

### 10.1 Benchmark 契约修复（Thinking Skills 仓库）

当前问题：runner 把 `expected_route` 注入被测 Prompt；scorer 不校验路由、依赖字符串包含；case 要求用户可见回答包含 Skill 名称，与「隐藏路由痕迹」原则冲突。增加新 case 前必须先修复。

Case 分为三类：

```yaml
kind: route | response | integration
```

- `route`：只测路由，输出 benchmark 专用 JSON，不生成用户回答。
- `response`：测自然回答，不要求暴露 Skill 名称。
- `integration`：测路由和回答的组合，需要运行时 trace 或适配器支持。

runner 不得在 Prompt 中包含 `expected_profile` 或 `expected_route`。`route` 输出必须包含穷举的 `advisory_components`；缺失列表时不得把「未上报」计成「确认未选择」。该列表仍是模型自报，只能证明声明的路由决策，不能证明宿主实际加载。

`integration` 的自然回答与 trace 必须使用独立输入通道：candidate stdout/response 文件不得携带 trace；只有 evaluator 控制的 host-adapter 通道可提交完整的 `discovered → selected → loaded` 事件流，并校验 domain selected/loaded 集合与 primary/secondary 精确一致、禁止 Skill 跨 role 的 selection/load 以及 advisory 汇总。trace 必须绑定 case id、run nonce、candidate Prompt hash、response hash、adapter id/version 和事件 hash；不得把独立启动的 `--command` 响应与预先存在的 trace 拼接。候选进程默认在不含 benchmark 金标文件的隔离工作目录运行；拥有广泛文件工具时仍需宿主级沙箱或远端 adapter，且实验必须另外绑定实际加载的 Skill bundle。

第一版自动评分只覆盖结构化、计数和明确词法约束；含 `human_rubric` 且自动检查通过的结果必须标记为 `needs_review`，不得计入最终 pass 或跨版本 delta。存在 `not_run` 的 partial coverage 也不得产生分数提升。run 需要记录评测合同版本、case-set/Prompt-set hash、case 顺序、candidate Prompt hash，以及模型、harness、采样配置、Skill bundle 和 adapter 绑定；只有这些实验身份一致的完整 run 才能比较 delta。case 库稳定后再引入独立 judge，且 judge 只能作为辅助 reviewer。

### 10.2 核心负向回归（探索误触发）

```json
{
  "id": "router-technical-exploration-001",
  "kind": "route",
  "turns": [
    {
      "role": "user",
      "content": "Could we add a protocol layer between the LLM and its skills, with a dynamic ratio for each skill?"
    }
  ],
  "expected_profile": {
    "domain": "technical",
    "objective": "explore",
    "mutation": "none",
    "artifact": "analysis",
    "artifact_sink": "chat"
  },
  "expected_route": {
    "primary": "technical-deep-dive",
    "secondary": null
  },
  "expected_activation": {
    "skill": "brainstorming",
    "state": "inactive"
  },
  "must_not_select": [
    "brainstorming",
    "writing-plans",
    "test-driven-development"
  ]
}
```

配套 `response` case 断言：首轮出现直接可行性判断；解释单一比例的语义歧义；提供协议维度或替代方案；不创建计划或 spec；不要求先批准设计；最多在提供价值后追问一个问题（`max_questions: 1`）。若提供「可切换到正式设计流程」入口，必须放在实质回答之后，且不能被记录为 brainstorming 已激活。

评测输入只能使用原始、脱敏的 user/assistant turns。`exploratory`、`did not request implementation` 等评测者总结属于金标语义，不得注入 candidate Prompt。

### 10.3 正向控制（交付门禁保持）

```yaml
id: explicit-design-for-delivery
prompt: >-
  请把这个 Skill 协议设计成可实施方案，在仓库中写正式规格文件，
  获得确认后再准备开发。
expected_profile:
  domain: technical
  objective: decide
  mutation: requested
  artifact: spec
  artifact_sink: workspace
expected_selection:
  advisory_components:
    - brainstorming
expected_activation:
  state: active
  source: inferred
  visibility: announce
  consent: none
```

该用例必须保留正式设计门禁，证明优化没有通过关闭 brainstorming 获得表面成功。另需一组 `objective=deliver, mutation=requested` 的实现请求 case，验证计划、测试和验证门禁仍然生效。所有探索 case 必须配套交付反例，以门禁保持率作为发布条件。

### 10.4 激活与用户仲裁回归

至少覆盖以下最小配对：

| Case | 预期 |
|---|---|
| 「这个协议层是否可行，我们先讨论」 | `inactive`，先回答，不前置询问 |
| 「是否需要写正式规格我还没想好，你先分析」 | `suggested + confirm`，先给初步价值再询问 |
| 「请使用 brainstorming 设计这个协议」 | `active + explicit + announce` |
| 「实现这个协议，但关键架构还没确定」 | `active + inferred + announce + opt_out` |
| `Let's make a react todo list` | brainstorming 仍自动进入正式设计流程 |
| 用户选择「先自由讨论/本次跳过」 | advisory 激活取消，选择被遵守且不会再次追问 |

每个负向 case 必须有同主题、同语言、只改变 objective 或 artifact intent 的正向 case，避免把语言和关键词差异误当作路由能力。

### 10.5 安装组合

同一组 case 至少验证：仅 Superpowers；仅 Thinking Skills；二者组合。B0/B1 只比较可观察的路由、激活和回答差异，不声称已经强制唯一 owner；同一 `exclusive_group` 只有一个 Router owner、且 Thinking Router 不被静默覆盖的运行时证明属于 Phase C 的 integration gate。

### 10.6 指标

路由与画像准确率；Skill 激活误报/漏报率；`announce/confirm` 选择准确率；用户退出是否被遵守；不必要确认次数；首个有用判断前的 token 数和时间；首轮是否提供可独立成立的分析；澄清问题数量；是否误创建计划、规格或文件；技术洞察质量与自然度（人工评审）；正式交付任务的门禁保持率；不同模型、平台和采样下的一致性。不依赖模型自报「使用了多少 Skill」。

### 10.7 试用记录

真实任务日志增加：

```yaml
router_owner: string | null
objective: string
mutation: string
artifact: string
artifact_sink: string
selected_routers: []
skill_activation_state: string
skill_activation_source: string
skill_activation_visibility: string
skill_activation_consent: string
user_overrode_activation: boolean
clarifying_questions_before_first_value: integer
plan_or_spec_created: boolean
```

真实试用证据用于发现问题和生成局部假设，不直接支持 profile 正式晋级。

## 11. 分阶段实施

### 变更集 A0：可信 RED 基线 + 冻结回归

Thinking Skills 侧：修复 benchmark Prompt 泄漏；增加 route/response 两类 case；对 `expected_route` 做结构化评分；加入探索与交付最小配对 case。

Superpowers 侧：把脱敏的原始对话 turns、显式设计正向控制和 `Let's make a react todo list` 加入评测；在当前安装副本上运行 fresh-session baseline，保存实际 Skill invocation trace，而不只保存模型自报路由。

冻结项：仓库 commit 或可恢复的 source snapshot/patch、安装副本哈希、模型与推理配置、宿主版本、candidate Prompt、case 顺序、judge 协议、原始输出和 host-adapter 事件。仅记录 dirty 文件哈希可以检测漂移，但不能恢复旧字节，不算正式冻结。第一个 Skill 行为修改前必须看到当前版本因预期原因失败。

完成标准：被测 Prompt 不含任何预期答案或评测者语义总结；探索 case 稳定复现 brainstorming 误触发；交付正向控制保持通过；自然回答无需展示 Skill 名称；runner 单元测试覆盖上下文注入、路由评分和泄漏防护。

### 变更集 B0：Brainstorming 可见触发与用户仲裁

严格按单变量顺序执行：

1. 收窄 brainstorming discovery/activation contract，加入 §9.5 的激活状态、显示与用户仲裁；暂不改正确激活后的 HARD-GATE 流程。
2. 在相同 case、模型和宿主上运行 before/after；记录实际是否加载 Skill、是否弹出确认、用户退出是否被遵守。
3. 若仍由 `task_class=complex` 触发，再单独修改 `using-superpowers`：`complex` 不再自动等价于 design intent，Process Skill 还必须满足 objective/artifact 前置条件。
4. 若修改了全局 `brainstorming/SKILL.md`，明确选择 `full_vNext` 并更新兼容基线；不得继续声称字节等价 `full_v6_1_1`。

完成标准：探索 case 不加载 brainstorming、不在首个价值前询问；不确定的正式设计意图先给初步价值再 `confirm`；显式与明确交付 case 可见地进入流程；用户 opt-out 被遵守；正向控制和高风险 Policy Floor 不回归。

### 变更集 B1：Task Profile + Domain Skill 模式

- `B1-T`（Thinking Skills）：修改 `thinking-router/SKILL.md` 输出任务画像；修改 `technical-deep-dive/SKILL.md` 增加四模式与首轮价值契约。
- `B1-S`（Superpowers）：扩展路由记录（§9.1），解耦 `complex` 与 Process Gate，消费本地可用的 objective/mutation/artifact 事实。
- 使用旧/新 Thinking Skills × 旧/新 Superpowers 的 2×2 版本矩阵归因，不把两个仓库修改成一个评测 arm。
- 更新 routing、evaluation、architecture 文档与 CHANGELOG。

完成标准：探索 case 输出 `objective=explore, mutation=none` 且首轮先给判断、不自动创建计划；交付 case 仍进入正式工作流；高风险任务始终保持宿主 Policy Floor。Phase C 前只声称 Prompt-level 协作，不声称跨插件 owner 已被强制执行。

### 变更集 C：跨框架仲裁 PoC

- 新增 canonical registry（`protocol/skills.registry.yaml`），含 role、phase、activation、hardness、exclusive_group、preconditions；brainstorming precondition 按 §2.3 裁决。
- 选择一个平台适配器解析 registry，记录实际 Skill 激活 trace。
- 实现 owner 检查与保守 fallback；增加重复 Router、冲突信封和缺失信封测试。
- 运行单独安装与叠加安装的对照实验。

完成标准：元数据改变可观察的 Skill 加载行为，而不只是 Prompt 文本；同一 `exclusive_group` 不产生两个 owner；探索模式下 Process Gate 不误触发；交付模式下必要门禁仍生效。运行时协议只有在至少一个适配器真正解析并执行时才算实现。

### 真实试用（伴随 B0/B1/C）

先运行 5–10 个真实探索性讨论任务。任意高风险漏路由立即回退 `superpowers=full`；连续两次明确质量回归时停止自动 frontier；根据真实失败形成下一条局部假设，不自动扩大实验矩阵。

## 12. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Router 膨胀成新瓶颈 | 只增加 `objective` 和 `mutation`；领域子模式由 Domain Skill 决定 |
| 为单一失败追加规则导致 Skill 僵硬 | 先加 Eval，优先修改模式边界，不为单一措辞硬编码关键词 |
| 字符串命中率被误认为语义质量 | 区分自动断言与人工检查；禁止将 expected 注入被测 Prompt |
| 各适配器分别解释协议字段产生漂移 | 维护 canonical registry 和统一 conformance case；适配器不复制协议定义 |
| 权重或任务模式稀释安全边界 | Policy Floor 不参与权重计算；`hardness=required` 仅由宿主权威边界使用 |
| 修复探索体验却破坏交付可靠性 | 所有探索 case 配套交付反例；门禁保持率作为发布条件 |
| 上游 Router 被利用降低门禁 | Superpowers 独立计算风险等级；owner 只接管意图解释，不接管安全判断 |
| 每次 Skill 匹配都询问造成确认疲劳 | 只有推断出来的重大流程升级使用 `confirm`；显式请求用 `announce`，探索与 inactive 不提示 |
| 显示了激活但实际未加载，或静默加载未显示 | integration eval 同时断言用户可见消息与宿主 invocation trace |

## 13. 事实核实状态

### 13.1 已核实

1. Thinking Skills benchmark runner 会把 `expected_route` 注入 candidate Prompt，scorer 主要依赖字符串包含、字数与问号计数。
2. 当前 benchmark 有 16 个 case，没有以 `technical-deep-dive` 为目标的独立可执行 case。
3. 当前仓库与本机已安装的 `brainstorming/SKILL.md` 哈希一致；frontmatter 仍声明任何 creative work 都必须使用，HARD-GATE 仍写明适用于 EVERY project。
4. 当前仓库与本机已安装的 `using-superpowers/SKILL.md` 哈希一致；本地 trial 为 active frontier，`complex` 规则仍会选择相关 design/planning Skill。
5. 当前本地 trial 没有生成可用于还原本次误触发路径的 invocation 日志，因此不能只凭结果断定由 Router 或宿主直接发现中的哪一层单独触发。

### 13.2 仍待核实

1. Codex/Claude、Cursor/OpenCode 等适配器对协议元数据的真实解析与执行边界。
2. 加入 invocation trace 后，本 Case 在各宿主上的具体触发来源及优先级。
3. 回归 case 中 `effective_profile` 的精确预期，以及本地 fork 是否建立 `full_vNext`。

## 14. 评审决策点

1. 已确认：brainstorming 激活默认可见；显式请求直接 `announce`，推断的重大流程升级使用 `confirm` 或提供 opt-out；探索讨论不弹前置确认。
2. 是否同意 `A0 → B0 → B1 → C` 的严格顺序，以及 B0 内部按单变量依次修改。
3. 是否接受第一版只用离散状态，不实现连续比例。
4. 若 B0 修改全局 brainstorming 文件，选择建立 `full_vNext`，还是增加 profile-specific 绑定以保留精确 v6.1.1。
5. 跨框架协议放在 Thinking Skills 仓库，还是未来拆成独立 Runtime Protocol 项目。

## 15. 推荐决策

批准 `A0 → B0` 的连续小步修复：A0 先取得可信 RED，随后立即处理已发生的 brainstorming 误触发；B0 每次只改变一个激活边界并运行 before/after。B1 与 C 不与 B0 打包，分别等待行为证据和运行时接口决策。本问题继续作为 Superpowers 侧 `brainstorming.universal_design_gate` 的核心负向 case，不扩张为下游 Skill 批量重写。

最终原则：

> Domain 判断「这是什么问题」；Objective 判断「用户现在处于什么阶段」；Artifact 判断「用户要什么产物以及产物落在哪里」；Process Skill 前置条件判断「是否应该升级为交付流程」；Policy Floor 决定「哪些边界无论如何都不能关闭」。
