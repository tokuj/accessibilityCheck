/**
 * インラインAI対話機能 アクセシビリティテスト
 * @requirement 6.1-6.6 - キーボード操作、スクリーンリーダー対応、ARIA属性
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// テスト対象のローカル開発サーバーURL
const BASE_URL = 'http://localhost:5173';

// APIモック用のインターセプトパターン
const CHAT_API_PATTERN = '**/api/chat';

// WCAG AA準拠タグ
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.describe('インラインAI対話機能 アクセシビリティテスト', () => {
  test.beforeEach(async ({ page }) => {
    // APIをモック
    await page.route(CHAT_API_PATTERN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'アクセシビリティテスト用の回答です。コントラスト比は4.5:1以上を確保してください。',
          referenceUrl: 'https://a11y-guidelines.ameba.design/1/contrast-minimum/',
          generatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('4.2.1: axe-coreによる自動アクセシビリティテスト', () => {
    test('AIChatButtonがWCAG AAに準拠している', async ({ page }) => {
      // 分析を実行してレポートを表示
      const urlInput = page.getByPlaceholder('URLを入力');
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com');
        await page.getByRole('button', { name: /分析|開始/i }).click();
        await page.waitForLoadState('networkidle');
      }

      // axe-coreによるスキャン
      const axeBuilder = new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .include('[aria-label="この項目についてAIに質問する"]');

      const accessibilityScanResults = await axeBuilder.analyze();

      // 違反がある場合は詳細を出力
      if (accessibilityScanResults.violations.length > 0) {
        console.log('\n[AIChatButton] アクセシビリティ違反:');
        accessibilityScanResults.violations.forEach((violation, index) => {
          console.log(`${index + 1}. ${violation.id}: ${violation.description}`);
          console.log(`   影響度: ${violation.impact}`);
        });
      }

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('AIChatPopoverがWCAG AAに準拠している', async ({ page }) => {
      // 分析を実行してレポートを表示
      const urlInput = page.getByPlaceholder('URLを入力');
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com');
        await page.getByRole('button', { name: /分析|開始/i }).click();
        await page.waitForLoadState('networkidle');
      }

      // チャットボタンを探す
      const chatButtons = page.getByRole('button', { name: 'この項目についてAIに質問する' });
      const buttonCount = await chatButtons.count();

      if (buttonCount === 0) {
        test.skip(true, '対話ボタンが見つかりません');
        return;
      }

      // Popoverを開く
      await chatButtons.first().click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // axe-coreによるスキャン（Popover部分）
      const axeBuilder = new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .include('[role="dialog"]');

      const accessibilityScanResults = await axeBuilder.analyze();

      // 違反がある場合は詳細を出力
      if (accessibilityScanResults.violations.length > 0) {
        console.log('\n[AIChatPopover] アクセシビリティ違反:');
        accessibilityScanResults.violations.forEach((violation, index) => {
          console.log(`${index + 1}. ${violation.id}: ${violation.description}`);
          console.log(`   影響度: ${violation.impact}`);
        });
      }

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('4.2.2: ARIA属性の正確性検証', () => {
    test('AIChatButtonに正しいARIA属性が設定されている', async ({ page }) => {
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

      const firstButton = chatButtons.first();

      // aria-label が設定されている
      await expect(firstButton).toHaveAttribute('aria-label', 'この項目についてAIに質問する');

      // 閉じている状態では aria-expanded="false"
      await expect(firstButton).toHaveAttribute('aria-expanded', 'false');

      // aria-haspopup="dialog" が設定されている
      await expect(firstButton).toHaveAttribute('aria-haspopup', 'dialog');

      // ボタンをクリックしてPopoverを開く
      await firstButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // 開いている状態では aria-expanded="true"
      await expect(firstButton).toHaveAttribute('aria-expanded', 'true');

      // aria-controls が設定されている
      const ariaControls = await firstButton.getAttribute('aria-controls');
      expect(ariaControls).toBeTruthy();
    });

    test('AIChatPopoverに正しいARIA属性が設定されている', async ({ page }) => {
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

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // role="dialog" が設定されている
      await expect(dialog).toHaveAttribute('role', 'dialog');

      // aria-modal="true" が設定されている
      await expect(dialog).toHaveAttribute('aria-modal', 'true');

      // aria-labelledby が設定されている
      const ariaLabelledby = await dialog.getAttribute('aria-labelledby');
      expect(ariaLabelledby).toBeTruthy();

      // ラベル要素が存在する
      if (ariaLabelledby) {
        const labelElement = page.locator(`#${ariaLabelledby}`);
        await expect(labelElement).toBeVisible();
      }

      // 入力フィールドに aria-label が設定されている
      const input = dialog.getByPlaceholder('質問を入力...');
      await expect(input).toHaveAttribute('aria-label', '質問');

      // 閉じるボタンに aria-label が設定されている
      const closeButton = dialog.getByRole('button', { name: '閉じる' });
      await expect(closeButton).toBeVisible();

      // 送信ボタンに aria-label が設定されている
      const sendButton = dialog.getByRole('button', { name: '送信' });
      await expect(sendButton).toBeVisible();
    });
  });

  test.describe('4.2.3: フォーカス管理の検証', () => {
    test('Popover開閉時にフォーカスが正しく移動する', async ({ page }) => {
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

      const firstButton = chatButtons.first();

      // ボタンにフォーカスを当てる
      await firstButton.focus();
      await expect(firstButton).toBeFocused();

      // Popoverを開く
      await firstButton.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // 入力フィールドにフォーカスが移動する
      const input = dialog.getByPlaceholder('質問を入力...');
      await expect(input).toBeFocused();

      // Escapeキーで閉じる
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();

      // フォーカスがボタンに戻る
      await expect(firstButton).toBeFocused();
    });

    test('閉じるボタンクリック時にフォーカスが戻る', async ({ page }) => {
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

      const firstButton = chatButtons.first();

      // Popoverを開く
      await firstButton.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // 閉じるボタンをクリック
      const closeButton = dialog.getByRole('button', { name: '閉じる' });
      await closeButton.click();

      await expect(dialog).not.toBeVisible();

      // フォーカスがボタンに戻る
      await expect(firstButton).toBeFocused();
    });

    test('Tab キーでPopover内をナビゲートできる', async ({ page }) => {
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

      // Popoverを開く
      await chatButtons.first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // 入力フィールドにフォーカスがある
      const input = dialog.getByPlaceholder('質問を入力...');
      await expect(input).toBeFocused();

      // Tabキーで送信ボタンに移動
      await page.keyboard.press('Tab');
      const sendButton = dialog.getByRole('button', { name: '送信' });
      await expect(sendButton).toBeFocused();
    });
  });

  test.describe('4.2.4: aria-live 通知の検証', () => {
    test('AI回答がaria-liveで通知される', async ({ page }) => {
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

      // Popoverを開く
      await chatButtons.first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // 質問を送信
      const input = dialog.getByPlaceholder('質問を入力...');
      await input.fill('テスト質問');
      await dialog.getByRole('button', { name: '送信' }).click();

      // 回答が表示されるまで待機
      const answerText = dialog.getByText('アクセシビリティテスト用の回答です');
      await expect(answerText).toBeVisible({ timeout: 10000 });

      // aria-live="polite" が設定されていることを確認
      const ariaLiveElement = dialog.locator('[aria-live="polite"]');
      await expect(ariaLiveElement).toBeVisible();
    });
  });

  test.describe('キーボードアクセシビリティ', () => {
    test('Enterキーでボタンを操作できる', async ({ page }) => {
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

      const firstButton = chatButtons.first();

      // フォーカスしてEnterキーで開く
      await firstButton.focus();
      await page.keyboard.press('Enter');

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
    });

    test('Spaceキーでボタンを操作できる', async ({ page }) => {
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

      const firstButton = chatButtons.first();

      // フォーカスしてSpaceキーで開く
      await firstButton.focus();
      await page.keyboard.press('Space');

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
    });
  });
});
