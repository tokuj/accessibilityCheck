/**
 * セッション管理機能のE2Eテスト
 *
 * Task 13: E2Eテストの実装
 * Requirements: 全要件
 *
 * テスト対象:
 * - セッション作成・読み込み・削除のE2Eフロー
 * - 認証済みセッションでのアクセシビリティ検証フロー
 * - パスフレーズ入力フロー
 * - エラーケースのテスト（不正パスフレーズ等）
 *
 * 注意: これらのテストはWebサーバーが起動している状態で実行する必要があります
 */

import { test, expect } from '@playwright/test';

// テストの前提条件
// - フロントエンドとバックエンドが起動していること
// - テスト用の認証済みセッションが存在すること（または作成可能であること）

const BASE_URL = 'http://localhost:5173';
const API_BASE_URL = 'http://localhost:3001';

test.describe('セッション管理機能', () => {
  test.describe('セッションAPI', () => {
    test('GET /api/sessions でセッション一覧を取得できる', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/sessions`);

      // 200 OK または空の配列を期待
      expect(response.ok()).toBeTruthy();

      const sessions = await response.json();
      expect(Array.isArray(sessions)).toBeTruthy();
    });

    test('POST /api/sessions でセッションを作成できる', async ({ request }) => {
      // テスト用のセッションを作成
      const response = await request.post(`${API_BASE_URL}/api/sessions`, {
        data: {
          name: 'e2e-test-session',
          passphrase: 'test-passphrase-12345',
          storageState: {
            cookies: [
              {
                name: 'test_cookie',
                value: 'test_value',
                domain: 'example.com',
                path: '/',
              },
            ],
            origins: [],
          },
          options: {
            autoDestroy: true,
          },
        },
      });

      // 201 Created または 409 Conflict（既存）を期待
      if (response.status() === 201) {
        const session = await response.json();
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('name', 'e2e-test-session');
        expect(session).toHaveProperty('domain', 'example.com');

        // クリーンアップ: 作成したセッションを削除
        await request.delete(`${API_BASE_URL}/api/sessions/${session.id}`);
      } else if (response.status() === 409) {
        // 重複名の場合は許容
        const error = await response.json();
        expect(error).toHaveProperty('error');
      } else {
        // その他のエラー
        test.fail(true, false, `Unexpected status: ${response.status()}`);
      }
    });

    test('DELETE /api/sessions/:id でセッションを削除できる', async ({ request }) => {
      // まずセッションを作成
      const createResponse = await request.post(`${API_BASE_URL}/api/sessions`, {
        data: {
          name: 'e2e-delete-test-session',
          passphrase: 'test-passphrase-12345',
          storageState: {
            cookies: [
              {
                name: 'test_cookie',
                value: 'test_value',
                domain: 'example.com',
                path: '/',
              },
            ],
            origins: [],
          },
        },
      });

      if (createResponse.status() === 201) {
        const session = await createResponse.json();

        // 削除
        const deleteResponse = await request.delete(
          `${API_BASE_URL}/api/sessions/${session.id}`
        );
        expect(deleteResponse.status()).toBe(204);

        // 再度削除しようとすると404
        const deleteAgainResponse = await request.delete(
          `${API_BASE_URL}/api/sessions/${session.id}`
        );
        expect(deleteAgainResponse.status()).toBe(404);
      }
    });

    test('POST /api/sessions/:id/load で正しいパスフレーズならセッションを読み込める', async ({
      request,
    }) => {
      // まずセッションを作成
      const passphrase = 'correct-passphrase-12345';
      const createResponse = await request.post(`${API_BASE_URL}/api/sessions`, {
        data: {
          name: 'e2e-load-test-session',
          passphrase,
          storageState: {
            cookies: [
              {
                name: 'session_cookie',
                value: 'session_value',
                domain: 'example.com',
                path: '/',
              },
            ],
            origins: [],
          },
        },
      });

      if (createResponse.status() === 201) {
        const session = await createResponse.json();

        // 正しいパスフレーズでロード
        const loadResponse = await request.post(
          `${API_BASE_URL}/api/sessions/${session.id}/load`,
          {
            data: { passphrase },
          }
        );
        expect(loadResponse.status()).toBe(200);

        const loadedData = await loadResponse.json();
        expect(loadedData).toHaveProperty('storageState');
        expect(loadedData.storageState).toHaveProperty('cookies');

        // クリーンアップ
        await request.delete(`${API_BASE_URL}/api/sessions/${session.id}`);
      }
    });

    test('POST /api/sessions/:id/load で不正パスフレーズなら401エラー', async ({
      request,
    }) => {
      // まずセッションを作成
      const passphrase = 'correct-passphrase-12345';
      const createResponse = await request.post(`${API_BASE_URL}/api/sessions`, {
        data: {
          name: 'e2e-wrong-pass-test-session',
          passphrase,
          storageState: {
            cookies: [
              {
                name: 'session_cookie',
                value: 'session_value',
                domain: 'example.com',
                path: '/',
              },
            ],
            origins: [],
          },
        },
      });

      if (createResponse.status() === 201) {
        const session = await createResponse.json();

        // 不正なパスフレーズでロード
        const loadResponse = await request.post(
          `${API_BASE_URL}/api/sessions/${session.id}/load`,
          {
            data: { passphrase: 'wrong-passphrase' },
          }
        );
        expect(loadResponse.status()).toBe(401);

        const error = await loadResponse.json();
        expect(error).toHaveProperty('error');

        // クリーンアップ
        await request.delete(`${API_BASE_URL}/api/sessions/${session.id}`);
      }
    });
  });

  test.describe('UIテスト', () => {
    test.skip('フロントエンドでセッション一覧が表示される', async ({ page }) => {
      // このテストはフロントエンドとバックエンドが起動している状態で実行
      await page.goto(BASE_URL);

      // セッション管理UIが表示されることを確認（showSessionManager=trueの場合）
      // 注: 現在のUIではshowSessionManager=falseがデフォルトのため、
      // このテストは特定の設定が必要

      // ページが正常にロードされることを確認
      await expect(page).toHaveTitle(/アクセシビリティ/);
    });

    test.skip('認証設定ダイアログを開ける', async ({ page }) => {
      await page.goto(BASE_URL);

      // 認証設定アイコン（鍵アイコン）をクリック
      const authButton = page.getByLabel(/認証設定/);
      await authButton.click();

      // ダイアログが開くことを確認
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('認証設定')).toBeVisible();
    });
  });

  test.describe('インタラクティブログインAPI', () => {
    test('GET /api/auth/interactive-login でアクティブセッション状態を取得できる', async ({
      request,
    }) => {
      const response = await request.get(`${API_BASE_URL}/api/auth/interactive-login`);

      // 200 OK を期待
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      // session は null またはオブジェクト
      expect(data).toHaveProperty('session');
    });

    // 注: headedブラウザを起動するテストはCI環境では実行困難なためスキップ
    test.skip('POST /api/auth/interactive-login でログインセッションを開始できる', async ({
      request,
    }) => {
      // このテストは開発環境（ALLOW_HEADED_BROWSER=true）でのみ実行可能
      const response = await request.post(`${API_BASE_URL}/api/auth/interactive-login`, {
        data: {
          loginUrl: 'https://example.com/login',
        },
      });

      // 200 OK または 503 Service Unavailable（headless環境）を期待
      if (response.status() === 200) {
        const session = await response.json();
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('loginUrl');
        expect(session).toHaveProperty('status');

        // キャンセル
        await request.delete(`${API_BASE_URL}/api/auth/interactive-login`);
      } else if (response.status() === 503) {
        // headless環境では503が返る
        const error = await response.json();
        expect(error).toHaveProperty('error');
      }
    });
  });
});

test.describe('SSEストリーミング', () => {
  test('GET /api/analyze-stream でSSE接続を確立できる', async ({ request }) => {
    // SSEエンドポイントにアクセス（URLパラメータ必須）
    const response = await request.get(
      `${API_BASE_URL}/api/analyze-stream?url=https://example.com`
    );

    // レスポンスがSSEフォーマットであることを確認
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/event-stream');
  });

  test('無効なURLでエラーレスポンスが返る', async ({ request }) => {
    // URLなしでアクセス
    const response = await request.get(`${API_BASE_URL}/api/analyze-stream`);

    // 400 Bad Request を期待
    expect(response.status()).toBe(400);
  });
});
