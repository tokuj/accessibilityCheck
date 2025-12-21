import { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import type { AuthConfig, AuthType } from '../types/accessibility';
import { SessionManager } from './SessionManager';
import { FormAnalyzerPanel } from './FormAnalyzerPanel';
import type { SelectedFormSelectors } from '../types/form-analyzer';
import {
  listFormLoginConfigs,
  loadFormLoginConfig,
  saveFormLoginConfig,
  deleteFormLoginConfig,
  type FormLoginConfigSummary,
} from '../utils/form-login-storage';

// 認証モード（手動認証 or セッション）
type AuthMode = 'manual' | 'session';

// フォーム設定モード（自動解析 or 手動設定）
type FormSettingMode = 'auto' | 'manual';

interface AuthSettingsProps {
  open: boolean;
  onClose: () => void;
  authConfig: AuthConfig | undefined;
  onSave: (config: AuthConfig | undefined) => void;
  // セッション関連props（オプション - 後方互換性）
  /** セッション選択時のコールバック */
  onSessionSelect?: (sessionId: string | null, passphrase?: string) => void;
  /** 選択中のセッションID */
  selectedSessionId?: string | null;
  /** 開発環境フラグ */
  isDevelopment?: boolean;
  /** ログイン記録ボタンクリック時のコールバック */
  onRecordLogin?: () => void;
}

const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  none: '認証なし',
  cookie: 'Cookie認証',
  bearer: 'Bearer Token認証',
  basic: 'Basic認証',
  form: 'フォームログイン',
};

const defaultConfig: AuthConfig = {
  type: 'none',
};

