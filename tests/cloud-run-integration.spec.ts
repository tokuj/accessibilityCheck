import { test, expect } from '@playwright/test';

test('Cloud Run フロントエンド→バックエンド通信テスト', async ({ page }, testInfo) => {
  test.setTimeout(120000); // 2分のタイムアウト
  // コンソールメッセージを監視
  const consoleMessages: { type: string; text: string }[] = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  // ネットワークリクエストを監視
  const apiRequests: { url: string; method: string }[] = [];
  const apiResponses: { url: string; status: number; headers: Record<string, string> }[] = [];

  page.on('request', request => {
    if (request.url().includes('a11y-check-api')) {
      apiRequests.push({ url: request.url(), method: request.method() });
    }
  });

  page.on('response', response => {
    if (response.url().includes('a11y-check-api')) {
      apiResponses.push({
        url: response.url(),
        status: response.status(),
        headers: response.headers()
      });
    }
  });

  // フロントエンドにアクセス
  await page.goto('https://a11y-check-frontend-783872951114.asia-northeast1.run.app');
  await page.waitForLoadState('networkidle');

  // URL入力（placeholderで特定）
  await page.fill('input[placeholder="分析したいURLを入力してください..."]', 'https://example.com');

  // 送信ボタンをクリック（type="submit"のIconButton）
  await page.click('button[type="submit"]');

  // API応答を待機（タイムアウト60秒）
  try {
    await page.waitForResponse(
      response => response.url().includes('a11y-check-api') && response.status() === 200,
      { timeout: 60000 }
    );
  } catch (e) {
    console.log('API Response timeout or error');
  }

  // 結果を出力
  console.log('=== Console Messages ===');
  consoleMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));

  console.log('=== API Requests ===');
  apiRequests.forEach(r => console.log(`${r.method} ${r.url}`));

  console.log('=== API Responses ===');
  apiResponses.forEach(r => console.log(`${r.status} ${r.url}`));

  // CORSエラーがないことを確認
  const corsErrors = consoleMessages.filter(m =>
    m.type === 'error' && m.text.toLowerCase().includes('cors')
  );

  // 少なくとも1つのAPIリクエストが成功していることを確認
  const successfulResponses = apiResponses.filter(r => r.status === 200);

  console.log('=== Test Results ===');
  console.log(`CORS Errors: ${corsErrors.length}`);
  console.log(`Successful API Responses: ${successfulResponses.length}`);

  // スクリーンショットを保存
  await page.screenshot({ path: 'screenshots/cloud-run-result.png', fullPage: true });
  await testInfo.attach('結果スクリーンショット', { path: 'screenshots/cloud-run-result.png', contentType: 'image/png' });

  expect(corsErrors).toHaveLength(0);
  expect(successfulResponses.length).toBeGreaterThan(0);
});
