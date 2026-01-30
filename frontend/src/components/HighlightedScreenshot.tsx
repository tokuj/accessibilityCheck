/**
 * HighlightedScreenshotコンポーネント
 * スクリーンショット上で問題箇所をハイライト表示する
 * @requirement 6.2, 6.3 - 問題箇所の視覚的特定
 * @task 13.3 - HighlightedScreenshotコンポーネントを作成する
 */
import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import type { NodeInfo } from '../types/accessibility';

interface HighlightedScreenshotProps {
  /** スクリーンショット画像（Base64） */
  screenshot: string;
  /** ハイライト対象のノード情報配列 */
  nodes: NodeInfo[];
  /** 選択中のノードインデックス */
  selectedNodeIndex?: number;
  /** ノードクリックコールバック */
  onNodeClick?: (index: number) => void;
}

/** ハイライトの通常色（赤枠） */
const HIGHLIGHT_COLOR = 'rgba(220, 53, 69, 0.8)';
/** ハイライトの選択色（青枠） */
const HIGHLIGHT_SELECTED_COLOR = 'rgba(25, 118, 210, 0.9)';
/** ズームのステップ */
const ZOOM_STEP = 0.25;
/** 最小ズーム */
const MIN_ZOOM = 0.5;
/** 最大ズーム */
const MAX_ZOOM = 3;

export function HighlightedScreenshot({
  screenshot,
  nodes,
  selectedNodeIndex,
  onNodeClick,
}: HighlightedScreenshotProps) {
  const [scale, setScale] = useState(1);

  // バウンディングボックスを持つノードのみフィルタリング
  const nodesWithBbox = useMemo(() => {
    return nodes
      .map((node, originalIndex) => ({ node, originalIndex }))
      .filter(({ node }) => node.boundingBox != null);
  }, [nodes]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const handleHighlightClick = (index: number) => {
    if (onNodeClick) {
      onNodeClick(index);
    }
  };

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {/* ズームコントロール */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1,
        }}
      >
        <IconButton
          onClick={handleZoomOut}
          disabled={scale <= MIN_ZOOM}
          aria-label="縮小"
          size="small"
        >
          <ZoomOutIcon />
        </IconButton>
        <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </Typography>
        <IconButton
          onClick={handleZoomIn}
          disabled={scale >= MAX_ZOOM}
          aria-label="拡大"
          size="small"
        >
          <ZoomInIcon />
        </IconButton>
      </Box>

      {/* スクリーンショットとハイライト */}
      <Box
        sx={{
          overflow: 'auto',
          maxHeight: 500,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Box
          data-testid="screenshot-container"
          sx={{
            position: 'relative',
            display: 'inline-block',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* スクリーンショット画像 */}
          <Box
            component="img"
            src={screenshot}
            alt="Page screenshot with highlighted issues"
            sx={{
              display: 'block',
              maxWidth: 'none',
            }}
          />

          {/* ハイライトオーバーレイ */}
          {nodesWithBbox.map(({ node, originalIndex }, displayIndex) => {
            const bbox = node.boundingBox!;
            const isSelected = selectedNodeIndex === originalIndex;

            return (
              <Box
                key={originalIndex}
                data-testid={`highlight-${originalIndex}`}
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => handleHighlightClick(originalIndex)}
                sx={{
                  position: 'absolute',
                  left: bbox.x,
                  top: bbox.y,
                  width: bbox.width,
                  height: bbox.height,
                  border: '3px solid',
                  borderColor: isSelected ? HIGHLIGHT_SELECTED_COLOR : HIGHLIGHT_COLOR,
                  backgroundColor: isSelected
                    ? 'rgba(25, 118, 210, 0.1)'
                    : 'rgba(220, 53, 69, 0.1)',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  '&:hover': {
                    borderWidth: 4,
                    backgroundColor: isSelected
                      ? 'rgba(25, 118, 210, 0.2)'
                      : 'rgba(220, 53, 69, 0.2)',
                  },
                }}
              >
                {/* 番号ラベル */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: -12,
                    left: -12,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: isSelected ? HIGHLIGHT_SELECTED_COLOR : HIGHLIGHT_COLOR,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                  }}
                >
                  {displayIndex + 1}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
