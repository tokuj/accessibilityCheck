# Research & Design Decisions: frontend-gcr-integration

---
**Purpose**: フロントエンドとGCRバックエンドの統合に関する調査結果と設計決定の記録

---

## Summary
- **Feature**: `frontend-gcr-integration`
- **Discovery Scope**: Extension（既存システムの拡張）
- **Key Findings**:
  - `VITE_API_URL`環境変数パターンは既に実装済み
  - CORS設定（`ALLOWED_ORIGINS`）はバックエンド側で環境変数対応済み
  - `AbortSignal.timeout()`による fetch タイムアウト実装が推奨される

## Research Log

### Vite 環境変数の動作確認
- **Context**: 本番ビルドで`.env.production`の環境変数が正しく埋め込まれるか確認
- **Sources Consulted**:
  - [Vite公式ドキュメント - Env Variables and Modes](https://vite.dev/guide/env-and-mode)
  - [Vue School - How to Use Environment Variables in Vite.js](https://vueschool.io/articles/vuejs-tutorials/how-to-use-environment-variables-in-vite-js/)
- **Findings**:
  - `VITE_`プレフィックス付き変数のみがクライアントコードに公開される
  - `.env.production`は`vite build`実行時に自動的に読み込まれる
  - 環境変数は静的に置換されるため、完全な静的文字列で参照する必要がある
  - `import.meta.env.VITE_*`でアクセス可能
- **Implications**:
  - 既存の`api.ts`の実装パターンは正しい
  - `.env.production`ファイルを作成するだけで要件1.1-1.3を満たせる

### Fetch API タイムアウト実装
- **Context**: 分析処理は最大300秒かかる可能性があり、適切なタイムアウト処理が必要
- **Sources Consulted**:
  - [MDN - AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
  - [Code Driven Development - Everything about AbortSignals](https://codedrivendevelopment.com/posts/everything-about-abort-signal-timeout)
  - [Dmitri Pavlutin - Timeout fetch request](https://dmitripavlutin.com/timeout-fetch-request/)
- **Findings**:
  - `AbortSignal.timeout(ms)`は2024年4月以降、主要ブラウザで安定サポート
  - タイムアウト時は`TimeoutError`（DOMException）がスローされる
  - 手動キャンセルと組み合わせる場合は`AbortSignal.any()`を使用
- **Implications**:
  - `fetch(url, { signal: AbortSignal.timeout(300000) })`でシンプルに実装可能
  - エラーハンドリングで`err.name === "TimeoutError"`を判定

### GCR バックエンドURL形式
- **Context**: Cloud Run サービスのURL形式を確認
- **Sources Consulted**: `scripts/deploy.sh`、`docs/gcp-architecture.md`
- **Findings**:
  - サービス名: `a11y-check-api`
  - リージョン: `asia-northeast1`
  - URL形式: `https://a11y-check-api-<hash>-an.a.run.app`
  - デプロイスクリプトで`gcloud run services describe`からURL取得可能
- **Implications**:
  - `.env.production`にはデプロイ後のURLを手動で設定
  - 将来的にはCI/CDで自動設定も可能

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存パターン拡張 | `api.ts`にタイムアウト追加、`.env.*`ファイル追加 | 最小変更、既存パターン踏襲 | なし | **採用** |
| 新規APIクライアント | 専用のAPIクライアントモジュール作成 | 機能拡張性高 | 過剰設計 | 見送り |

## Design Decisions

### Decision: タイムアウト実装方法
- **Context**: 分析APIは最大300秒かかるため、タイムアウト処理が必要
- **Alternatives Considered**:
  1. `AbortSignal.timeout()` - モダンAPI、シンプル
  2. `AbortController` + `setTimeout` - 手動制御、互換性高
  3. ラッパーライブラリ（axios等）- 機能豊富だが依存増
- **Selected Approach**: `AbortSignal.timeout()`
- **Rationale**:
  - React 19 + Vite 7使用のモダンプロジェクトでブラウザ互換性問題なし
  - 追加依存なしで実装可能
  - コードがシンプル
- **Trade-offs**:
  - 古いブラウザ非対応（ターゲット外のため問題なし）
- **Follow-up**: タイムアウト時のエラーメッセージをユーザーフレンドリーにする

### Decision: 環境変数ファイル構成
- **Context**: 開発・本番環境で異なるAPIエンドポイントを使用
- **Alternatives Considered**:
  1. `.env.production`のみ作成
  2. `.env.example` + `.env.production` + `.env.development`
- **Selected Approach**: `.env.example` + `.env.production`の2ファイル構成
- **Rationale**:
  - `.env.example`: テンプレートとしてリポジトリに含める
  - `.env.production`: 本番URL設定（機密性低いためgit管理可）
  - 開発環境はViteプロキシを使用するため`.env.development`不要
- **Trade-offs**: なし

### Decision: CORS設定の更新タイミング
- **Context**: バックエンドデプロイ時に`ALLOWED_ORIGINS`設定が必要
- **Selected Approach**: `deploy.sh`の`--set-env-vars`に`ALLOWED_ORIGINS`を追加
- **Rationale**:
  - デプロイスクリプトで一元管理
  - フロントエンドのホスティングURLが決まり次第設定
- **Follow-up**: フロントエンドホスティング先の決定後に設定値を確定

## Risks & Mitigations
- **Risk 1**: フロントエンドホスティング先未定 → 設計書ではプレースホルダーを使用し、実装時に決定
- **Risk 2**: GCR URLがデプロイごとに変わる可能性 → サービス名固定のため実際にはURL固定
- **Risk 3**: タイムアウト300秒が長すぎる/短すぎる → 運用後に調整可能な設計

## References
- [Vite Env Variables and Modes](https://vite.dev/guide/env-and-mode) — 環境変数の仕組み
- [MDN AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) — タイムアウトAPI
- [Cloud Run Static Outbound IP](https://cloud.google.com/run/docs/configuring/static-outbound-ip) — GCR固定IP設定
