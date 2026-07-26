# 全局 Frontier 默认与 PDC 路由优先级修复方案

> 日期：2026-07-26  
> 状态：分析与执行计划，尚未授权修改配置或 Skill  
> 关联计划：[顶级模型工作流优化实施计划](../plans/2026-07-19-frontier-model-workflow-optimization.zh-CN.md)  
> 触发案例：普通工作目录中的单文件静态 HTML 展示页任务

## 1. 结论

本次回归不是单一模型误判，而是两个相互叠加的设计缺口：

1. **配置发现缺口：** 当前自动选择 Frontier 的唯一可执行入口，是工作仓库内的 `.superpowers/frontier-trial.config.json`。普通项目没有该文件时，规则会回退到 `full`。目前没有真正的用户级全局默认配置。
2. **路由所有权倒置：** 全局 `using-superpowers` 在项目生命周期路由之前选择 `brainstorming` 和 `writing-plans`。PDC 虽然规定先判断 lightweight/full，并明确不对每个功能强制完整规格与计划，但它还没有获得优先决定项目工作模式的机会。

此外还有一个次级缺口：

3. **PDC 缺少通用的边界交付路径：** 当前 `project-develop` 虽然允许轻量规格和内联计划，但正式修改用户可见行为时仍要求 Change Brief 和 Flow Record。若目标是让低风险、边界清晰的单文件展示页直接交付，PDC 还需要明确的 `bounded-delivery` 路径。

因此，“把全局默认改成 Frontier”是必要条件，但不是充分条件。完整修复必须同时解决配置分层、Router 顺序和 PDC 边界交付。

## 2. 已核实事实

### 2.1 当前配置发现行为

`skills/using-superpowers/SKILL.md` 与
`skills/using-superpowers/references/frontier-routing.md` 当前按以下顺序选择建议配置：

1. 用户显式指定 `superpowers=full|frontier|off`；
2. 自然语言关闭建议工作流；
3. 当前工作仓库内已激活的 `.superpowers/frontier-trial.config.json`；
4. 已正式批准且仍有效的能力档案默认；
5. 未知时保守回退 `full`。

本机核验结果：

- `D:\ai-discovery\.superpowers\frontier-trial.config.json` 不存在；
- 实验 Fork 内的
  `D:\ai-discovery\superpowers-frontier-model\.superpowers\frontier-trial.config.json`
  存在；
- 当前没有用户级全局 Frontier 配置。

所以，在普通项目缺少 trial 文件时回退 `full`，符合当前实现，却不符合“用户已选择全局 Frontier 默认”的产品预期。

### 2.2 当前 PDC 路由行为

已安装 PDC 根入口声明：

- PDC 是项目生命周期的顶层 Router；
- 应先判断 `lightweight-answer`、机械产物或完整生命周期；
- 应优先选择状态变化最小的路径；
- Superpowers 只能在 PDC 已恢复项目上下文和范围后，作为流程桥接被调用。

`project-develop` 还明确写有：

> 不对每个功能强制完整 brainstorming/spec；默认使用轻量模式，只有复杂任务、用户要求或团队约定时才生成完整规格。

但是，全局 `using-superpowers` 同时规定：

- 在第一次响应或动作前完成全局路由；
- `full` 保留 v6.1.1 的 “1% 可能性就调用”；
- 多个 Skill 同时适用时，流程 Skill 先于实现 Skill。

这使全局 Router 在 PDC 之前选定旧流程。PDC 后续即使被加载，也无法撤销已经生效的规格和计划硬门槛。

## 3. 目标行为

在未显式覆盖、无高风险、无仓库强制策略时，用户级全局配置
`default_profile=frontier` 应跨普通项目生效。

对于项目工作，路由顺序应为：

```text
主机权限与风险下限
        ↓
项目生命周期 / 领域 Router（PDC）
        ↓
PDC 返回工作模式、范围和风险提示
        ↓
Superpowers 选择必要的建议流程组件
        ↓
执行与比例化验证
```

PDC 不是普通的“实现 Skill”，而是项目范围和生命周期的所有者，因此不受“流程 Skill 总是先于实现 Skill”这一通用规则约束。

## 4. 配置分层方案

### 4.1 把稳定默认与实验 trial 分开

不再让 `.superpowers/frontier-trial.config.json` 同时承担“项目试验开关”和“用户默认配置”两种职责：

