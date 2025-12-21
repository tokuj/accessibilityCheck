/**
 * フォーム解析パネルコンポーネント（Task 3.3〜3.5）
 *
 * ログインフォームの自動解析UIを提供
 *
 * Requirements:
 * - 1.2: ログインURL入力フィールド
 * - 1.3, 1.4: URL形式バリデーション
 * - 2.1: 解析ボタン
 * - 2.5: ローディング表示
 * - 2.6, 5.3, 5.4: エラー表示
 * - 3.1, 3.2, 3.4: 解析結果表示
 * - 3.3: 複数候補選択
 * - 5.1: 手動設定モード切り替え
 */

import { useState, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import type {
  FormAnalysisResult,
  FormFieldCandidate,
  SelectedFormSelectors,
  FormAnalysisError,
} from '../types/form-analyzer';
import { analyzeForm, FormAnalyzerApiError } from '../services/form-analyzer-api';

type SettingMode = 'auto' | 'manual';

interface FormAnalyzerPanelProps {
  onSelectorsChange: (selectors: SelectedFormSelectors) => void;
  onModeChange: (mode: SettingMode) => void;
  initialUrl?: string;
}

interface FieldDisplayInfo {
  type: 'username' | 'password' | 'submit';
  label: string;
  candidates: FormFieldCandidate[];
  selectedIndex: number;
}

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getConfidenceColor(
  confidence: 'high' | 'medium' | 'low'
): 'success' | 'warning' | 'error' {
  switch (confidence) {
    case 'high':
      return 'success';
    case 'medium':
      return 'warning';
    case 'low':
      return 'error';
  }
}

export function FormAnalyzerPanel({
  onSelectorsChange,
  onModeChange,
  initialUrl = '',
}: FormAnalyzerPanelProps) {
  const [loginUrl, setLoginUrl] = useState(initialUrl);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FormAnalysisResult | null>(
    null
  );
  const [error, setError] = useState<FormAnalysisError | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<{
    username: number;
    password: number;
    submit: number;
  }>({ username: 0, password: 0, submit: 0 });

  const handleAnalyze = useCallback(async () => {
    // URLバリデーション
    if (!isValidUrl(loginUrl)) {
      setUrlError('有効なURL（http:// または https://）を入力してください');
      return;
    }

    setUrlError(null);
    setError(null);
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const result = await analyzeForm(loginUrl);
      setAnalysisResult(result);
      setSelectedIndices({ username: 0, password: 0, submit: 0 });

      // 自動で最初の候補を選択してコールバック
      const selectors: SelectedFormSelectors = {
        loginUrl,
        usernameSelector: result.usernameFields[0]?.selector || '',
        passwordSelector: result.passwordFields[0]?.selector || '',
        submitSelector: result.submitButtons[0]?.selector || '',
      };
      onSelectorsChange(selectors);
    } catch (e) {
      if (e instanceof FormAnalyzerApiError) {
        setError({ type: e.errorType, message: e.message });
      } else {
        setError({ type: 'analysis_failed', message: '予期しないエラーが発生しました' });
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [loginUrl, onSelectorsChange]);

  const handleRetry = useCallback(() => {
    handleAnalyze();
  }, [handleAnalyze]);

  const handleModeChange = useCallback(() => {
    onModeChange('manual');
  }, [onModeChange]);

  const handleSelectionChange = useCallback(
    (fieldType: 'username' | 'password' | 'submit', index: number) => {
      setSelectedIndices((prev) => {
        const newIndices = { ...prev, [fieldType]: index };

        // セレクタ更新を通知
        if (analysisResult) {
          const selectors: SelectedFormSelectors = {
            loginUrl,
            usernameSelector:
              analysisResult.usernameFields[newIndices.username]?.selector || '',
            passwordSelector:
              analysisResult.passwordFields[newIndices.password]?.selector || '',
            submitSelector:
              analysisResult.submitButtons[newIndices.submit]?.selector || '',
          };
          onSelectorsChange(selectors);
        }

        return newIndices;
      });
    },
    [analysisResult, onSelectorsChange]
  );

  // 結果が変わったら選択をリセット
  useEffect(() => {
    if (analysisResult) {
      setSelectedIndices({ username: 0, password: 0, submit: 0 });
    }
  }, [analysisResult]);

  const fieldDisplayInfos: FieldDisplayInfo[] = analysisResult
    ? [
        {
          type: 'username' as const,
          label: 'ユーザー名フィールド',
          candidates: analysisResult.usernameFields,
          selectedIndex: selectedIndices.username,
        },
        {
          type: 'password' as const,
          label: 'パスワードフィールド',
          candidates: analysisResult.passwordFields,
          selectedIndex: selectedIndices.password,
        },
        {
          type: 'submit' as const,
          label: '送信ボタン',
          candidates: analysisResult.submitButtons,
          selectedIndex: selectedIndices.submit,
        },
      ]
    : [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="info">
        ログインページのURLを入力して「解析」をクリックすると、フォーム要素を自動検出します。
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField
          label="ログインページURL"
          placeholder="https://example.com/login"
          value={loginUrl}
          onChange={(e) => setLoginUrl(e.target.value)}
          fullWidth
          error={!!urlError}
          helperText={urlError}
          disabled={isAnalyzing}
        />
        <Button
          variant="contained"
          onClick={handleAnalyze}
          disabled={!loginUrl || isAnalyzing}
          sx={{ minWidth: 80, height: 56 }}
        >
          解析
        </Button>
      </Box>

      {isAnalyzing && (
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}
        >
          <CircularProgress size={24} />
          <Typography>解析中...</Typography>
        </Box>
      )}

      {error && (
        <Alert
          severity="error"
          action={
            error.type === 'timeout' ? (
              <Button color="inherit" size="small" onClick={handleRetry}>
                リトライ
              </Button>
            ) : undefined
          }
        >
          {error.message}
        </Alert>
      )}

      {analysisResult && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold">
              解析結果
            </Typography>
            <Chip
              label={
                analysisResult.confidence === 'high'
                  ? '高信頼度'
                  : analysisResult.confidence === 'medium'
                    ? '中信頼度'
                    : '低信頼度'
              }
              color={getConfidenceColor(analysisResult.confidence)}
              size="small"
            />
          </Box>

          {fieldDisplayInfos.map((fieldInfo) => (
            <Box key={fieldInfo.type} sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                {fieldInfo.label}
              </Typography>

              {fieldInfo.candidates.length === 0 ? (
                <Typography variant="body2" color="text.disabled">
                  検出されませんでした
                </Typography>
              ) : fieldInfo.candidates.length === 1 ? (
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    bgcolor: 'grey.100',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    display: 'inline-block',
                  }}
                >
                  {fieldInfo.candidates[0].selector}
                </Typography>
              ) : (
                <FormControl fullWidth size="small">
                  <InputLabel id={`${fieldInfo.type}-select-label`}>
                    候補を選択
                  </InputLabel>
                  <Select
                    labelId={`${fieldInfo.type}-select-label`}
                    value={fieldInfo.selectedIndex}
                    label="候補を選択"
                    onChange={(e) =>
                      handleSelectionChange(fieldInfo.type, e.target.value as number)
                    }
                  >
                    {fieldInfo.candidates.map((candidate, idx) => (
                      <MenuItem key={candidate.selector} value={idx}>
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {candidate.selector}
                          </Typography>
                          {candidate.label && (
                            <Typography variant="caption" color="text.secondary">
                              ラベル: {candidate.label}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          ))}
        </Paper>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="text"
          color="inherit"
          size="small"
          onClick={handleModeChange}
        >
          手動設定に切り替え
        </Button>
      </Box>
    </Box>
  );
}
