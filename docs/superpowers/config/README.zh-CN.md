# 用户级全局配置

用户级配置让所有普通工作区共享一个默认 Superpowers profile，不需要在每个项目放置 trial 文件。

## Canonical 路径

```text
${XDG_CONFIG_HOME}/superpowers/config.json
```

未设置 `XDG_CONFIG_HOME` 时：

```text
~/.config/superpowers/config.json
```

Windows 默认示例：

```text
C:\Users\用户名\.config\superpowers\config.json
```

`SUPERPOWERS_CONFIG` 可以指向另一个绝对文件路径。它只覆盖发现位置，不改变路由优先级。

某些原生 Skill Loader 的沙箱不能直接读取用户 `.config`。安装器可以在 `using-superpowers/.runtime/owner-config.json` 生成只读快照，并用 `owner-config.provenance.json` 记录 canonical 路径、生成时间以及一致的 canonical/snapshot SHA-256。解析器只在 canonical 文件因 `EACCES` 或 `EPERM` 不可读、且快照仍与 provenance 一致时使用；canonical 缺失、格式错误或 Schema 不兼容时不会使用。canonical 始终是权威来源；修改后必须重新生成安装快照。

## 配置内容

参见 [global-config.example.json](./global-config.example.json)：

```json
{
  "schema_version": 1,
  "mode": "owner_default",
  "default_profile": "frontier"
}
```

`default_profile` 支持 `full`、`frontier` 和 `off`。该配置表达用户偏好，不代表某个模型或推理等级已经通过正式能力评估，因此不接受模型 ID、推理等级或提供方名称。

## 优先级

1. 当前请求显式指定的 `superpowers=full|frontier|off`；
2. 当前请求明确关闭建议工作流；
3. 当前项目有效且适用于任务类别的 trial；
4. 用户级全局默认；
5. 已批准且仍有效的能力默认；
6. 保守回退 `full`。

高风险任务始终得到 `effective_profile=full`。权限、破坏性操作确认和完成证据不会被 `frontier` 或 `off` 关闭。

## 检查解析结果

从 `using-superpowers` Skill 目录执行：

```text
node scripts/resolve-config.mjs --format json --task-class bounded --project-dir <项目目录>
```

只检查 bootstrap 注入内容：

```text
node scripts/resolve-config.mjs --format bootstrap
```

解析器不会写入配置，也不会记录 Prompt、代码、项目路径、秘密或用户内容。损坏或不兼容的配置不会部分生效，而是继续使用已批准默认或保守 `full`。
