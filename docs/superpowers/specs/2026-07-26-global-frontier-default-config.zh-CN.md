# 用户级全局 Frontier 默认配置方案

> 日期：2026-07-26
>
> 状态：已实施并完成首个 Harness 冒烟；证据见 [Global Owner Default Results](../evals/global-owner-default-results-2026-07-26.md)
>
> 关联计划：[顶级模型工作流优化实施计划](../plans/2026-07-19-frontier-model-workflow-optimization.zh-CN.md)
>
> 触发案例：普通工作目录中的单文件静态 HTML 展示页任务

## 1. 最终范围

本问题只有一个目标：

> 实现真正的用户级全局 Frontier 默认配置，使普通、低风险项目不需要逐项目创建 `.superpowers/frontier-trial.config.json`，也能选择 `frontier`。

以下内容明确不属于本次修复：

- 不修改 PDC；
- 不改变 PDC 与 Superpowers 的路由顺序；
- 不新增 PDC `bounded-delivery`；
- 不改变 `.llm-wiki` 项目的生命周期规则；
- 不修改 `brainstorming`、`writing-plans` 或 TDD 的组件正文；
- 不把用户默认配置解释为能力档案已经正式晋级。

PDC 只在已初始化 `.llm-wiki` 的项目中触发。本次问题发生在普通项目，因此此前提出的 PDC 仲裁分析不适用于这个案例，已从整体计划移除。

## 2. 已确认的设计缺口

当前 `using-superpowers` 的自动配置发现顺序是：

1. 用户显式指定 `superpowers=full|frontier|off`；
2. 自然语言关闭建议工作流；
3. 当前工作仓库内已激活的 `.superpowers/frontier-trial.config.json`；
4. 已批准且仍有效的能力档案默认；
5. 未知时回退 `full`。

当前不存在用户级全局默认配置来源。因此：

- 实验 Fork 内存在 trial 配置时，可以自动使用 Frontier；
- 普通项目没有 trial 配置时，会回退 `full`；
- 用户若希望所有普通项目默认 Frontier，只能在每个项目重复放置 trial 文件，或每次显式输入 `superpowers=frontier`。

这不是随机路由错误，而是配置分层缺少“用户级默认”这一层。

## 3. 配置职责

三类信息必须分开：

| 配置 | 作用域 | 职责 |
|---|---|---|
| 用户级全局配置 | 当前用户的所有普通工作区 | 表达所有者的默认工作流偏好 |
| 项目 trial | 单个项目 | 有期限、可回滚的实验覆盖与试用记录 |
| 能力档案 | 特定模型、推理配置、Harness 和工具链 | 记录正式评估证据 |

用户选择 `default_profile=frontier` 表示默认偏好，不表示该模型配置已经通过正式留出集晋级。项目 trial 继续保留，但不再是普通项目使用 Frontier 的必要条件。

## 4. Canonical 全局配置路径

### 4.1 推荐路径

推荐的跨平台 canonical 位置：

```text
${XDG_CONFIG_HOME}/superpowers/config.json
```

当 `XDG_CONFIG_HOME` 未设置时：

```text
~/.config/superpowers/config.json
```

在当前 Windows 用户环境中，对应：

```text
C:\Users\admin\.config\superpowers\config.json
```

选择该路径的原因：

- 与 Superpowers 已有的 `~/.config/superpowers/hooks/` 用户级约定一致；
- 不绑定 Codex、Claude Code、OpenCode 等单一 Harness；
- 不把全局偏好放进某个项目仓库；
- 不与 `.superpowers/frontier-trial.config.json` 的项目实验职责冲突。

### 4.2 显式路径覆盖

为自动化、便携安装和受限运行环境保留可选环境变量：

```text
SUPERPOWERS_CONFIG
```

若设置，它必须指向一个明确的配置文件，并优先于默认 XDG 路径。它只改变配置文件的发现位置，不改变 profile 决策优先级。

首轮不把 `C:\Users\admin\.agents\config\superpowers.json` 作为 canonical，因为该目录属于特定 Agent 安装布局。Codex 适配器可以读取 canonical 文件，或由安装程序建立受控映射，但不应产生第二份可独立漂移的真源。

