import type { CollectionCustomizer } from '@forestadmin/datasource-customizer';

import { byId, now } from './utils';

function badge(text: string, color: string): string {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${color};color:#fff;">${text}</span>`;
}

function riskBadge(rating: string): string {
  const colors: Record<string, string> = { LOW: '#16a34a', MEDIUM: '#d97706', HIGH: '#dc2626' };

  return badge(rating || '—', colors[rating] || '#6b7280');
}

function flag(value: unknown, label: string): string {
  return value
    ? `<span style="color:#dc2626;font-weight:600;">⚠ ${label}</span>`
    : '<span style="color:#6b7280;">— No</span>';
}

function row(label: string, value: unknown): string {
  return `<tr><td style="padding:6px 8px;color:#6b7280;font-size:12px;width:38%;">${label}</td><td style="padding:6px 8px;font-size:13px;">${
    value ?? '—'
  }</td></tr>`;
}

export default function customizeKycCases(collection: CollectionCustomizer): void {
  // Relationships
  collection
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })
    .addOneToManyRelation('documents', 'kyc_documents', { originKey: 'kyc_case_id' });

  collection.addAction('Approve KYC', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      const caseId = await context.getRecordId();
      const data = await context.getRecord([
        'customer_id',
        'opened_at',
        'customer:first_name',
        'customer:last_name',
        'customer:email',
        'customer:nationality',
        'customer:risk_rating',
        'customer:is_pep',
        'customer:is_sanctioned',
      ]);
      const c = data.customer ?? {};

      await context.collection.update(byId(caseId), { status: 'APPROVED', resolved_at: now() });
      await context.dataSource
        .getCollection('customers')
        .update(
          { conditionTree: { field: 'id', operator: 'Equal', value: data.customer_id } },
          { onboarding_status: 'APPROVED' },
        );

      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;padding:4px;">
          <div style="background:#16a34a;color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
            <div style="font-size:16px;font-weight:700;">✓ KYC Approved — Onboarding Complete</div>
            <div style="font-size:12px;opacity:0.85;">Customer onboarding status set to APPROVED.</div>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:6px;overflow:hidden;">
            ${row('Name', `<strong>${c.first_name ?? ''} ${c.last_name ?? ''}</strong>`)}
            ${row('Email', c.email)}
            ${row('Nationality', c.nationality)}
            ${row('Risk rating', riskBadge(c.risk_rating as string))}
            ${row('PEP', flag(c.is_pep, 'Politically Exposed Person'))}
            ${row('Sanctions', flag(c.is_sanctioned, 'On sanctions list'))}
            ${row('Case', `#${caseId} · opened ${String(data.opened_at ?? '').slice(0, 10)}`)}
            ${row('Outcome', badge('APPROVED', '#16a34a'))}
          </table>
        </div>`;

      return resultBuilder.success('KYC Approved', { html });
    },
  });

  collection.addAction('Reject KYC', {
    scope: 'Single',
    form: [
      {
        label: 'Rejection Reason',
        type: 'String',
        isRequired: true,
        description: 'Briefly explain why the KYC case is being rejected.',
      },
    ],
    execute: async (context, resultBuilder) => {
      const caseId = await context.getRecordId();

      await context.collection.update(byId(caseId), {
        status: 'REJECTED',
        rejection_reason: context.formValues['Rejection Reason'],
        resolved_at: now(),
      });

      return resultBuilder.success(
        `KYC rejected. Reason recorded: "${context.formValues['Rejection Reason']}".`,
      );
    },
  });

  collection.addAction('Escalate KYC', {
    scope: 'Single',
    form: [
      {
        label: 'Escalation Reason',
        type: 'String',
        isRequired: true,
        description: 'Explain why this case requires senior compliance review.',
      },
    ],
    execute: async (context, resultBuilder) => {
      const caseId = await context.getRecordId();

      await context.collection.update(byId(caseId), {
        status: 'ESCALATED',
        escalation_reason: context.formValues['Escalation Reason'],
      });

      return resultBuilder.success('Case escalated to senior compliance team for review.');
    },
  });
}
