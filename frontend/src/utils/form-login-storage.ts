/**
 * フォームログイン設定のlocalStorage管理ユーティリティ
 *
 * ログインURL、セレクタ、認証情報を保存・読み込み・削除する
 */

/** 保存キーのプレフィックス */
const STORAGE_KEY_PREFIX = 'a11y_form_login_';
/** インデックスキー */
const INDEX_KEY = 'a11y_form_login_index';

/**
 * フォームログイン設定
 */
export interface FormLoginConfig {
  /** 設定名（一意識別子） */
  name: string;
  /** ログインページURL */
  loginUrl: string;
  /** ユーザー名フィールドのセレクタ */
  usernameSelector: string;
  /** パスワードフィールドのセレクタ */
  passwordSelector: string;
  /** 送信ボタンのセレクタ */
  submitSelector: string;
  /** ユーザー名 */
  username: string;
  /** パスワード */
  password: string;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
}

/**
 * 設定の概要（パスワードを含まない）
 */
export interface FormLoginConfigSummary {
  name: string;
  loginUrl: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 保存済み設定の一覧を取得
 */
export function listFormLoginConfigs(): FormLoginConfigSummary[] {
  try {
    const indexJson = localStorage.getItem(INDEX_KEY);
    if (!indexJson) {
      return [];
    }

    const names: string[] = JSON.parse(indexJson);
    const summaries: FormLoginConfigSummary[] = [];

    for (const name of names) {
      const config = loadFormLoginConfig(name);
      if (config) {
        summaries.push({
          name: config.name,
          loginUrl: config.loginUrl,
          username: config.username,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        });
      }
    }

    // 更新日時の降順でソート
    return summaries.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    console.error('[FormLoginStorage] 一覧取得エラー:', error);
    return [];
  }
}

/**
 * 設定を保存
 * @param config 保存する設定
 * @returns 成功した場合true
 */
export function saveFormLoginConfig(config: Omit<FormLoginConfig, 'createdAt' | 'updatedAt'>): boolean {
  try {
    const now = new Date().toISOString();
    const existing = loadFormLoginConfig(config.name);

    const fullConfig: FormLoginConfig = {
      ...config,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    // 設定を保存
    const key = `${STORAGE_KEY_PREFIX}${config.name}`;
    localStorage.setItem(key, JSON.stringify(fullConfig));

    // インデックスを更新
    updateIndex(config.name, 'add');

    console.log('[FormLoginStorage] 設定を保存:', config.name);
    return true;
  } catch (error) {
    console.error('[FormLoginStorage] 保存エラー:', error);
    return false;
  }
}

/**
 * 設定を読み込み
 * @param name 設定名
 * @returns 設定（存在しない場合はnull）
 */
export function loadFormLoginConfig(name: string): FormLoginConfig | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${name}`;
    const json = localStorage.getItem(key);

    if (!json) {
      return null;
    }

    return JSON.parse(json) as FormLoginConfig;
  } catch (error) {
    console.error('[FormLoginStorage] 読み込みエラー:', error);
    return null;
  }
}

/**
 * 設定を削除
 * @param name 設定名
 * @returns 成功した場合true
 */
export function deleteFormLoginConfig(name: string): boolean {
  try {
    const key = `${STORAGE_KEY_PREFIX}${name}`;
    localStorage.removeItem(key);

    // インデックスを更新
    updateIndex(name, 'remove');

    console.log('[FormLoginStorage] 設定を削除:', name);
    return true;
  } catch (error) {
    console.error('[FormLoginStorage] 削除エラー:', error);
    return false;
  }
}

/**
 * 設定名が既に存在するか確認
 * @param name 設定名
 * @returns 存在する場合true
 */
export function existsFormLoginConfig(name: string): boolean {
  const key = `${STORAGE_KEY_PREFIX}${name}`;
  return localStorage.getItem(key) !== null;
}

/**
 * インデックスを更新（内部関数）
 */
function updateIndex(name: string, action: 'add' | 'remove'): void {
  try {
    const indexJson = localStorage.getItem(INDEX_KEY);
    let names: string[] = indexJson ? JSON.parse(indexJson) : [];

    if (action === 'add') {
      if (!names.includes(name)) {
        names.push(name);
      }
    } else {
      names = names.filter(n => n !== name);
    }

    localStorage.setItem(INDEX_KEY, JSON.stringify(names));
  } catch (error) {
    console.error('[FormLoginStorage] インデックス更新エラー:', error);
  }
}

/**
 * すべての設定を削除
 * @returns 成功した場合true
 */
export function clearAllFormLoginConfigs(): boolean {
  try {
    const indexJson = localStorage.getItem(INDEX_KEY);
    if (indexJson) {
      const names: string[] = JSON.parse(indexJson);
      for (const name of names) {
        const key = `${STORAGE_KEY_PREFIX}${name}`;
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem(INDEX_KEY);

    console.log('[FormLoginStorage] すべての設定を削除');
    return true;
  } catch (error) {
    console.error('[FormLoginStorage] 全削除エラー:', error);
    return false;
  }
}
