/**
 * NodeDetailsコンポーネント
 * ノード情報の展開表示を行うコンポーネント
 * @requirement 1.1, 1.2, 1.4, 1.5, 4.5, 5.1, 5.3, 5.5, 6.4, 6.5, 6.6, 6.7, 7.3
 * @task 6.1 - ノード情報の展開表示UIを実装する
 * @task 13.4 - NodeDetailsコンポーネントを拡張する
 * @task 14.5 - 要素説明を優先表示する
 */
import { useState } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Chip from '@mui/material/Chip';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CodeIcon from '@mui/icons-material/Code';
import PlaceIcon from '@mui/icons-material/Place';
import type { NodeInfo, BoundingBox } from '../types/accessibility';

/**
 * バウンディングボックスから位置ラベルを生成する
 * @requirement 7.6 - 位置情報バッジを追加
 */
function getPositionLabel(
  boundingBox: BoundingBox,
  viewportSize: { width: number; height: number }
): string {
  const centerX = boundingBox.x + boundingBox.width / 2;
  const centerY = boundingBox.y + boundingBox.height / 2;

  // 垂直位置
  let vertical: string;
  if (centerY < viewportSize.height / 3) {
    vertical = '上部';
  } else if (centerY < (viewportSize.height * 2) / 3) {
    vertical = '中央';
  } else {
    vertical = '下部';
  }

  // 水平位置
  let horizontal: string;
  if (centerX < viewportSize.width / 3) {
    horizontal = '左';
  } else if (centerX < (viewportSize.width * 2) / 3) {
    horizontal = '中央';
  } else {
    horizontal = '右';
  }

  // 中央・中央の場合は「中央」のみ
  if (vertical === '中央' && horizontal === '中央') {
    return '中央';
  }

  return `${vertical}・${horizontal}`;
}

interface NodeDetailsProps {
  /** ノード情報配列 */
  nodes: NodeInfo[];
  /** 展開状態 */
  expanded: boolean;
  /** 展開トグルコールバック */
  onToggle: () => void;
  /** 初期表示件数（デフォルト: 10） */
  initialDisplayCount?: number;
  /** スクリーンショット画像（Base64） @requirement 6.2 */
  screenshot?: string;
  /** 選択中のノードインデックス @requirement 6.5 */
  selectedNodeIndex?: number;
  /** ノード選択コールバック @requirement 6.5 */
  onNodeSelect?: (index: number) => void;
  /** ビューポートサイズ（位置情報バッジ用） @requirement 7.6 */
  viewportSize?: { width: number; height: number };
}

/** デフォルトビューポートサイズ（位置ラベル計算用） */
const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

