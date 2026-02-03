import { useState, useMemo, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import LinkIcon from '@mui/icons-material/Link';
import BuildIcon from '@mui/icons-material/Build';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import { ScoreCard } from './ScoreCard';
import { ImprovementList } from './ImprovementList';
import { ViolationsTable } from './ViolationsTable';
import { PassesTable } from './PassesTable';
import { IncompleteTable } from './IncompleteTable';
import { LighthouseScores } from './LighthouseScores';
import { PageTabs } from './PageTabs';
import { SemiAutoCheckPanel } from './SemiAutoCheckPanel';
import { WCAGCoverageMatrix } from './WCAGCoverageMatrix';
import { EngineSummaryPanel } from './EngineSummaryPanel';
import { WaveStructurePanel } from './WaveStructurePanel';
import type { AccessibilityReport, RuleResult } from '../types/accessibility';
import type { SemiAutoItem, SemiAutoAnswer, SemiAutoProgress } from '../types/semi-auto-check';
import { calculateScores, calculatePageScores } from '../utils/scoreCalculator';
import { exportAllResultsToCsv, type ResultWithPage } from '../utils/csvExport';
import { exportReportToPdf, generatePdfFileName } from '../utils/pdfExport';

interface ReportSummaryProps {
  report: AccessibilityReport;
  url: string;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`detail-tabpanel-${index}`}
      aria-labelledby={`detail-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export function ReportSummary({ report, url, onClose }: ReportSummaryProps) {
  const [tabValue, setTabValue] = useState(0);
  // アクティブなページインデックス（複数ページタブ用、Task 9.1）
  const [activePageIndex, setActivePageIndex] = useState(0);
  // WCAGフィルタ状態（Task 11.2）
  const [wcagFilter, setWcagFilter] = useState<string | null>(null);

  // PDF生成用のref（Task 5.1）
  const pdfTargetRef = useRef<HTMLDivElement>(null);

  // 半自動チェック用の状態（Task 16.3）
  // @requirement wcag-coverage-expansion 5.1, 5.2, 5.3, 5.5, 5.6, 16.3
  const [semiAutoItems, setSemiAutoItems] = useState<SemiAutoItem[]>(() => {
    // レポートから半自動チェック項目を初期化
    const items = report.semiAutoItems || report.pages[0]?.semiAutoItems || [];
    return items;
  });
  const [currentSemiAutoIndex, setCurrentSemiAutoIndex] = useState(0);
  const [semiAutoComplete, setSemiAutoComplete] = useState(false);

  // PDF生成状態（Task 5.3）
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Snackbar状態（Task 5.4）
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
    showRetry: boolean;
  }>({
    open: false,
    message: '',
    severity: 'success',
    showRetry: false,
  });

  // 複数ページかどうかを判定
  const isMultiPage = report.pages.length > 1;

  // 現在アクティブなページ（複数ページ時は選択されたページ、単一ページ時は最初のページ）
  const activePage = report.pages[activePageIndex] || report.pages[0];

  // スコア計算（複数ページ時はアクティブページ、単一ページ時はレポート全体）
  const scores = useMemo(() => {
    if (isMultiPage) {
      return calculatePageScores(activePage);
    }
    return calculateScores(report);
  }, [isMultiPage, activePage, report]);

  // Collect all violations
  const allViolations: RuleResult[] = report.pages.flatMap((page) => page.violations);

  // 表示用URL（複数ページ時はアクティブページのURL、単一ページ時はpropsのurl）
  const currentUrl = isMultiPage ? activePage.url : url;
  // Truncate URL for display
  const displayUrl = currentUrl.length > 50 ? currentUrl.substring(0, 50) + '...' : currentUrl;

  // PageTabs用のページ情報を生成（総合スコアを計算）
  const pageTabsData = report.pages.map((page) => {
    const pageScores = calculatePageScores(page);
    return {
      title: page.name,
      url: page.url,
      violationCount: page.violations.length,
      // 総合スコアを表示（Lighthouseスコアではなく、違反/パス比率から計算）
      accessibilityScore: pageScores.totalScore,
    };
  });

  // 現在のスクリーンショット（複数ページ時はアクティブページのもの、フォールバック付き）
  const currentScreenshot = isMultiPage
    ? activePage.screenshot || report.screenshot
    : report.screenshot;

  // 半自動チェックの進捗状況を計算（Task 16.3）
  // @requirement wcag-coverage-expansion 5.6
  const semiAutoProgress: SemiAutoProgress = useMemo(() => {
    const completed = semiAutoItems.filter(item => item.answer !== undefined).length;
    return { completed, total: semiAutoItems.length };
  }, [semiAutoItems]);

  // 半自動チェック回答ハンドラー（Task 16.3）
  // @requirement wcag-coverage-expansion 5.3
  const handleSemiAutoAnswer = useCallback((itemId: string, answer: SemiAutoAnswer) => {
    setSemiAutoItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, answer, answeredAt: new Date().toISOString() }
          : item
      )
    );

    // 次の未回答項目に移動
    const nextIndex = semiAutoItems.findIndex(
      (item, index) => index > currentSemiAutoIndex && !item.answer
    );

    if (nextIndex !== -1) {
      setCurrentSemiAutoIndex(nextIndex);
    } else {
      // 未回答項目がなければ完了チェック
      const allAnswered = semiAutoItems.every(
        (item, index) => index === semiAutoItems.findIndex(i => i.id === itemId) || item.answer
      );
      if (allAnswered) {
        setSemiAutoComplete(true);
      }
    }
  }, [semiAutoItems, currentSemiAutoIndex]);

  // 半自動チェックスキップハンドラー（Task 16.3）
  // @requirement wcag-coverage-expansion 5.5
  const handleSemiAutoSkip = useCallback((_itemId: string) => {
    // 次の項目に移動（回答済みも未回答も含む）
    const nextIndex = (currentSemiAutoIndex + 1) % semiAutoItems.length;
    setCurrentSemiAutoIndex(nextIndex);
  }, [currentSemiAutoIndex, semiAutoItems.length]);

  // 半自動チェック完了ハンドラー（Task 16.3）
  const handleSemiAutoComplete = useCallback(() => {
    // 完了時の処理（将来的にはAPI送信など）
    console.log('半自動チェック完了:', semiAutoItems.filter(item => item.answer));
    setSemiAutoComplete(true);
  }, [semiAutoItems]);

  // 詳細タブ用のカウント（複数ページ時はアクティブページ、単一ページ時は全体サマリー）
  const detailCounts = isMultiPage
    ? {
        violations: activePage.violations.length,
        passes: activePage.passes.length,
        incomplete: activePage.incomplete.length,
      }
    : {
        violations: report.summary.totalViolations,
        passes: report.summary.totalPasses,
        incomplete: report.summary.totalIncomplete,
      };

  // CSV出力用に全結果を収集
  const handleDownloadCsv = () => {
    const allResults: ResultWithPage[] = [];

    // 違反を追加
    report.pages.forEach((page) => {
      page.violations.forEach((v) => {
        allResults.push({
          resultType: '違反',
          toolSource: v.toolSource || 'axe-core',
          pageName: page.name,
          pageUrl: page.url,
          id: v.id,
          description: v.description,
          impact: v.impact,
          nodeCount: v.nodeCount,
          wcagCriteria: v.wcagCriteria,
          helpUrl: v.helpUrl,
        });
      });
    });

    // パスを追加
    report.pages.forEach((page) => {
      page.passes.forEach((p) => {
        allResults.push({
          resultType: 'パス',
          toolSource: p.toolSource || 'axe-core',
          pageName: page.name,
          pageUrl: page.url,
          id: p.id,
          description: p.description,
          impact: p.impact,
          nodeCount: p.nodeCount,
          wcagCriteria: p.wcagCriteria,
          helpUrl: p.helpUrl,
        });
      });
    });

    // 要確認を追加
    report.pages.forEach((page) => {
      page.incomplete.forEach((i) => {
        allResults.push({
          resultType: '要確認',
          toolSource: i.toolSource || 'axe-core',
          pageName: page.name,
          pageUrl: page.url,
          id: i.id,
          description: i.description,
          impact: i.impact,
          nodeCount: i.nodeCount,
          wcagCriteria: i.wcagCriteria,
          helpUrl: i.helpUrl,
        });
      });
    });

    exportAllResultsToCsv(allResults, url);
  };

  // PDF出力ハンドラ（Task 5.2）
  const handleDownloadPdf = async () => {
    if (isPdfGenerating || !pdfTargetRef.current) {
      return;
    }

    setIsPdfGenerating(true);
    setSnackbar({ open: false, message: '', severity: 'success', showRetry: false });

    try {
      const filename = generatePdfFileName(url);
      const result = await exportReportToPdf(pdfTargetRef.current, { filename });

      if (result.success) {
        setSnackbar({
          open: true,
          message: 'PDFファイルのダウンロードを開始しました',
          severity: 'success',
          showRetry: false,
        });
      } else {
        setSnackbar({
          open: true,
          message: result.error || 'PDF生成中にエラーが発生しました',
          severity: 'error',
          showRetry: true,
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'PDF生成中にエラーが発生しました',
        severity: 'error',
        showRetry: true,
      });
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // Snackbarを閉じる
  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Card sx={{ maxWidth: 1400, mx: 'auto', mb: 4 }}>
      <CardContent sx={{ p: 4 }}>
        {/* ページタブ（複数ページ時のみ表示、Task 9.1） */}
        {isMultiPage && (
          <Box sx={{ mb: 3 }}>
            <PageTabs
              pages={pageTabsData}
              activeIndex={activePageIndex}
              onChange={setActivePageIndex}
            />
          </Box>
        )}

        {/* Header with URL and close button */}
        <Box data-testid="report-header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              bgcolor: 'grey.100',
              borderRadius: 2,
              maxWidth: '70%',
            }}
          >
            <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayUrl}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              aria-label="PDFダウンロード"
              startIcon={isPdfGenerating ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating}
            >
              PDFダウンロード
            </Button>
            <Button
              variant="text"
              color="primary"
              onClick={onClose}
              sx={{ fontWeight: 500 }}
            >
              閉じる
            </Button>
          </Box>
        </Box>

        {/* PDF対象領域（Task 5.1） */}
        <Box data-testid="pdf-target-area" ref={pdfTargetRef}>
          {/* Screenshot */}
          {currentScreenshot && (
            <Box sx={{ mb: 3, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <img
                src={currentScreenshot}
                alt="ページスクリーンショット"
                style={{ width: '100%', display: 'block' }}
              />
            </Box>
          )}

        {/* Tools Used */}
        {report.toolsUsed && report.toolsUsed.length > 0 && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'info.lighter', borderRadius: 2, border: '1px solid', borderColor: 'info.light' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <BuildIcon sx={{ fontSize: 18, color: 'info.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                分析ツール
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {report.toolsUsed.map((tool) => (
                <Chip
                  key={tool.name}
                  label={`${tool.name} v${tool.version}`}
                  size="small"
                  variant="outlined"
                  color={
                    tool.name === 'pa11y' ? 'secondary' :
                    tool.name === 'lighthouse' ? 'warning' : 'default'
                  }
                />
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                合計実行時間: {(report.toolsUsed.reduce((sum, t) => sum + t.duration, 0) / 1000).toFixed(1)}秒
              </Typography>
            </Box>
          </Box>
        )}

        {/* Score Card */}
        <ScoreCard
          totalScore={scores.totalScore}
          categories={scores.categories}
          passCount={isMultiPage ? activePage.passes.length : report.summary.totalPasses}
          violationCount={isMultiPage ? activePage.violations.length : report.summary.totalViolations}
        />

        {/* Lighthouse Scores（複数ページ時はアクティブページのスコア） */}
        {(isMultiPage ? activePage.lighthouseScores : report.lighthouseScores) && (
          <Box sx={{ mt: 3 }}>
            <LighthouseScores scores={(isMultiPage ? activePage.lighthouseScores : report.lighthouseScores)!} />
          </Box>
        )}

        {/* Divider */}
        <Box sx={{ my: 4, borderBottom: 1, borderColor: 'divider' }} />

        {/* Improvement List（複数ページ時はアクティブページのデータ） */}
        <ImprovementList
          violations={isMultiPage ? activePage.violations : allViolations}
          aiSummary={isMultiPage ? activePage.aiSummary : report.aiSummary}
          targetUrl={currentUrl}
          onWcagFilter={setWcagFilter}
        />

        {/* Divider */}
        <Box sx={{ my: 4, borderBottom: 1, borderColor: 'divider' }} />

        {/* 半自動チェックパネル（Task 16.3）*/}
        {/* @requirement wcag-coverage-expansion 5.1, 5.2, 5.3, 5.5, 5.6, 16.3 */}
        {semiAutoItems.length > 0 && (
          <>
            <SemiAutoCheckPanel
              items={semiAutoItems}
              currentIndex={currentSemiAutoIndex}
              onAnswer={handleSemiAutoAnswer}
              onSkip={handleSemiAutoSkip}
              onComplete={handleSemiAutoComplete}
              progress={semiAutoProgress}
              isComplete={semiAutoComplete}
              hidden={false}
            />
            <Box sx={{ my: 4, borderBottom: 1, borderColor: 'divider' }} />
          </>
        )}

        {/* WCAGカバレッジマトリクス（Task 17.1）*/}
        {/* @requirement wcag-coverage-expansion 7.1, 7.2, 7.3, 7.4, 7.5, 17.1 */}
        {report.coverageMatrix && (
          <>
            <WCAGCoverageMatrix
              matrix={report.coverageMatrix}
            />
            <Box sx={{ my: 4, borderBottom: 1, borderColor: 'divider' }} />
          </>
        )}

        {/* エンジン別検出サマリー（Task 17.2）*/}
        {/* @requirement wcag-coverage-expansion 1.4, 6.3, 6.5, 17.2 */}
        {report.engineSummary && (
          <>
            <EngineSummaryPanel
              engineSummary={report.engineSummary}
              multiEngineViolations={report.multiEngineViolations || []}
            />
            <Box sx={{ my: 4, borderBottom: 1, borderColor: 'divider' }} />
          </>
        )}

        {/* WAVE構造情報（Task 17.3）*/}
        {/* @requirement wcag-coverage-expansion 4.3, 17.3 */}
        {report.waveStructureInfo && (
          <>
            <WaveStructurePanel
              structureInfo={report.waveStructureInfo}
            />
            <Box sx={{ my: 4, borderBottom: 1, borderColor: 'divider' }} />
          </>
        )}

        {/* Detail Tabs */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            詳細結果
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadCsv}
          >
            CSVダウンロード
          </Button>
        </Box>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            aria-label="詳細結果タブ"
          >
            <Tab
              label={`違反 (${detailCounts.violations})`}
              id="detail-tab-0"
              aria-controls="detail-tabpanel-0"
            />
            <Tab
              label={`パス (${detailCounts.passes})`}
              id="detail-tab-1"
              aria-controls="detail-tabpanel-1"
            />
            <Tab
              label={`要確認 (${detailCounts.incomplete})`}
              id="detail-tab-2"
              aria-controls="detail-tabpanel-2"
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          {/* WCAGフィルタ表示とクリアボタン（Task 11.2） */}
          {wcagFilter && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                WCAG {wcagFilter} でフィルタリング中
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FilterListOffIcon />}
                onClick={() => setWcagFilter(null)}
                sx={{ ml: 1 }}
              >
                フィルタ解除
              </Button>
            </Box>
          )}
          <ViolationsTable
            pages={isMultiPage ? [activePage] : report.pages}
            wcagFilter={wcagFilter}
          />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <PassesTable pages={isMultiPage ? [activePage] : report.pages} />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <IncompleteTable pages={isMultiPage ? [activePage] : report.pages} />
        </TabPanel>
        </Box>
        {/* Snackbar for notifications (Task 5.4) */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={snackbar.severity === 'success' ? 3000 : 6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            variant="filled"
            action={
              snackbar.showRetry ? (
                <Button color="inherit" size="small" onClick={handleDownloadPdf}>
                  再試行
                </Button>
              ) : undefined
            }
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </CardContent>
    </Card>
  );
}
