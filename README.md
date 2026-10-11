# pi-bot

[English](#english) | [中文](#中文)

---

## English

**pi-bot** is an open-source Pi Package that brings multi-bot team capabilities to the [pi coding agent](https://github.com/earendil-works/pi), powered by the [Respire memory system](https://github.com/risense-ai/respire-cli).

### Features

- 🤖 **Multi-Bot Teams**: Create and manage multiple AI bots with different roles and personalities
- 🧠 **Respire Memory**: Unified memory system with semantic recall and structured storage
- 💬 **Bot Communication**: Bots can message each other and collaborate on tasks
- 👥 **Group Chat**: Multi-bot conversations with turn-taking and @mentions
- ⏰ **Scheduled Tasks**: Cron-style task scheduling for automated workflows
- 🔐 **Secrets Management**: Secure storage and environment injection of API keys
- 📊 **Usage Statistics**: Track token usage and costs per bot and model
- 🌐 **Web UI**: HTTP + SSE API for building custom interfaces

### Architecture

pi-bot is built as a pure TypeScript system with three main components:

1. **pi-respire**: A pi extension that integrates Respire memory
   - Session startup rule injection
   - Recall enforcement (first tool call must be recall)
   - Memory tools (recall, remember, show, etc.)

2. **pi-bot daemon**: Multi-session host using pi SDK
   - Bot roster and lifecycle management
   - Inter-bot messaging and group chat
   - Scheduler, secrets, usage tracking
   - HTTP/SSE API server

3. **respire-client**: TypeScript client for Respire Runtime RPC

### Installation

```bash
# Install the pi-bot daemon globally
npm install -g pi-bot

# Or install just the Respire extension for pi
pi install npm:pi-respire
```

### Quick Start

```bash
# Initialize and start the daemon
pi-bot init
pi-bot serve

# The Web UI will be available at http://localhost:8787
```

### Requirements

- Node.js ≥ 22.19
- Respire CLI (`rsrs`) installed and runtime running (optional but recommended)
- pi coding agent ≥ 1.1.0

### Development

```bash
# Clone the repository
git clone https://github.com/luodaoyi/pi-bot.git
cd pi-bot

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### License

Apache-2.0 - see [LICENSE](./LICENSE) for details.

Portions of this project are inspired by [DeepSeek-Bot](https://github.com/FeiZhuLulu/DeepSeek-Bot).

---

## 中文

**pi-bot** 是一个开源的 Pi Package，为 [pi coding agent](https://github.com/earendil-works/pi) 带来多机器人团队协作能力，由 [Respire 记忆系统](https://github.com/risense-ai/respire-cli)驱动。

### 功能特性

- 🤖 **多机器人团队**：创建和管理具有不同角色和个性的多个 AI 机器人
- 🧠 **Respire 记忆**：统一的记忆系统，支持语义召回和结构化存储
- 💬 **机器人通信**：机器人之间可以相互发送消息并协作完成任务
- 👥 **群聊**：多机器人对话，支持轮流发言和 @ 提及
- ⏰ **定时任务**：Cron 风格的任务调度，实现自动化工作流
- 🔐 **密钥管理**：API 密钥的安全存储和环境变量注入
- 📊 **用量统计**：按机器人和模型追踪 token 使用量和成本
- 🌐 **Web 界面**：HTTP + SSE API，可构建自定义界面

### 架构

pi-bot 采用纯 TypeScript 构建，包含三个主要组件：

1. **pi-respire**：集成 Respire 记忆的 pi 扩展
   - 会话启动时注入规则
   - 强制执行 recall（首个工具调用必须是 recall）
   - 记忆工具（recall、remember、show 等）

2. **pi-bot daemon**：使用 pi SDK 的多会话宿主
   - 机器人名册和生命周期管理
   - 机器人间消息传递和群聊
   - 调度器、密钥、用量追踪
   - HTTP/SSE API 服务器

3. **respire-client**：Respire Runtime RPC 的 TypeScript 客户端

### 安装

```bash
# 全局安装 pi-bot daemon
npm install -g pi-bot

# 或仅安装 Respire 扩展到 pi
pi install npm:pi-respire
```

### 快速开始

```bash
# 初始化并启动 daemon
pi-bot init
pi-bot serve

# Web 界面将在 http://localhost:8787 可用
```

### 系统要求

- Node.js ≥ 22.19
- Respire CLI (`rsrs`) 已安装且 runtime 正在运行（可选但推荐）
- pi coding agent ≥ 1.1.0

### 开发

```bash
# 克隆仓库
git clone https://github.com/luodaoyi/pi-bot.git
cd pi-bot

# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test
```

### 许可证

Apache-2.0 - 详见 [LICENSE](./LICENSE)。

本项目的部分设计受到 [DeepSeek-Bot](https://github.com/FeiZhuLulu/DeepSeek-Bot) 的启发。
