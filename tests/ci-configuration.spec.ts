import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

test.describe('CI/CD設定検証', () => {
  const projectRoot = process.cwd();

  test.describe('Task 3.1: アクセシビリティテストのWCAG準拠設定', () => {
    const accessibilityTestPath = path.join(projectRoot, 'tests', 'accessibility.spec.ts');
    let testContent: string;

    test.beforeAll(() => {
      testContent = fs.readFileSync(accessibilityTestPath, 'utf-8');
    });

    test('accessibility.spec.tsが存在すること', () => {
      expect(fs.existsSync(accessibilityTestPath)).toBe(true);
    });

    test('WCAG 2.0/2.1 Level A/AAタグを使用していること', () => {
      // Required WCAG tags
      const requiredTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

      for (const tag of requiredTags) {
        expect(testContent).toContain(tag);
      }
    });

    test('axe-coreを使用していること', () => {
      expect(testContent).toContain('@axe-core/playwright');
      expect(testContent).toContain('AxeBuilder');
    });

    test('違反検出時に詳細情報を出力していること', () => {
      // 違反ID、説明、影響度、ヘルプURLが出力されることを確認
      expect(testContent).toContain('violation.id');
      expect(testContent).toContain('violation.description');
      expect(testContent).toContain('violation.impact');
      expect(testContent).toContain('violation.helpUrl');
    });

    test('複数ページを対象としていること', () => {
      // TEST_PAGES配列に複数のページが定義されていることを確認
      expect(testContent).toContain('TEST_PAGES');

      // 少なくとも2つ以上のページURLが含まれていること
      const urlMatches = testContent.match(/url:\s*['"]https?:\/\/[^'"]+['"]/g);
      expect(urlMatches).not.toBeNull();
      expect(urlMatches!.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Task 3.2: GitHub Actionsワークフロー設定', () => {
    const workflowPath = path.join(projectRoot, '.github', 'workflows', 'playwright.yml');
    let workflowContent: string;
    let workflowConfig: any;

    test.beforeAll(() => {
      workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      workflowConfig = yaml.parse(workflowContent);
    });

    test('playwright.ymlが存在すること', () => {
      expect(fs.existsSync(workflowPath)).toBe(true);
    });

    test('PR作成・更新時にトリガーされること', () => {
      expect(workflowConfig.on).toHaveProperty('pull_request');
      expect(workflowConfig.on.pull_request.branches).toContain('main');
    });

    test('main/masterへのpush時にトリガーされること', () => {
      expect(workflowConfig.on).toHaveProperty('push');
      const pushBranches = workflowConfig.on.push.branches;
      expect(pushBranches.includes('main') || pushBranches.includes('master')).toBe(true);
    });

    test('npm ciでインストールすること', () => {
      const steps = workflowConfig.jobs.test.steps;
      const installStep = steps.find((step: any) => step.run && step.run.includes('npm ci'));
      expect(installStep).toBeDefined();
    });

    test('Playwrightテストを実行すること', () => {
      const steps = workflowConfig.jobs.test.steps;
      const testStep = steps.find((step: any) => step.run && step.run.includes('playwright test'));
      expect(testStep).toBeDefined();
    });

    test('テストレポートがアーティファクトとして30日間保持されること', () => {
      const steps = workflowConfig.jobs.test.steps;
      const artifactStep = steps.find((step: any) =>
        step.uses && step.uses.includes('upload-artifact')
      );
      expect(artifactStep).toBeDefined();
      expect(artifactStep.with['retention-days']).toBe(30);
      expect(artifactStep.with.path).toContain('playwright-report');
    });

    test('テスト失敗時にもアーティファクトがアップロードされること', () => {
      const steps = workflowConfig.jobs.test.steps;
      const artifactStep = steps.find((step: any) =>
        step.uses && step.uses.includes('upload-artifact')
      );
      expect(artifactStep).toBeDefined();
      // !cancelled() でキャンセル以外は常にアップロード
      expect(artifactStep.if).toContain('!cancelled()');
    });
  });
});