实施验证发现，当前 Codex 沙箱会对 canonical `.config` 路径返回 `EPERM`，即使 Windows ACL 允许当前用户完全控制；硬链接也会按同一文件身份被拒绝。为保持 canonical 权威，安装器可以在已安装的 `using-superpowers/.runtime/owner-config.json` 生成只读快照，并用独立 provenance 记录 canonical 路径、生成时间和一致的 canonical/snapshot SHA-256。解析器仅在 canonical 因 `EACCES` 或 `EPERM` 不可读且快照校验通过时使用；canonical 缺失、内容无效或快照被修改时不得使用。修改 canonical 后必须重新生成快照。

### 4.3 最小 Schema

首轮只加入完成目标所需字段：

```json
{
  "schema_version": 1,
  "mode": "owner_default",
  "default_profile": "frontier"
}
```

约束：

- `default_profile` 只能是 `full`、`frontier` 或 `off`；
- 未知字段按 Schema 策略拒绝或明确忽略，行为必须固定；
- 损坏、不可读或 Schema 不匹配的文件不得部分生效；
- 不在此文件硬编码模型 ID 或推理等级；
- 不在此文件声明能力档案已批准；
- 不记录 Prompt、代码、项目路径、秘密或用户内容。

## 5. 配置发现与优先级

保持现有安全和显式控制语义，只增加一个配置层。

### 5.1 建议配置选择

按以下顺序选择 `requested_profile`：

1. 当前请求中的显式 `superpowers=full|frontier|off`；
2. 当前请求中明确关闭建议工作流的自然语言；
3. 当前项目有效且适用于该任务类别的 trial 配置；
4. 有效的用户级全局默认配置；
5. 已批准且仍有效的能力档案默认；
6. 保守回退 `full`。

### 5.2 强制风险下限

上述顺序只选择建议配置。随后仍按既有规则计算 `effective_profile`：

- `high_risk` 始终强制 `effective_profile=full`；
- 主机权限、破坏性操作确认和必需完成证据始终保留；
- `off` 只关闭建议组件，不能关闭安全与验证下限；
- 用户显式配置优先于全局默认，但不能降低强制风险下限。

例如：

| 输入 | requested | effective |
|---|---|---|
| 普通项目、全局 frontier | frontier | frontier |
| 普通项目、显式 full | full | full |
| 普通项目、显式 off | off | off，仍保留强制下限 |
| 高风险任务、全局 frontier | frontier | full |
| 高风险任务、显式 off | off | full |

### 5.3 失败行为

- 项目 trial 缺失、失效、过期或损坏：继续解析全局默认；
- 全局配置缺失：继续解析已批准能力默认，最终才回退 `full`；
- 全局配置损坏或不可读：报告一次清晰诊断，并保守继续后续回退；
- 不允许损坏的项目 trial 直接遮蔽有效的全局默认；
- 不允许模型根据产品名、自我描述或推理等级猜测全局默认。

## 6. 实现边界

后续获批实施时，推荐增加一个无副作用的配置解析器，而不是只在 Prompt 中描述文件路径。

逻辑接口：

```text
discoverGlobalConfig({
  explicitConfigPath,
  xdgConfigHome,
  userHome
})

resolveRequestedProfile({
  explicitDirective,
  naturalLanguageOffRamp,
  projectTrial,
  globalOwnerDefault,
  approvedCapabilityDefault
})

applyMandatoryRiskFloor({
  requestedProfile,
  taskClass,
  mandatoryComponents
})
```

解析器负责：

- 确定 canonical 路径；
- 严格解析和校验 Schema；
- 返回结构化结果与诊断；
- 不写文件；
- 不记录任务内容；
- 不自行修改项目 trial 或能力档案。

各 Harness 的 bootstrap、hook 或原生发现入口必须使用同一解析语义。仅修改源 `SKILL.md` 而未改变真实加载入口，不算修复完成。

## 7. 最小验证方案

目标是用最小证据证明“全局默认跨普通项目生效”，而不是重新运行完整的组件有效性矩阵。

### 7.1 确定性测试

至少覆盖以下 8 个案例：

