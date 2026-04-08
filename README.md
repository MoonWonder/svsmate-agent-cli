# SVSmate Agent CLI

这是一个基于 [SVSmate](https://github.com/naivecynics/SVSmate) 核心能力改造的命令行工具。

如果你是通过脚本或 agent 调用，优先看 [docs/agent-usage.md](./docs/agent-usage.md)。

目标不是复刻 VS Code 插件界面，而是把它背后的几项能力抽出来，供终端脚本和 agent 直接调用：

- CAS 登录并复用 Blackboard 会话
- 拉取课程列表
- 同步整学期或单门课程的页面与附件
- 下载指定 Blackboard 文件
- 同步和缓存 Blackboard 日历

## 安装与构建

```bash
npm install
npm run build
```

构建后可直接执行：

```bash
node dist/cli.js help
```

发布到 npm 后可全局安装：

```bash
npm install -g svsmate-agent-cli
svsmate-agent help
```

## 常用命令

先登录并保存凭据：

```bash
node dist/cli.js auth login --username <用户名> --password <密码> --save --output json
```

查看课程列表：

```bash
node dist/cli.js courses list --output json
```

同步一个学期：

```bash
node dist/cli.js courses sync-term 25spring --output json
```

只抓取元数据，不下载附件：

```bash
node dist/cli.js courses sync-course --course-url "<课程 URL>" --metadata-only --output json
```

同步日历：

```bash
node dist/cli.js calendar sync --output json
```

下载单个 Blackboard 文件：

```bash
node dist/cli.js materials download --url "<文件 URL>" --target ./target.pdf --output json
```

## 运行约定

- 默认根目录是 `~/.svsmate-agent`
- 可通过 `--root <dir>` 覆盖根目录
- `--output` 支持 `text`、`json`、`jsonl`
- stdout 在非 TTY 环境下默认输出 `json`
- 凭据优先级为：命令行参数 > 环境变量 > 本地缓存 > 交互输入

## Agent 接口

### 单对象模式

`--output json` 会输出稳定包络：

```json
{
  "ok": true,
  "action": "auth.status",
  "timestamp": "2026-03-23T03:14:36.735Z",
  "data": {
    "loggedIn": true
  }
}
```

失败时：

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

### 事件流模式

`--output jsonl` 适合 agent 消费长任务进度。每行都是独立 JSON：

```jsonl
{"type":"start","schemaVersion":1,"timestamp":"2026-03-23T03:14:47.930Z","action":"courses.sync-course","meta":{"argv":["--term-id","26spring"]}}
{"type":"progress","schemaVersion":1,"timestamp":"2026-03-23T03:14:48.195Z","action":"courses.sync-course","stage":"fetch_courses","message":"正在拉取课程列表"}
{"type":"result","schemaVersion":1,"timestamp":"2026-03-23T03:14:49.119Z","ok":true,"action":"courses.sync-course","data":{"termId":"26spring"}}
```

事件类型固定为：

- `start`
- `progress`
- `result`
- `error`

### 退出码

- `0` 成功
- `2` 命令或参数错误
- `3` 认证错误
- `4` 网络、远端服务或响应格式错误
- `5` 资源不存在
- `6` 下载或本地 IO 错误
- `10` 未分类内部错误

### 错误码分类

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

## 数据目录

默认目录结构如下：

```text
~/.svsmate-agent/
  bb-vault/        # 课程同步结果
  calendar/        # 日历缓存
  config/          # 凭据与订阅地址
  .cache/          # Blackboard cookies
```

## 安全说明

为了方便自动化，`auth login --save` 会将凭据写入本地 `config/secrets.json`。这是明文文件存储，不等价于系统钥匙串，适合本机受控环境，不适合高敏感场景。

## 致谢

本项目的能力抽取与命令行封装工作，建立在原项目 [SVSmate](https://github.com/naivecynics/SVSmate) 的设计与实现基础之上。

感谢原作者与贡献者对南科大 Blackboard 使用体验改进所做的工作。
