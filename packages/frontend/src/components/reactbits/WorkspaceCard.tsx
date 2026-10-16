import React from 'react';
import SpotlightCard, { type SpotlightCardProps } from './SpotlightCard';

type WorkspaceCardProps = Omit<SpotlightCardProps, 'theme'> & {
  surface?: string;
};

/** LedgerLens cosmic glass shell around React Bits SpotlightCard. */
export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  spotlightColor = '#00D6A0',
  surface = 'rgba(7, 17, 15, 0.74)',
  className = '',
  style,
  children,
  ...rest
}) => (
  <SpotlightCard
    theme="dark"
    spotlightColor={spotlightColor}
    intensity={0.62}
    spotlightSize={230}
    softness={0.72}
    borderGlow={0.85}
    ambient
    className={`!rounded-2xl backdrop-blur-md shadow-[0_18px_42px_-18px_rgba(0,0,0,0.75)] ${/\bp-\d|!p-/.test(className) ? '' : 'p-5'} ${className}`}
    style={{
      ['--spotlight-card-surface' as string]: surface,
      ['--spotlight-card-border' as string]: `${spotlightColor}60`,
      ...style
    }}
    {...rest}
  >
    {children}
  </SpotlightCard>
);
