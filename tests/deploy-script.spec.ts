/**
 * deploy.sh スクリプトのユニットテスト
 *
 * スクリプトの構文チェックと設定値の検証を行う
 * 実際のデプロイは行わない（CI環境では --dry-run オプションを使用）
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('deploy.sh スクリプト', () => {
  const scriptPath = path.join(process.cwd(), 'scripts', 'deploy.sh');

  test('スクリプトファイルが存在すること', async () => {
    const exists = fs.existsSync(scriptPath);
    expect(exists).toBe(true);
  });

  test('スクリプトが実行可能な権限を持つこと', async () => {
    const stats = fs.statSync(scriptPath);
    // Unix権限: 実行可能ビットが設定されているか確認
    const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;
    expect(isExecutable).toBe(true);
  });

  test('必須設定が含まれていること', async () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');

    // 設定変数が定義されていること
    expect(content).toContain('PROJECT_ID=');
    expect(content).toContain('REGION=');
    expect(content).toContain('SERVICE_NAME=');
    expect(content).toContain('IMAGE_NAME=');

    // GCPプロジェクト設定が正しいこと
    expect(content).toContain('PROJECT_ID="itgproto"');
    expect(content).toContain('REGION="asia-northeast1"');
  });

  test('エラーハンドリングが設定されていること', async () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');

    // set -e でエラー時に即終了
    expect(content).toMatch(/set -e/);
  });

  test('必須コマンドが含まれていること', async () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');

    // gcloud設定コマンド
    expect(content).toContain('gcloud config set project');

    // Docker認証設定
    expect(content).toContain('gcloud auth configure-docker');

    // Dockerビルドコマンド
    expect(content).toContain('docker build');

    // Dockerプッシュコマンド
    expect(content).toContain('docker push');

    // Cloud Runデプロイコマンド
    expect(content).toContain('gcloud run deploy');
  });

  test('Cloud Run設定が正しいこと', async () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');

    // 未認証アクセス許可
    expect(content).toContain('--allow-unauthenticated');

    // メモリ設定（2GB以上）
    expect(content).toMatch(/--memory\s+2Gi/);

    // タイムアウト設定（300秒以上）
    expect(content).toMatch(/--timeout\s+300/);

    // インスタンス数設定
    expect(content).toContain('--min-instances');
    expect(content).toContain('--max-instances');

    // NODE_ENV環境変数
    expect(content).toContain('NODE_ENV=production');
  });

  test('デプロイ成功時にURLを表示すること', async () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');

    // デプロイ完了メッセージ
    expect(content).toMatch(/echo.*[Dd]eployment|デプロイ/);

    // サービスURL取得コマンド
    expect(content).toContain('gcloud run services describe');
  });
});
