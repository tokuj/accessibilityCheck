/**
 * AnalysisOptionsPanel コンポーネント
 *
 * Requirements: wcag-coverage-expansion 8.1, 8.2, 8.3, 8.4, 8.5
 * Task 10.1: AnalysisOptionsPanelコンポーネントを実装
 * Task 10.2: オプション永続化を実装
 *
 * - エンジン選択チェックボックス
 * - WCAGバージョン選択ドロップダウン
 * - 半自動チェック有効/無効トグル
 * - レスポンシブテスト有効/無効トグル
 * - WAVE API設定
 * - プリセットボタン（クイック分析/フル分析）
 * - localStorage永続化
 */

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import FormGroup from '@mui/material/FormGroup';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TuneIcon from '@mui/icons-material/Tune';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';

import {
  QUICK_ANALYSIS_PRESET,
  FULL_ANALYSIS_PRESET,
  ANALYSIS_OPTIONS_STORAGE_KEY,
  type AnalysisOptions,
  type ViewportType,
} from '../types/analysis-options';

interface AnalysisOptionsPanelProps {
  /** 現在の分析オプション */
  options: AnalysisOptions;
  /** オプション変更時のコールバック */
  onChange: (options: AnalysisOptions) => void;
  /** 折りたたみモード */
  compact?: boolean;
  /** localStorageから設定を読み込むか */
  loadFromStorage?: boolean;
  /** localStorageに設定を保存するか */
  saveToStorage?: boolean;
}

/**
 * AnalysisOptionsPanel - 分析オプション設定パネル
 * @requirement 8.1 - 分析オプション設定を表示
 * @requirement 8.2 - 各種オプションを提供
 * @requirement 8.5 - 前回の設定をlocalStorageに保存
 */