- **用户级稳定默认：** 表达所有者希望普通项目默认使用的配置；
- **项目级稳定策略：** 表达仓库要求，例如强制 `full`；
- **项目级 trial：** 只用于受控实验、有效期、日志和回滚，不是全局产品配置；
- **能力档案：** 记录评估证据，不等同于用户偏好。

全局 Frontier 可以作为 `owner_default` 或 `dogfood_global` 生效，同时明确“尚未获得正式能力晋级”的证据状态。不能因为它是用户选择，就把它伪装成已通过留出集验证的能力档案。

### 4.2 建议优先级

先计算不可降低的强制风险下限，再解析建议配置：

1. 当前请求显式指定 `superpowers=full|frontier|off`；
2. 主机权限、安全、发布、迁移、破坏性操作和回滚风险下限；
3. 仓库或组织的强制策略，只允许提高工作流强度；
4. 当前项目已激活的 trial，仅作用于其声明的任务类别和有效期；
5. 用户级全局默认；
6. 已批准且仍有效的能力默认；
7. 无有效配置时回退 `full`。

需要特别区分：

- 项目策略可以把全局 `frontier` 提高为 `full`；
- 普通仓库内容不能静默把用户的安全下限降低为 `off`；
- 高风险任务无论默认是什么，都强制得到相应的完整风险保障；
- 缺少项目 trial 不再覆盖或取消有效的用户级默认。

### 4.3 配置发现接口

Task 2A 实施前先冻结跨 Harness 的逻辑接口：

```text
resolveWorkflowProfile({
  explicitDirective,
  mandatoryRiskFloor,
  repositoryPolicy,
  projectTrial,
  globalOwnerDefault,
  approvedCapabilityDefault
})
```

具体物理路径必须由平台适配器确定，不能在核心 Skill 中写死某台机器的绝对路径。建议支持：

1. 运行环境显式注入的配置路径；
2. 平台的用户级 Agent 配置目录；
3. 受支持的跨平台 Superpowers 配置目录；
4. 项目根目录中的稳定策略和 trial 文件。

Codex 本机的候选用户级来源可映射到
`C:\Users\admin\.agents\config\superpowers.json`，但在写入前仍需单独批准，并需要明确其他 Harness 的对应位置。核心配置 Schema 和解析语义保持平台无关。

## 5. PDC 与 Superpowers 的路由仲裁

### 5.1 新的项目路由信封

PDC 应返回结构化或等价的路由信封：

```json
{
  "owner": "project-develop-copilot",
  "mode": "lightweight-answer | bounded-delivery | mechanical-artifact | full-lifecycle",
  "task_class": "mechanical | bounded | complex | high_risk",
  "scope": "已恢复或已声明的项目范围",
  "required_operational_skills": [],
  "recommended_process_skills": [],
  "verification_scope": "targeted | proportional | full"
}
```

Superpowers 在收到信封后选择建议流程：

- `lightweight-answer`：不进入开发生命周期；
- `bounded-delivery`：只选择确有增量价值的流程组件；
- `mechanical-artifact`：执行确定性产物更新；
- `full-lifecycle`：根据复杂度和风险选择设计、计划、TDD、审查与完整验证。

### 5.2 单文件静态 HTML 案例

只有同时满足以下条件，才进入 `bounded-delivery`：

- 用户要求明确，验收标准可直接判断；
- 单文件或隔离产物；
- 不涉及认证、秘密、发布、迁移、破坏性数据或回滚风险；
- 不改变共享接口或跨模块行为；
- 不需要先解决实质性产品/视觉歧义；
- 当前仓库没有更高强度的强制策略。

建议行为：

- 不强制创建独立规格文档；
- 不强制运行 `brainstorming`；
- 不强制创建微步骤 `writing-plans` 文档；
- 在执行前保留简短的内联目标、约束和验收标准；
- 没有可测试行为时不强制形式化 TDD；
- 通过浏览器渲染、静态检查、链接/资源检查和必要的视觉核验提供新鲜完成证据。

如果页面需求包含开放式视觉设计、多人协作接口、复杂交互或范围不清，则升级为 `full-lifecycle` 或先进入紧凑设计。

## 6. 为什么不能只改一处

| 只修改 | 仍然存在的问题 |
|---|---|
| 只增加全局 Frontier 默认 | PDC 仍可能被全局流程 Router 抢先；项目范围和流程所有权没有解决 |
| 只让 PDC 优先 | 普通项目仍因缺少 trial 而得到 `full`，PDC 后续桥接仍可能选择旧重流程 |
| 只修改 `project-develop` 文案 | `using-superpowers` 已经在它之前选择了 brainstorming/writing-plans |
| 只修改 Prompt 顺序 | 不同 Harness 的 bootstrap、hook 或原生发现仍可能继续注入旧入口 |
| 只跳过规格和计划 | 没有比例化验证会把“减流程”错误变成“减可靠性” |

