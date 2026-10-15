import React from 'react';
import SpotlightCard, { type SpotlightCardProps } from './SpotlightCard';

type WorkspaceCardProps = Omit<SpotlightCardProps, 'theme'> & {
  surface?: string;
};

/** LedgerLens shell around React Bits SpotlightCard. */
export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  spotlightColor = '#00D6A0',
  surface = '#0c1813',
  className = '',
  style,
  children,
  ...rest
}) => (
  <SpotlightCard
    theme="dark"
    spotlightColor={spotlightColor}
    intensity={0.55}
    spotlightSize={210}
    softness={0.74}
    borderGlow={0.7}
    ambient
    className={`!rounded-2xl ${/\bp-\d|!p-/.test(className) ? '' : 'p-5'} ${className}`}
    style={{
      ['--spotlight-card-surface' as string]: surface,
      ['--spotlight-card-border' as string]: `${spotlightColor}44`,
      ...style
    }}
    {...rest}
  >
    {children}
  </SpotlightCard>
);
