/**
 * UrlInput コンポーネント
 *
 * Task 3: 複数URL入力機能の実装
 * Requirements: 1.1-1.7, 2.1-2.4, 6.3
 *
 * 複数URLの入力、チップ表示、ドメイン検証を行うフォームコンポーネント。
 * - 最大4つのURLまで追加可能
 * - 同一ドメイン制約の検証
 * - URLチップによる視覚的なフィードバック
 * - カウンター表示（n/4）
 */

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { getDomain } from 'tldts';
import { AuthSettings } from './AuthSettings';
import { UrlChip } from './UrlChip';
import type { AuthConfig, AuthType } from '../types/accessibility';

/** 最大URL数 */
const MAX_URLS = 4;

const getAuthTypeLabel = (type?: AuthType): string => {
  switch (type) {
    case 'cookie': return 'Cookie認証';
    case 'bearer': return 'Bearer Token';
    case 'basic': return 'Basic認証';
    case 'form': return 'フォームログイン';
    default: return '認証なし';
  }
};

/**
 * URLから登録可能ドメイン（registrable domain）を抽出する
 * tldtsを使用してサブドメインを除いたドメインを取得する
 * 例: news.yahoo.co.jp → yahoo.co.jp
 *     www.example.com → example.com
 */
function getRegistrableDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    // tldtsを使用して登録可能ドメインを取得
    const domain = getDomain(hostname);
    // getDomainがnullを返す場合（ローカルホストやIPアドレスなど）はホスト名をそのまま使用
    return domain || hostname;
  } catch {
    return null;
  }
}

/**
 * URLの形式を検証する
 */
function validateUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * URLにプロトコルを付与する（必要な場合）
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return 'https://' + trimmed;
  }
  return trimmed;
}

interface UrlInputProps {
  /**
   * 分析開始時のコールバック
   * @param urls 分析対象URL配列
   * @param auth 手動認証設定（オプション）
   * @param sessionId セッションID（オプション）
   * @param passphrase セッションのパスフレーズ（オプション）
   */
  onAnalyze: (urls: string[], auth?: AuthConfig, sessionId?: string, passphrase?: string) => void;
  disabled?: boolean;
  compact?: boolean;
  initialValue?: string;
  /** 初期URL配列（複数URL対応） */
  initialUrls?: string[];
  /** セッション管理UIを表示するかどうか（デフォルト: false - 後方互換性のため） */
  showSessionManager?: boolean;
  /** 開発環境フラグ（ログイン記録ボタン表示用） */
  isDevelopment?: boolean;
}

