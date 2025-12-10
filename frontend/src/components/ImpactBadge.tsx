import Chip from '@mui/material/Chip';
import type { Impact } from '../types/accessibility';
import { impactColors } from '../theme';

interface ImpactBadgeProps {
  impact?: Impact;
}

const impactLabels: Record<Impact, string> = {
  critical: '致命的',
  serious: '重大',
  moderate: '中程度',
  minor: '軽微',
};

export function ImpactBadge({ impact }: ImpactBadgeProps) {
  if (!impact) {
    return <Chip label="不明" size="small" />;
  }

  return (
    <Chip
      label={impactLabels[impact]}
      size="small"
      sx={{
        backgroundColor: impactColors[impact],
        color: impact === 'moderate' ? 'black' : 'white',
        fontWeight: 'bold',
      }}
    />
  );
}
