import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import VerifiedIcon from '@mui/icons-material/Verified';
import SearchIcon from '@mui/icons-material/Search';
import type { LighthouseScores as LighthouseScoresType } from '../types/accessibility';

interface LighthouseScoresProps {
  scores: LighthouseScoresType;
}

function getScoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 90) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

interface ScoreRowProps {
  icon: React.ReactNode;
  label: string;
  score: number | undefined;
}

function ScoreRow({ icon, label, score }: ScoreRowProps) {
  const displayScore = score ?? 0;
  const isNA = score === undefined;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
      <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
        {icon}
      </Box>
      <Typography variant="body2" sx={{ minWidth: 120 }}>
        {label}
      </Typography>
      <Box sx={{ flexGrow: 1, mr: 2 }}>
        <LinearProgress
          variant="determinate"
          value={displayScore}
          color={isNA ? 'inherit' : getScoreColor(displayScore)}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>
      <Typography
        variant="body2"
        sx={{
          minWidth: 40,
          textAlign: 'right',
          fontWeight: 600,
          color: isNA ? 'text.disabled' : `${getScoreColor(displayScore)}.main`,
        }}
      >
        {isNA ? 'N/A' : displayScore}
      </Typography>
    </Box>
  );
}

export function LighthouseScores({ scores }: LighthouseScoresProps) {
  return (
    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        Lighthouse
      </Typography>
      <ScoreRow icon={<SpeedIcon fontSize="small" />} label="Performance" score={scores.performance} />
      <ScoreRow icon={<AccessibilityNewIcon fontSize="small" />} label="Accessibility" score={scores.accessibility} />
      <ScoreRow icon={<VerifiedIcon fontSize="small" />} label="Best Practices" score={scores.bestPractices} />
      <ScoreRow icon={<SearchIcon fontSize="small" />} label="SEO" score={scores.seo} />
    </Box>
  );
}
