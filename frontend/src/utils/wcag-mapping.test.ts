/**
 * WCAGマッピングユーティリティのユニットテスト
 * @requirement 2.5 - WCAGレベル表示
 * @task 5.2 - WCAGマッピングのユニットテストを作成する
 */
import { describe, it, expect } from 'vitest';
import {
  getWcagLevel,
  getWcagInfo,
  getAllWcagCriteria,
  type WcagLevel,
  type WcagCriterionInfo,
} from './wcag-mapping';

describe('wcag-mapping', () => {
  describe('getWcagLevel', () => {
    describe('Level A基準の判定', () => {
      const levelACriteria = [
        '1.1.1', // 非テキストコンテンツ
        '1.2.1', // 音声のみ及び映像のみ
        '1.2.2', // キャプション（収録済み）
        '1.2.3', // 音声解説、又はメディアに対する代替
        '1.3.1', // 情報及び関係性
        '1.3.2', // 意味のあるシーケンス
        '1.3.3', // 感覚的な特徴
        '1.4.1', // 色の使用
        '1.4.2', // 音声の制御
        '2.1.1', // キーボード
        '2.1.2', // キーボードトラップなし
        '2.1.4', // 文字キーのショートカット (WCAG 2.1)
        '2.2.1', // タイミング調整可能
        '2.2.2', // 一時停止、停止、非表示
        '2.3.1', // 3回の閃光、又は閾値以下
        '2.4.1', // ブロックスキップ
        '2.4.2', // ページタイトル
        '2.4.3', // フォーカス順序
        '2.4.4', // リンクの目的（コンテキスト内）
        '2.5.1', // ポインタジェスチャ (WCAG 2.1)
        '2.5.2', // ポインタキャンセル (WCAG 2.1)
        '2.5.3', // ラベルを含む名前 (WCAG 2.1)
        '2.5.4', // 動きによる起動 (WCAG 2.1)
        '3.1.1', // ページの言語
        '3.2.1', // フォーカス時
        '3.2.2', // 入力時
        '3.3.1', // エラーの特定
        '3.3.2', // ラベル又は説明
        '4.1.1', // 構文解析
        '4.1.2', // 名前、役割、値
      ];

      it.each(levelACriteria)('%s はLevel Aを返す', (criterion) => {
        expect(getWcagLevel(criterion)).toBe('A');
      });
    });

    describe('Level AA基準の判定', () => {
      const levelAACriteria = [
        '1.2.4', // キャプション（ライブ）
        '1.2.5', // 音声解説（収録済み）
        '1.3.4', // 表示の向き (WCAG 2.1)
        '1.3.5', // 入力目的の特定 (WCAG 2.1)
        '1.4.3', // コントラスト（最低限）
        '1.4.4', // テキストのサイズ変更
        '1.4.5', // 文字画像
        '1.4.10', // リフロー (WCAG 2.1)
        '1.4.11', // 非テキストのコントラスト (WCAG 2.1)
        '1.4.12', // テキストの間隔 (WCAG 2.1)
        '1.4.13', // ホバー又はフォーカスで表示されるコンテンツ (WCAG 2.1)
        '2.4.5', // 複数の手段
        '2.4.6', // 見出し及びラベル
        '2.4.7', // フォーカスの可視化
        '3.1.2', // 一部分の言語
        '3.2.3', // 一貫したナビゲーション
        '3.2.4', // 一貫した識別性
        '3.3.3', // エラー修正の提案
        '3.3.4', // エラー回避（法的、金融、データ）
        '4.1.3', // ステータスメッセージ (WCAG 2.1)
      ];

      it.each(levelAACriteria)('%s はLevel AAを返す', (criterion) => {
        expect(getWcagLevel(criterion)).toBe('AA');
      });
    });

    describe('Level AAA基準の判定', () => {
      const levelAAACriteria = [
        '1.2.6', // 手話（収録済み）
        '1.2.7', // 拡張音声解説（収録済み）
        '1.2.8', // メディアに対する代替（収録済み）
        '1.2.9', // 音声のみ（ライブ）
        '1.3.6', // 目的の特定 (WCAG 2.1)
        '1.4.6', // コントラスト（高度）
        '1.4.7', // 小さな背景音、又は背景音なし
        '1.4.8', // 視覚的提示
        '1.4.9', // 文字画像（例外なし）
        '2.1.3', // キーボード（例外なし）
        '2.2.3', // タイミング非依存
        '2.2.4', // 中断
        '2.2.5', // 再認証
        '2.2.6', // タイムアウト (WCAG 2.1)
        '2.3.2', // 3回の閃光
        '2.3.3', // インタラクションによるアニメーション (WCAG 2.1)
        '2.4.8', // 現在位置
        '2.4.9', // リンクの目的（リンクのみ）
        '2.4.10', // セクション見出し
        '2.5.5', // ターゲットのサイズ (WCAG 2.1)
        '2.5.6', // 入力メカニズムの共存 (WCAG 2.1)
        '3.1.3', // 一般的ではない用語
        '3.1.4', // 略語
        '3.1.5', // 読解レベル
        '3.1.6', // 発音
        '3.2.5', // 要求による変化
        '3.3.5', // ヘルプ
        '3.3.6', // エラー回避（すべて）
      ];

      it.each(levelAAACriteria)('%s はLevel AAAを返す', (criterion) => {
        expect(getWcagLevel(criterion)).toBe('AAA');
      });
    });

    describe('不明な基準の判定', () => {
      it('存在しない基準に対してはunknownを返す', () => {
        expect(getWcagLevel('9.9.9')).toBe('unknown');
      });

      it('空文字列に対してはunknownを返す', () => {
        expect(getWcagLevel('')).toBe('unknown');
      });

      it('不正なフォーマットに対してはunknownを返す', () => {
        expect(getWcagLevel('invalid')).toBe('unknown');
      });

      it('部分的な基準番号に対してはunknownを返す', () => {
        expect(getWcagLevel('1.1')).toBe('unknown');
      });
    });
  });

  describe('getWcagInfo', () => {
    it('存在する基準の情報を返す', () => {
      const info = getWcagInfo('1.1.1');
      expect(info).not.toBeNull();
      expect(info?.criterion).toBe('1.1.1');
      expect(info?.level).toBe('A');
      expect(info?.name).toBe('非テキストコンテンツ');
    });

    it('コントラスト基準の情報を返す', () => {
      const info = getWcagInfo('1.4.3');
      expect(info).not.toBeNull();
      expect(info?.criterion).toBe('1.4.3');
      expect(info?.level).toBe('AA');
      expect(info?.name).toBe('コントラスト（最低限）');
    });

    it('WCAG 2.1追加基準の情報を返す', () => {
      const info = getWcagInfo('1.3.4');
      expect(info).not.toBeNull();
      expect(info?.criterion).toBe('1.3.4');
      expect(info?.level).toBe('AA');
      expect(info?.name).toBe('表示の向き');
    });

    it('存在しない基準に対してはnullを返す', () => {
      expect(getWcagInfo('9.9.9')).toBeNull();
    });

    it('空文字列に対してはnullを返す', () => {
      expect(getWcagInfo('')).toBeNull();
    });
  });

  describe('getAllWcagCriteria', () => {
    it('78件の基準を返す', () => {
      const criteria = getAllWcagCriteria();
      expect(criteria.length).toBe(78);
    });

    it('Level Aの基準が30件ある', () => {
      const criteria = getAllWcagCriteria();
      const levelA = criteria.filter((c) => c.level === 'A');
      expect(levelA.length).toBe(30);
    });

    it('Level AAの基準が20件ある', () => {
      const criteria = getAllWcagCriteria();
      const levelAA = criteria.filter((c) => c.level === 'AA');
      expect(levelAA.length).toBe(20);
    });

    it('Level AAAの基準が28件ある', () => {
      const criteria = getAllWcagCriteria();
      const levelAAA = criteria.filter((c) => c.level === 'AAA');
      expect(levelAAA.length).toBe(28);
    });

    it('全ての基準がcriterion、level、nameを持つ', () => {
      const criteria = getAllWcagCriteria();
      for (const c of criteria) {
        expect(c.criterion).toBeDefined();
        expect(c.criterion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(['A', 'AA', 'AAA']).toContain(c.level);
        expect(c.name).toBeDefined();
        expect(c.name.length).toBeGreaterThan(0);
      }
    });
  });
});
