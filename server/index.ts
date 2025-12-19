import express from 'express';
import cors from 'cors';
import { analyzeUrl, type AuthConfig } from './analyzer';
import { getCorsConfig } from './cors-config';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS設定：環境変数ALLOWED_ORIGINSで許可オリジンを指定可能
const corsConfig = getCorsConfig();
app.use(cors(corsConfig));
app.use(express.json());

app.post('/api/analyze', async (req, res) => {
  const { url, auth } = req.body as { url?: string; auth?: AuthConfig };

  if (!url) {
    return res.status(400).json({
      status: 'error',
      error: 'URLが指定されていません',
    });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({
      status: 'error',
      error: '無効なURL形式です',
    });
  }

  // 認証設定のログ（セキュリティのため詳細は出力しない）
  const authType = auth?.type || 'none';
  console.log(`分析開始: ${url} (認証: ${authType})`);

  try {
    const report = await analyzeUrl(url, auth);
    console.log(`分析完了: 違反${report.summary.totalViolations}件, パス${report.summary.totalPasses}件`);
    console.log(`スクリーンショット: ${report.screenshot ? 'あり (' + Math.round(report.screenshot.length / 1024) + 'KB)' : 'なし'}`);

    res.json({
      status: 'completed',
      report,
    });
  } catch (error) {
    console.error('分析エラー:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : '分析中にエラーが発生しました',
    });
  }
});

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
