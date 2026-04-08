# SVSmate Agent CLI 使用文档

这份文档面向会调用命令行工具的 agent，而不是人工终端用户。

目标很明确：

- 让 agent 以稳定、非交互、可解析的方式调用本工具
- 明确输出协议、退出码、错误码和推荐工作流
- 避免 agent 误用交互模式、误判成功状态、或把密码写入日志

## 基本原则

agent 调用时，优先遵守下面几条：

1. 默认使用 `--output json`
2. 长任务使用 `--output jsonl`
3. 非必要不要依赖交互输入
4. 先判断进程退出码，再解析输出
5. 将 `error.code` 作为分支依据，不要只靠错误文案

## 输出模式

CLI 支持三种输出模式：

- `text`
- `json`
- `jsonl`

对 agent 来说，推荐如下：

- 短命令：`--output json`
- 长命令：`--output jsonl`
- 不推荐：`text`

如果未显式传入 `--output`，且 stdout 不是 TTY，则默认使用 `json`。

## 成功输出格式

`--output json` 时，stdout 始终输出一个 JSON 对象：

```json
{
  "ok": true,
  "action": "courses.list",
  "timestamp": "2026-03-23T03:14:36.735Z",
  "data": {
    "rootDir": "/abs/path/.svsmate-agent",
    "terms": {}
  }
}
```

字段说明：

- `ok`: 是否成功
- `action`: 固定动作名
- `timestamp`: ISO 时间
- `data`: 命令实际结果

## 失败输出格式

`--output json` 时，失败输出固定为：

```json
{
  "ok": false,
  "action": "courses.sync-course",
  "timestamp": "2026-03-23T03:14:42.290Z",
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "学期 26spring 下未找到课程：__not_found__",
    "exitCode": 5,
    "details": {
      "termId": "26spring",
      "courseName": "__not_found__"
    }
  }
}
```

字段说明：

- `error.code`: 稳定错误码，适合 agent 分支处理
- `error.message`: 给人看的说明
- `error.exitCode`: 进程退出码
- `error.details`: 可选上下文

## JSONL 事件流格式

`--output jsonl` 适合长任务，例如课程同步、日历同步。

stdout 每一行都是一个独立 JSON 对象。事件类型固定为：

- `start`
- `progress`
- `result`
- `error`

示例：

```jsonl
{"type":"start","schemaVersion":1,"timestamp":"2026-03-23T03:14:47.930Z","action":"courses.sync-course","meta":{"argv":["--term-id","26spring"]}}
{"type":"progress","schemaVersion":1,"timestamp":"2026-03-23T03:14:48.195Z","action":"courses.sync-course","stage":"fetch_courses","message":"正在拉取课程列表"}
{"type":"progress","schemaVersion":1,"timestamp":"2026-03-23T03:14:48.408Z","action":"courses.sync-course","stage":"fetch_sidebar","message":"正在抓取课程侧边栏","data":{"courseName":"Artificial Intelligence Spring 2026"}}
{"type":"result","schemaVersion":1,"timestamp":"2026-03-23T03:14:49.119Z","ok":true,"action":"courses.sync-course","data":{"termId":"26spring"}}
```

推荐解析方式：

1. 逐行读取 JSON
2. 根据 `type` 分流处理
3. `result` 表示成功结束
4. `error` 表示失败结束

## 退出码约定

- `0`: 成功
- `2`: 命令或参数错误
- `3`: 认证错误
- `4`: 网络、远端服务或响应格式错误
- `5`: 资源不存在
- `6`: 下载失败或本地 IO 错误
- `10`: 未分类内部错误

推荐规则：

- 退出码为 `0` 才视为成功
- 非 `0` 时，即使 stdout 有 JSON，也要按失败处理

## 错误码约定

当前稳定错误码如下：

- `INVALID_COMMAND`
- `INVALID_ARGUMENT`
- `AUTH_CREDENTIALS_MISSING`
- `AUTH_FAILED`
- `NETWORK_ERROR`
- `HTTP_ERROR`
- `RESOURCE_NOT_FOUND`
- `INVALID_RESPONSE`
- `DOWNLOAD_FAILED`
- `IO_ERROR`
- `INTERRUPTED`
- `INTERNAL_ERROR`

推荐分组方式：

