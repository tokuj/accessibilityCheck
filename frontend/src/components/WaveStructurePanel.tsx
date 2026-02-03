/**
 * WaveStructurePanel コンポーネント
 *
 * Requirements: wcag-coverage-expansion 4.3
 * Task 13.2: WAVE構造情報表示を実装
 *
 * - WAVEの見出し階層情報を視覚的に表示
 * - ランドマーク情報を表示
 */

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import WarningIcon from '@mui/icons-material/Warning';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TitleIcon from '@mui/icons-material/Title';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import WebAssetIcon from '@mui/icons-material/WebAsset';
import InfoIcon from '@mui/icons-material/Info';
import SearchIcon from '@mui/icons-material/Search';
import InputIcon from '@mui/icons-material/Input';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';

/**
 * 見出し情報
 */
export interface HeadingInfo {
  /** 見出しレベル（1-6） */
  level: number;
  /** 見出しテキスト */
  text: string;
  /** XPath（オプション） */
  xpath?: string;
}

/**
 * ランドマーク種類
 */
export type LandmarkType =
  | 'banner'
  | 'navigation'
  | 'main'
  | 'contentinfo'
  | 'complementary'
  | 'search'
  | 'form'
  | 'region';

/**
 * ランドマーク情報
 */
export interface LandmarkInfo {
  /** ランドマーク種類 */
  type: LandmarkType;
  /** ランドマークのラベル（aria-label / aria-labelledby） */
  label?: string;
  /** XPath（オプション） */
  xpath?: string;
}

/**
 * WAVE構造情報
 * @requirement 4.3 - WAVEの構造情報（見出し階層、ランドマーク）を視覚的に表示
 */
export interface WaveStructureInfo {
  /** 見出し階層情報 */
  headings: HeadingInfo[];
  /** ランドマーク情報 */
  landmarks: LandmarkInfo[];
}

interface WaveStructurePanelProps {
  /** WAVE構造情報 */
  structureInfo: WaveStructureInfo;
  /** コンパクトモード（詳細を非表示） */
  compact?: boolean;
}

/**
 * ランドマークタイプに対応するアイコンを返す
 */
function getLandmarkIcon(type: LandmarkType): React.ReactNode {
  switch (type) {
    case 'banner':
      return <HomeIcon />;
    case 'navigation':
      return <MenuIcon />;
    case 'main':
      return <WebAssetIcon />;
    case 'contentinfo':
      return <InfoIcon />;
    case 'complementary':
      return <ViewSidebarIcon />;
    case 'search':
      return <SearchIcon />;
    case 'form':
      return <InputIcon />;
    case 'region':
      return <ViewQuiltIcon />;
    default:
      return <ViewQuiltIcon />;
  }
}

/**
 * 見出しスキップを検出
 */
function detectHeadingSkips(headings: HeadingInfo[]): number[] {
  const skips: number[] = [];
  for (let i = 1; i < headings.length; i++) {
    const prevLevel = headings[i - 1].level;
    const currLevel = headings[i].level;
    // レベルが2以上増加した場合はスキップ
    if (currLevel > prevLevel + 1) {
      skips.push(i);
    }
  }
  return skips;
}

/**
 * 見出しレベル別の内訳を計算
 */
function calculateHeadingBreakdown(headings: HeadingInfo[]): Record<number, number> {
  const breakdown: Record<number, number> = {};
  for (const heading of headings) {
    breakdown[heading.level] = (breakdown[heading.level] || 0) + 1;
  }
  return breakdown;
}

/**
 * WaveStructurePanel - WAVE構造情報表示コンポーネント
 * @requirement 4.3 - WAVEの構造情報（見出し階層、ランドマーク）を視覚的に表示
 */
export function WaveStructurePanel({
  structureInfo,
  compact = false,
}: WaveStructurePanelProps) {
  const { headings, landmarks } = structureInfo;

  // 空の状態
  const isEmpty = headings.length === 0 && landmarks.length === 0;

  // 見出しスキップを検出
  const headingSkips = useMemo(() => detectHeadingSkips(headings), [headings]);

  // 見出しレベル別内訳
  const headingBreakdown = useMemo(() => calculateHeadingBreakdown(headings), [headings]);

  if (isEmpty) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          構造情報がありません
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AccountTreeIcon color="primary" />
        <Typography variant="h6">ページ構造情報（WAVE）</Typography>
      </Box>

      {/* サマリー */}
      <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            見出し数
          </Typography>
          <Typography variant="h5" data-testid="heading-count">
            {headings.length}
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            ランドマーク数
          </Typography>
          <Typography variant="h5" data-testid="landmark-count">
            {landmarks.length}
          </Typography>
        </Box>
      </Box>

      {/* 見出しレベル別内訳 */}
      {headings.length > 0 && (
        <Box sx={{ mb: 2 }} data-testid="heading-breakdown">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            見出しレベル別
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.entries(headingBreakdown)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([level, count]) => (
                <Chip
                  key={level}
                  label={`H${level}: ${count}`}
                  size="small"
                  variant="outlined"
                  data-testid={`heading-level-h${level}`}
                />
              ))}
          </Box>
        </Box>
      )}

      {/* 詳細表示（compactモードでは非表示） */}
      {!compact && (
        <>
          <Divider sx={{ my: 2 }} />

          {/* 見出し階層セクション */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TitleIcon color="action" />
              <Typography variant="subtitle1">見出し階層</Typography>
            </Box>

            {headings.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 1 }}>
                見出しがありません
              </Typography>
            ) : (
              <List
                dense
                aria-label="見出し階層"
                sx={{ py: 0 }}
              >
                {headings.map((heading, index) => {
                  const isSkip = headingSkips.includes(index);
                  const indentLevel = heading.level - 1;

                  return (
                    <ListItem
                      key={`heading-${index}`}
                      data-testid={`heading-item-${index}`}
                      sx={{
                        marginLeft: `${indentLevel * 16}px`,
                        py: 0.5,
                      }}
                    >
                      <Chip
                        label={`H${heading.level}`}
                        size="small"
                        color={heading.level === 1 ? 'primary' : 'default'}
                        sx={{ mr: 1, minWidth: 40 }}
                      />
                      <ListItemText
                        primary={heading.text}
                        primaryTypographyProps={{
                          variant: 'body2',
                          color: isSkip ? 'warning.main' : 'text.primary',
                        }}
                      />
                      {isSkip && (
                        <WarningIcon
                          fontSize="small"
                          color="warning"
                          data-testid="heading-skip-warning"
                          titleAccess="見出しレベルがスキップされています"
                        />
                      )}
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>

          {/* ランドマークセクション */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ViewQuiltIcon color="action" />
              <Typography variant="subtitle1">ランドマーク</Typography>
            </Box>

            {landmarks.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 1 }}>
                ランドマークがありません
              </Typography>
            ) : (
              <List
                dense
                aria-label="ランドマーク一覧"
                sx={{ py: 0 }}
              >
                {landmarks.map((landmark, index) => (
                  <ListItem
                    key={`landmark-${index}`}
                    data-testid={`landmark-${landmark.type}`}
                    sx={{ py: 0.5 }}
                  >
                    <ListItemIcon
                      sx={{ minWidth: 36 }}
                      data-testid="landmark-icon"
                    >
                      {getLandmarkIcon(landmark.type)}
                    </ListItemIcon>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={landmark.type}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      {landmark.label && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          data-testid="landmark-label"
                        >
                          {landmark.label}
                        </Typography>
                      )}
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </>
      )}
    </Paper>
  );
}