export function AuthSettings({
  open,
  onClose,
  authConfig,
  onSave,
  onSessionSelect,
  selectedSessionId,
  isDevelopment = false,
  onRecordLogin,
}: AuthSettingsProps) {
  const [config, setConfig] = useState<AuthConfig>(authConfig || defaultConfig);
  // 認証モード（セッション機能が有効な場合のみ使用）
  const [authMode, setAuthMode] = useState<AuthMode>(
    selectedSessionId ? 'session' : 'manual'
  );
  // フォーム設定モード（自動解析 or 手動設定）
  const [formSettingMode, setFormSettingMode] = useState<FormSettingMode>('auto');
  // 解析済みセレクタ（自動解析で検出されたもの）
  const [analyzedSelectors, setAnalyzedSelectors] = useState<SelectedFormSelectors | null>(null);
  // 保存済みフォームログイン設定
  const [savedFormConfigs, setSavedFormConfigs] = useState<FormLoginConfigSummary[]>([]);
  // 選択中の保存済み設定名
  const [selectedFormConfig, setSelectedFormConfig] = useState<string>('');
  // 設定保存用の名前入力
  const [saveConfigName, setSaveConfigName] = useState<string>('');

  // セッション機能が有効かどうか（onSessionSelectが渡されている場合）
  const sessionEnabled = !!onSessionSelect;

  // 解析完了しているかどうか
  const isAnalysisComplete = analyzedSelectors !== null &&
    analyzedSelectors.usernameSelector &&
    analyzedSelectors.passwordSelector &&
    analyzedSelectors.submitSelector;

  // 保存済み設定を読み込み
  const refreshSavedConfigs = useCallback(() => {
    const configs = listFormLoginConfigs();
    setSavedFormConfigs(configs);
  }, []);

  useEffect(() => {
    if (open) {
      setConfig(authConfig || defaultConfig);
      // 選択中のセッションがあればセッションモードに
      setAuthMode(selectedSessionId ? 'session' : 'manual');
      // フォーム設定モードをリセット
      setFormSettingMode('auto');
      // 解析済みセレクタをリセット
      setAnalyzedSelectors(null);
      // 選択中の保存済み設定をリセット
      setSelectedFormConfig('');
      setSaveConfigName('');
      // 保存済み設定を読み込み
      refreshSavedConfigs();
    }
  }, [open, authConfig, selectedSessionId, refreshSavedConfigs]);

  const handleAuthModeChange = (mode: AuthMode) => {
    setAuthMode(mode);
    if (mode === 'manual') {
      // 手動認証に切り替え時はセッション選択を解除
      onSessionSelect?.(null);
    } else {
      // セッションモードに切り替え時は手動認証設定をクリア
      setConfig(defaultConfig);
    }
  };

  const handleTypeChange = (type: AuthType) => {
    setConfig({ ...config, type });
  };

  const handleFieldChange = (field: keyof AuthConfig, value: string) => {
    setConfig({ ...config, [field]: value });
  };

  const handleSave = () => {
    if (config.type === 'none') {
      onSave(undefined);
    } else {
      onSave(config);
    }
    onClose();
  };

  const handleClear = () => {
    setConfig(defaultConfig);
    onSave(undefined);
    onClose();
  };

  // セッション選択ハンドラー
  const handleSessionSelect = (sessionId: string | null) => {
    onSessionSelect?.(sessionId);
  };

  // フォーム解析パネルからセレクタを受け取る
  const handleSelectorsChange = useCallback((selectors: SelectedFormSelectors) => {
    setAnalyzedSelectors(selectors);
    // セレクタとloginUrlをconfigに反映
    setConfig((prev) => ({
      ...prev,
      loginUrl: selectors.loginUrl,
      usernameSelector: selectors.usernameSelector,
      passwordSelector: selectors.passwordSelector,
      submitSelector: selectors.submitSelector,
    }));
  }, []);

  // フォーム設定モード切り替え
  const handleFormSettingModeChange = useCallback((mode: 'auto' | 'manual') => {
    setFormSettingMode(mode);
    if (mode === 'manual') {
      // 手動モードに切り替え時は解析結果をクリア
      setAnalyzedSelectors(null);
    }
  }, []);

  // 保存済みフォームログイン設定を選択
  const handleFormConfigSelect = useCallback((configName: string) => {
    setSelectedFormConfig(configName);
    if (!configName) {
      return;
    }

    const savedConfig = loadFormLoginConfig(configName);
    if (savedConfig) {
      // 設定を反映
      setConfig((prev) => ({
        ...prev,
        type: 'form',
        loginUrl: savedConfig.loginUrl,
        usernameSelector: savedConfig.usernameSelector,
        passwordSelector: savedConfig.passwordSelector,
        submitSelector: savedConfig.submitSelector,
        username: savedConfig.username,
        password: savedConfig.password,
      }));
      // 手動モードに切り替え（セレクタが既に設定されているため）
      setFormSettingMode('manual');
      // 保存名を設定
      setSaveConfigName(configName);
    }
  }, []);

  // フォームログイン設定を保存
  const handleSaveFormConfig = useCallback(() => {
    if (!saveConfigName.trim()) {
      return;
    }

    const success = saveFormLoginConfig({
      name: saveConfigName.trim(),
      loginUrl: config.loginUrl || '',
      usernameSelector: config.usernameSelector || '',
      passwordSelector: config.passwordSelector || '',
      submitSelector: config.submitSelector || '',
      username: config.username || '',
      password: config.password || '',
    });

    if (success) {
      refreshSavedConfigs();
      setSelectedFormConfig(saveConfigName.trim());
    }
  }, [saveConfigName, config, refreshSavedConfigs]);

  // フォームログイン設定を削除
  const handleDeleteFormConfig = useCallback((configName: string) => {
    if (window.confirm(`"${configName}" を削除しますか？`)) {
      deleteFormLoginConfig(configName);
      refreshSavedConfigs();
      if (selectedFormConfig === configName) {
        setSelectedFormConfig('');
        setSaveConfigName('');
      }
    }
  }, [selectedFormConfig, refreshSavedConfigs]);

  // フォームログイン設定が保存可能か判定
  const canSaveFormConfig = config.type === 'form' &&
    config.loginUrl &&
    config.usernameSelector &&
    config.passwordSelector &&
    config.submitSelector &&
    config.username &&
    config.password &&
    saveConfigName.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>認証設定</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* セッション機能が有効な場合、認証モード選択を表示 */}
          {sessionEnabled && (
            <>
              <FormControl fullWidth>
                <InputLabel id="auth-mode-label">認証方式</InputLabel>
                <Select
                  labelId="auth-mode-label"
                  value={authMode}
                  label="認証方式"
                  onChange={(e) => handleAuthModeChange(e.target.value as AuthMode)}
                >
                  <MenuItem value="session">保存済みセッション</MenuItem>
                  <MenuItem value="manual">手動認証設定</MenuItem>
                </Select>
              </FormControl>

              {authMode === 'session' && (
                <Box sx={{ mt: 1 }}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    保存済みのセッションを選択してください。セッションには認証済みのCookie/トークンが暗号化して保存されています。
                  </Alert>
                  <SessionManager
                    onSessionSelect={handleSessionSelect}
                    selectedSessionId={selectedSessionId}
                    isDevelopment={isDevelopment}
                    onRecordLogin={onRecordLogin}
                  />
                </Box>
              )}

              <Divider sx={{ my: 1 }} />
            </>
          )}

          {/* 手動認証設定（セッションモードでない場合、またはセッション機能が無効な場合） */}
          {(authMode === 'manual' || !sessionEnabled) && (
            <>
              <FormControl fullWidth>
                <InputLabel id="auth-type-label">認証タイプ</InputLabel>
                <Select
                  labelId="auth-type-label"
                  value={config.type}
                  label="認証タイプ"
                  onChange={(e) => handleTypeChange(e.target.value as AuthType)}
                >
                  {Object.entries(AUTH_TYPE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

          {config.type === 'cookie' && (
            <>
              <Alert severity="info" sx={{ mb: 1 }}>
                ブラウザの開発者ツールからCookieをコピーして貼り付けてください。
              </Alert>
              <TextField
                label="Cookie"
                placeholder="name=value; name2=value2"
                multiline
                rows={3}
                value={config.cookies || ''}
                onChange={(e) => handleFieldChange('cookies', e.target.value)}
                fullWidth
              />
            </>
          )}

          {config.type === 'bearer' && (
            <>
              <Alert severity="info" sx={{ mb: 1 }}>
                APIアクセストークンを入力してください。
              </Alert>
              <TextField
                label="Bearer Token"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={config.token || ''}
                onChange={(e) => handleFieldChange('token', e.target.value)}
                fullWidth
              />
            </>
          )}

          {config.type === 'basic' && (
            <>
              <Alert severity="info" sx={{ mb: 1 }}>
                HTTP Basic認証の資格情報を入力してください。
              </Alert>
              <TextField
                label="ユーザー名"
                value={config.username || ''}
                onChange={(e) => handleFieldChange('username', e.target.value)}
                fullWidth
              />
              <TextField
                label="パスワード"
                type="password"
                value={config.password || ''}
                onChange={(e) => handleFieldChange('password', e.target.value)}
                fullWidth
              />
            </>
          )}

          {config.type === 'form' && (
            <>
              {/* 保存済みフォームログイン設定 */}
              {savedFormConfigs.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    保存済みログイン設定
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel id="saved-form-config-label">設定を選択</InputLabel>
                    <Select
                      labelId="saved-form-config-label"
                      value={selectedFormConfig}
                      label="設定を選択"
                      onChange={(e) => handleFormConfigSelect(e.target.value)}
                    >
                      <MenuItem value="">
                        <em>新規設定</em>
                      </MenuItem>
                      {savedFormConfigs.map((cfg) => (
                        <MenuItem key={cfg.name} value={cfg.name}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box>
                              <Typography variant="body2">{cfg.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {cfg.username} @ {new URL(cfg.loginUrl).hostname}
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {selectedFormConfig && (
                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteFormConfig(selectedFormConfig)}
                      >
                        削除
                      </Button>
                    </Box>
                  )}
                </Box>
              )}

              {/* 自動解析モード */}
              {formSettingMode === 'auto' && (
                <>
                  <FormAnalyzerPanel
                    onSelectorsChange={handleSelectorsChange}
                    onModeChange={handleFormSettingModeChange}
                    initialUrl={config.loginUrl}
                  />

                  {/* 解析完了後のみ認証情報入力を表示 */}
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    認証情報
                  </Typography>
                  <TextField
                    label="ユーザー名"
                    value={config.username || ''}
                    onChange={(e) => handleFieldChange('username', e.target.value)}
                    fullWidth
                    disabled={!isAnalysisComplete}
                  />
                  <TextField
                    label="パスワード"
                    type="password"
                    value={config.password || ''}
                    onChange={(e) => handleFieldChange('password', e.target.value)}
                    fullWidth
                    disabled={!isAnalysisComplete}
                  />
                  <TextField
                    label="ログイン成功URLパターン（正規表現）"
                    placeholder="/dashboard, /home"
                    value={config.successUrlPattern || ''}
                    onChange={(e) => handleFieldChange('successUrlPattern', e.target.value)}
                    fullWidth
                    size="small"
                    helperText="ログイン成功後に遷移するURLのパターンを指定（省略可）"
                    disabled={!isAnalysisComplete}
                  />
                </>
              )}

              {/* 手動設定モード */}
              {formSettingMode === 'manual' && (
                <>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    ログインフォームの情報を入力してください。自動でログインを行います。
                  </Alert>
                  <TextField
                    label="ログインURL"
                    placeholder="https://example.com/login"
                    value={config.loginUrl || ''}
                    onChange={(e) => handleFieldChange('loginUrl', e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="ユーザー名"
                    value={config.username || ''}
                    onChange={(e) => handleFieldChange('username', e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="パスワード"
                    type="password"
                    value={config.password || ''}
                    onChange={(e) => handleFieldChange('password', e.target.value)}
                    fullWidth
                  />
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
                    フォーム要素のセレクタ（CSS）
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    ブラウザの開発者ツール（F12）でログインフォームの要素を右クリック →「Copy」→「Copy selector」でセレクタを取得できます。
                  </Typography>
                  <TextField
                    label="ユーザー名入力欄"
                    placeholder="#username, input[name='email']"
                    value={config.usernameSelector || ''}
                    onChange={(e) => handleFieldChange('usernameSelector', e.target.value)}
                    fullWidth
                    size="small"
                    helperText="例: #email, input[name='username'], .login-input"
                  />
                  <TextField
                    label="パスワード入力欄"
                    placeholder="#password, input[type='password']"
                    value={config.passwordSelector || ''}
                    onChange={(e) => handleFieldChange('passwordSelector', e.target.value)}
                    fullWidth
                    size="small"
                    helperText="例: #password, input[type='password']"
                  />
                  <TextField
                    label="送信ボタン"
                    placeholder="button[type='submit'], #login-btn"
                    value={config.submitSelector || ''}
                    onChange={(e) => handleFieldChange('submitSelector', e.target.value)}
                    fullWidth
                    size="small"
                    helperText="例: button[type='submit'], .login-button, #login-btn"
                  />
                  <TextField
                    label="ログイン成功URLパターン（正規表現）"
                    placeholder="/dashboard, /home"
                    value={config.successUrlPattern || ''}
                    onChange={(e) => handleFieldChange('successUrlPattern', e.target.value)}
                    fullWidth
                    size="small"
                    helperText="ログイン成功後に遷移するURLのパターンを指定（省略可）"
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="text"
                      color="inherit"
                      size="small"
                      onClick={() => handleFormSettingModeChange('auto')}
                    >
                      自動解析に切り替え
                    </Button>
                  </Box>
                </>
              )}

              {/* 設定保存UI */}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                設定を保存
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  label="設定名"
                  placeholder="例: 本番環境, テスト環境"
                  value={saveConfigName}
                  onChange={(e) => setSaveConfigName(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  helperText="次回から選択するだけでログインできます"
                />
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveFormConfig}
                  disabled={!canSaveFormConfig}
                  sx={{ mt: 0.5 }}
                >
                  設定を保存
                </Button>
              </Box>
            </>
          )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClear} color="inherit">
          クリア
        </Button>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
