# Aether — Copilot Remote Control

<p align="center">
  <img src="https://img.shields.io/badge/self--hosted-yes-blue" alt="self-hosted" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node >= 18" />
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="MIT" />
</p>

> **[日本語版は下にあります / Japanese version below](#aether--copilot-リモートコントロール)**

Self-hosted web app to remotely control GitHub Copilot CLI from browser & Android.

```
┌─────────────────┐                   ┌───────────────┐     ACP/stdio     ┌──────────────┐
│  Browser         │   Socket.IO      │               │ ◄───────────────► │              │
│  Android App     │ ◄──────────────► │  Aether       │                   │  Copilot CLI │
│  (multi-client)  │                  │  (start.js)   │                   │  (--acp)     │
└─────────────────┘                   └───────────────┘                   └──────────────┘
```

## Getting Started

### Prerequisites

- **Node.js 18+**
- **GitHub Copilot CLI** installed (`copilot --version` to verify)

### Option 1: Direct

```bash
git clone https://github.com/ganondorofu/aether-copilot-remote.git
cd aether-copilot-remote
npm install
node start.js
```

→ Open `http://localhost:8787` → Create account on first visit

### Option 2: systemd Service

```bash
# Copy service file and enable
loginctl enable-linger $USER
mkdir -p ~/.config/systemd/user
cp aether.service ~/.config/systemd/user/
systemctl --user enable --now aether
```

### Android App

Download the APK from [Releases](../../releases) → Install → Enter server URL → Log in

## Features

| Feature | Web | Android |
|---------|-----|---------|
| Prompt & Chat | ✅ | ✅ |
| Model selection (16+ models) | ✅ | ✅ |
| Mode switching (Agent/Edit/Plan) | ✅ | ✅ |
| Permission management | ✅ | ✅ |
| Slash commands | ✅ | ✅ |
| Tool call display (collapsible) | ✅ | ✅ |
| Thinking process (collapsible) | ✅ | ✅ |
| Markdown rendering | ✅ | ✅ |
| Multi-session management | ✅ | ✅ |
| YOLO levels (auto-approve) | ✅ | ✅ |
| Usage / quota display | ✅ | ✅ |
| Dark / Light theme | ✅ | ✅ |
| Multi-client sync | ✅ | ✅ |
| Chat history (disk-backed) | ✅ | ✅ |
| English / Japanese i18n | ✅ | ✅ |
| Per-session model & YOLO | ✅ | ✅ |
| Biometric app lock | — | ✅ |
| Self-update from releases | — | ✅ |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | Server port |
| `COPILOT_PATH` | `copilot` | Path to Copilot CLI binary |
| `COPILOT_CWD` | `$HOME` | Default working directory |
| `COPILOT_ARGS` | | Extra CLI arguments |
| `WORKSPACE_IDLE_TIMEOUT_MS` | `1800000` | Idle timeout (30 min) |

## Security

- Username/password authentication (scrypt hash)
- JWT token-based session management
- Credentials stored locally in `data/`
- **Always use a reverse proxy (nginx etc.) + HTTPS when exposing to the internet**

## Build Android APK

```bash
cd android
JAVA_HOME=/path/to/jdk17 ANDROID_HOME=/path/to/sdk ./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

## Tech Stack

- **Server**: Node.js + Express + Socket.IO v4 + [ACP SDK](https://github.com/nickarora/acp-sdk)
- **Web**: Vanilla JS + marked.js + highlight.js + DOMPurify
- **Android**: Kotlin + Jetpack Compose + Material 3 + Markwon
- **Auth**: scrypt + JWT (no external DB)

## License

MIT

---

# Aether — Copilot リモートコントロール

GitHub Copilot CLI をブラウザ・Androidアプリからリモート操作できるセルフホスト型Webアプリケーション。

```
┌─────────────────┐                   ┌───────────────┐     ACP/stdio     ┌──────────────┐
│  ブラウザ         │   Socket.IO      │               │ ◄───────────────► │              │
│  Androidアプリ    │ ◄──────────────► │  Aether       │                   │  Copilot CLI │
│  (マルチクライアント) │                │  (start.js)   │                   │  (--acp)     │
└─────────────────┘                   └───────────────┘                   └──────────────┘
```

## はじめに

### 前提条件

- **Node.js 18+**
- **GitHub Copilot CLI** がインストール済み（`copilot --version` で確認）

### 方法 1: 直接実行

```bash
git clone https://github.com/ganondorofu/aether-copilot-remote.git
cd aether-copilot-remote
npm install
node start.js
```

→ `http://localhost:8787` にアクセス → 初回はアカウント作成

### 方法 2: systemd サービス

```bash
# サービスファイルをコピーして有効化
loginctl enable-linger $USER
mkdir -p ~/.config/systemd/user
cp aether.service ~/.config/systemd/user/
systemctl --user enable --now aether
```

### Android アプリ

[Releases](../../releases) から APK をダウンロード → インストール → サーバーURL入力 → ログイン

## 機能一覧

| 機能 | Web | Android |
|------|-----|---------|
| プロンプト＆チャット | ✅ | ✅ |
| モデル選択（16+ モデル対応） | ✅ | ✅ |
| モード切替（Agent/Edit/Plan） | ✅ | ✅ |
| 権限管理（許可/拒否） | ✅ | ✅ |
| スラッシュコマンド | ✅ | ✅ |
| ツール呼び出し表示（折りたたみ） | ✅ | ✅ |
| 思考プロセス表示（折りたたみ） | ✅ | ✅ |
| Markdown レンダリング | ✅ | ✅ |
| マルチセッション管理 | ✅ | ✅ |
| YOLO レベル（自動承認） | ✅ | ✅ |
| 使用量 / クオータ表示 | ✅ | ✅ |
| ダーク / ライトテーマ | ✅ | ✅ |
| マルチクライアント同期 | ✅ | ✅ |
| チャット履歴（ディスク保存） | ✅ | ✅ |
| 英語 / 日本語 i18n | ✅ | ✅ |
| セッション別モデル＆YOLO | ✅ | ✅ |
| 生体認証アプリロック | — | ✅ |
| リリースからの自動更新 | — | ✅ |

## 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `PORT` | `8787` | サーバーポート |
| `COPILOT_PATH` | `copilot` | Copilot CLI のパス |
| `COPILOT_CWD` | `$HOME` | デフォルト作業ディレクトリ |
| `COPILOT_ARGS` | | 追加CLIオプション |
| `WORKSPACE_IDLE_TIMEOUT_MS` | `1800000` | アイドルタイムアウト（30分） |

## セキュリティ

- ユーザー名/パスワード認証（scryptハッシュ）
- JWTトークンベースのセッション管理
- 認証情報は `data/` ディレクトリにローカル保存
- **インターネット公開時は必ずリバースプロキシ（nginx等）+ HTTPS を使用してください**

## Android APK ビルド

```bash
cd android
JAVA_HOME=/path/to/jdk17 ANDROID_HOME=/path/to/sdk ./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

## 技術スタック

- **サーバー**: Node.js + Express + Socket.IO v4 + [ACP SDK](https://github.com/nickarora/acp-sdk)
- **Web**: Vanilla JS + marked.js + highlight.js + DOMPurify
- **Android**: Kotlin + Jetpack Compose + Material 3 + Markwon
- **認証**: scrypt + JWT（外部DB不要）

## ライセンス

MIT
