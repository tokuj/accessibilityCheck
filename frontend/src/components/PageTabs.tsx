/**
 * PageTabs コンポーネント
 *
 * Task 8.1: PageTabsコンポーネントを新規作成
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 *
 * 複数ページのレポートをタブ形式で切り替えるコンポーネント。
 * - 各タブにページタイトルを表示
 * - 長いタイトルは省略表示（ellipsis）- 最大20文字
 * - タブに違反数をバッジで表示
 * - タブクリック時にonChangeコールバックでインデックスを通知
 */

import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

/** タイトル表示の最大文字数 */
const MAX_TITLE_LENGTH = 20;

export interface PageInfo {
  /** ページタイトル */
  title: string;
  /** ページURL */
  url: string;
  /** 違反数 */
  violationCount: number;
  /** アクセシビリティスコア（0-100、オプショナル） */
  accessibilityScore?: number;
}

export interface PageTabsProps {
  /** ページ情報の配列 */
  pages: PageInfo[];
  /** 現在アクティブなタブのインデックス */
  activeIndex: number;
  /** タブ切り替え時のコールバック */
  onChange: (index: number) => void;
}

/**
 * タイトルを省略表示する
 * @param title 元のタイトル
 * @returns 20文字を超える場合は省略した文字列
 */
function truncateTitle(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) {
    return title;
  }
  return title.substring(0, MAX_TITLE_LENGTH) + '...';
}

/**
 * スコアに基づいて色を返す
 * @param score 0-100のスコア
 * @returns 色名
 */
function getScoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 90) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

/**
 * 複数ページのレポートをタブ形式で切り替えるコンポーネント
 */
export function PageTabs({ pages, activeIndex, onChange }: PageTabsProps) {
  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    onChange(newValue);
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs
        value={activeIndex}
        onChange={handleChange}
        aria-label="ページ分析結果タブ"
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTab-root': {
            minHeight: 48,
            textTransform: 'none',
          },
        }}
      >
        {pages.map((page, index) => {
          const truncatedTitle = truncateTitle(page.title);
          const tooltipContent = (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {page.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'grey.400' }}>
                {page.url}
              </Typography>
            </Box>
          );

          return (
            <Tooltip
              key={page.url}
              title={tooltipContent}
              arrow
              placement="top"
              enterDelay={500}
            >
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{truncatedTitle}</span>
                    {page.accessibilityScore !== undefined && (
                      <Badge
                        badgeContent={page.accessibilityScore}
                        color={getScoreColor(page.accessibilityScore)}
                        max={100}
                        data-testid="score-badge"
                        sx={{
                          '& .MuiBadge-badge': {
                            position: 'static',
                            transform: 'none',
                            minWidth: 28,
                          },
                        }}
                      />
                    )}
                    {page.violationCount > 0 && (
                      <Badge
                        badgeContent={page.violationCount}
                        color="error"
                        max={99}
                        data-testid="violation-badge"
                        sx={{
                          '& .MuiBadge-badge': {
                            position: 'static',
                            transform: 'none',
                          },
                        }}
                      />
                    )}
                  </Box>
                }
                id={`page-tab-${index}`}
                aria-controls={`page-tabpanel-${index}`}
              />
            </Tooltip>
          );
        })}
      </Tabs>
    </Box>
  );
}