export function AnalysisOptionsPanel({
  options,
  onChange,
  compact = false,
  loadFromStorage = false,
  saveToStorage = false,
}: AnalysisOptionsPanelProps) {
  const [expanded, setExpanded] = useState(!compact);

  // localStorageから設定を読み込み
  useEffect(() => {
    if (loadFromStorage) {
      try {
        const saved = localStorage.getItem(ANALYSIS_OPTIONS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as AnalysisOptions;
          onChange(parsed);
        }
      } catch {
        // 不正なデータの場合は無視
      }
    }
  }, [loadFromStorage]); // eslint-disable-line react-hooks/exhaustive-deps

  // 設定変更をラップしてlocalStorageに保存
  const handleChange = useCallback(
    (newOptions: AnalysisOptions) => {
      onChange(newOptions);
      if (saveToStorage) {
        try {
          localStorage.setItem(ANALYSIS_OPTIONS_STORAGE_KEY, JSON.stringify(newOptions));
        } catch {
          // 保存失敗は無視
        }
      }
    },
    [onChange, saveToStorage]
  );

  // エンジン選択変更ハンドラー
  const handleEngineChange = useCallback(
    (engine: keyof typeof options.engines) => {
      handleChange({
        ...options,
        engines: {
          ...options.engines,
          [engine]: !options.engines[engine],
        },
      });
    },
    [options, handleChange]
  );

  // WCAGバージョン変更ハンドラー
  const handleWcagVersionChange = useCallback(
    (version: '2.0' | '2.1' | '2.2') => {
      handleChange({
        ...options,
        wcagVersion: version,
      });
    },
    [options, handleChange]
  );

  // 半自動チェック変更ハンドラー
  const handleSemiAutoCheckChange = useCallback(() => {
    handleChange({
      ...options,
      semiAutoCheck: !options.semiAutoCheck,
    });
  }, [options, handleChange]);

  // レスポンシブテスト変更ハンドラー
  const handleResponsiveTestChange = useCallback(() => {
    handleChange({
      ...options,
      responsiveTest: !options.responsiveTest,
    });
  }, [options, handleChange]);

  // ビューポート選択変更ハンドラー
  const handleViewportChange = useCallback(
    (viewport: ViewportType) => {
      const newViewports = options.viewports.includes(viewport)
        ? options.viewports.filter((v) => v !== viewport)
        : [...options.viewports, viewport];

      handleChange({
        ...options,
        viewports: newViewports,
      });
    },
    [options, handleChange]
  );

  // WAVE API有効/無効変更ハンドラー
  const handleWaveApiEnabledChange = useCallback(() => {
    handleChange({
      ...options,
      waveApi: {
        ...options.waveApi,
        enabled: !options.waveApi.enabled,
      },
    });
  }, [options, handleChange]);

  // WAVE APIキー変更ハンドラー
  const handleWaveApiKeyChange = useCallback(
    (apiKey: string) => {
      handleChange({
        ...options,
        waveApi: {
          ...options.waveApi,
          apiKey,
        },
      });
    },
    [options, handleChange]
  );

  // プリセット適用ハンドラー
  const handleQuickPreset = useCallback(() => {
    handleChange(QUICK_ANALYSIS_PRESET);
  }, [handleChange]);

  const handleFullPreset = useCallback(() => {
    handleChange(FULL_ANALYSIS_PRESET);
  }, [handleChange]);

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* プリセットボタン */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FlashOnIcon />}
          onClick={handleQuickPreset}
          aria-label="クイック分析"
        >
          クイック分析
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AllInclusiveIcon />}
          onClick={handleFullPreset}
          aria-label="フル分析"
        >
          フル分析
        </Button>
      </Box>

      <Divider />

      {/* エンジン選択 */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          分析エンジン
        </Typography>
        <FormGroup row>
          <FormControlLabel
            control={
              <Checkbox
                checked={options.engines.axeCore}
                onChange={() => handleEngineChange('axeCore')}
                name="axeCore"
              />
            }
            label="axe-core"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={options.engines.pa11y}
                onChange={() => handleEngineChange('pa11y')}
                name="pa11y"
              />
            }
            label="Pa11y"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={options.engines.lighthouse}
                onChange={() => handleEngineChange('lighthouse')}
                name="lighthouse"
              />
            }
            label="Lighthouse"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={options.engines.ibm}
                onChange={() => handleEngineChange('ibm')}
                name="ibm"
              />
            }
            label="IBM Equal Access"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={options.engines.alfa}
                onChange={() => handleEngineChange('alfa')}
                name="alfa"
              />
            }
            label="Siteimprove Alfa"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={options.engines.qualweb}
                onChange={() => handleEngineChange('qualweb')}
                name="qualweb"
              />
            }
            label="QualWeb"
          />
        </FormGroup>
      </Box>

      <Divider />

      {/* WCAGバージョン選択 */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel id="wcag-version-label">WCAGバージョン</InputLabel>
        <Select
          labelId="wcag-version-label"
          id="wcag-version-select"
          value={options.wcagVersion}
          label="WCAGバージョン"
          onChange={(e) => handleWcagVersionChange(e.target.value as '2.0' | '2.1' | '2.2')}
          inputProps={{ 'aria-label': 'WCAGバージョン' }}
        >
          <MenuItem value="2.0">2.0 AA</MenuItem>
          <MenuItem value="2.1">2.1 AA</MenuItem>
          <MenuItem value="2.2">2.2 AA</MenuItem>
        </Select>
      </FormControl>

      <Divider />

      {/* オプショントグル */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          追加オプション
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={options.semiAutoCheck}
                onChange={handleSemiAutoCheckChange}
                name="semiAutoCheck"
              />
            }
            label="半自動チェック"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={options.responsiveTest}
                onChange={handleResponsiveTestChange}
                name="responsiveTest"
              />
            }
            label="レスポンシブテスト"
          />
        </FormGroup>
      </Box>

      {/* レスポンシブテストが有効な場合のビューポート選択 */}
      {options.responsiveTest && (
        <Box sx={{ pl: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            テスト対象ビューポート
          </Typography>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.viewports.includes('mobile')}
                  onChange={() => handleViewportChange('mobile')}
                  size="small"
                />
              }
              label="モバイル (375px)"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.viewports.includes('tablet')}
                  onChange={() => handleViewportChange('tablet')}
                  size="small"
                />
              }
              label="タブレット (768px)"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.viewports.includes('desktop')}
                  onChange={() => handleViewportChange('desktop')}
                  size="small"
                />
              }
              label="デスクトップ (1280px)"
            />
          </FormGroup>
        </Box>
      )}

      <Divider />

      {/* WAVE API設定 */}
      <Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={options.waveApi.enabled}
              onChange={handleWaveApiEnabledChange}
              name="waveApi"
            />
          }
          label="WAVE API"
        />
        {options.waveApi.enabled && (
          <TextField
            size="small"
            label="WAVE APIキー"
            type="password"
            value={options.waveApi.apiKey || ''}
            onChange={(e) => handleWaveApiKeyChange(e.target.value)}
            sx={{ mt: 1, width: '100%' }}
            inputProps={{ 'aria-label': 'WAVE APIキー' }}
          />
        )}
      </Box>
    </Box>
  );

  if (compact) {
    return (
      <Paper sx={{ p: 2, mt: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TuneIcon color="action" />
            <Typography variant="subtitle1">分析オプション</Typography>
          </Box>
          <IconButton
            size="small"
            aria-label="分析オプション"
            aria-expanded={expanded}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Collapse in={expanded}>
          <Box sx={{ pt: 2 }}>{content}</Box>
        </Collapse>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TuneIcon color="primary" />
        <Typography variant="h6">分析オプション</Typography>
      </Box>
      {content}
    </Paper>
  );
}