## 7. 测试与验收

### 7.1 配置发现

- 无项目配置 + 全局 `frontier` → `requested_profile=frontier`；
- 项目强制 `full` + 全局 `frontier` → `effective_profile=full`；
- 显式请求配置覆盖默认，但不能降低高风险下限；
- 项目 trial 过期或损坏时，继续使用有效全局默认，而不是直接回退 `full`；
- 全局配置缺失或损坏，且没有其他有效来源 → 保守 `full`；
- 全局 dogfood 默认不得被记录为正式能力批准。

### 7.2 路由所有权

- 普通项目任务先得到 PDC 生命周期判定，再选择 Superpowers 流程组件；
- 非项目任务继续使用标准 Superpowers Router；
- PDC 的 Context Recovery 发生在 brainstorming/writing-plans 之前；
- PDC 的 `bounded-delivery` 不选择不必要的设计和计划组件；
- 模糊、跨模块或高风险项目仍升级到完整流程；
- 仓库强制 `full` 和高风险下限不能被 PDC 降低。

### 7.3 回归案例

冻结本次单文件静态 HTML 请求与实际路由轨迹作为 RED 夹具。至少比较：

1. 当前行为：缺项目 trial → `full` → brainstorming → writing-plans；
2. 修复后：全局 frontier → PDC bounded-delivery → 比例化验证；
3. 同一任务显式 `superpowers=full` → 保留完整兼容路径；
4. 同一任务加入发布或安全风险 → 强制完整风险流程。

Node 测试只证明解析器和策略表一致。至少补一个真实 Harness 的新会话行为测试，确认加载的是真实入口，不是只修改了未生效的 `SKILL.md` 影子。

## 8. 分阶段执行

### 阶段 A：冻结回归

- 保存去标识化的原始任务、工作目录配置状态和实际 Skill 顺序；
- 把“缺少项目 trial 导致回退 full”写成预期失败；
- 记录当前 bootstrap、hook、缓存和原生发现来源。

### 阶段 B：实现全局配置解析

- 冻结平台无关 Schema 和解析优先级；
- 实现纯函数解析器与无副作用 discovery；
- 增加无项目配置的普通工作区夹具；
- 此阶段不自动写入或激活用户全局配置。

### 阶段 C：修正 Router 所有权

- 将项目生命周期 Router 定义为流程选择的前置所有者；
- 增加 PDC 路由信封；
- 修正“process-first”规则，使其不错误地覆盖 lifecycle/domain Router；
- 在所有注入入口运行加载与顺序回归。

### 阶段 D：增加 PDC `bounded-delivery`

- 先定位 PDC canonical source，不直接把已安装目录当唯一真源；
- 定义进入、升级和退出条件；
- 让单文件低风险产物使用内联验收与比例化验证；
- 保留 Change Brief/Flow Record 在复杂、持续性或团队协作工作中的价值。

### 阶段 E：授权全局试用

- 用户单独批准实际全局配置写入；
- 固定 Fork 提交与安装来源；
- 选择 5–10 个跨普通项目的真实任务进行 dogfood；
- 记录错误路由、返工、Token/时间方向和用户主观摩擦；
- 任意高风险漏判立即停止；连续出现两个必要质量回归则回退。

## 9. 对现有 R0 的影响

当前 R0 只冻结了旧配置发现和旧 Router 所有权下的行为。Task 2A 会改变：

- 默认配置来源；
- 项目任务的首个 Router；
- advisory components 的选择顺序；
- 普通项目中 `full` 与 `frontier` 的分布。

因此，Task 2A 完成后必须重新运行与受影响主张对应的最小 R0 子集。旧 R0 结果可以保留为历史基线，但不能证明新配置与新仲裁逻辑安全。

## 10. 需要后续明确的决策

实施前需要冻结但本轮不擅自决定：

1. 用户级配置的跨平台 canonical 路径及各 Harness 映射；
2. 项目稳定策略是否只允许提高强度，还是经用户信任后也允许降低建议强度；
3. PDC canonical source 在哪个仓库维护；
4. `bounded-delivery` 是否允许修改持久项目文件而不创建 Change Brief；
5. 哪个 Harness 作为首个 live E2E 晋级目标。

这些决策不影响当前根因判断，但会影响实现文件和发布方式。
