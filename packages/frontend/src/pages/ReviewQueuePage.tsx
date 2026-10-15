import React from 'react';
import { DocumentTable } from '../components/documents/DocumentTable';

interface ReviewQueuePageProps {
  onOpenReview: (id: string) => void;
  onOpenUpload: () => void;
  globalSearch: string;
}

export const ReviewQueuePage: React.FC<ReviewQueuePageProps> = ({
  onOpenReview,
  onOpenUpload,
  globalSearch
}) => {
  return (
    <DocumentTable
      filterStatus="needs_review"
      title="Verification & Review Queue"
      description="Documents flagged for uncertain fields, missing details, or duplicate collisions"
      onOpenReview={onOpenReview}
      onOpenUpload={onOpenUpload}
      globalSearch={globalSearch}
      spotlightColor="#FFB000"
    />
  );
};
