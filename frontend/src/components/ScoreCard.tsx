import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import BarChartIcon from '@mui/icons-material/BarChart';
import type { CategoryScore } from '../utils/scoreCalculator';

interface ScoreCardProps {
  totalScore: number;
  categories: CategoryScore[];
}

function CategoryProgressBar({ category }: { category: CategoryScore }) {
  const getProgressColor = (score: number): string => {
    if (score >= 90) return '#4caf50';
    if (score >= 70) return '#2196f3';
    if (score >= 50) return '#ff9800';
    return '#f44336';
  };

  return (
    <Box sx={{ flex: 1, minWidth: '200px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <BarChartIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {category.name}
        </Typography>
        <Typography variant="body2" fontWeight="bold">
          {category.score}点
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={category.score}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: 'grey.200',
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            bgcolor: getProgressColor(category.score),
          },
        }}
      />
    </Box>
  );
}

export function ScoreCard({ totalScore, categories }: ScoreCardProps) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            分析レポート
          </Typography>
          <Typography variant="body2" color="text.secondary">
            axe-core・pa11y・Lighthouseによる総合診断結果
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary">
            総合スコア
          </Typography>
          <Typography variant="h3" fontWeight="bold" sx={{ lineHeight: 1 }}>
            {totalScore}
            <Typography component="span" variant="h5" color="text.secondary">
              /100
            </Typography>
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 3,
        }}
      >
        {categories.map((category) => (
          <CategoryProgressBar key={category.nameEn} category={category} />
        ))}
      </Box>
    </Box>
  );
}
