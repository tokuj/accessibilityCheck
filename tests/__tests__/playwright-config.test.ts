/**
 * playwright.config.ts のテスト
 *
 * Requirements: 6.1, 6.2
 * - グローバルテストタイムアウトが180秒に設定されていること
 * - アクションタイムアウトが90秒に設定されていること
 */

import { describe, it, expect } from 'vitest';
import config from '../../playwright.config';

describe('playwright.config.ts タイムアウト設定', () => {
  describe('Requirement 6.1: グローバルテストタイムアウト', () => {
    it('グローバルテストタイムアウトが180秒（180000ms）に設定されていること', () => {
      expect(config.timeout).toBe(180000);
    });
  });

  describe('Requirement 6.2: アクションタイムアウト', () => {
    it('アクションタイムアウトが90秒（90000ms）に設定されていること', () => {
      expect(config.use?.actionTimeout).toBe(90000);
    });
  });
});
