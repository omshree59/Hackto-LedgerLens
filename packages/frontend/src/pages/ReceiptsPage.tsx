import React from 'react';
import { DocumentTable } from '../components/documents/DocumentTable';

interface ReceiptsPageProps {
  onOpenReview: (id: string) => void;
  onOpenUpload: () => void;
  globalSearch: string;
}

export const ReceiptsPage: React.FC<ReceiptsPageProps> = ({
  onOpenReview,
  onOpenUpload,
  globalSearch
}) => {
  return (
    <DocumentTable
      documentType="receipt"
      title="Receipts & Expenses"
      description="Track receipts, card charges, dining, and travel expenses"
      onOpenReview={onOpenReview}
      onOpenUpload={onOpenUpload}
      globalSearch={globalSearch}
      spotlightColor="#3185FF"
    />
  );
};
