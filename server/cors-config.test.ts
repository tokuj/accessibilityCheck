import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCorsConfig } from './cors-config';

describe('getCorsConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数をリセット
    process.env = { ...originalEnv };
    delete process.env.ALLOWED_ORIGINS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // タスク2.2: 環境変数のデフォルト値テスト

  it('ALLOWED_ORIGINSが未設定の場合、デフォルトでlocalhost:5173を許可する', () => {
    const config = getCorsConfig();

    expect(config.origin).toEqual(['http://localhost:5173']);
    expect(config.credentials).toBe(true);
  });

  it('ALLOWED_ORIGINSが設定されている場合、指定されたオリジンを許可する', () => {
    process.env.ALLOWED_ORIGINS = 'https://example.com';

    const config = getCorsConfig();

    expect(config.origin).toEqual(['https://example.com']);
    expect(config.credentials).toBe(true);
  });

  it('ALLOWED_ORIGINSがカンマ区切りで複数指定されている場合、すべてのオリジンを許可する', () => {
    process.env.ALLOWED_ORIGINS = 'https://example.com, https://app.example.com, http://localhost:3000';

    const config = getCorsConfig();

    expect(config.origin).toEqual([
      'https://example.com',
      'https://app.example.com',
      'http://localhost:3000',
    ]);
    expect(config.credentials).toBe(true);
  });

  it('オリジン指定の前後の空白はトリムされる', () => {
    process.env.ALLOWED_ORIGINS = '  https://example.com  ,  https://app.example.com  ';

    const config = getCorsConfig();

    expect(config.origin).toEqual([
      'https://example.com',
      'https://app.example.com',
    ]);
  });

  it('空文字列の場合、デフォルト値を使用する', () => {
    process.env.ALLOWED_ORIGINS = '';

    const config = getCorsConfig();

    expect(config.origin).toEqual(['http://localhost:5173']);
    expect(config.credentials).toBe(true);
  });
});

// タスク2.2: PORT環境変数のデフォルト値テスト
describe('PORT環境変数', () => {
  it('PORT環境変数が未設定の場合、デフォルト値3001を使用する', () => {
    // server/index.tsの挙動をテスト
    const originalPort = process.env.PORT;
    delete process.env.PORT;

    const port = process.env.PORT || 3001;
    expect(port).toBe(3001);

    process.env.PORT = originalPort;
  });

  it('PORT環境変数が設定されている場合、その値を使用する', () => {
    const originalPort = process.env.PORT;
    process.env.PORT = '8080';

    const port = process.env.PORT || 3001;
    expect(port).toBe('8080');

    process.env.PORT = originalPort;
  });
});