export function NodeDetails({
  nodes,
  expanded,
  onToggle,
  initialDisplayCount = 10,
  selectedNodeIndex,
  onNodeSelect,
  viewportSize = DEFAULT_VIEWPORT,
}: NodeDetailsProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedContextIndices, setExpandedContextIndices] = useState<Set<number>>(new Set());

  // ノードが存在しない場合のハンドリング
  const safeNodes = nodes ?? [];
  const hasNodes = safeNodes.length > 0;
  const nodeCount = safeNodes.length;

  // 表示するノードを決定
  const displayedNodes = showAll
    ? safeNodes
    : safeNodes.slice(0, initialDisplayCount);
  const hasMore = nodeCount > initialDisplayCount && !showAll;
  const remainingCount = nodeCount - initialDisplayCount;

  // クリップボードにコピー
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // コピー失敗時は無視
    }
  };

  // ノード選択
  const handleNodeClick = (index: number) => {
    if (onNodeSelect) {
      onNodeSelect(index);
    }
  };

  // contextHtmlの展開トグル
  const toggleContextHtml = (index: number) => {
    setExpandedContextIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* ヘッダー：展開トグルボタン */}
      <Button
        onClick={onToggle}
        aria-expanded={expanded}
        startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        size="small"
        sx={{
          textTransform: 'none',
          color: 'text.secondary',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        ノード情報 ({nodeCount}件)
      </Button>

      {/* 展開コンテンツ */}
      <Collapse in={expanded} timeout="auto">
        <Box
          sx={{
            mt: 1,
            pl: 2,
            borderLeft: '2px solid',
            borderColor: 'divider',
          }}
        >
          {!hasNodes ? (
            <Typography color="text.secondary" variant="body2">
              ノード情報を取得できませんでした
            </Typography>
          ) : (
            <>
              {displayedNodes.map((node, index) => {
                const isSelected = selectedNodeIndex === index;
                const isContextExpanded = expandedContextIndices.has(index);

                return (
                  <Box
                    key={`${node.target}-${index}`}
                    data-node-index={index}
                    data-selected={isSelected ? 'true' : 'false'}
                    onClick={() => handleNodeClick(index)}
                    sx={{
                      mb: 2,
                      p: 1.5,
                      backgroundColor: isSelected ? 'primary.50' : 'grey.50',
                      borderRadius: 1,
                      border: isSelected ? '2px solid' : '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'transparent',
                      cursor: onNodeSelect ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      '&:hover': onNodeSelect
                        ? {
                            backgroundColor: isSelected ? 'primary.100' : 'grey.100',
                          }
                        : {},
                    }}
                  >
                    {/* 非表示要素の警告 @requirement 6.7 */}
                    {node.isHidden && (
                      <Alert
                        severity="warning"
                        icon={<VisibilityOffIcon />}
                        sx={{ mb: 1, py: 0 }}
                      >
                        この要素はビューポート外または非表示です
                      </Alert>
                    )}

                    {/* 要素説明を優先表示 @requirement 7.3 */}
                    {node.elementDescription && (
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 'bold',
                          mb: 1,
                          color: 'text.primary',
                        }}
                      >
                        {node.elementDescription}
                      </Typography>
                    )}

                    {/* 要素個別のスクリーンショット @requirement 7.4 */}
                    {node.elementScreenshot && (
                      <Box
                        sx={{
                          mb: 2,
                          p: 1,
                          backgroundColor: 'white',
                          borderRadius: 1,
                          border: '2px solid',
                          borderColor: 'error.main',
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          問題箇所のスクリーンショット
                        </Typography>
                        <img
                          src={node.elementScreenshot}
                          alt="問題箇所のスクリーンショット"
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            display: 'block',
                          }}
                        />
                      </Box>
                    )}

                    {/* 位置情報バッジ @requirement 7.6 */}
                    {node.boundingBox && !node.isHidden && (
                      <Chip
                        icon={<PlaceIcon />}
                        label={getPositionLabel(node.boundingBox, viewportSize)}
                        size="small"
                        variant="outlined"
                        sx={{ mb: 1 }}
                      />
                    )}

                    {/* 技術詳細（CSSセレクタ・XPath）を折りたたみ表示 @requirement 7.3 */}
                    <Accordion
                      disableGutters
                      sx={{
                        backgroundColor: 'transparent',
                        boxShadow: 'none',
                        '&:before': { display: 'none' },
                        '& .MuiAccordionSummary-root': {
                          minHeight: 32,
                          px: 0,
                        },
                        '& .MuiAccordionSummary-content': {
                          my: 0,
                        },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon fontSize="small" />}
                        sx={{ flexDirection: 'row-reverse', gap: 1 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          技術詳細を表示
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 0, pt: 0 }}>
                        {/* CSSセレクタ @requirement 6.4 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              wordBreak: 'break-all',
                              color: 'primary.main',
                              flex: 1,
                            }}
                          >
                            CSS: {node.target}
                          </Typography>
                          <Tooltip title="CSSセレクタをコピー">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(node.target);
                              }}
                              aria-label="CSSセレクタをコピー"
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        {/* XPath @requirement 6.4 */}
                        {node.xpath && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                wordBreak: 'break-all',
                                color: 'text.secondary',
                                flex: 1,
                              }}
                            >
                              XPath: {node.xpath}
                            </Typography>
                            <Tooltip title="XPathをコピー">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(node.xpath!);
                                }}
                                aria-label="XPathをコピー"
                              >
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>

                    {/* HTML抜粋 */}
                    <Box
                      component="code"
                      data-testid="node-html"
                      sx={{
                        display: 'block',
                        mt: 1,
                        p: 1,
                        backgroundColor: 'grey.100',
                        borderRadius: 0.5,
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        overflowX: 'auto',
                      }}
                    >
                      {node.html}
                    </Box>

                    {/* 周辺HTML @requirement 6.5 */}
                    {node.contextHtml && (
                      <Box sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          startIcon={<CodeIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleContextHtml(index);
                          }}
                          sx={{ textTransform: 'none' }}
                        >
                          {isContextExpanded ? '周辺HTMLを非表示' : '周辺HTMLを表示'}
                        </Button>
                        <Collapse in={isContextExpanded}>
                          <Box
                            component="code"
                            sx={{
                              display: 'block',
                              mt: 1,
                              p: 1,
                              backgroundColor: 'grey.200',
                              borderRadius: 0.5,
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              overflowX: 'auto',
                              maxHeight: 200,
                              overflow: 'auto',
                            }}
                          >
                            {node.contextHtml}
                          </Box>
                        </Collapse>
                      </Box>
                    )}

                    {/* 修正方法（failureSummary） @requirement 6.6 */}
                    {node.failureSummary && (
                      <Box sx={{ mt: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 'bold',
                            color: 'error.main',
                          }}
                        >
                          修正方法
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 0.5,
                            color: 'error.main',
                            fontStyle: 'italic',
                          }}
                        >
                          {node.failureSummary}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                );
              })}

              {/* さらに表示ボタン */}
              {hasMore && (
                <Button
                  onClick={() => setShowAll(true)}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  さらに{remainingCount}件表示
                </Button>
              )}
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