- 用户输入问题：`INVALID_COMMAND`、`INVALID_ARGUMENT`
- 认证问题：`AUTH_CREDENTIALS_MISSING`、`AUTH_FAILED`
- 远端问题：`NETWORK_ERROR`、`HTTP_ERROR`、`INVALID_RESPONSE`
- 资源问题：`RESOURCE_NOT_FOUND`
- 本地执行问题：`DOWNLOAD_FAILED`、`IO_ERROR`
- 其他兜底：`INTERRUPTED`、`INTERNAL_ERROR`

## 推荐调用方式

### 认证

推荐优先级：

1. 使用环境变量
2. 或先执行一次 `auth login --save`
3. 后续命令直接复用本地缓存

推荐示例：

```bash
SVSMATE_USERNAME="$USER_NAME" \
SVSMATE_PASSWORD="$PASSWORD" \
node dist/cli.js auth status --output json --root ./.svsmate-agent
```

如果需要保存凭据：

```bash
node dist/cli.js auth login \
  --username "$USER_NAME" \
  --password "$PASSWORD" \
  --save \
  --output json \
  --root ./.svsmate-agent
```

### 拉取课程列表

```bash
node dist/cli.js courses list --output json --root ./.svsmate-agent
```

推荐读取：

- `data.terms`

### 同步单门课程

```bash
node dist/cli.js courses sync-course \
  --term-id 26spring \
  --course-name "Artificial Intelligence Spring 2026" \
  --metadata-only \
  --output jsonl \
  --root ./.svsmate-agent
```

推荐场景：

- 仅拿结构和元数据：加 `--metadata-only`
- 要展示长任务进度：用 `jsonl`

### 同步整学期

```bash
node dist/cli.js courses sync-term 26spring --output jsonl --root ./.svsmate-agent
```

推荐读取：

- `result.data.courseCount`
- `result.data.courses`

### 同步日历

```bash
node dist/cli.js calendar sync --output json --root ./.svsmate-agent
```

推荐读取：

- `data.eventCount`
- `data.events`

### 下载单个文件

```bash
node dist/cli.js materials download \
  --url "https://bb.sustech.edu.cn/..." \
  --target ./downloads/file.pdf \
  --output json \
  --root ./.svsmate-agent
```

注意：

- 这里目标路径参数是 `--target`
- 不要再把 `--output` 当作下载目标文件参数

## 推荐工作流

### 工作流一：首次使用

1. `auth login --save --output json`
2. `courses list --output json`
3. 选择 `termId` 或 `courseUrl`
4. 再调用同步命令

### 工作流二：无状态 agent

1. 通过环境变量提供凭据
2. 所有命令都显式传 `--root`
3. 短命令使用 `json`
4. 长命令使用 `jsonl`

### 工作流三：容错重试

推荐只对以下错误做重试：

- `NETWORK_ERROR`
- `HTTP_ERROR`

不建议自动重试：

- `AUTH_FAILED`
- `INVALID_ARGUMENT`
- `RESOURCE_NOT_FOUND`

## Agent 解析建议

推荐伪代码：

```text
运行命令
读取退出码

如果 output_mode == json:
  解析 stdout 为单个 JSON
  if exit_code == 0 and payload.ok == true:
    返回 payload.data
  else:
    按 payload.error.code 分支

如果 output_mode == jsonl:
  逐行解析 JSON
  缓存最后一个 result 或 error 事件
  实时消费 progress 事件
  进程结束后:
    if exit_code == 0 and last_event.type == "result":
      返回 last_event.data
    else:
      按 last_error.error.code 分支
```

## 安全建议

agent 调用时尽量遵守下面几条：

- 不要把密码写入 shell history
- 不要把密码拼进日志
- 优先使用环境变量传凭据
- 若使用 `--save`，要知道它会把凭据写入本地明文文件

## 数据目录

默认根目录是 `~/.svsmate-agent`，也可以用 `--root` 覆盖。

目录结构：

```text
<root>/
  bb-vault/     # 课程同步结果
  calendar/     # 日历缓存
  config/       # secrets.json
  .cache/       # cookies.json
```

## 兼容性说明

- `--json` 仍保留，等价于 `--output json`
- 协议版本字段目前是 `schemaVersion: 1`
- 若以后协议变更，应以 `schemaVersion` 作为兼容判断入口
