# Research & Design Decisions: report-ux-enhancements

---
**Purpose**: ディスカバリーフェーズで得られた調査結果と設計判断の根拠を記録する。
**Feature**: `report-ux-enhancements`
**Discovery Scope**: Complex Integration (既存システム拡張 + 外部API統合)
---

## Summary

- **Feature**: `report-ux-enhancements`
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  1. Gemini 3 Flash APIは `gemini-3-flash-preview` モデルで利用可能、100万トークン入力対応
  2. GCP Secret Managerは `@google-cloud/secret-manager` パッケージで統合、Cloud Runではサービスアカウントで自動認証
  3. SSEはExpressで `text/event-stream` ヘッダーと `res.write()` で実装可能

---

## Research Log

### Gemini 3 Flash API

- **Context**: 要件3でAI総評をGemini 3 Flashで生成する必要がある
- **Sources Consulted**:
  - [Gemini models | Gemini API](https://ai.google.dev/gemini-api/docs/models)
  - [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
  - [Gemini 3 Flash Blog](https://blog.google/products/gemini/gemini-3-flash/)
- **Findings**:
  - モデル名: `gemini-3-flash-preview` (現在プレビュー版)
  - 入力コンテキスト: 100万トークン
  - 出力上限: 64Kトークン
  - 料金: $0.50/1M入力トークン、$3/1M出力トークン
  - `thinking_level` パラメータで推論レベル制御 (minimal, low, medium, high)
  - Knowledge cutoff: 2025年1月
- **Implications**:
  - 違反情報の要約には十分なコンテキストウィンドウ
  - 日本語対応は確認済み
  - 料金は低コストで運用可能

### GCP Secret Manager + Cloud Run

- **Context**: APIキーをSecret Managerから取得し、Cloud Runで利用する
- **Sources Consulted**:
  - [Configure secrets for Cloud Run](https://cloud.google.com/run/docs/configuring/services/secrets)
  - [Secret Manager Node.js Client](https://cloud.google.com/nodejs/docs/reference/secret-manager/latest)
  - [NPM: @google-cloud/secret-manager](https://www.npmjs.com/package/@google-cloud/secret-manager)
- **Findings**:
  - パッケージ: `@google-cloud/secret-manager`
  - Cloud Runでは**サービスアカウント経由で自動認証**（ADC: Application Default Credentials）
  - サービスアカウントに `roles/secretmanager.secretAccessor` ロール付与が必要
  - シークレット名形式: `projects/{project}/secrets/{name}/versions/latest`
  - ローカル開発時は `GOOGLE_APPLICATION_CREDENTIALS` 環境変数でサービスアカウントJSONを指定
- **Implications**:
  - コード内にAPIキーをハードコードしない設計が可能
  - Cloud Runデプロイ時のIAM設定が必要

### Express SSE実装パターン

- **Context**: 要件4で分析ログをリアルタイムストリーミングする
- **Sources Consulted**:
  - [Understanding SSE with Node.js](https://itsfuad.medium.com/understanding-server-sent-events-sse-with-node-js-3e881c533081)
  - [Real-time Log Streaming with SSE](https://dev.to/manojspace/real-time-log-streaming-with-nodejs-and-react-using-server-sent-events-sse-48pk)
  - [Server-Sent Events with Express - Mastering JS](https://masteringjs.io/tutorials/express/server-sent-events)
  - [better-sse NPM](https://www.npmjs.com/package/better-sse)
- **Findings**:
  - 必須ヘッダー:
    ```javascript
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    ```
  - `res.write(`data: ${message}\n\n`)` で送信（`\n\n` 必須）
  - `res.end()` は使用しない（接続を維持）
  - クライアント側: `EventSource` API使用
  - ライブラリ: `better-sse` が人気（TypeScript対応）
- **Implications**:
  - 既存のExpress構成に追加可能
  - 新規エンドポイント `/api/analyze-stream` の追加が必要
  - CORSヘッダーの追加設定が必要

---

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| **A: 既存エンドポイント拡張** | `/api/analyze` に全機能統合 | シンプル、変更最小 | 分析時間増加、エラーハンドリング複雑 | 要件1,2,3に適用 |
| **B: 新規ストリーミングエンドポイント** | `/api/analyze-stream` を追加 | 既存互換維持、段階的移行可能 | 2つのエンドポイント管理 | 要件4に適用 |
| **C: WebSocket全面移行** | 双方向通信に移行 | 柔軟性高い | 既存構成の大幅変更、Cloud Run対応要確認 | 過剰設計 |

**選択**: **オプションA + B のハイブリッド**
- 要件1,2,3: 既存エンドポイント内で対応
- 要件4: 新規SSEエンドポイントを追加

---

## Design Decisions

### Decision: AI総評生成タイミング

- **Context**: Gemini API呼び出しを分析フロー内で行うか、別途にするか
- **Alternatives Considered**:
  1. 分析完了後に同期呼び出し — シンプルだが分析時間増加
  2. 別エンドポイントで非同期呼び出し — 複雑だがUX向上
  3. SSEでAI総評もストリーム — 最も複雑
- **Selected Approach**: オプション1（分析完了後に同期呼び出し）
- **Rationale**:
  - Gemini 3 Flashは高速（5秒以内目標達成可能）
  - 実装がシンプル
  - フォールバック実装が容易
- **Trade-offs**: 分析全体の応答時間が数秒増加
- **Follow-up**: レスポンス時間が許容範囲か実測で確認

### Decision: CSVエクスポートの実装場所

- **Context**: CSVをフロントエンドで生成するか、バックエンドで生成するか
- **Alternatives Considered**:
  1. フロントエンド生成（Blob + URL.createObjectURL）
  2. バックエンドAPI（`/api/export/csv`）
- **Selected Approach**: オプション1（フロントエンド生成）
- **Rationale**:
  - データ量が限定的（通常数十〜数百件の違反）
  - バックエンド変更不要
  - ネットワーク往復なしで即時ダウンロード
- **Trade-offs**: 大量データ時のブラウザメモリ消費
- **Follow-up**: 1000件以上の違反ケースでのパフォーマンス確認

### Decision: ログストリーミング方式

- **Context**: リアルタイムログ表示にSSE vs WebSocket vs ポーリング
- **Alternatives Considered**:
  1. SSE（Server-Sent Events）
  2. WebSocket
  3. ポーリング（1秒間隔）
- **Selected Approach**: SSE
- **Rationale**:
  - 単方向通信で十分（サーバー → クライアント）
  - HTTP/1.1互換でCloud Runサポート確実
  - 実装がシンプル（既存Express構成に追加）
  - 自動再接続機能あり
- **Trade-offs**: 双方向通信が必要になった場合は再設計
- **Follow-up**: Cloud Runでのタイムアウト設定確認（デフォルト60秒）

### Decision: レポート画面幅の拡張

- **Context**: 現在900pxのmaxWidthを拡張
- **Alternatives Considered**:
  1. 1400pxに拡張
  2. 100%（フルワイド）
  3. Container maxWidth="xl" 使用
- **Selected Approach**: オプション1（1400px）
- **Rationale**:
  - 8カラムテーブルを横スクロールなしで表示可能
  - 4Kディスプレイでも間延びしない
  - 既存デザインとの一貫性維持
- **Trade-offs**: 中間サイズディスプレイでは依然として広め
- **Follow-up**: レスポンシブ対応のブレークポイント調整

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Gemini API呼び出し失敗 | AI総評が表示されない | Medium | ルールベース総評へのフォールバック実装 |
| Secret Manager接続エラー | API認証失敗 | Low | 環境変数でのフォールバック、エラーログ強化 |
| SSE接続タイムアウト（Cloud Run） | ログ途切れ | Medium | Cloud Runタイムアウト延長、再接続ロジック |
| CSVダウンロードのメモリ不足 | ブラウザクラッシュ | Low | データ量警告表示、分割ダウンロード検討 |

---

## References

- [Gemini 3 Flash - Google AI](https://ai.google.dev/gemini-api/docs/gemini-3) — Gemini 3 Flash APIドキュメント
- [GCP Secret Manager Node.js](https://cloud.google.com/nodejs/docs/reference/secret-manager/latest) — Secret Managerクライアントライブラリ
- [Cloud Run Secrets Configuration](https://cloud.google.com/run/docs/configuring/services/secrets) — Cloud RunでのSecret Manager統合
- [Express SSE Tutorial](https://masteringjs.io/tutorials/express/server-sent-events) — ExpressでのSSE実装ガイド
- [better-sse](https://www.npmjs.com/package/better-sse) — TypeScript対応SSEライブラリ

---

_Generated at: 2025-12-20T10:45:00+09:00_
