/**
 * FormAnalyzerService
 * ログインページのフォーム要素を自動検出するサービス
 *
 * Task 1.2: フォーム要素検出ロジック
 * Task 1.3: エラーハンドリング
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 5.3, 5.4
 */

import { chromium, type Browser, type Page } from 'playwright';
import type {
  FormAnalysisResult,
  FormFieldCandidate,
  AnalyzeOptions,
  AnalyzeError,
  Result,
} from './types';

/** デフォルトのタイムアウト（30秒） */
const DEFAULT_TIMEOUT = 30000;

/** 最大候補数 */
const MAX_CANDIDATES = 5;

/**
 * ユーザー名フィールド検出用のセレクタパターン
 * 優先度順に定義
 */
const USERNAME_SELECTORS = [
  'input[type="email"]',
  'input[name*="email" i]',
  'input[id*="email" i]',
  'input[name*="user" i]',
  'input[id*="user" i]',
  'input[name*="login" i]',
  'input[id*="login" i]',
  'input[name*="account" i]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
];

/**
 * パスワードフィールド検出用のセレクタ
 */
const PASSWORD_SELECTOR = 'input[type="password"]';

/**
 * 送信ボタン検出用のセレクタパターン
 * 優先度順に定義
 */
const SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button:has-text("ログイン")',
  'button:has-text("Login")',
  'button:has-text("Sign in")',
  'button:has-text("サインイン")',
  '[role="button"]:has-text("ログイン")',
  '[role="button"]:has-text("Login")',
];

/**
 * フォーム解析サービス
 * Playwrightを使用してログインページのフォーム要素を検出する
 */
export class FormAnalyzerService {
  /**
   * ブラウザを起動する（テスト時にモック可能）
   */
  protected async launchBrowser(): Promise<Browser> {
    return chromium.launch({ headless: true });
  }

  /**
   * ログインフォームを解析し、フォーム要素を検出する
   * @param url 解析対象のログインページURL
   * @param options 解析オプション
   * @returns 解析結果（成功時はFormAnalysisResult、失敗時はAnalyzeError）
   */
  async analyzeLoginForm(
    url: string,
    options?: AnalyzeOptions
  ): Promise<Result<FormAnalysisResult, AnalyzeError>> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    let browser: Browser | null = null;

