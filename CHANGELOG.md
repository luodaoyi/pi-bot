# Changelog

All notable changes to pi-agent-bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-beta.4] - 2026-10-11

### Summary / 摘要

**Critical P0 bug fixes for Windows users.** Fixed GUI 404 error when running from arbitrary working directories, robust daemon lifecycle detection with PID/version verification, and added headless `--no-browser` support with comprehensive CI testing across all platforms.

**Windows用户的关键P0漏洞修复。** 修复了从任意工作目录运行时的GUI 404错误，通过PID/版本验证实现了健壮的守护进程生命周期检测，并添加了无头`--no-browser`支持和全平台的综合CI测试。

### Fixed / 修复

- **GUI 404 on Windows:** Replace `@hono/node-server/serveStatic` with custom static file handler that properly handles absolute paths on Windows. Includes mime-type mapping, path traversal protection, and SPA fallback to `index.html`. ([245ab89](https://github.com/luodaoyi/pi-bot/commit/245ab89))
  - 修复Windows上的GUI 404错误：用自定义静态文件处理器替换`@hono/node-server/serveStatic`，正确处理Windows上的绝对路径
- **Daemon detection:** Health endpoint now returns `{ status, version, pid, home, timestamp }` for proper daemon identity verification. `stop` command works even without PID file. ([245ab89](https://github.com/luodaoyi/pi-bot/commit/245ab89))
  - 守护进程检测：健康检查端点现在返回包含版本和PID的完整信息用于身份验证
- Add pre-publish version check to release workflow to prevent publishing mismatched versions ([7f21116](https://github.com/luodaoyi/pi-bot/commit/7f21116))
  - 添加发布前版本检查以防止发布不匹配的版本

### Added / 新增

- `--no-browser` flag for `pi-bot open` command to support headless/CI environments ([245ab89](https://github.com/luodaoyi/pi-bot/commit/245ab89))
  - 为`pi-bot open`命令添加`--no-browser`标志以支持无头/CI环境
- Comprehensive CI test matrix (Ubuntu, macOS, Windows) for global npm install from tarball, daemon startup from different working directories, web UI serving, and CLI commands ([245ab89](https://github.com/luodaoyi/pi-bot/commit/245ab89))
  - 添加全面的CI测试矩阵（Ubuntu、macOS、Windows）测试全局npm安装、守护进程启动和CLI命令
- pnpm installation instructions and Node.js >= 22.19.0 requirement in README ([245ab89](https://github.com/luodaoyi/pi-bot/commit/245ab89))
  - README中添加pnpm安装说明和Node.js >= 22.19.0要求

### Changed / 变更

- Daemon spawns with `cwd` set to `~/.pi-bot` for consistent file resolution ([245ab89](https://github.com/luodaoyi/pi-bot/commit/245ab89))
  - 守护进程使用`~/.pi-bot`作为工作目录以确保文件解析一致性
- `pi-bot status` now shows full daemon info: PID, version, port, home directory, and web URL ([245ab89](https://github.com/luodaoyi/pi-bot/commit/245ab89))
  - `pi-bot status`现在显示完整的守护进程信息：PID、版本、端口、主目录和Web URL
- `open/start` commands verify responding daemon's PID/version matches expectations and warn about foreign daemons ([245ab89](https://github.com/luodaoyi/pi-bot/commit/245ab89))
  - `open/start`命令验证响应守护进程的PID/版本并警告外部守护进程

### Known Issues / 已知问题

- None / 无

## [0.1.0-beta.3] - 2026-10-11

### Summary / 摘要

**Version bump release.** Added npm version verification to release workflow to prevent publishing mismatched versions after beta.2 E403 error.

**版本升级发布。** 在beta.2发布E403错误后，向发布工作流添加了npm版本验证以防止发布不匹配的版本。

### Fixed / 修复

- Add pre-publish check in release workflow to verify package.json version matches tag before publishing ([ae83bee](https://github.com/luodaoyi/pi-bot/commit/ae83bee))
  - 在发布工作流中添加发布前检查，验证package.json版本与标签匹配

### Changed / 变更

- Bump version to 0.1.0-beta.3 ([ae83bee](https://github.com/luodaoyi/pi-bot/commit/ae83bee))
  - 版本升级到0.1.0-beta.3

### Known Issues / 已知问题

- **GUI returns 404 on Windows** when running from arbitrary working directories (fixed in beta.4)
  - 从任意工作目录运行时GUI返回404（已在beta.4中修复）
- **Daemon stop fails** when PID file is missing or stale daemon exists on same port (fixed in beta.4)
  - 当PID文件丢失或同一端口存在过期守护进程时停止失败（已在beta.4中修复）

## [0.1.0-beta.2] - 2026-10-11

### Summary / 摘要

**GUI fix release.** Resolved blank GUI page caused by API contract mismatch between frontend and backend. Also includes `/pi-bot` slash command for Pi extension integration and shared daemon management improvements.

**GUI修复版本。** 解决了前后端API契约不匹配导致的空白GUI页面。还包括Pi扩展集成的`/pi-bot`斜杠命令和共享守护进程管理改进。

### Fixed / 修复

- **Blank GUI page:** Fix API contract mismatch where frontend expected `{bot}` but backend returned `{success, data: {bot}}`. Standardized response format. ([e919de2](https://github.com/luodaoyi/pi-bot/commit/e919de2)) [#6](https://github.com/luodaoyi/pi-bot/pull/6)
  - 修复空白GUI页面：前端期望`{bot}`但后端返回`{success, data: {bot}}`的API契约不匹配
- Increase daemon health check timeout to 30s for slower Windows startup ([08f4441](https://github.com/luodaoyi/pi-bot/commit/08f4441))
  - 将守护进程健康检查超时增加到30秒以适应Windows慢启动
- Ensure `.pi-bot` directory exists before writing PID/port files ([43ca2d6](https://github.com/luodaoyi/pi-bot/commit/43ca2d6))
  - 确保在写入PID/端口文件之前`.pi-bot`目录存在
- Resolve lint errors in daemon manager and CLI ([996bd24](https://github.com/luodaoyi/pi-bot/commit/996bd24))
  - 解决守护进程管理器和CLI中的lint错误

### Added / 新增

- `/pi-bot` slash command for Pi extension: `open`, `status`, `stop` subcommands ([1c1a4de](https://github.com/luodaoyi/pi-bot/commit/1c1a4de))
  - Pi扩展的`/pi-bot`斜杠命令：`open`、`status`、`stop`子命令
- Shared daemon management between CLI and Pi extension (both use same daemon instance at `~/.pi-bot`) ([1c1a4de](https://github.com/luodaoyi/pi-bot/commit/1c1a4de))
  - CLI和Pi扩展之间的共享守护进程管理（两者使用`~/.pi-bot`的同一守护进程实例）

### Known Issues / 已知问题

- **GUI returns 404 on Windows** when running from arbitrary working directories (fixed in beta.4)
  - 从任意工作目录运行时GUI返回404（已在beta.4中修复）
- npm publish E403 error when attempting to republish existing version (resolved by adding version check in beta.3)
  - 尝试重新发布现有版本时出现npm发布E403错误（通过在beta.3中添加版本检查解决）

## [0.1.0-beta.1] - 2026-10-11

### Summary / 摘要

**CI fixes and release workflow improvements.** Resolved npm package naming conflict, fixed OIDC trusted publishing, and addressed multiple Windows compatibility issues in CI tests.

**CI修复和发布工作流改进。** 解决了npm包命名冲突，修复了OIDC可信发布，并解决了CI测试中的多个Windows兼容性问题。

### Fixed / 修复

- Fix release workflow for npm OIDC trusted publishing ([da12990](https://github.com/luodaoyi/pi-bot/commit/da12990))
  - 修复npm OIDC可信发布的发布工作流
- Install npm 11 instead of latest for OIDC support ([1bd2318](https://github.com/luodaoyi/pi-bot/commit/1bd2318))
  - 安装npm 11而不是最新版本以支持OIDC
- Upgrade Node.js to 22.22.2 / 24 LTS for npm 12 compatibility ([6bd61e1](https://github.com/luodaoyi/pi-bot/commit/6bd61e1), [406da4a](https://github.com/luodaoyi/pi-bot/commit/406da4a))
  - 将Node.js升级到22.22.2 / 24 LTS以兼容npm 12
- Fix Windows Node.js compatibility: use cd and relative paths in CI tests ([2e0effb](https://github.com/luodaoyi/pi-bot/commit/2e0effb), [4536450](https://github.com/luodaoyi/pi-bot/commit/4536450), [683d995](https://github.com/luodaoyi/pi-bot/commit/683d995))
  - 修复Windows Node.js兼容性：在CI测试中使用cd和相对路径
- Use dynamic version in CI tarball paths ([09319b4](https://github.com/luodaoyi/pi-bot/commit/09319b4))
  - 在CI tarball路径中使用动态版本
- Simplify Pi install test to verify structure ([62329a8](https://github.com/luodaoyi/pi-bot/commit/62329a8))
  - 简化Pi安装测试以验证结构

### Changed / 变更

- Rename npm package from `pi-bot` to `pi-agent-bot` ([4c14f91](https://github.com/luodaoyi/pi-bot/commit/4c14f91))
  - 将npm包从`pi-bot`重命名为`pi-agent-bot`
- Sync pi manifest version to 0.1.0-beta.1 ([ae4a053](https://github.com/luodaoyi/pi-bot/commit/ae4a053))
  - 同步pi清单版本到0.1.0-beta.1
- Document skipped tests and Vitest node:sqlite limitation ([0b33816](https://github.com/luodaoyi/pi-bot/commit/0b33816))
  - 记录跳过的测试和Vitest node:sqlite限制

## [0.1.0-beta.0] - 2026-10-11

### Summary / 摘要

**Initial beta release.** Multi-bot daemon with Pi SDK integration, Respire memory system, team coordination, scheduler, secrets management, usage tracking, and web GUI for managing AI agents.

**初始beta版本。** 多机器人守护进程，集成Pi SDK、Respire记忆系统、团队协调、调度器、密钥管理、使用跟踪和Web GUI用于管理AI代理。

### Added / 新增

- Core daemon server with HTTP API and SSE support for real-time updates ([844346b](https://github.com/luodaoyi/pi-bot/commit/844346b)) [#1](https://github.com/luodaoyi/pi-bot/pull/1)
  - 核心守护进程服务器，带有HTTP API和SSE支持用于实时更新
- Multi-bot management with role-based configuration and concurrent session handling ([844346b](https://github.com/luodaoyi/pi-bot/commit/844346b)) [#1](https://github.com/luodaoyi/pi-bot/pull/1)
  - 多机器人管理，带有基于角色的配置和并发会话处理
- Respire memory client integration with Pi SDK for persistent agent memory ([844346b](https://github.com/luodaoyi/pi-bot/commit/844346b)) [#1](https://github.com/luodaoyi/pi-bot/pull/1)
  - Respire记忆客户端与Pi SDK集成用于持久代理记忆
- Team coordination system for multi-agent collaboration ([844346b](https://github.com/luodaoyi/pi-bot/commit/844346b)) [#1](https://github.com/luodaoyi/pi-bot/pull/1) [#4](https://github.com/luodaoyi/pi-bot/pull/4)
  - 多代理协作的团队协调系统
- Task scheduler with cron-based job scheduling ([844346b](https://github.com/luodaoyi/pi-bot/commit/844346b)) [#4](https://github.com/luodaoyi/pi-bot/pull/4)
  - 基于cron的任务调度器
- Secrets management for secure credential storage ([844346b](https://github.com/luodaoyi/pi-bot/commit/844346b)) [#4](https://github.com/luodaoyi/pi-bot/pull/4)
  - 安全凭证存储的密钥管理
- Usage tracking with node:sqlite backend ([844346b](https://github.com/luodaoyi/pi-bot/commit/844346b)) [#4](https://github.com/luodaoyi/pi-bot/pull/4)
  - 使用node:sqlite后端的使用跟踪
- React + TypeScript web GUI with Tailwind CSS for managing bots ([844346b](https://github.com/luodaoyi/pi-bot/commit/844346b)) [#1](https://github.com/luodaoyi/pi-bot/pull/1)
  - React + TypeScript Web GUI，带有Tailwind CSS用于管理机器人
- CLI commands: `serve`, `start`, `open`, `status`, `stop`, `init`, `doctor` ([844346b](https://github.com/luodaoyi/pi-bot/commit/844346b)) [#1](https://github.com/luodaoyi/pi-bot/pull/1)
  - CLI命令：`serve`、`start`、`open`、`status`、`stop`、`init`、`doctor`
- Pi package manifest for `pi install npm:pi-agent-bot` support ([a36f040](https://github.com/luodaoyi/pi-bot/commit/a36f040))
  - Pi包清单以支持`pi install npm:pi-agent-bot`
- Comprehensive CI workflow with cross-platform testing (Ubuntu, macOS, Windows) ([844346b](https://github.com/luodaoyi/pi-bot/commit/844346b))
  - 全面的CI工作流，带有跨平台测试（Ubuntu、macOS、Windows）

### Known Issues / 已知问题

- Web static files path incorrect in production build (fixed by multiple commits: [39a07ec](https://github.com/luodaoyi/pi-bot/commit/39a07ec), [7f1a537](https://github.com/luodaoyi/pi-bot/commit/7f1a537), [4d94b98](https://github.com/luodaoyi/pi-bot/commit/4d94b98))
  - 生产构建中的Web静态文件路径不正确（由多个提交修复）
- GUI test case sensitivity issue on Windows ([61992cf](https://github.com/luodaoyi/pi-bot/commit/61992cf))
  - Windows上的GUI测试大小写敏感性问题
- Windows tarball path issues in E2E test ([f5aaa8e](https://github.com/luodaoyi/pi-bot/commit/f5aaa8e))
  - E2E测试中的Windows tarball路径问题
- Database directory must exist before opening SQLite ([0f67dfe](https://github.com/luodaoyi/pi-bot/commit/0f67dfe))
  - 打开SQLite之前必须存在数据库目录

---

[0.1.0-beta.4]: https://github.com/luodaoyi/pi-bot/compare/v0.1.0-beta.3...v0.1.0-beta.4
[0.1.0-beta.3]: https://github.com/luodaoyi/pi-bot/compare/v0.1.0-beta.2...v0.1.0-beta.3
[0.1.0-beta.2]: https://github.com/luodaoyi/pi-bot/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/luodaoyi/pi-bot/compare/844346b...v0.1.0-beta.1
[0.1.0-beta.0]: https://github.com/luodaoyi/pi-bot/releases/tag/v0.1.0-beta.1
