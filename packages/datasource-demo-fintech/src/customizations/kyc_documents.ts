import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { byId, now } from './utils';

const REJECTION_REASONS = [
  'Image quality too low — please resubmit a clearer scan.',
  'Document partially obscured — ensure all corners are visible.',
  'Expiry date unreadable — please provide a higher-resolution image.',
  'Glare detected on security features — retake under natural light.',
];

function panel(title: string, color: string, subtitle: string, rows: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;padding:4px;">
      <div style="background:${color};color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
        <div style="font-size:16px;font-weight:700;">${title}</div>
        <div style="font-size:12px;opacity:0.85;">${subtitle}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:6px;overflow:hidden;">${rows}</table>
    </div>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 8px;color:#6b7280;font-size:12px;width:40%;">${label}</td><td style="padding:6px 8px;font-size:13px;">${value}</td></tr>`;
}

function badgeOutcome(text: string, color: string): string {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${color};color:#fff;">${text}</span>`;
}

export default function customizeKycDocuments(collection: CollectionCustomizer): void {
  // Relationships
  collection
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addManyToOneRelation('kycCase', 'kyc_cases', { foreignKey: 'kyc_case_id' });

  collection.addAction('Verify Document', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      const docId = await context.getRecordId();
      const doc = await context.getRecord(['document_type']);

      const passed = Math.random() < 0.8;
      const scanRef = `SCAN-${Date.now().toString(36).toUpperCase()}`;
      const docLabel = String(doc.document_type).replace(/_/g, ' ');

      if (passed) {
        await context.collection.update(byId(docId), { verified: true, verified_at: now() });

        return resultBuilder.success('Document verified', {
          html: panel(
            '✓ Document Verified',
            '#16a34a',
            'Automated scan completed successfully.',
            [
              row('Document type', docLabel),
              row('Scan reference', `<span style="font-family:monospace;">${scanRef}</span>`),
              row('Outcome', badgeOutcome('VERIFIED', '#16a34a')),
            ].join(''),
          ),
        });
      }

      const reason = REJECTION_REASONS[Math.floor(Math.random() * REJECTION_REASONS.length)];

      return resultBuilder.success('Verification failed', {
        html: panel(
          '⚠ Verification Failed',
          '#d97706',
          'The document could not be verified automatically.',
          [
            row('Document type', docLabel),
            row('Scan reference', `<span style="font-family:monospace;">${scanRef}</span>`),
            row('Reason', `<span style="color:#b45309;">${reason}</span>`),
            row('Outcome', badgeOutcome('NOT VERIFIED', '#d97706')),
          ].join(''),
        ),
      });
    },
  });
}
