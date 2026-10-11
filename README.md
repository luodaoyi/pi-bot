# pi-bot

[English](#english) | [中文](#中文)

---

## English

An open-source port of [DeepSeek-Bot](https://github.com/FeiZhuLulu/DeepSeek-Bot) to the [pi coding agent](https://github.com/earendil-works/pi) ecosystem, with integrated [Respire](https://github.com/risense-ai/respire-cli) memory system.

### Features

- **Multi-Bot Teams**: Create and manage multiple AI agents with different roles
- **Memory System**: Integration with Respire for semantic long-term memory
- **Group Chat**: Coordinate multiple bots in group conversations
- **Scheduled Tasks**: Run tasks on schedules (cron, daily, weekly)
- **Secrets Management**: Secure storage and injection of API keys
- **Usage Tracking**: Monitor token usage and costs per bot
- **Web UI**: Manage bots, conversations, and settings through a web interface

### Installation

#### As a Pi Package (Recommended)

```bash
# Install pi-respire extension for memory features
pi install npm:pi-respire

# Install pi-bot
npm install -g pi-bot

# Initialize and start
pi-bot init
pi-bot serve
```

#### From Source

```bash
git clone https://github.com/luodaoyi/pi-bot.git
cd pi-bot
pnpm install
pnpm build
pnpm start
```

### Quick Start

1. **Configure Memory Backend** (Optional)
   ```bash
   # Install Respire CLI if not already installed
   npm install -g rsrs-cli
   
   # Respire will start automatically on first use
   ```

2. **Start the Daemon**
   ```bash
   pi-bot serve
   ```

3. **Access Web UI**
   Open http://localhost:8787 in your browser

4. **Create Your First Bot**
   - Navigate to the Bots page
   - Click "Create Bot"
   - Configure name, role, and model
   - Start chatting!

### Architecture

pi-bot consists of several packages:

- **`pi-bot`**: Main daemon with HTTP API server
- **`pi-respire`**: Pi extension for Respire memory integration
- **`respire-client`**: TypeScript client for Respire Runtime
- **`shared`**: Shared TypeScript types

### Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

### License

Apache License 2.0 - See [LICENSE](./LICENSE) and [NOTICE](./NOTICE) for details.

---

## 中文

将 [DeepSeek-Bot](https://github.com/FeiZhuLulu/DeepSeek-Bot) 移植到 [pi 编码代理](https://github.com/earendil-works/pi) 生态系统的开源项目，集成了 [Respire](https://github.com/risense-ai/respire-cli) 记忆系统。

### 特性

- **多Bot团队**：创建和管理具有不同角色的多个AI代理
- **记忆系统**：集成Respire实现语义化长期记忆
- **群聊功能**：在群组对话中协调多个bot
- **定时任务**：按计划运行任务（cron、每日、每周）
- **密钥管理**：安全存储和注入API密钥
- **用量追踪**：监控每个bot的token使用和成本
- **Web界面**：通过网页界面管理bot、对话和设置

### 安装

#### 作为Pi包安装（推荐）

```bash
# 安装pi-respire扩展以使用记忆功能
pi install npm:pi-respire

# 安装pi-bot
npm install -g pi-bot

# 初始化并启动
pi-bot init
pi-bot serve
```

#### 从源码安装

```bash
git clone https://github.com/luodaoyi/pi-bot.git
cd pi-bot
pnpm install
pnpm build
pnpm start
```

### 快速开始

1. **配置记忆后端**（可选）
   ```bash
   # 如果尚未安装，请安装Respire CLI
   npm install -g rsrs-cli
   
   # Respire会在首次使用时自动启动
   ```

2. **启动守护进程**
   ```bash
   pi-bot serve
   ```

3. **访问Web界面**
   在浏览器中打开 http://localhost:8787

4. **创建第一个Bot**
   - 导航到Bots页面
   - 点击"创建Bot"
   - 配置名称、角色和模型
   - 开始对话！

### 架构

pi-bot由多个包组成：

- **`pi-bot`**：主守护进程和HTTP API服务器
- **`pi-respire`**：用于Respire记忆集成的Pi扩展
- **`respire-client`**：Respire Runtime的TypeScript客户端
- **`shared`**：共享的TypeScript类型

### 开发

请参阅 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解开发设置和指南。

### 许可证

Apache License 2.0 - 详见 [LICENSE](./LICENSE) 和 [NOTICE](./NOTICE)。
