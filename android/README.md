# Copilot Remote UI - Android版

GitHub Copilot CLIをAndroid端末から操作するためのMaterial Design 3アプリ。

### ✅ 'EOFREADME'


### UI基盤
- **Markdownレンダリング** - Markwonライブラリによるリッチテキスト表示
- **ナビゲーションドロワー** - セッション管理・切替UI
- **Material Design 3** - モダンなUI/UXデザイン

### セッション管理
- セッション一覧表示
- セッション切替機能
- 新規セッション作成UI（TODO実装マーク付き）
- セッション削除UI（TODO実装マーク付き）
- CWD（作業ディレクトリ）表示

### チャット機能
- ユーザーメッセージ送信
- エージェント応答表示（Markdown対応）
- 思考プロセス表示（折りたたみ可能）
- ツールコール詳細表示
- プラン表示
- パーミッション対応（承認/拒否/フィードバック）

### モデル・モード管理
BottomSheet）
- モード切替（タブUI）
- YOLOレベル選択（4段階：Normal/Trust reads/Trust most/YOLO）
- スラッシュコマンドパレット

### 設定・UI

- テーマ切替（ダーク/ライト）
- 設定パネル（ConfigOptions表示・編集）
- ファイル添付ボタン（TODO実装マーク付き）

## 🏗️ アーキテクチャ

### 技術スタック
- **言語**: Kotlin
- **UI**: Jetpack Compose
- **デザイン**: Material Design 3
- **通信**: Socket.IO Client
- **データ**: Kotlinx Serialization
- **Markdown**: Markwon
- **設定**: DataStore Preferences

### プロジェクト構造
```
app/src/main/java/com/copilot/remote/
 ui/
   ├── MainActivity.kt           - エントリーポイント・テーマ管理
   ├── CopilotScreen.kt          - メイン画面（700+行）
   ├── components/
   │   └── MarkdownText.kt       - Markdownレンダリング
   └── theme/
       └── Theme.kt              - Material Design 3テーマ
 viewmodel/
   └── CopilotViewModel.kt       - 状態管理・ビジネスロジック
 model/
   └── Models.kt                 - データモデル定義
 network/
   └── CopilotWebSocket.kt       - Socket.IO通信
 data/
    └── PreferencesRepository.kt  - 設定永続化
```

## 🔌 プロトコル

ExitCopilot CLI Daemonと通信：

```
Android App <--Socket.IO--> Relay Server <--Socket.IO--> Daemon <--ACP--> Copilot CLI
```

- **認証**: トークンベース
- **暗号化**: E2Eサポート（NaCl）
- **メッセージ**: SessionEnvelope形式

## 🛠️ ビルド方法

### 前提条件
- JDK 17以上
- Android Studio Koala (2024.1.1) 以上
- Gradle 8.9以上
- Android SDK 26-35

### ビルドコマンド
```bash
cd android
./gradlew assembleDebug  # デバッグAPK
./gradlew assembleRelease  # リリースAPK（要署名設定）
```

### 依存関係
- Compose BOM 2024.12.01
- Markwon 4.6.2
- Socket.IO Client 2.1.1
- DataStore Preferences 1.1.1
- Kotlinx Serialization 1.7.3

## 📱 使い方

1. **リレーサーバー起動**
   ```bash
   cd copilot-remote-ui
   npm start
   ```

2. **デーモン起動**
   ```bash
   npm run daemon -- <DAEMON_TOKEN>
   ```

3. **Androidアプリ起動**
   - APKをインストール
   - リレーサーバーURLとClient Tokenを入力
   - セッション選択して接続

## 🎨 Web版との機能比較

| 機能 | Web | Android |
|-----|-----|---------|
| Markdown表示 | ✅ | ✅ |
| セッション管理 | ✅ | ✅ |
| モデル選択 | ✅ | ✅ |
| YOLO選択 | ✅ | ✅ |
| 使用量表示 | ✅ | ✅ |
| テーマ切替 | ✅ | ✅ |
| 設定パネル | ✅ | ✅ |
| ファイル添付 | ✅ | ⏳ (UI準備済み) |
| CWD表示 | ✅ | ✅ |

## 📝 TODO

'EOFREADME'UI準備済みだが実装が必要：

1. **セッション作成・削除**
   - `CopilotViewModel.createNewSession()` の実装
   - `CopilotViewModel.deleteSession()` の実装

2. **ファイル添付**
   - Activity Result APIで画像選択
   - Base64エンコード
   - プロンプトに添付

3. **ディレクトリブラウザ**
   - リレー経由でディレクトリ一覧取得
   - ファイル・フォUI

## 🤝 参考実装

- **Web版**: `public/app.js` (770行)
- **Happy Coder**: `happy-app` パッケージ

## 📄 ライセンス

ISC
