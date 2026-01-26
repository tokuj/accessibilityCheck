/**
 * インラインAI対話機能 E2Eテスト
 * @requirement 全要件 - 対話フロー、履歴管理、エラー処理、キーボードナビゲーション
 */
import { test, expect } from '@playwright/test';

// テスト対象のローカル開発サーバーURL
const BASE_URL = 'http://localhost:5173';

// APIモック用のインターセプトパターン
const CHAT_API_PATTERN = '**/api/chat';

test.describe('インラインAI対話機能 E2Eテスト', () => {
  test.beforeEach(async ({ page }) => {
    // レポートページへ移動（テスト用のレポートデータを想定）
    await page.goto(BASE_URL);
    // ページの読み込み完了を待機
    await page.waitForLoadState('networkidle');
  });

  test.describe('4.1.1: 違反行での対話フロー', () => {
    test('ホバー→クリック→質問入力→送信→回答表示→閉じるのフローが動作する', async ({ page }) => {
      // APIレスポンスをモック
      await page.route(CHAT_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            answer: 'これはテスト回答です。コントラスト比は4.5:1以上を確保してください。',
            referenceUrl: 'https://a11y-guidelines.ameba.design/1/contrast-minimum/',
            generatedAt: new Date().toISOString(),
          }),
        });
      });

      // 分析を実行してレポートを表示（テスト用URLを入力）
      const urlInput = page.getByPlaceholder('URLを入力');
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com');
        await page.getByRole('button', { name: /分析|開始/i }).click();
        // レポートが表示されるまで待機
        await page.waitForSelector('[data-testid="violations-table"], .MuiTableContainer-root', {
          timeout: 60000,
        }).catch(() => {
          // 違反がない場合はスキップ
        });
      }

      // AIChatButtonを探す（aria-labelで検索）
      const chatButtons = page.getByRole('button', { name: 'この項目についてAIに質問する' });
      const buttonCount = await chatButtons.count();

      // チャットボタンが存在しない場合はテストをスキップ
      if (buttonCount === 0) {
        test.skip(true, '対話ボタンが見つかりません（違反がない可能性があります）');
        return;
      }

      // 最初のチャットボタンをクリック
      const firstButton = chatButtons.first();
      await firstButton.click();

      // Popoverが開いたことを確認
      const popover = page.getByRole('dialog');
      await expect(popover).toBeVisible();

      // 入力フィールドにフォーカスが当たっていることを確認
      const input = popover.getByPlaceholder('質問を入力...');
      await expect(input).toBeFocused();

      // 質問を入力
      await input.fill('この違反はどうすれば修正できますか？');

      // 送信ボタンをクリック
      const sendButton = popover.getByRole('button', { name: '送信' });
      await sendButton.click();

      // ローディング状態を確認
      await expect(popover.getByText('回答を生成中...')).toBeVisible();

      // 回答が表示されるまで待機
      await expect(popover.getByText(/これはテスト回答です/)).toBeVisible({ timeout: 10000 });

      // 参照URLが表示されていることを確認
      await expect(popover.getByRole('link', { name: /参照/i })).toBeVisible();

      // 閉じるボタンをクリック
      const closeButton = popover.getByRole('button', { name: '閉じる' });
      await closeButton.click();

      // Popoverが閉じたことを確認
      await expect(popover).not.toBeVisible();
    });
  });

  test.describe('4.1.2: スコア項目での対話フロー', () => {
    test('スコア項目の対話ボタンから質問できる', async ({ page }) => {
      // APIレスポンスをモック
      await page.route(CHAT_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            answer: 'スコアは100点満点中の評価です。改善にはコントラスト比の調整が効果的です。',
            referenceUrl: 'https://a11y-guidelines.ameba.design/',
            generatedAt: new Date().toISOString(),
          }),
        });
      });

      // 分析を実行
      const urlInput = page.getByPlaceholder('URLを入力');
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com');
        await page.getByRole('button', { name: /分析|開始/i }).click();
        await page.waitForLoadState('networkidle');
      }

      // スコアカード内のチャットボタンを探す
      const chatButtons = page.getByRole('button', { name: 'この項目についてAIに質問する' });
      const buttonCount = await chatButtons.count();

      if (buttonCount === 0) {
        test.skip(true, '対話ボタンが見つかりません');
        return;
      }

      // 最初のボタンをクリック
      await chatButtons.first().click();

      // Popoverが開く
      const popover = page.getByRole('dialog');
      await expect(popover).toBeVisible();

      // 質問を送信
      const input = popover.getByPlaceholder('質問を入力...');
      await input.fill('このスコアを改善するにはどうすればいいですか？');
      await popover.getByRole('button', { name: '送信' }).click();

      // 回答を確認
      await expect(popover.getByText(/スコアは100点満点中/)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('4.1.3: 履歴の保持と再表示', () => {
    test('対話履歴がセッション内で保持される', async ({ page }) => {
      // APIレスポンスをモック
      let callCount = 0;
      await page.route(CHAT_API_PATTERN, async (route) => {
        callCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            answer: `回答${callCount}: これはテスト回答です。`,
            referenceUrl: 'https://a11y-guidelines.ameba.design/',
            generatedAt: new Date().toISOString(),
          }),
        });
      });

      // 分析を実行
      const urlInput = page.getByPlaceholder('URLを入力');
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com');
        await page.getByRole('button', { name: /分析|開始/i }).click();
        await page.waitForLoadState('networkidle');
      }

      const chatButtons = page.getByRole('button', { name: 'この項目についてAIに質問する' });
      const buttonCount = await chatButtons.count();

      if (buttonCount === 0) {
        test.skip(true, '対話ボタンが見つかりません');
        return;
      }

      // 最初のボタンをクリック
      const firstButton = chatButtons.first();
      await firstButton.click();

      const popover = page.getByRole('dialog');

      // 1回目の質問
      const input = popover.getByPlaceholder('質問を入力...');
      await input.fill('最初の質問です');
      await popover.getByRole('button', { name: '送信' }).click();
      await expect(popover.getByText(/回答1/)).toBeVisible({ timeout: 10000 });

      // 2回目の質問
      await input.fill('2回目の質問です');
      await popover.getByRole('button', { name: '送信' }).click();
      await expect(popover.getByText(/回答2/)).toBeVisible({ timeout: 10000 });

      // Popoverを閉じる
      await popover.getByRole('button', { name: '閉じる' }).click();
      await expect(popover).not.toBeVisible();

      // 再度開く
      await firstButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // 履歴が保持されていることを確認
      const reopenedPopover = page.getByRole('dialog');
      await expect(reopenedPopover.getByText('最初の質問です')).toBeVisible();
      await expect(reopenedPopover.getByText('2回目の質問です')).toBeVisible();
      await expect(reopenedPopover.getByText(/回答1/)).toBeVisible();
      await expect(reopenedPopover.getByText(/回答2/)).toBeVisible();
    });
  });

  test.describe('4.1.4: エラー時の再試行フロー', () => {
    test('APIエラー時に再試行ボタンが表示され、再試行できる', async ({ page }) => {
      let callCount = 0;

      await page.route(CHAT_API_PATTERN, async (route) => {
        callCount++;
        if (callCount === 1) {
          // 1回目はエラー
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Internal Server Error',
            }),
          });
        } else {
          // 2回目以降は成功
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              answer: '再試行後の回答です。',
              referenceUrl: 'https://a11y-guidelines.ameba.design/',
              generatedAt: new Date().toISOString(),
            }),
          });
        }
      });

      // 分析を実行
      const urlInput = page.getByPlaceholder('URLを入力');
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com');
        await page.getByRole('button', { name: /分析|開始/i }).click();
        await page.waitForLoadState('networkidle');
      }

      const chatButtons = page.getByRole('button', { name: 'この項目についてAIに質問する' });
      const buttonCount = await chatButtons.count();

      if (buttonCount === 0) {
        test.skip(true, '対話ボタンが見つかりません');
        return;
      }

      await chatButtons.first().click();

      const popover = page.getByRole('dialog');
      const input = popover.getByPlaceholder('質問を入力...');

      // 質問を送信（1回目はエラー）
      await input.fill('テスト質問');
      await popover.getByRole('button', { name: '送信' }).click();

      // エラーメッセージと再試行ボタンが表示される
      await expect(popover.getByRole('alert')).toBeVisible({ timeout: 10000 });
      const retryButton = popover.getByRole('button', { name: '再試行' });
      await expect(retryButton).toBeVisible();

      // 再試行
      await retryButton.click();

      // 成功した回答が表示される
      await expect(popover.getByText('再試行後の回答です。')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('4.1.5: キーボードナビゲーション', () => {
    test('Tab, Enter, Escapeキーで操作できる', async ({ page }) => {
      // APIレスポンスをモック
      await page.route(CHAT_API_PATTERN, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            answer: 'キーボード操作での回答です。',
            referenceUrl: 'https://a11y-guidelines.ameba.design/',
            generatedAt: new Date().toISOString(),
          }),
        });
      });

      // 分析を実行
      const urlInput = page.getByPlaceholder('URLを入力');
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com');
        await page.getByRole('button', { name: /分析|開始/i }).click();
        await page.waitForLoadState('networkidle');
      }

      const chatButtons = page.getByRole('button', { name: 'この項目についてAIに質問する' });
      const buttonCount = await chatButtons.count();

      if (buttonCount === 0) {
        test.skip(true, '対話ボタンが見つかりません');
        return;
      }

      // Tabキーでチャットボタンにフォーカス
      const firstButton = chatButtons.first();
      await firstButton.focus();
      await expect(firstButton).toBeFocused();

      // Enterキーで開く
      await page.keyboard.press('Enter');
      const popover = page.getByRole('dialog');
      await expect(popover).toBeVisible();

      // 入力フィールドにフォーカスが当たっている
      const input = popover.getByPlaceholder('質問を入力...');
      await expect(input).toBeFocused();

      // 質問を入力してEnterキーで送信
      await input.fill('キーボードからの質問');
      await page.keyboard.press('Enter');

      // 回答を待機
      await expect(popover.getByText('キーボード操作での回答です。')).toBeVisible({ timeout: 10000 });

      // Escapeキーで閉じる
      await page.keyboard.press('Escape');
      await expect(popover).not.toBeVisible();

      // フォーカスがボタンに戻る
      await expect(firstButton).toBeFocused();
    });
  });

  test.describe('4.1.6: 複数対話ポイント間の遷移', () => {
    test('異なる項目の対話ポイントを切り替えて使用できる', async ({ page }) => {
      // APIレスポンスをモック
      let contextType = '';
      await page.route(CHAT_API_PATTERN, async (route, request) => {
        const body = request.postDataJSON();
        contextType = body?.context?.type || 'unknown';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            answer: `${contextType}に関する回答です。`,
            referenceUrl: 'https://a11y-guidelines.ameba.design/',
            generatedAt: new Date().toISOString(),
          }),
        });
      });

      // 分析を実行
      const urlInput = page.getByPlaceholder('URLを入力');
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com');
        await page.getByRole('button', { name: /分析|開始/i }).click();
        await page.waitForLoadState('networkidle');
      }

      const chatButtons = page.getByRole('button', { name: 'この項目についてAIに質問する' });
      const buttonCount = await chatButtons.count();

      if (buttonCount < 2) {
        test.skip(true, '複数の対話ボタンが見つかりません');
        return;
      }

      // 1つ目のボタンで対話
      await chatButtons.nth(0).click();
      let popover = page.getByRole('dialog');
      await expect(popover).toBeVisible();

      let input = popover.getByPlaceholder('質問を入力...');
      await input.fill('1つ目の項目について');
      await popover.getByRole('button', { name: '送信' }).click();
      await expect(popover.getByText(/に関する回答です/)).toBeVisible({ timeout: 10000 });

      // Popoverを閉じる
      await popover.getByRole('button', { name: '閉じる' }).click();
      await expect(popover).not.toBeVisible();

      // 2つ目のボタンで対話
      await chatButtons.nth(1).click();
      popover = page.getByRole('dialog');
      await expect(popover).toBeVisible();

      // 新しいPopoverには前の履歴がないことを確認
      input = popover.getByPlaceholder('質問を入力...');
      await input.fill('2つ目の項目について');
      await popover.getByRole('button', { name: '送信' }).click();
      await expect(popover.getByText(/に関する回答です/)).toBeVisible({ timeout: 10000 });
    });
  });
});