1. 无项目 trial + 有效全局 `frontier` → `requested_profile=frontier`；
2. 有效项目 trial → 按现有优先级覆盖全局默认；
3. 项目 trial 缺失 → 使用全局默认；
4. 项目 trial 过期、损坏或不适用 → 使用全局默认；
5. 显式 `full|frontier|off` → 覆盖全局默认；
6. 高风险 + 全局 `frontier` → `effective_profile=full`；
7. 全局配置缺失 → 已批准默认或保守 `full`；
8. 全局配置损坏或 Schema 不匹配 → 不部分生效，并产生可诊断回退。

还必须验证：

- `SUPERPOWERS_CONFIG` 只覆盖发现路径；
- XDG 未设置时正确使用 `~/.config/superpowers/config.json`；
- Windows、Linux/macOS 路径夹具得到一致语义；
- 配置中不接受模型 ID 或推理等级作为自动晋级依据。

### 7.2 真实入口冒烟

在首个受支持 Harness 中运行 4 次全新、隔离的 route-only 会话，不执行编码或外部操作：

1. 普通目录、无 `.superpowers`、全局 `frontier`、低风险边界任务 → Frontier；
2. 相同条件，显式 `superpowers=full` → Full；
3. 相同条件，显式 `superpowers=off` → Off advisory；
4. 相同全局配置，高风险任务 → effective Full。

每次记录：

- 实际发现的配置来源；
- requested/effective profile；
- 任务分类；
- advisory 与 mandatory 集合；
- bootstrap/hook/原生发现的真实入口版本。

任一高风险案例未升级到 Full，立即停止。四次冒烟只证明发现和优先级接线正确，不证明 Frontier 组件在质量上已经晋级。

### 7.3 普通项目回归

冻结本次案例为配置回归：

```text
工作目录：普通项目，无 .llm-wiki，无 .superpowers trial
全局配置：default_profile=frontier
任务：低风险、边界清晰的单文件静态 HTML 展示页
预期：requested_profile=frontier
禁止：仅因项目缺少 trial 而回退 full
```

此夹具只断言配置选择，不对页面开发流程或 PDC 行为提出新要求。

## 8. 分阶段执行

### 阶段 A：冻结配置回归

- 保存去标识化的普通项目配置状态；
- 固定当前 `missing project trial → full` 为 RED；
- 记录全部真实配置读取与注入入口。

### 阶段 B：实现全局配置解析

- 冻结 Schema、canonical 路径和环境变量覆盖；
- 实现无副作用 discovery、严格校验和 profile resolver；
- 完成确定性测试；
- 此阶段不创建用户真实配置。

### 阶段 C：接入真实入口

- 让获支持的 bootstrap、hook 和原生发现入口读取同一结果；
- 验证缓存、重复注入和上下文恢复后不会丢失或重复应用；
- 运行 4 次 route-only 冒烟。

### 阶段 D：授权本机试用

- 用户单独批准创建 canonical 全局配置；
- 写入 `default_profile=frontier`；
- 保留显式 `full` 和删除/停用配置的回滚路径；
- 在普通低风险项目中开始真实试用；
- 路由或质量问题进入后续组件实验，不在本 Task 扩大修改范围。

## 9. 对 R0 的影响

本修复改变的是配置来源和默认 profile，不改变任务分类表、PDC 或三个待评估组件的正文。

实施后只重跑受影响的最小 R0 子集：

- 全局默认发现；
- 显式 profile 覆盖；
- 项目 trial 与全局默认优先级；
- 高风险强制 Full；
- 缺失/损坏配置回退。

旧 R0 的其他分类证据可以继续作为历史证据，不需要因为新增一个配置来源而自动重跑完整 72 次矩阵。若实现过程同时改变了分类或 advisory 选择逻辑，则必须重新评估范围并申请额外预算。

## 10. 实施授权与剩余边界

用户随后已明确授权本方案的实现、测试、本机配置写入与本地 Skill 同步；这些动作的验证证据记录在
[Global Owner Default Results](../evals/global-owner-default-results-2026-07-26.md)。

本次授权仍不包括：

- 修改 PDC 仲裁、生命周期或 `bounded-delivery`；
- 修改 `brainstorming`、`writing-plans`、TDD 等下游组件正文；
- 执行真实 Agent 编码任务；
- 仅凭这次配置接线验证就把 Frontier 宣布为正式能力晋级默认。