export function UrlInput({
  onAnalyze,
  disabled,
  compact = false,
  initialValue = '',
  initialUrls = [],
  showSessionManager = false,
  isDevelopment = false,
}: UrlInputProps) {
  // 複数URL管理用の状態
  const [urls, setUrls] = useState<string[]>(initialUrls);
  // 入力中のURL
  const [inputValue, setInputValue] = useState(initialValue);
  // ドメイン検証エラー
  const [domainError, setDomainError] = useState<string | null>(null);

  const [authConfig, setAuthConfig] = useState<AuthConfig | undefined>(undefined);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  // セッション管理用の状態
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionPassphrase, setSessionPassphrase] = useState<string | undefined>(undefined);

  /**
   * URLを追加する
   * - URL形式チェック
   * - 重複チェック
   * - ドメイン検証（2つ目以降）
   */
  const addUrl = useCallback((url: string) => {
    const normalizedUrl = normalizeUrl(url);

    // URL形式チェック
    if (!validateUrl(normalizedUrl)) {
      return false;
    }

    // 最大数チェック
    if (urls.length >= MAX_URLS) {
      return false;
    }

    // 重複チェック
    if (urls.includes(normalizedUrl)) {
      return false;
    }

    // ドメイン検証（2つ目以降）- サブドメインは同一ドメインとして扱う
    if (urls.length > 0) {
      const existingDomain = getRegistrableDomain(urls[0]);
      const newDomain = getRegistrableDomain(normalizedUrl);

      if (existingDomain !== newDomain) {
        setDomainError('同一ドメインのURLのみ追加できます');
        return false;
      }
    }

    // エラーをクリアしてURLを追加
    setDomainError(null);
    setUrls((prev) => [...prev, normalizedUrl]);
    return true;
  }, [urls]);

  /**
   * URLを削除する
   */
  const removeUrl = useCallback((index: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== index));
    setDomainError(null);
  }, []);

  /**
   * キー入力ハンドラー
   * Enterキーでチップ追加
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (addUrl(inputValue)) {
        setInputValue('');
      }
    }
  };

  /**
   * フォーム送信ハンドラー
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 入力中のURLがある場合は配列に追加
    let urlsToAnalyze = [...urls];
    if (inputValue.trim()) {
      const normalizedUrl = normalizeUrl(inputValue);
      if (validateUrl(normalizedUrl)) {
        // ドメイン検証（既存URLがある場合）- サブドメインは同一ドメインとして扱う
        if (urls.length > 0) {
          const existingDomain = getRegistrableDomain(urls[0]);
          const newDomain = getRegistrableDomain(normalizedUrl);
          if (existingDomain !== newDomain) {
            setDomainError('同一ドメインのURLのみ追加できます');
            return;
          }
        }
        if (!urls.includes(normalizedUrl)) {
          urlsToAnalyze = [...urls, normalizedUrl];
        }
      }
    }

    if (urlsToAnalyze.length === 0) {
      return;
    }

    // セッション選択時はセッションIDとパスフレーズを渡す
    if (selectedSessionId) {
      onAnalyze(urlsToAnalyze, undefined, selectedSessionId, sessionPassphrase);
    } else {
      onAnalyze(urlsToAnalyze, authConfig);
    }
  };

  // セッション選択ハンドラー
  const handleSessionSelect = (sessionId: string | null) => {
    setSelectedSessionId(sessionId);
    if (sessionId) {
      // セッション選択時はパスフレーズを設定（現時点では空文字列として初期化）
      // 実際のパスフレーズ入力は Task 10 で実装予定
      setSessionPassphrase('');
    } else {
      setSessionPassphrase(undefined);
    }
  };

  const hasAuth = authConfig && authConfig.type !== 'none';
  const hasSession = !!selectedSessionId;
  const isMaxUrls = urls.length >= MAX_URLS;
  const hasUrlsOrInput = urls.length > 0 || inputValue.trim();

  return (
    <>
      <Box sx={{ width: compact ? '100%' : { xs: '90%', sm: '600px', md: '700px' }, maxWidth: '700px', mx: 'auto' }}>
        <Paper
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            px: 3,
            py: 1.5,
            borderRadius: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            backgroundColor: 'white',
            border: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* チップ表示エリア */}
          {urls.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                mb: 1,
                pb: 1,
                borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
              }}
            >
              {urls.map((url, index) => (
                <UrlChip
                  key={url}
                  url={url}
                  onDelete={() => removeUrl(index)}
                  disabled={disabled}
                />
              ))}
            </Box>
          )}

          {/* 入力エリア */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip
              title={
                hasSession
                  ? 'セッション認証使用中'
                  : hasAuth
                    ? `認証設定済み (${getAuthTypeLabel(authConfig?.type)})`
                    : '認証設定'
              }
              aria-label="認証設定"
            >
              <IconButton
                onClick={() => setAuthDialogOpen(true)}
                disabled={disabled}
                aria-label="認証設定"
                sx={{
                  mr: 1,
                  color: hasSession ? 'primary.main' : hasAuth ? 'success.main' : 'text.secondary',
                }}
              >
                <Badge
                  color={hasSession ? 'primary' : 'success'}
                  variant="dot"
                  invisible={!hasAuth && !hasSession}
                >
                  {hasAuth || hasSession ? <LockIcon /> : <LockOpenIcon />}
                </Badge>
              </IconButton>
            </Tooltip>
            <InputBase
              sx={{
                flex: 1,
                fontSize: '1rem',
                '& input::placeholder': {
                  color: 'text.secondary',
                  opacity: 0.7,
                },
              }}
              placeholder="分析したいURLを入力してください..."
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setDomainError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={disabled || isMaxUrls}
            />
            {/* カウンター */}
            <Typography
              variant="caption"
              sx={{
                color: isMaxUrls ? 'warning.main' : 'text.secondary',
                mx: 1,
                fontWeight: isMaxUrls ? 'bold' : 'normal',
              }}
            >
              {urls.length}/{MAX_URLS}
            </Typography>
            <Box sx={{ width: '1px', height: 24, bgcolor: 'divider', mx: 1 }} />
            <IconButton
              type="submit"
              disabled={disabled || !hasUrlsOrInput}
              sx={{
                p: 1.5,
                bgcolor: hasUrlsOrInput ? 'primary.main' : 'grey.300',
                color: 'white',
                '&:hover': {
                  bgcolor: hasUrlsOrInput ? 'primary.dark' : 'grey.300',
                },
                '&.Mui-disabled': {
                  bgcolor: 'grey.300',
                  color: 'white',
                },
              }}
            >
              <ArrowUpwardIcon />
            </IconButton>
          </Box>
        </Paper>

        {/* ドメインエラー表示 */}
        {domainError && (
          <Alert severity="error" sx={{ mt: 1, borderRadius: '12px' }}>
            {domainError}
          </Alert>
        )}
      </Box>

      <AuthSettings
        open={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        authConfig={authConfig}
        onSave={setAuthConfig}
        // セッション機能が有効な場合のみセッション関連propsを渡す
        onSessionSelect={showSessionManager ? handleSessionSelect : undefined}
        selectedSessionId={showSessionManager ? selectedSessionId : undefined}
        isDevelopment={isDevelopment}
      />
    </>
  );
}
