/**
 * deployment-guide.md ドキュメントの検証テスト
 *
 * ドキュメントが要件を満たしているかを確認する
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('deployment-guide.md ドキュメント', () => {
  const docPath = path.join(process.cwd(), 'docs', 'deployment-guide.md');

  test('ドキュメントファイルが存在すること', async () => {
    const exists = fs.existsSync(docPath);
    expect(exists).toBe(true);
  });

  test('環境変数の概要セクションが含まれていること', async () => {
    const content = fs.readFileSync(docPath, 'utf-8');

    // 環境変数の説明が含まれていること
    expect(content).toContain('VITE_API_URL');
    expect(content).toContain('ALLOWED_ORIGINS');
    expect(content).toContain('環境変数');
  });

  test('ローカル開発環境のセットアップ手順が含まれていること', async () => {
    const content = fs.readFileSync(docPath, 'utf-8');

    // 開発環境セットアップの説明
    expect(content).toMatch(/ローカル開発|開発環境/);
    expect(content).toContain('npm install');
    expect(content).toContain('npm run dev');
  });

  test('本番環境用ビルド手順が含まれていること', async () => {
    const content = fs.readFileSync(docPath, 'utf-8');

    // 本番ビルド手順
    expect(content).toMatch(/本番環境|production/i);
    expect(content).toContain('npm run build');
    expect(content).toContain('.env.production');
  });

  test('GCRバックエンドへの接続設定が含まれていること', async () => {
    const content = fs.readFileSync(docPath, 'utf-8');

    // GCR接続設定
    expect(content).toMatch(/GCR|Cloud Run/i);
    expect(content).toContain('CORS');
    expect(content).toContain('FRONTEND_ORIGIN');
  });

  test('トラブルシューティングセクションが含まれていること', async () => {
    const content = fs.readFileSync(docPath, 'utf-8');

    // トラブルシューティング
    expect(content).toContain('トラブルシューティング');

    // 主要なエラーケースの説明
    expect(content).toMatch(/CORS.*エラー|CORSエラー/i);
    expect(content).toMatch(/接続.*エラー|タイムアウト/);
  });
});