    try {
      browser = await this.launchBrowser();
      const context = await browser.newContext();
      const page = await context.newPage();

      // ページにアクセス
      try {
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // タイムアウトエラーの判定
        if (message.toLowerCase().includes('timeout')) {
          return {
            success: false,
            error: {
              type: 'timeout',
              message: `ページの読み込みがタイムアウトしました: ${url}`,
            },
          };
        }

        // ナビゲーション失敗
        return {
          success: false,
          error: {
            type: 'navigation_failed',
            message: `ページへのアクセスに失敗しました: ${message}`,
          },
        };
      }

      // フォーム要素を検出
      console.log('[FormAnalyzer] フォーム要素検出開始');
      const [usernameFields, passwordFields, submitButtons] = await Promise.all([
        this.detectUsernameFields(page),
        this.detectPasswordFields(page),
        this.detectSubmitButtons(page),
      ]);
      console.log('[FormAnalyzer] 検出結果:', {
        usernameFields: usernameFields.map(f => ({ selector: f.selector, label: f.label })),
        passwordFields: passwordFields.map(f => ({ selector: f.selector, label: f.label })),
        submitButtons: submitButtons.map(f => ({ selector: f.selector, label: f.label })),
      });

      // パスワードフィールドが見つからない場合はエラー
      if (passwordFields.length === 0) {
        return {
          success: false,
          error: {
            type: 'no_form_found',
            message: 'ログインフォームが見つかりませんでした。パスワードフィールドを検出できませんでした。',
          },
        };
      }

      // 全体の信頼度を算出
      const confidence = this.calculateOverallConfidence(
        usernameFields,
        passwordFields,
        submitButtons
      );

      return {
        success: true,
        value: {
          usernameFields: this.sortByConfidence(usernameFields).slice(0, MAX_CANDIDATES),
          passwordFields: this.sortByConfidence(passwordFields).slice(0, MAX_CANDIDATES),
          submitButtons: this.sortByConfidence(submitButtons).slice(0, MAX_CANDIDATES),
          confidence,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: {
          type: 'navigation_failed',
          message: `解析中にエラーが発生しました: ${message}`,
        },
      };
    } finally {
      // ブラウザを確実にクローズ
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * ユーザー名フィールドを検出
   */
  private async detectUsernameFields(page: Page): Promise<FormFieldCandidate[]> {
    const candidates: FormFieldCandidate[] = [];
    const processedIds = new Set<string>();

    for (const selector of USERNAME_SELECTORS) {
      try {
        const locator = page.locator(selector);
        const count = await locator.count();

        for (let i = 0; i < count && candidates.length < MAX_CANDIDATES; i++) {
          const element = locator.nth(i);
          const candidate = await this.extractFieldInfo(element, 'username');

          // 重複排除（IDまたはセレクタで判定）
          const uniqueKey = candidate.id || candidate.selector;
          if (!processedIds.has(uniqueKey)) {
            processedIds.add(uniqueKey);
            candidates.push(candidate);
          }
        }
      } catch {
        // セレクタが無効な場合はスキップ
        continue;
      }
    }

    return candidates;
  }

  /**
   * パスワードフィールドを検出
   */
  private async detectPasswordFields(page: Page): Promise<FormFieldCandidate[]> {
    const candidates: FormFieldCandidate[] = [];

    try {
      const locator = page.locator(PASSWORD_SELECTOR);
      const count = await locator.count();

      for (let i = 0; i < count && candidates.length < MAX_CANDIDATES; i++) {
        const element = locator.nth(i);
        const candidate = await this.extractFieldInfo(element, 'password');
        candidates.push(candidate);
      }
    } catch {
      // エラーは無視
    }

    return candidates;
  }

  /**
   * 送信ボタンを検出
   */
  private async detectSubmitButtons(page: Page): Promise<FormFieldCandidate[]> {
    const candidates: FormFieldCandidate[] = [];
    const processedIds = new Set<string>();

    for (const selector of SUBMIT_SELECTORS) {
      try {
        const locator = page.locator(selector);
        const count = await locator.count();

        for (let i = 0; i < count && candidates.length < MAX_CANDIDATES; i++) {
          const element = locator.nth(i);
          const candidate = await this.extractButtonInfo(element);

          const uniqueKey = candidate.id || candidate.selector;
          if (!processedIds.has(uniqueKey)) {
            processedIds.add(uniqueKey);
            candidates.push(candidate);
          }
        }
      } catch {
        continue;
      }
    }

    return candidates;
  }

  /**
   * フィールド情報を抽出
   */
  private async extractFieldInfo(
    element: ReturnType<Page['locator']>,
    fieldType: 'username' | 'password'
  ): Promise<FormFieldCandidate> {
    const [name, id, type, placeholder] = await Promise.all([
      element.getAttribute('name'),
      element.getAttribute('id'),
      element.getAttribute('type'),
      element.getAttribute('placeholder'),
    ]);

    // ラベル要素を取得
    let label: string | null = null;
    try {
      label = await element.evaluate((el: HTMLInputElement) => {
        // 1. for属性でラベルを探す
        if (el.id) {
          const labelEl = document.querySelector(`label[for="${el.id}"]`);
          if (labelEl) return labelEl.textContent?.trim() || null;
        }

        // 2. 親要素のlabelを探す
        const parentLabel = el.closest('label');
        if (parentLabel) {
          return parentLabel.textContent?.trim() || null;
        }

        // 3. aria-labelを探す
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        return null;
      });
    } catch {
      // エラーは無視
    }

    // セレクタを生成
    const selector = this.generateSelector(id, name, type || fieldType);

    // 信頼度を算出
    const confidence = this.calculateFieldConfidence({
      hasId: !!id,
      hasName: !!name,
      hasLabel: !!label,
      hasPlaceholder: !!placeholder,
      fieldType,
    });

    return {
      selector,
      label,
      placeholder,
      name,
      id,
      type: type || fieldType,
      confidence,
    };
  }

  /**
   * ボタン情報を抽出
   */
  private async extractButtonInfo(
    element: ReturnType<Page['locator']>
  ): Promise<FormFieldCandidate> {
    const [name, id, type, tagName] = await Promise.all([
      element.getAttribute('name'),
      element.getAttribute('id'),
      element.getAttribute('type'),
      element.evaluate((el) => el.tagName.toLowerCase()),
    ]);

    let label: string | null = null;
    try {
      label = await element.textContent();
      if (label) label = label.trim();
    } catch {
      // エラーは無視
    }

    const selector = this.generateButtonSelector(id, name, label, tagName);

    const confidence = this.calculateFieldConfidence({
      hasId: !!id,
      hasName: !!name,
      hasLabel: !!label,
      hasPlaceholder: false,
      fieldType: 'submit',
    });

    return {
      selector,
      label,
      placeholder: null,
      name,
      id,
      type: type || 'submit',
      confidence,
    };
  }

  /**
   * CSSセレクタを生成（入力フィールド用）
   * 優先順位: id > name > type
   */
  private generateSelector(
    id: string | null,
    name: string | null,
    type: string
  ): string {
    if (id) {
      return `#${id}`;
    }
    if (name) {
      return `input[name="${name}"]`;
    }
    return `input[type="${type}"]`;
  }

  /**
   * ボタン用のCSSセレクタを生成
   * 優先順位: id > name > テキスト（:has-text）> タグ+type
   */
  private generateButtonSelector(
    id: string | null,
    name: string | null,
    label: string | null,
    tagName: string
  ): string {
    if (id) {
      return `#${id}`;
    }
    if (name) {
      return `${tagName}[name="${name}"]`;
    }
    // ラベル（テキスト）がある場合は :has-text を使用
    if (label) {
      return `${tagName}:has-text("${label}")`;
    }
    // フォールバック: タグ + type
    if (tagName === 'button') {
      return 'button[type="submit"]';
    }
    return 'input[type="submit"]';
  }

  /**
   * フィールドの信頼度を算出
   */
  private calculateFieldConfidence(params: {
    hasId: boolean;
    hasName: boolean;
    hasLabel: boolean;
    hasPlaceholder: boolean;
    fieldType: string;
  }): number {
    let score = 0.5; // 基本スコア

    // ID/Nameがある場合はスコアアップ
    if (params.hasId) score += 0.2;
    if (params.hasName) score += 0.15;
    if (params.hasLabel) score += 0.1;
    if (params.hasPlaceholder) score += 0.05;

    // パスワードフィールドは高信頼
    if (params.fieldType === 'password') score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * 全体の信頼度を算出
   */
  private calculateOverallConfidence(
    usernameFields: FormFieldCandidate[],
    passwordFields: FormFieldCandidate[],
    submitButtons: FormFieldCandidate[]
  ): 'high' | 'medium' | 'low' {
    const hasUsername = usernameFields.length > 0;
    const hasPassword = passwordFields.length > 0;
    const hasSubmit = submitButtons.length > 0;

    // 全要素がそろっている
    if (hasUsername && hasPassword && hasSubmit) {
      return 'high';
    }

    // パスワードと、ユーザー名または送信ボタンがある
    if (hasPassword && (hasUsername || hasSubmit)) {
      return 'medium';
    }

    // パスワードのみ
    return 'low';
  }

  /**
   * 信頼度順にソート（降順）
   */
  private sortByConfidence(candidates: FormFieldCandidate[]): FormFieldCandidate[] {
    return [...candidates].sort((a, b) => b.confidence - a.confidence);
  }
}

/** シングルトンインスタンス */
export const formAnalyzerService = new FormAnalyzerService();
