# Research & Design Decisions: gemini-json-parse-fix

## Summary

- **Feature**: gemini-json-parse-fix
- **Discovery Scope**: Extension（既存システムの拡張）
- **Key Findings**:
  - Gemini APIのJSONエスケープ問題は業界で広く報告されている既知の課題
  - JSON文字列内の制御文字（改行、タブ等）のエスケープ処理が必要
  - 段階的なサニタイズ戦略（制御文字 → Markdownバッククォート除去）が有効

## Research Log

### Gemini API JSON応答の既知の問題

- **Context**: Cloud Runログで`SyntaxError: Unterminated string in JSON`エラーが発生
- **Sources Consulted**:
  - [Gemini API JSON Escaping Issue - Google AI Forum](https://discuss.ai.google.dev/t/json-responses-and-plaintext-responses-with-json-doesnt-have-proper-double-quotations-escaping/33926)
  - [Gemini CLI JSON Parse Error - GitHub Issue](https://github.com/google-gemini/gemini-cli/issues/4277)
  - [Gemini Structured Output Special Characters - GitHub Issue](https://github.com/googleapis/python-genai/issues/1238)
- **Findings**:
  - `responseMimeType: 'application/json'`を指定しても、コード例を含む応答で問題発生
  - 未エスケープの引用符、制御文字、バックスラッシュが主な原因
  - Markdownバッククォートで囲まれる場合もある（稀）
- **Implications**: サニタイズ処理はJSON文字列値内の制御文字に焦点を当てる

### JSON制御文字のエスケープパターン

- **Context**: JSONパース前のサニタイズ実装方法の調査
- **Sources Consulted**:
  - [MDN - SyntaxError: JSON.parse: bad parsing](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/JSON_bad_parse)
  - [GeeksforGeeks - How To Escape Strings in JSON](https://www.geeksforgeeks.org/javascript/how-to-escape-strings-in-json/)
  - [LangChain Issue - Bad control character in string literal](https://github.com/langchain-ai/langchainjs/issues/2902)
- **Findings**:
  - エスケープ必須文字: `\n`（改行）, `\r`（復帰）, `\t`（タブ）, `\"`（引用符）, `\\`（バックスラッシュ）
  - 正規表現ベースの置換が一般的なアプローチ
  - JSON文字列値内でのみ処理する必要あり（構造を破壊しないため）
- **Implications**: 文字列値内の制御文字を対象とした正規表現サニタイズを採用

### リトライ機構のベストプラクティス

- **Context**: 一時的なエラー時のリトライ実装
- **Sources Consulted**:
  - プロジェクト内既存パターン調査（なし）
  - 一般的な指数バックオフパターン
- **Findings**:
  - リトライ対象: タイムアウト、ネットワークエラー、5xxエラー
  - 指数バックオフ: 1秒 → 2秒 → ...（今回は1回のみなので1秒固定）
  - レート制限（429）はリトライ対象外（Retry-Afterヘッダーに従う）
- **Implications**: 簡易実装として1回・1秒バックオフを採用

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A: 既存ファイル拡張 | gemini.ts内で完結 | 変更最小、import不変 | ファイル肥大化（450行超） | 短期的には有効 |
| B: 新規ユーティリティ | 別ファイルに分離 | 再利用性高、テスト容易 | ファイル数増加 | 過剰設計の恐れ |
| **C: ハイブリッド** | gemini.ts内+型拡張 | バランス良好 | リトライは再利用不可 | **採用** |

## Design Decisions

### Decision: サニタイズ戦略

- **Context**: Gemini応答内の不正JSON文字列の修正方法
- **Alternatives Considered**:
  1. JSON5ライブラリ導入 — 寛容なパースが可能だが外部依存追加
  2. 文字単位パース — 完全な制御可能だが実装複雑
  3. 正規表現ベースのサニタイズ — 既知パターンに対応、依存なし
- **Selected Approach**: 正規表現ベースのサニタイズ
- **Rationale**:
  - 外部依存追加なし
  - 既知の問題パターン（制御文字）に特化
  - 実装・テストが容易
- **Trade-offs**:
  - ✅ シンプル、既存パターン踏襲
  - ❌ 未知のパターンには対応不可（フォールバックで補完）
- **Follow-up**: テストケースで実際のGemini応答パターンを検証

### Decision: フォールバックAISummary生成

- **Context**: パース失敗時のユーザー体験維持
- **Alternatives Considered**:
  1. エラー返却のみ — ユーザー体験低下
  2. 空のAISummary — 情報なし
  3. 違反情報から生成 — 最低限の価値提供
- **Selected Approach**: 違反情報からフォールバックAISummary生成
- **Rationale**:
  - 既存の`countByImpact`関数を活用
  - ユーザーに最低限の情報を提供
  - `isFallback`フラグで識別可能
- **Trade-offs**:
  - ✅ システム継続性維持
  - ❌ AI生成の詳細な改善提案は欠落
- **Follow-up**: フォールバック発生率をログ監視

### Decision: GeminiError型の拡張

- **Context**: パースエラーを明示的に区別する必要性
- **Alternatives Considered**:
  1. 既存の`api_error`を流用 — 区別不可
  2. 新しい`parse_error`型を追加 — 明示的な区別
- **Selected Approach**: `parse_error`型を追加
- **Rationale**:
  - 呼び出し元でパースエラーを識別可能
  - ログ・監視での分類が容易
  - 将来的なエラーハンドリング拡張に対応
- **Trade-offs**:
  - ✅ 明確なエラー分類
  - ❌ GeminiError型の変更（軽微）
- **Follow-up**: フロントエンドでのエラー表示確認

### Decision: maxOutputTokens値

- **Context**: 適切なトークン数上限の決定
- **Alternatives Considered**:
  1. 4096 — 2倍で安全マージン確保
  2. 8192 — より大きなマージン
  3. 環境変数化 — 柔軟性最大
- **Selected Approach**: 4096（定数定義）
- **Rationale**:
  - 現行2048の2倍で十分なマージン
  - Gemini 2.0 Flashの上限内
  - 定数定義で変更容易
- **Trade-offs**:
  - ✅ シンプル、変更容易
  - ❌ 環境ごとの調整には再デプロイ必要
- **Follow-up**: 本番環境でトランケーション発生を監視

## Risks & Mitigations

| リスク | 影響度 | 軽減策 |
|--------|--------|--------|
| サニタイズが有効なJSONを破壊 | 高 | 十分なテストケース、段階的適用 |
| フォールバックが頻発 | 中 | ログ監視、アラート設定、根本原因分析 |
| リトライによるレイテンシ増加 | 低 | リトライ1回のみ、短いバックオフ |
| 型変更による既存コードへの影響 | 低 | AISummaryの`isFallback`はオプショナル |

## References

- [MDN - SyntaxError: JSON.parse: bad parsing](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/JSON_bad_parse) — JSON構文エラーの詳細
- [GeeksforGeeks - How To Escape Strings in JSON](https://www.geeksforgeeks.org/javascript/how-to-escape-strings-in-json/) — JSONエスケープパターン
- [Google AI Forum - JSON Escaping Issue](https://discuss.ai.google.dev/t/json-responses-and-plaintext-responses-with-json-doesnt-have-proper-double-quotations-escaping/33926) — Gemini固有の問題報告
- [LangChain Issue #2902](https://github.com/langchain-ai/langchainjs/issues/2902) — LLM JSON応答の制御文字問題
