import React from 'react';
import { DocumentTable } from '../components/documents/DocumentTable';

interface InvoicesPageProps {
  onOpenReview: (id: string) => void;
  onOpenUpload: () => void;
  globalSearch: string;
}

export const InvoicesPage: React.FC<InvoicesPageProps> = ({
  onOpenReview,
  onOpenUpload,
  globalSearch
}) => {
  return (
    <DocumentTable
      documentType="invoice"
      title="Invoices Inbox"
      description="Manage accounts payable, bill items, and vendor invoices"
      onOpenReview={onOpenReview}
      onOpenUpload={onOpenUpload}
      globalSearch={globalSearch}
    />
  );
};
