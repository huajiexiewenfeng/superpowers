# Frontier 本地试用说明

这是一条可随时回退的真实任务试用通道。它不重跑 72 次合成路由，也不把当前模型档案标记为已批准。

## 当前约定

- 默认 profile：`frontier`
- 适用任务：`mechanical`、`bounded`、`complex`
- 高风险任务：始终强制 `effective_profile=full`
- 随时回退：在请求中写 `superpowers=full`
- 首轮样本：10 个真实任务
- 模型范围：`gpt-5.6-sol`
- 允许的 reasoning effort：`high`、`xhigh`、`max`、`ultra`
- 每个任务必须记录实际 reasoning effort；不同等级分别汇总

仓库提交的是配置模板：

```text
docs/superpowers/trial/frontier-trial.config.example.json
```

本地启用文件不会进入 Git：

```text
.superpowers/frontier-trial.config.json
```

只有 `mode=trial`、`status=active` 且未过期的本地配置才生效。缺失、格式错误、停用或过期时，路由器忽略它并回到已批准配置或保守的 `full`。

`runtime_binding.actual_reasoning_effort` 表示本地默认的实际运行等级。任务使用其他允许等级时，应通过 `--reasoning-effort` 覆盖；日志不会把 `xhigh`、`max` 或 `ultra` 合并记为 `high`。如果无法确认实际等级，不应把该任务计入可比较样本。

## 每个真实任务记录什么

只记录路由字段和粗粒度结果，不记录用户请求、代码、仓库路径、文件路径、秘密或其他正文。

任务完成后运行：

```powershell
node scripts/frontier-trial-log.mjs record `
  --task-id dogfood-001 `
  --requested-profile frontier `
  --effective-profile frontier `
  --task-class bounded `
  --outcome selected_advisory_workflow `
  --advisory systematic-debugging `
  --reasoning-effort high `
  --verification passed `
  --result satisfied `
  --process fit `
  --rework no `
  --quality-regression no
```

查看累计摘要：

```powershell
node scripts/frontier-trial-log.mjs summary
```

日志默认写入：

```text
.superpowers/trial/frontier-dogfood-001.jsonl
```

该路径已被 `.gitignore` 排除。

摘要会按下面的组合分层统计：

```text
exact_model_id + reasoning_effort
```

不同推理等级可以共同参与真实试用，但不能被当作同一个运行条件直接比较。正式 R0 的 `gpt-5.6-sol/high` 冻结绑定不受本地 dogfood 配置影响。

## 停止规则

出现任一情况，停止自动 `frontier`，下一任务改用 `superpowers=full`：

1. 任意高风险任务没有得到 `effective_profile=full`；
2. 连续两个任务出现明确质量回归。

日志脚本能检测并报告这些条件，但它不是宿主权限系统，不能把 prompt 路由变成确定性的安全边界。

## 假设—实验循环

真实任务先暴露问题，再投入实验：

1. 从日志和用户反馈定位具体失败，不把问题归因给整个 Skill。
2. 写一个局部假设，例如“无条件 TDD 对这个任务类型没有净收益”。
3. 对同类小样本做一次受控开/关比较。
4. 安全先于质量，质量先于成本；灾难性失败不能被均值抵消。
5. 只保留、收窄或删除被这次证据支持的 component。

这批 dogfood 数据只用于方向判断和生成下一条可检验假设，不作为正式 profile 晋级证据。
