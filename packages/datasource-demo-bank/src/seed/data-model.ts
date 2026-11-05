/**
 * The data model: the 59 tables with their typed fields and dropdown values, the
 * one-to-many links (relations), the join tables (manyToMany) and where the status history lives.
 * Read through schema.ts; the generators in this folder only decide what goes in the rows.
 *
 * Conventions every table follows:
 * - Every id is a UUID (primary and foreign keys alike): it cannot be mistaken for an amount or a
 *   count, and an id from one table can never match a row of another by accident. Human-readable
 *   references (such as KYC-2026-004512) are separate fields.
 * - Every case table has a reference staff quote on the phone, in letters and audits:
 *   PREFIX-YEAR-NUMBER, e.g. KYC-2026-004512. Prefixes: CUS customers, KYC kyc_cases, ALR alerts,
 *   INV investigations, SAR sar_reports, HIT screening_hits, DSP dispute_requests, CBK chargebacks,
 *   SEP sepa_disputes, APP loan_applications, LON loans, COL collection_cases, LIM limit_requests,
 *   CMP complaints, CHG customer_change_requests, CLO closures, HLD holds, AUT authority_requests,
 *   EVT business_events, INS insolvency_proceedings, DEC deceased_cases, QA qa_reviews, RFI
 *   information_requests.
 * - Amounts are in euros unless a currency field says otherwise: only accounts, transactions, fees,
 *   card payments abroad (original currency) and transfers carry one.
 * - Status history lives in one status_changes table: record_id is the id of the changed row in any
 *   case table (UUIDs never collide across tables), record_type names the table. The few dates a
 *   banker expects to read on the record itself (escalated_at, filed_at...) stay as fields.
 * - Countries are ISO 3166 two-letter codes (FR, DE), currencies ISO 4217 codes (EUR), operators
 *   are identified by their email in *_by fields.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dataModel: { tables: Record<string, any>; [key: string]: any } = {
  tables: {
    alerts: {
      fields: [
        {
          name: 'alert_type',
          type: 'enum',
          enum: [
            'STRUCTURING',
            'RAPID_MOVEMENT',
            'UNUSUAL_VOLUME',
            'HIGH_RISK_COUNTRY',
            'SANCTIONS_MATCH',
            'SUSPICIOUS_PATTERN',
            'CARD_TESTING',
            'UNUSUAL_CARD_SPEND',
            'NEW_DEVICE_NEW_PAYEE',
            'IMPOSSIBLE_TRAVEL',
            'MULE_PATTERN',
            'INCOMING_FRAUD_RECALL',
            'CUSTOMER_REPORT',
            'REPEATED_DISPUTES',
            'INVOICE_IBAN_CHANGE',
          ],
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'resolution_notes',
          type: 'string',
        },
        {
          name: 'resolved_at',
          type: 'datetime',
        },
        {
          name: 'severity',
          type: 'enum',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['OPEN', 'IN_REVIEW', 'SECOND_LOOK', 'ESCALATED', 'CLEARED'],
        },
        {
          name: 'triggered_at',
          type: 'datetime',
        },
        {
          name: 'category',
          type: 'enum',
          enum: ['AML', 'FRAUD', 'ACCOUNT_TAKEOVER'],
        },
        {
          name: 'rule_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'login_event_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'investigation_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'score',
          type: 'decimal',
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
        {
          name: 'reviewed_by',
          type: 'string',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'escalated_at',
          type: 'datetime',
        },
        {
          name: 'clearance_reason',
          type: 'enum',
          enum: [
            'FALSE_POSITIVE',
            'EXPLAINED_BY_PROFILE',
            'DUPLICATE',
            'ALREADY_INVESTIGATED',
            'VERIFIED_WITH_COUNTERPARTY',
          ],
        },
        {
          name: 'source',
          type: 'enum',
          enum: ['RULE', 'MANUAL'],
        },
        {
          name: 'created_by',
          type: 'string',
        },
        {
          name: 'device_checked_at',
          type: 'datetime',
        },
        {
          name: 'called_at',
          type: 'datetime',
        },
        {
          name: 'call_outcome',
          type: 'enum',
          enum: ['CONFIRMED', 'DENIED', 'NOT_REACHED'],
        },
        {
          name: 'due_at',
          type: 'datetime',
        },
      ],
    },
    cards: {
      fields: [
        {
          name: 'blocked_at',
          type: 'datetime',
        },
        {
          name: 'card_type',
          type: 'enum',
          enum: ['PHYSICAL', 'VIRTUAL'],
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'expires_at',
          type: 'date',
        },
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'issued_at',
          type: 'datetime',
        },
        {
          name: 'last_four_digits',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['PENDING', 'ACTIVE', 'BLOCKED', 'EXPIRED', 'CANCELLED'],
        },
        {
          name: 'account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'holder_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'network',
          type: 'enum',
          enum: ['VISA', 'MASTERCARD'],
        },
        {
          name: 'embossed_name',
          type: 'string',
        },
        {
          name: 'activated_at',
          type: 'datetime',
        },
        {
          name: 'card_token',
          type: 'string',
        },
        {
          name: 'replaces_card_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'blocked_reason',
          type: 'enum',
          enum: ['LOST', 'STOLEN', 'FRAUD', 'AML_FREEZE', 'CUSTOMER_REQUEST', 'ACCOUNT_CLOSED'],
        },
      ],
    },
    chargebacks: {
      fields: [
        {
          name: 'amount',
          type: 'decimal',
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'currency',
          type: 'string',
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'days_to_deadline',
          type: 'integer',
        },
        {
          name: 'decision_at',
          type: 'datetime',
        },
        {
          name: 'evidence_submitted_at',
          type: 'datetime',
        },
        {
          name: 'filed_at',
          type: 'datetime',
        },
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'is_overdue',
          type: 'boolean',
        },
        {
          name: 'network',
          type: 'enum',
          enum: ['VISA', 'MASTERCARD'],
        },
        {
          name: 'processor_dispute_id',
          type: 'string',
        },
        {
          name: 'provisional_credit_issued',
          type: 'boolean',
        },
        {
          name: 'reason_code',
          type: 'string',
        },
        {
          name: 'reason_description',
          type: 'string',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'representment_deadline',
          type: 'datetime',
        },
        {
          name: 'resolution_notes',
          type: 'string',
        },
        {
          name: 'source',
          type: 'enum',
          enum: ['CUSTOMER_REQUEST', 'FRAUD_DETECTION'],
        },
        {
          name: 'status',
          type: 'enum',
          enum: [
            'INITIATED',
            'WAITING_CARDHOLDER',
            'PRESENTED',
            'REPRESENTED',
            'PRE_ARBITRATION',
            'ARBITRATION',
            'WON',
            'LOST',
            'WITHDRAWN',
          ],
        },
        {
          name: 'updated_at',
          type: 'datetime',
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'dispute_request_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'provisional_credit_transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'representment_received_at',
          type: 'datetime',
        },
        {
          name: 'representment_reason',
          type: 'string',
        },
        {
          name: 'pre_arbitration_filed_at',
          type: 'datetime',
        },
        {
          name: 'provisional_credit_reversed_at',
          type: 'datetime',
        },
        {
          name: 'card_transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'alert_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
      ],
    },
    customers: {
      fields: [
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'referral_code',
          type: 'string',
        },
        {
          name: 'risk_rating',
          type: 'enum',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
        },
        {
          name: 'updated_at',
          type: 'datetime',
        },
        {
          name: 'display_name',
          type: 'string',
        },
        {
          name: 'customer_type',
          type: 'enum',
          enum: ['RETAIL', 'BUSINESS'],
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['PROSPECT', 'DECLINED', 'ONBOARDING', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED'],
        },
        {
          name: 'business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'next_review_at',
          type: 'datetime',
        },
        {
          name: 'expected_monthly_in',
          type: 'decimal',
        },
        {
          name: 'expected_monthly_out',
          type: 'decimal',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'preferred_language',
          type: 'enum',
          enum: ['FR', 'EN', 'DE', 'ES', 'IT', 'NL'],
        },
        {
          name: 'onboarding_channel',
          type: 'enum',
          enum: ['APP', 'WEB', 'BRANCH', 'PARTNER'],
        },
        {
          name: 'onboarded_at',
          type: 'datetime',
        },
        {
          name: 'relationship_manager',
          type: 'string',
        },
        {
          name: 'partner',
          type: 'string',
        },
      ],
    },
    kyc_cases: {
      fields: [
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'escalation_reason',
          type: 'string',
        },
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'notes',
          type: 'string',
        },
        {
          name: 'opened_at',
          type: 'datetime',
        },
        {
          name: 'rejection_reason',
          type: 'string',
        },
        {
          name: 'resolved_at',
          type: 'datetime',
        },
        {
          name: 'status',
          type: 'enum',
          enum: [
            'OPEN',
            'IN_REVIEW',
            'WAITING_CUSTOMER',
            'PENDING_APPROVAL',
            'ESCALATED',
            'APPROVED',
            'REJECTED',
          ],
        },
        {
          name: 'type',
          type: 'enum',
          enum: ['ONBOARDING', 'PERIODIC_REVIEW', 'EVENT_REVIEW', 'REMEDIATION'],
        },
        {
          name: 'trigger',
          type: 'enum',
          enum: [
            'SCHEDULED',
            'SANCTIONS_HIT',
            'ADVERSE_MEDIA',
            'OWNERSHIP_CHANGE',
            'DOCUMENT_EXPIRED',
            'AML_INVESTIGATION',
          ],
        },
        {
          name: 'due_at',
          type: 'datetime',
        },
        {
          name: 'risk_before',
          type: 'enum',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
        },
        {
          name: 'risk_after',
          type: 'enum',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
        },
        {
          name: 'investigation_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
        {
          name: 'decided_by',
          type: 'string',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'channel',
          type: 'enum',
          enum: ['APP', 'WEB', 'BRANCH', 'PARTNER'],
        },
        {
          name: 'escalated_at',
          type: 'datetime',
        },
        {
          name: 'updated_at',
          type: 'datetime',
        },
        {
          name: 'rejection_code',
          type: 'enum',
          enum: [
            'IDENTITY_FAILED',
            'DOCUMENT_FORGED',
            'SYNTHETIC_IDENTITY',
            'UBO_MISMATCH',
            'RISK_APPETITE',
            'NO_RESPONSE',
          ],
        },
        {
          name: 'partner',
          type: 'string',
        },
      ],
    },
    documents: {
      fields: [
        {
          name: 'document_type',
          type: 'enum',
          enum: [
            'PASSPORT',
            'NATIONAL_ID',
            'DRIVERS_LICENSE',
            'SELFIE',
            'PROOF_OF_ADDRESS',
            'BANK_STATEMENT',
            'PROOF_OF_INCOME',
            'COMPANY_REGISTRATION',
            'ARTICLES_OF_ASSOCIATION',
            'UBO_DECLARATION',
            'GUARANTEE_DEED',
            'COURT_ORDER',
            'DEATH_CERTIFICATE',
          ],
        },
        {
          name: 'file_url',
          type: 'string',
        },
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'kyc_case_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'uploaded_at',
          type: 'datetime',
        },
        {
          name: 'verified',
          type: 'boolean',
        },
        {
          name: 'verified_at',
          type: 'datetime',
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'information_request_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'document_number',
          type: 'string',
        },
        {
          name: 'issued_at',
          type: 'datetime',
        },
        {
          name: 'expires_at',
          type: 'datetime',
        },
        {
          name: 'issuing_country',
          type: 'string',
        },
        {
          name: 'check_result',
          type: 'enum',
          enum: ['PASSED', 'FAILED', 'MANUAL_REVIEW'],
        },
        {
          name: 'failure_reason',
          type: 'string',
        },
        {
          name: 'verified_by',
          type: 'string',
        },
        {
          name: 'provider_check_id',
          type: 'string',
        },
        {
          name: 'source',
          type: 'enum',
          enum: ['CUSTOMER_APP', 'OPERATOR_UPLOAD', 'PROVIDER', 'EMAIL'],
        },
        {
          name: 'file_name',
          type: 'string',
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'partner',
          type: 'string',
        },
      ],
    },
    dispute_requests: {
      fields: [
        {
          name: 'amount',
          type: 'decimal',
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'currency',
          type: 'string',
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'reason',
          type: 'enum',
          enum: [
            'UNAUTHORIZED',
            'DUPLICATE_CHARGE',
            'CANCELLED_ORDER',
            'CANCELLED_RECURRING',
            'ITEM_NOT_RECEIVED',
            'SERVICE_NOT_RENDERED',
            'WRONG_BENEFICIARY',
            'WRONG_AMOUNT',
            'NO_MANDATE',
            'MANDATE_REVOKED',
            'SCAM',
          ],
        },
        {
          name: 'reason_detail',
          type: 'string',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'requested_at',
          type: 'datetime',
        },
        {
          name: 'resolution_notes',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['NEW', 'WAITING_CUSTOMER', 'UNDER_INVESTIGATION', 'ROUTED', 'CLOSED'],
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'route',
          type: 'enum',
          enum: ['CHARGEBACK', 'SEPA_DISPUTE', 'BANK_REFUND', 'CONTACT_MERCHANT', 'DECLINED'],
        },
        {
          name: 'merchant_contacted_at',
          type: 'datetime',
        },
        {
          name: 'channel',
          type: 'enum',
          enum: ['APP', 'WEB', 'PHONE', 'EMAIL', 'BRANCH'],
        },
        {
          name: 'routed_at',
          type: 'datetime',
        },
        {
          name: 'closed_at',
          type: 'datetime',
        },
        {
          name: 'payment_type',
          type: 'enum',
          enum: ['CARD', 'DIRECT_DEBIT', 'TRANSFER', 'INSTANT_TRANSFER', 'WERO'],
        },
        {
          name: 'card_transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'direct_debit_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'outgoing_transfer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'investigation_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'created_by',
          type: 'string',
        },
        {
          name: 'support_ticket_ref',
          type: 'string',
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
        {
          name: 'bdf_notified_at',
          type: 'datetime',
        },
        {
          name: 'alert_id',
          type: 'uuid',
          foreignKey: true,
        },
      ],
    },
    sar_reports: {
      fields: [
        {
          name: 'activity_end_date',
          type: 'date',
        },
        {
          name: 'activity_start_date',
          type: 'date',
        },
        {
          name: 'activity_type',
          type: 'enum',
          enum: [
            'STRUCTURING',
            'RAPID_MOVEMENT',
            'UNUSUAL_VOLUME',
            'HIGH_RISK_COUNTRY',
            'SANCTIONS_MATCH',
            'SUSPICIOUS_PATTERN',
          ],
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'filed_at',
          type: 'datetime',
        },
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'narrative',
          type: 'string',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'ANSWERED'],
        },
        {
          name: 'total_amount',
          type: 'decimal',
        },
        {
          name: 'transaction_count',
          type: 'integer',
        },
        {
          name: 'investigation_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'currency',
          type: 'string',
        },
        {
          name: 'fiu_reference',
          type: 'string',
        },
        {
          name: 'filed_by',
          type: 'string',
        },
        {
          name: 'acknowledged_at',
          type: 'datetime',
        },
        {
          name: 'updated_at',
          type: 'datetime',
        },
        {
          name: 'tracfin_answer',
          type: 'enum',
          enum: ['RELEASE_ACCOUNTS', 'KEEP_BLOCKED', 'EXIT_RELATIONSHIP'],
        },
        {
          name: 'tracfin_answered_at',
          type: 'datetime',
        },
        {
          name: 'tracfin_note',
          type: 'string',
        },
      ],
    },
    accounts: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'iban',
          type: 'string',
        },
        {
          name: 'type',
          type: 'enum',
          enum: ['CURRENT', 'SAVINGS', 'BUSINESS'],
        },
        {
          name: 'currency',
          type: 'string',
        },
        {
          name: 'plan',
          type: 'enum',
          enum: ['STANDARD', 'PREMIUM', 'METAL', 'BUSINESS_PRO'],
        },
        {
          name: 'balance',
          type: 'decimal',
        },
        {
          name: 'available_balance',
          type: 'decimal',
        },
        {
          name: 'overdraft_limit',
          type: 'decimal',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['ACTIVE', 'FROZEN', 'DORMANT', 'CLOSED'],
        },
        {
          name: 'opened_at',
          type: 'datetime',
        },
        {
          name: 'last_activity_at',
          type: 'datetime',
        },
        {
          name: 'closed_at',
          type: 'datetime',
        },
        {
          name: 'bic',
          type: 'string',
        },
        {
          name: 'name',
          type: 'string',
        },
        {
          name: 'frozen_at',
          type: 'datetime',
        },
        {
          name: 'freeze_reason',
          type: 'enum',
          enum: [
            'FRAUD_SUSPICION',
            'AML_INVESTIGATION',
            'SANCTIONS',
            'AUTHORITY_REQUEST',
            'CUSTOMER_REQUEST',
            'DECEASED',
            'SAR_FILED',
          ],
        },
        {
          name: 'interest_rate',
          type: 'decimal',
        },
        {
          name: 'purpose',
          type: 'enum',
          enum: ['DAILY_BANKING', 'SAVINGS', 'SALARY', 'BUSINESS_OPERATIONS', 'INVESTMENT'],
        },
        {
          name: 'freeze_note',
          type: 'string',
        },
      ],
    },
    transactions: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'counterparty_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'initiated_by_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'device_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'rail',
          type: 'enum',
          enum: ['CARD', 'TRANSFER', 'DIRECT_DEBIT', 'WERO', 'WALLET', 'FEE', 'INTERNAL'],
        },
        {
          name: 'direction',
          type: 'enum',
          enum: ['DEBIT', 'CREDIT'],
        },
        {
          name: 'amount',
          type: 'decimal',
        },
        {
          name: 'currency',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['PENDING', 'HELD', 'BOOKED', 'REVERSED', 'REJECTED'],
        },
        {
          name: 'booked_at',
          type: 'datetime',
        },
        {
          name: 'value_date',
          type: 'date',
        },
        {
          name: 'balance_after',
          type: 'decimal',
        },
        {
          name: 'description',
          type: 'string',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'status_reason',
          type: 'string',
        },
        {
          name: 'reversed_at',
          type: 'datetime',
        },
        {
          name: 'category',
          type: 'enum',
          enum: [
            'GROCERIES',
            'TRANSPORT',
            'RESTAURANTS',
            'SHOPPING',
            'BILLS',
            'SALARY',
            'CASH',
            'TRANSFERS',
            'REFUNDS',
            'FEES',
            'LOANS',
            'OTHER',
          ],
        },
      ],
    },
    card_transactions: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'card_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'merchant_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'type',
          type: 'enum',
          enum: ['PURCHASE', 'ATM_WITHDRAWAL'],
        },
        {
          name: 'authorization_code',
          type: 'string',
        },
        {
          name: 'entry_mode',
          type: 'enum',
          enum: ['CHIP', 'CONTACTLESS', 'ONLINE', 'MOBILE_WALLET'],
        },
        {
          name: 'is_3ds',
          type: 'boolean',
        },
        {
          name: 'country',
          type: 'string',
        },
        {
          name: 'original_amount',
          type: 'decimal',
        },
        {
          name: 'original_currency',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['AUTHORIZED', 'DECLINED', 'CLEARED', 'SETTLED', 'REVERSED', 'EXPIRED'],
        },
        {
          name: 'authorized_at',
          type: 'datetime',
        },
        {
          name: 'decline_reason',
          type: 'enum',
          enum: [
            'INSUFFICIENT_FUNDS',
            'WRONG_PIN',
            'SUSPECTED_FRAUD',
            'CARD_BLOCKED',
            'LIMIT_EXCEEDED',
            'EXPIRED_CARD',
          ],
        },
        {
          name: 'cleared_at',
          type: 'datetime',
        },
        {
          name: 'settled_at',
          type: 'datetime',
        },
        {
          name: 'acquirer_reference_number',
          type: 'string',
        },
        {
          name: 'exchange_rate',
          type: 'decimal',
        },
        {
          name: 'wallet_type',
          type: 'enum',
          enum: ['APPLE_PAY', 'GOOGLE_PAY', 'SAMSUNG_PAY'],
        },
        {
          name: 'city',
          type: 'string',
        },
      ],
    },
    direct_debits: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'mandate_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'amount',
          type: 'decimal',
        },
        {
          name: 'mandate_type',
          type: 'enum',
          enum: ['CORE', 'B2B'],
        },
        {
          name: 'sequence',
          type: 'enum',
          enum: ['FIRST', 'RECURRING', 'ONE_OFF'],
        },
        {
          name: 'collection_date',
          type: 'date',
        },
        {
          name: 'return_reason',
          type: 'string',
        },
        {
          name: 'end_to_end_id',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['SCHEDULED', 'COLLECTED', 'REJECTED', 'RETURNED', 'REFUNDED'],
        },
        {
          name: 'received_at',
          type: 'datetime',
        },
      ],
    },
    wero_payments: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'wero_contact_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'direction',
          type: 'enum',
          enum: ['SENT', 'RECEIVED'],
        },
        {
          name: 'flow',
          type: 'enum',
          enum: ['P2P', 'ECOMMERCE', 'REQUEST_TO_PAY'],
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['REQUESTED', 'PAID', 'DECLINED', 'EXPIRED'],
        },
        {
          name: 'proxy_used',
          type: 'string',
        },
        {
          name: 'message',
          type: 'string',
        },
        {
          name: 'requested_at',
          type: 'datetime',
        },
        {
          name: 'expires_at',
          type: 'datetime',
        },
        {
          name: 'paid_at',
          type: 'datetime',
        },
        {
          name: 'decline_reason',
          type: 'string',
        },
        {
          name: 'merchant_order_id',
          type: 'string',
        },
      ],
    },
    wallet_transfers: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'peer_account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'transfer_reference',
          type: 'string',
        },
        {
          name: 'message',
          type: 'string',
        },
      ],
    },
    fees: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'triggered_by_transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'type',
          type: 'enum',
          enum: [
            'MONTHLY_PLAN',
            'CARD_ANNUAL',
            'CARD_REPLACEMENT',
            'FOREIGN_CARD_PAYMENT',
            'FOREIGN_ATM_WITHDRAWAL',
            'INSTANT_TRANSFER',
            'REJECTED_PAYMENT',
            'OVERDRAFT',
            'PAPER_STATEMENT',
          ],
        },
        {
          name: 'amount',
          type: 'decimal',
        },
        {
          name: 'currency',
          type: 'string',
        },
        {
          name: 'period',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['CHARGED', 'WAIVED', 'REFUNDED'],
        },
        {
          name: 'charged_at',
          type: 'datetime',
        },
        {
          name: 'waived_by',
          type: 'string',
        },
        {
          name: 'waiver_reason',
          type: 'string',
        },
        {
          name: 'waived_at',
          type: 'datetime',
        },
        {
          name: 'refunded_at',
          type: 'datetime',
        },
        {
          name: 'refund_transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
      ],
    },
    counterparties: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'counterparty_type',
          type: 'enum',
          enum: [
            'CARD_MERCHANT',
            'SCT_EMITTER',
            'SCT_BENEFICIARY',
            'SDD_CREDITOR',
            'WERO_CONTACT',
            'WALLET_PEER',
          ],
        },
        {
          name: 'name',
          type: 'string',
        },
        {
          name: 'country',
          type: 'string',
        },
        {
          name: 'risk_level',
          type: 'enum',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
        },
        {
          name: 'is_blocked',
          type: 'boolean',
        },
        {
          name: 'first_seen_at',
          type: 'datetime',
        },
        {
          name: 'last_screened_at',
          type: 'datetime',
        },
        {
          name: 'blocked_at',
          type: 'datetime',
        },
        {
          name: 'block_reason',
          type: 'string',
        },
      ],
    },
    card_merchants: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'counterparty_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'mcc_code',
          type: 'string',
        },
        {
          name: 'category',
          type: 'enum',
          enum: ['GROCERIES', 'RESTAURANTS', 'TRANSPORT', 'SHOPPING', 'BILLS', 'CASH'],
        },
        {
          name: 'acquirer',
          type: 'string',
        },
        {
          name: 'acquirer_merchant_id',
          type: 'string',
        },
        {
          name: 'city',
          type: 'string',
        },
      ],
    },
    sct_emitters: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'counterparty_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'iban',
          type: 'string',
        },
        {
          name: 'bic',
          type: 'string',
        },
        {
          name: 'bank_name',
          type: 'string',
        },
      ],
    },
    sct_beneficiaries: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'counterparty_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'added_from_device_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'iban',
          type: 'string',
        },
        {
          name: 'bic',
          type: 'string',
        },
        {
          name: 'bank_name',
          type: 'string',
        },
        {
          name: 'nickname',
          type: 'string',
        },
        {
          name: 'is_saved',
          type: 'boolean',
        },
        {
          name: 'payee_check',
          type: 'enum',
          enum: ['MATCH', 'CLOSE_MATCH', 'NO_MATCH', 'NOT_POSSIBLE'],
        },
        {
          name: 'is_trusted',
          type: 'boolean',
        },
        {
          name: 'added_at',
          type: 'datetime',
        },
        {
          name: 'payee_check_name',
          type: 'string',
        },
        {
          name: 'removed_at',
          type: 'datetime',
        },
        {
          name: 'last_used_at',
          type: 'datetime',
        },
      ],
    },
    sdd_creditors: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'counterparty_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'creditor_identifier',
          type: 'string',
        },
        {
          name: 'iban',
          type: 'string',
        },
        {
          name: 'sector',
          type: 'string',
        },
      ],
    },
    wero_contacts: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'counterparty_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'proxy_type',
          type: 'enum',
          enum: ['PHONE', 'EMAIL'],
        },
        {
          name: 'proxy_value',
          type: 'string',
        },
      ],
    },
    mandates: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'creditor_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'mandate_reference',
          type: 'string',
        },
        {
          name: 'type',
          type: 'enum',
          enum: ['CORE', 'B2B'],
        },
        {
          name: 'signed_at',
          type: 'datetime',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
        },
        {
          name: 'revoked_at',
          type: 'datetime',
        },
        {
          name: 'last_collection_at',
          type: 'datetime',
        },
      ],
    },
    individuals: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'first_name',
          type: 'string',
        },
        {
          name: 'last_name',
          type: 'string',
        },
        {
          name: 'date_of_birth',
          type: 'date',
        },
        {
          name: 'nationality',
          type: 'string',
        },
        {
          name: 'place_of_birth',
          type: 'string',
        },
        {
          name: 'country_of_residence',
          type: 'string',
        },
        {
          name: 'address_line1',
          type: 'string',
        },
        {
          name: 'postal_code',
          type: 'string',
        },
        {
          name: 'city',
          type: 'string',
        },
        {
          name: 'country',
          type: 'string',
        },
        {
          name: 'email',
          type: 'string',
        },
        {
          name: 'phone',
          type: 'string',
        },
        {
          name: 'is_pep',
          type: 'boolean',
        },
        {
          name: 'is_sanctioned',
          type: 'boolean',
        },
        {
          name: 'occupation',
          type: 'string',
        },
        {
          name: 'employment_status',
          type: 'enum',
          enum: ['EMPLOYED', 'SELF_EMPLOYED', 'RETIRED', 'STUDENT', 'UNEMPLOYED'],
        },
        {
          name: 'employer',
          type: 'string',
        },
        {
          name: 'income_band',
          type: 'enum',
          enum: [
            'BELOW_20K',
            'FROM_20K_TO_40K',
            'FROM_40K_TO_70K',
            'FROM_70K_TO_120K',
            'ABOVE_120K',
          ],
        },
        {
          name: 'source_of_funds',
          type: 'enum',
          enum: [
            'SALARY',
            'BUSINESS_INCOME',
            'PENSION',
            'SAVINGS',
            'INHERITANCE',
            'INVESTMENTS',
            'OTHER',
          ],
        },
        {
          name: 'source_of_wealth',
          type: 'string',
        },
        {
          name: 'tax_residence',
          type: 'string',
        },
        {
          name: 'tax_id',
          type: 'string',
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'updated_at',
          type: 'datetime',
        },
        {
          name: 'birth_name',
          type: 'string',
        },
        {
          name: 'address_line2',
          type: 'string',
        },
        {
          name: 'is_us_person',
          type: 'boolean',
        },
      ],
    },
    businesses: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'legal_name',
          type: 'string',
        },
        {
          name: 'registration_number',
          type: 'string',
        },
        {
          name: 'legal_form',
          type: 'enum',
          enum: ['SAS', 'SASU', 'SARL', 'EURL', 'SA', 'SNC', 'SCI', 'SELARL', 'EI', 'ASSOCIATION'],
        },
        {
          name: 'address_line1',
          type: 'string',
        },
        {
          name: 'postal_code',
          type: 'string',
        },
        {
          name: 'city',
          type: 'string',
        },
        {
          name: 'country',
          type: 'string',
        },
        {
          name: 'incorporation_date',
          type: 'date',
        },
        {
          name: 'industry',
          type: 'string',
        },
        {
          name: 'vat_number',
          type: 'string',
        },
        {
          name: 'source_of_funds',
          type: 'enum',
          enum: ['REVENUE', 'SHAREHOLDER_FUNDS', 'LOAN', 'INVESTMENT', 'GRANT'],
        },
        {
          name: 'website',
          type: 'string',
        },
        {
          name: 'accepts_card_payments',
          type: 'boolean',
        },
        {
          name: 'products_sold',
          type: 'string',
        },
        {
          name: 'expected_monthly_volume',
          type: 'decimal',
        },
        {
          name: 'average_basket',
          type: 'decimal',
        },
        {
          name: 'online_share_pct',
          type: 'decimal',
        },
        {
          name: 'delivery_delay_days',
          type: 'integer',
        },
        {
          name: 'chargeback_ratio',
          type: 'decimal',
        },
        {
          name: 'reserve_pct',
          type: 'decimal',
        },
        {
          name: 'reserve_days',
          type: 'integer',
        },
        {
          name: 'is_sanctioned',
          type: 'boolean',
        },
        {
          name: 'trading_name',
          type: 'string',
        },
        {
          name: 'nace_code',
          type: 'string',
        },
        {
          name: 'lei',
          type: 'string',
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'updated_at',
          type: 'datetime',
        },
      ],
    },
    business_members: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'owner_business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'role',
          type: 'enum',
          enum: ['OWNER', 'SHAREHOLDER', 'DIRECTOR', 'MANAGER'],
        },
        {
          name: 'ownership_pct',
          type: 'decimal',
        },
        {
          name: 'since',
          type: 'date',
        },
        {
          name: 'until',
          type: 'date',
        },
        {
          name: 'verified',
          type: 'boolean',
        },
        {
          name: 'verified_by',
          type: 'string',
        },
        {
          name: 'verified_at',
          type: 'datetime',
        },
        {
          name: 'source',
          type: 'enum',
          enum: ['COMPANY_REGISTER', 'UBO_REGISTER', 'CLIENT_DECLARATION'],
        },
      ],
    },
    customer_members: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'role',
          type: 'enum',
          enum: [
            'HOLDER',
            'JOINT_HOLDER',
            'LEGAL_GUARDIAN',
            'ATTORNEY',
            'AUTHORISED_USER',
            'SIGNATORY',
          ],
        },
        {
          name: 'can_initiate_payments',
          type: 'boolean',
        },
        {
          name: 'since',
          type: 'date',
        },
        {
          name: 'until',
          type: 'date',
        },
        {
          name: 'is_primary_contact',
          type: 'boolean',
        },
        {
          name: 'proof_document_id',
          type: 'uuid',
          foreignKey: true,
        },
      ],
    },
    investigations: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'type',
          type: 'enum',
          enum: ['AML', 'FRAUD', 'IDENTITY_FRAUD', 'SANCTIONS', 'ACCOUNT_TAKEOVER'],
        },
        {
          name: 'origin',
          type: 'enum',
          enum: [
            'ALERTS',
            'KYC_ESCALATION',
            'SCREENING_HIT',
            'AUTHORITY_REQUEST',
            'INTERNAL_REFERRAL',
            'ADVERSE_MEDIA',
            'CUSTOMER_REPORT',
            'DISPUTE',
          ],
        },
        {
          name: 'origin_kyc_case_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'origin_authority_request_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['OPEN', 'IN_PROGRESS', 'WAITING_INFORMATION', 'PENDING_MLRO', 'CLOSED'],
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
        {
          name: 'opened_at',
          type: 'datetime',
        },
        {
          name: 'due_at',
          type: 'datetime',
        },
        {
          name: 'summary',
          type: 'string',
        },
        {
          name: 'decision',
          type: 'enum',
          enum: ['SAR_FILED', 'NO_SAR', 'EXIT_RELATIONSHIP', 'FIRST_PARTY_FRAUD', 'GENUINE_FRAUD'],
        },
        {
          name: 'decided_by',
          type: 'string',
        },
        {
          name: 'decided_at',
          type: 'datetime',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'sent_to_mlro_at',
          type: 'datetime',
        },
        {
          name: 'amount_involved',
          type: 'decimal',
        },
        {
          name: 'priority',
          type: 'enum',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        },
      ],
    },
    rules: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'category',
          type: 'enum',
          enum: ['AML', 'FRAUD', 'ACCOUNT_TAKEOVER'],
        },
        {
          name: 'name',
          type: 'string',
        },
        {
          name: 'description',
          type: 'string',
        },
        {
          name: 'threshold',
          type: 'decimal',
        },
        {
          name: 'is_active',
          type: 'boolean',
        },
        {
          name: 'created_by',
          type: 'string',
        },
        {
          name: 'code',
          type: 'string',
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'updated_at',
          type: 'datetime',
        },
        {
          name: 'updated_by',
          type: 'string',
        },
        {
          name: 'default_severity',
          type: 'enum',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        },
      ],
    },
    alert_transactions: {
      fields: [
        {
          name: 'alert_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'role',
          type: 'enum',
          enum: ['TRIGGER', 'CONTEXT', 'REPORTED'],
        },
      ],
    },
    watchlist_entries: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'list',
          type: 'enum',
          enum: ['OFAC', 'EU', 'UN', 'UK_HMT', 'PEP'],
        },
        {
          name: 'name',
          type: 'string',
        },
        {
          name: 'aliases',
          type: 'string',
        },
        {
          name: 'country',
          type: 'string',
        },
        {
          name: 'date_of_birth',
          type: 'date',
        },
        {
          name: 'listed_at',
          type: 'datetime',
        },
        {
          name: 'source_entry_id',
          type: 'string',
        },
        {
          name: 'entity_type',
          type: 'enum',
          enum: ['PERSON', 'ENTITY', 'VESSEL', 'AIRCRAFT'],
        },
        {
          name: 'regime',
          type: 'string',
        },
        {
          name: 'delisted_at',
          type: 'datetime',
        },
        {
          name: 'updated_at',
          type: 'datetime',
        },
      ],
    },
    screening_hits: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'counterparty_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'watchlist_entry_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'investigation_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'match_score',
          type: 'decimal',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['OPEN', 'TRUE_MATCH', 'FALSE_POSITIVE'],
        },
        {
          name: 'reviewed_by',
          type: 'string',
        },
        {
          name: 'reviewed_at',
          type: 'datetime',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'screened_name',
          type: 'string',
        },
        {
          name: 'trigger',
          type: 'enum',
          enum: ['ONBOARDING', 'DAILY_RESCREENING', 'PAYMENT', 'LIST_UPDATE'],
        },
        {
          name: 'matched_on',
          type: 'string',
        },
        {
          name: 'decision_reason',
          type: 'string',
        },
        {
          name: 'hit_type',
          type: 'enum',
          enum: ['SANCTIONS', 'PEP'],
        },
        {
          name: 'entity_type',
          type: 'enum',
          enum: ['PERSON', 'ENTITY', 'VESSEL', 'AIRCRAFT'],
        },
      ],
    },
    devices: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'fingerprint',
          type: 'string',
        },
        {
          name: 'platform',
          type: 'enum',
          enum: ['IOS', 'ANDROID', 'WEB'],
        },
        {
          name: 'first_seen_at',
          type: 'datetime',
        },
        {
          name: 'is_trusted',
          type: 'boolean',
        },
        {
          name: 'device_name',
          type: 'string',
        },
        {
          name: 'last_seen_at',
          type: 'datetime',
        },
        {
          name: 'revoked_at',
          type: 'datetime',
        },
        {
          name: 'app_version',
          type: 'string',
        },
      ],
    },
    login_events: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'device_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'ip_address',
          type: 'string',
        },
        {
          name: 'country',
          type: 'string',
        },
        {
          name: 'success',
          type: 'boolean',
        },
        {
          name: 'risk_score',
          type: 'decimal',
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'event_type',
          type: 'enum',
          enum: ['LOGIN', 'PASSWORD_RESET', 'MFA_RESET', 'LOGOUT'],
        },
        {
          name: 'auth_method',
          type: 'enum',
          enum: ['PASSWORD', 'BIOMETRIC', 'SMS_OTP', 'APP_PUSH'],
        },
        {
          name: 'failure_reason',
          type: 'enum',
          enum: ['WRONG_PASSWORD', 'OTP_FAILED', 'ACCOUNT_LOCKED', 'DEVICE_BLOCKED'],
        },
        {
          name: 'city',
          type: 'string',
        },
      ],
    },
    information_requests: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'context',
          type: 'enum',
          enum: [
            'KYC_CASE',
            'INVESTIGATION',
            'CHANGE_REQUEST',
            'DISPUTE_REQUEST',
            'CHARGEBACK',
            'SEPA_DISPUTE',
            'LOAN_APPLICATION',
            'COMPLAINT',
            'COLLECTION_CASE',
            'GUARANTEE',
          ],
        },
        {
          name: 'addressed_to_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'kyc_case_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'chargeback_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'loan_application_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'complaint_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'sepa_dispute_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'collection_case_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'guarantee_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'channel',
          type: 'enum',
          enum: ['APP', 'EMAIL', 'POST', 'PHONE'],
        },
        {
          name: 'questions',
          type: 'string',
        },
        {
          name: 'requested_by',
          type: 'string',
        },
        {
          name: 'sent_at',
          type: 'datetime',
        },
        {
          name: 'due_at',
          type: 'datetime',
        },
        {
          name: 'reminders_sent',
          type: 'integer',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['DRAFT', 'SENT', 'ANSWERED', 'OVERDUE', 'CANCELLED'],
        },
        {
          name: 'answered_at',
          type: 'datetime',
        },
        {
          name: 'answer',
          type: 'string',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
        {
          name: 'last_reminder_at',
          type: 'datetime',
        },
        {
          name: 'cancel_reason',
          type: 'string',
        },
        {
          name: 'investigation_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'change_request_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'dispute_request_id',
          type: 'uuid',
          foreignKey: true,
        },
      ],
    },
    customer_change_requests: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'requested_from_device_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'field',
          type: 'enum',
          enum: ['ADDRESS', 'PHONE', 'EMAIL', 'NAME'],
        },
        {
          name: 'old_value',
          type: 'string',
        },
        {
          name: 'new_value',
          type: 'string',
        },
        {
          name: 'channel',
          type: 'enum',
          enum: ['APP', 'WEB', 'PHONE', 'BRANCH'],
        },
        {
          name: 'risk_flags',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['PENDING', 'APPROVED', 'REJECTED'],
        },
        {
          name: 'requested_at',
          type: 'datetime',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'decided_by',
          type: 'string',
        },
        {
          name: 'decided_at',
          type: 'datetime',
        },
        {
          name: 'verification_method',
          type: 'enum',
          enum: ['OTP_OLD_PHONE', 'ID_AND_SELFIE', 'CALLBACK', 'NONE'],
        },
        {
          name: 'rejection_reason',
          type: 'string',
        },
      ],
    },
    complaints: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'fee_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'chargeback_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'dispute_request_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'sepa_dispute_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'collection_case_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'category',
          type: 'enum',
          enum: [
            'FEES',
            'CARD_PAYMENT',
            'TRANSFER',
            'DIRECT_DEBIT',
            'FRAUD_SCAM',
            'ACCOUNT_ACCESS',
            'ACCOUNT_CLOSURE',
            'CREDIT',
            'CUSTOMER_SERVICE',
          ],
        },
        {
          name: 'channel',
          type: 'enum',
          enum: ['APP', 'WEB', 'EMAIL', 'PHONE', 'POST', 'BRANCH'],
        },
        {
          name: 'received_at',
          type: 'datetime',
        },
        {
          name: 'acknowledged_at',
          type: 'datetime',
        },
        {
          name: 'regulatory_deadline',
          type: 'date',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['RECEIVED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'CLOSED'],
        },
        {
          name: 'outcome',
          type: 'enum',
          enum: ['UPHELD', 'PARTIALLY_UPHELD', 'REJECTED'],
        },
        {
          name: 'compensation_amount',
          type: 'decimal',
        },
        {
          name: 'compensation_transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'root_cause',
          type: 'enum',
          enum: [
            'PROCESS_ERROR',
            'SYSTEM_ERROR',
            'STAFF_ERROR',
            'UNCLEAR_INFORMATION',
            'THIRD_PARTY',
            'FRAUD',
            'NO_FAULT',
          ],
        },
        {
          name: 'resolved_at',
          type: 'datetime',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'description',
          type: 'string',
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
        {
          name: 'escalated_to',
          type: 'enum',
          enum: ['BANKING_MEDIATOR', 'ACPR', 'COURT'],
        },
        {
          name: 'escalated_at',
          type: 'datetime',
        },
        {
          name: 'escalation_reference',
          type: 'string',
        },
        {
          name: 'escalation_outcome',
          type: 'enum',
          enum: ['FOR_CUSTOMER', 'FOR_BANK', 'SPLIT'],
        },
        {
          name: 'escalation_decided_at',
          type: 'datetime',
        },
      ],
    },
    closures: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'initiated_by',
          type: 'enum',
          enum: ['CUSTOMER', 'BANK'],
        },
        {
          name: 'reason',
          type: 'enum',
          enum: ['CUSTOMER_REQUEST', 'RISK_EXIT', 'DECEASED', 'INSOLVENCY', 'DORMANCY', 'FRAUD'],
        },
        {
          name: 'investigation_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'deceased_case_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'insolvency_proceeding_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'payout_beneficiary_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'requested_at',
          type: 'datetime',
        },
        {
          name: 'notice_end_date',
          type: 'date',
        },
        {
          name: 'balance_to_return',
          type: 'decimal',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['REQUESTED', 'APPROVED', 'NOTICE_SENT', 'PENDING_PAYOUT', 'CLOSED', 'CANCELLED'],
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'closed_at',
          type: 'datetime',
        },
        {
          name: 'approved_by',
          type: 'string',
        },
        {
          name: 'notice_sent_at',
          type: 'datetime',
        },
        {
          name: 'payout_transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
      ],
    },
    holds: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'amount',
          type: 'decimal',
        },
        {
          name: 'reason',
          type: 'enum',
          enum: [
            'AUTHORITY_REQUEST',
            'FRAUD',
            'INVESTIGATION',
            'SANCTIONS',
            'DISPUTE',
            'INSOLVENCY',
          ],
        },
        {
          name: 'authority_request_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'investigation_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'alert_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'insolvency_proceeding_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'screening_hit_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'chargeback_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'sepa_dispute_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'placed_by',
          type: 'string',
        },
        {
          name: 'placed_at',
          type: 'datetime',
        },
        {
          name: 'released_at',
          type: 'datetime',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['ACTIVE', 'RELEASED', 'EXPIRED'],
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'released_by',
          type: 'string',
        },
        {
          name: 'release_reason',
          type: 'string',
        },
        {
          name: 'expires_at',
          type: 'datetime',
        },
      ],
    },
    authority_requests: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'type',
          type: 'enum',
          enum: ['SEIZURE', 'PRECAUTIONARY_FREEZE', 'TAX_GARNISHMENT', 'INFORMATION_REQUEST'],
        },
        {
          name: 'requester_type',
          type: 'enum',
          enum: ['BAILIFF', 'TAX_AUTHORITY', 'SOCIAL_SECURITY', 'COURT', 'POLICE', 'FIU'],
        },
        {
          name: 'requester_name',
          type: 'string',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'received_at',
          type: 'datetime',
        },
        {
          name: 'response_due',
          type: 'date',
        },
        {
          name: 'amount_claimed',
          type: 'decimal',
        },
        {
          name: 'amount_held',
          type: 'decimal',
        },
        {
          name: 'protected_amount',
          type: 'decimal',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['RECEIVED', 'IN_PROGRESS', 'FUNDS_HELD', 'ANSWERED', 'PAID_OUT', 'CLOSED'],
        },
        {
          name: 'answered_at',
          type: 'datetime',
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
        {
          name: 'channel',
          type: 'enum',
          enum: ['POST', 'EMAIL', 'BAILIFF_PORTAL', 'IN_PERSON'],
        },
        {
          name: 'file_url',
          type: 'string',
        },
      ],
    },
    business_events: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'kyc_case_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'type',
          type: 'enum',
          enum: [
            'OWNERSHIP_CHANGE',
            'DIRECTOR_CHANGE',
            'ADDRESS_CHANGE',
            'LEGAL_FORM_CHANGE',
            'CAPITAL_CHANGE',
            'INSOLVENCY_OPENED',
            'DISSOLUTION',
          ],
        },
        {
          name: 'source',
          type: 'enum',
          enum: ['COMPANY_REGISTER', 'CLIENT', 'ADVERSE_MEDIA'],
        },
        {
          name: 'effective_date',
          type: 'date',
        },
        {
          name: 'detected_at',
          type: 'datetime',
        },
        {
          name: 'details',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['NEW', 'REVIEW_OPENED', 'DISMISSED'],
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'register_reference',
          type: 'string',
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
        {
          name: 'dismiss_reason',
          type: 'string',
        },
      ],
    },
    insolvency_proceedings: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'type',
          type: 'enum',
          enum: ['SAFEGUARD', 'RECEIVERSHIP', 'LIQUIDATION', 'PERSONAL_DEBT_RESTRUCTURING'],
        },
        {
          name: 'court',
          type: 'string',
        },
        {
          name: 'judgment_date',
          type: 'date',
        },
        {
          name: 'practitioner_name',
          type: 'string',
        },
        {
          name: 'claims_deadline',
          type: 'date',
        },
        {
          name: 'bank_claim_amount',
          type: 'decimal',
        },
        {
          name: 'claim_filed_at',
          type: 'datetime',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['OPENED', 'ACCOUNTS_FROZEN', 'CLAIM_FILED', 'BALANCE_HANDED_OVER', 'CLOSED'],
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'court_case_number',
          type: 'string',
        },
        {
          name: 'practitioner_email',
          type: 'string',
        },
        {
          name: 'closed_at',
          type: 'datetime',
        },
      ],
    },
    deceased_cases: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'date_of_death',
          type: 'date',
        },
        {
          name: 'notified_at',
          type: 'datetime',
        },
        {
          name: 'notified_by',
          type: 'string',
        },
        {
          name: 'executor_name',
          type: 'string',
        },
        {
          name: 'notary_name',
          type: 'string',
        },
        {
          name: 'balance_at_death',
          type: 'decimal',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['NOTIFIED', 'ACCOUNTS_FROZEN', 'CERTIFICATE_VERIFIED', 'FUNDS_RELEASED', 'CLOSED'],
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'certificate_verified_at',
          type: 'datetime',
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
        {
          name: 'funds_released_at',
          type: 'datetime',
        },
      ],
    },
    qa_reviews: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'kyc_case_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'alert_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'investigation_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'chargeback_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'complaint_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'operator_email',
          type: 'string',
        },
        {
          name: 'reviewer_email',
          type: 'string',
        },
        {
          name: 'sample_reason',
          type: 'enum',
          enum: ['RANDOM', 'HIGH_RISK', 'NEW_OPERATOR'],
        },
        {
          name: 'score',
          type: 'decimal',
        },
        {
          name: 'outcome',
          type: 'enum',
          enum: ['PENDING', 'PASSED', 'FAILED'],
        },
        {
          name: 'reviewed_at',
          type: 'datetime',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'coaching_note',
          type: 'string',
        },
        {
          name: 'failed_criteria',
          type: 'string',
        },
      ],
    },
    sepa_disputes: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'direct_debit_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'incoming_transfer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'outgoing_transfer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'dispute_request_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'alert_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'return_transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'scheme',
          type: 'enum',
          enum: ['SDD_CORE', 'SDD_B2B', 'SCT', 'SCT_INST'],
        },
        {
          name: 'type',
          type: 'enum',
          enum: ['REFUND', 'RETURN', 'RECALL', 'REQUEST_FOR_RECALL'],
        },
        {
          name: 'side',
          type: 'enum',
          enum: ['WE_ASKED', 'WE_ARE_ASKED'],
        },
        {
          name: 'reason',
          type: 'enum',
          enum: [
            'CUSTOMER_REQUEST',
            'UNAUTHORISED',
            'INSUFFICIENT_FUNDS',
            'ACCOUNT_CLOSED',
            'DUPLICATE',
            'TECHNICAL',
            'FRAUD',
            'WRONG_IBAN',
            'WRONG_AMOUNT',
          ],
        },
        {
          name: 'reason_code',
          type: 'string',
        },
        {
          name: 'amount',
          type: 'decimal',
        },
        {
          name: 'requested_at',
          type: 'datetime',
        },
        {
          name: 'response_due',
          type: 'date',
        },
        {
          name: 'status',
          type: 'enum',
          enum: [
            'OPEN',
            'WAITING_OTHER_BANK',
            'WAITING_CUSTOMER',
            'ACCEPTED',
            'REFUSED',
            'PARTIAL',
          ],
        },
        {
          name: 'amount_returned',
          type: 'decimal',
        },
        {
          name: 'customer_consent_at',
          type: 'datetime',
        },
        {
          name: 'answered_at',
          type: 'datetime',
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'other_bank_bic',
          type: 'string',
        },
      ],
    },
    loan_applications: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'product',
          type: 'enum',
          enum: ['PERSONAL_LOAN', 'CAR_LOAN', 'BNPL', 'BUSINESS_TERM_LOAN'],
        },
        {
          name: 'amount',
          type: 'decimal',
        },
        {
          name: 'term_months',
          type: 'integer',
        },
        {
          name: 'purpose',
          type: 'string',
        },
        {
          name: 'declared_income',
          type: 'decimal',
        },
        {
          name: 'declared_expenses',
          type: 'decimal',
        },
        {
          name: 'debt_to_income',
          type: 'decimal',
        },
        {
          name: 'external_score',
          type: 'decimal',
        },
        {
          name: 'credit_register_checked_at',
          type: 'datetime',
        },
        {
          name: 'credit_register_result',
          type: 'enum',
          enum: ['NOT_LISTED', 'LISTED', 'NOT_CHECKED'],
        },
        {
          name: 'offered_amount',
          type: 'decimal',
        },
        {
          name: 'offered_rate',
          type: 'decimal',
        },
        {
          name: 'offered_term_months',
          type: 'integer',
        },
        {
          name: 'status',
          type: 'enum',
          enum: [
            'SUBMITTED',
            'IN_REVIEW',
            'WAITING_DOCUMENTS',
            'OFFER_MADE',
            'APPROVED',
            'DECLINED',
            'WITHDRAWN',
          ],
        },
        {
          name: 'decision_reason',
          type: 'string',
        },
        {
          name: 'decided_by',
          type: 'string',
        },
        {
          name: 'decided_at',
          type: 'datetime',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'submitted_at',
          type: 'datetime',
        },
        {
          name: 'offered_apr',
          type: 'decimal',
        },
        {
          name: 'channel',
          type: 'enum',
          enum: ['APP', 'WEB', 'BRANCH', 'BROKER'],
        },
      ],
    },
    loans: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'application_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'disbursement_transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'principal',
          type: 'decimal',
        },
        {
          name: 'rate',
          type: 'decimal',
        },
        {
          name: 'term_months',
          type: 'integer',
        },
        {
          name: 'outstanding_balance',
          type: 'decimal',
        },
        {
          name: 'next_due_at',
          type: 'datetime',
        },
        {
          name: 'days_past_due',
          type: 'integer',
        },
        {
          name: 'signed_at',
          type: 'datetime',
        },
        {
          name: 'withdrawal_deadline',
          type: 'date',
        },
        {
          name: 'disbursed_at',
          type: 'datetime',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['CURRENT', 'LATE', 'DEFAULT', 'RESTRUCTURED', 'REPAID'],
        },
        {
          name: 'contract_number',
          type: 'string',
        },
        {
          name: 'instalment_amount',
          type: 'decimal',
        },
        {
          name: 'maturity_date',
          type: 'date',
        },
        {
          name: 'apr',
          type: 'decimal',
        },
      ],
    },
    repayments: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'loan_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'due_at',
          type: 'datetime',
        },
        {
          name: 'amount_due',
          type: 'decimal',
        },
        {
          name: 'amount_paid',
          type: 'decimal',
        },
        {
          name: 'paid_at',
          type: 'datetime',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['SCHEDULED', 'PAID', 'PARTIAL', 'MISSED'],
        },
        {
          name: 'instalment_number',
          type: 'integer',
        },
        {
          name: 'principal_part',
          type: 'decimal',
        },
        {
          name: 'interest_part',
          type: 'decimal',
        },
      ],
    },
    guarantees: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'loan_application_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'loan_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'guarantor_individual_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'guarantor_business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'type',
          type: 'enum',
          enum: ['PERSONAL_GUARANTEE', 'PROPERTY', 'CASH_DEPOSIT', 'VEHICLE', 'STATE_GUARANTEE'],
        },
        {
          name: 'amount_guaranteed',
          type: 'decimal',
        },
        {
          name: 'value',
          type: 'decimal',
        },
        {
          name: 'valued_at',
          type: 'datetime',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['PENDING_SIGNATURE', 'ACTIVE', 'CALLED', 'RELEASED', 'EXPIRED'],
        },
        {
          name: 'signed_at',
          type: 'datetime',
        },
        {
          name: 'expires_at',
          type: 'datetime',
        },
        {
          name: 'called_at',
          type: 'datetime',
        },
      ],
    },
    collection_cases: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'loan_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'insolvency_proceeding_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'days_past_due',
          type: 'integer',
        },
        {
          name: 'amount_due',
          type: 'decimal',
        },
        {
          name: 'stage',
          type: 'enum',
          enum: ['EARLY', 'LATE', 'LEGAL', 'WRITTEN_OFF'],
        },
        {
          name: 'assigned_to',
          type: 'string',
        },
        {
          name: 'next_action_at',
          type: 'datetime',
        },
        {
          name: 'promise_to_pay_date',
          type: 'date',
        },
        {
          name: 'promise_to_pay_amount',
          type: 'decimal',
        },
        {
          name: 'outcome',
          type: 'enum',
          enum: ['PAID', 'PAYMENT_PLAN', 'RESTRUCTURED', 'WRITTEN_OFF'],
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['OPEN', 'IN_PROGRESS', 'PAUSED', 'CLOSED'],
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'opened_at',
          type: 'datetime',
        },
        {
          name: 'last_contact_at',
          type: 'datetime',
        },
        {
          name: 'formal_notice_sent_at',
          type: 'datetime',
        },
        {
          name: 'closed_at',
          type: 'datetime',
        },
      ],
    },
    limit_requests: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'requested_by_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'card_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'account_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'type',
          type: 'enum',
          enum: ['CARD_PAYMENT', 'CARD_WITHDRAWAL', 'TRANSFER', 'OVERDRAFT'],
        },
        {
          name: 'current_limit',
          type: 'decimal',
        },
        {
          name: 'requested_limit',
          type: 'decimal',
        },
        {
          name: 'temporary_until',
          type: 'date',
        },
        {
          name: 'reason',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['PENDING', 'APPROVED', 'DECLINED'],
        },
        {
          name: 'decided_by',
          type: 'string',
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'requested_at',
          type: 'datetime',
        },
        {
          name: 'decided_at',
          type: 'datetime',
        },
        {
          name: 'channel',
          type: 'enum',
          enum: ['APP', 'WEB', 'PHONE', 'BRANCH'],
        },
      ],
    },
    investigation_transactions: {
      fields: [
        {
          name: 'investigation_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'included_in_sar',
          type: 'boolean',
        },
        {
          name: 'note',
          type: 'string',
        },
        {
          name: 'added_by',
          type: 'string',
        },
        {
          name: 'added_at',
          type: 'datetime',
        },
      ],
    },
    status_changes: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'record_type',
          type: 'enum',
          enum: [
            'CUSTOMERS',
            'KYC_CASES',
            'ALERTS',
            'INVESTIGATIONS',
            'SAR_REPORTS',
            'SCREENING_HITS',
            'DISPUTE_REQUESTS',
            'CHARGEBACKS',
            'SEPA_DISPUTES',
            'LOAN_APPLICATIONS',
            'LOANS',
            'COLLECTION_CASES',
            'LIMIT_REQUESTS',
            'COMPLAINTS',
            'CUSTOMER_CHANGE_REQUESTS',
            'CLOSURES',
            'HOLDS',
            'AUTHORITY_REQUESTS',
            'BUSINESS_EVENTS',
            'INSOLVENCY_PROCEEDINGS',
            'DECEASED_CASES',
            'QA_REVIEWS',
            'INFORMATION_REQUESTS',
            'EINVOICING_REGISTRATIONS',
            'INVOICES',
            'EREPORTING_SUBMISSIONS',
            'OUTGOING_TRANSFERS',
          ],
        },
        {
          name: 'record_id',
          type: 'uuid',
        },
        {
          name: 'field',
          type: 'string',
        },
        {
          name: 'old_value',
          type: 'string',
        },
        {
          name: 'new_value',
          type: 'string',
        },
        {
          name: 'changed_by',
          type: 'string',
        },
        {
          name: 'changed_at',
          type: 'datetime',
        },
        {
          name: 'reason',
          type: 'string',
        },
      ],
    },
    incoming_transfers: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'emitter_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'scheme',
          type: 'enum',
          enum: ['SEPA', 'SEPA_INSTANT'],
        },
        {
          name: 'end_to_end_id',
          type: 'string',
        },
        {
          name: 'purpose_code',
          type: 'string',
        },
        {
          name: 'remittance_info',
          type: 'string',
        },
      ],
    },
    outgoing_transfers: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'beneficiary_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'scheme',
          type: 'enum',
          enum: ['SEPA', 'SEPA_INSTANT'],
        },
        {
          name: 'initiated_via',
          type: 'enum',
          enum: ['BANKING_APP', 'API'],
        },
        {
          name: 'end_to_end_id',
          type: 'string',
        },
        {
          name: 'payee_check',
          type: 'enum',
          enum: ['MATCH', 'CLOSE_MATCH', 'NO_MATCH', 'NOT_POSSIBLE'],
        },
        {
          name: 'validation_status',
          type: 'enum',
          enum: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'],
        },
        {
          name: 'validated_by',
          type: 'string',
        },
        {
          name: 'validated_at',
          type: 'datetime',
        },
        {
          name: 'requested_execution_date',
          type: 'date',
        },
        {
          name: 'rejection_reason',
          type: 'string',
        },
        {
          name: 'sca_method',
          type: 'enum',
          enum: ['APP_CONFIRMATION', 'SMS_OTP', 'BIOMETRIC', 'EXEMPTED'],
        },
        {
          name: 'purpose_code',
          type: 'string',
        },
        {
          name: 'is_standing_order',
          type: 'boolean',
        },
        {
          name: 'callback_at',
          type: 'datetime',
        },
        {
          name: 'callback_result',
          type: 'enum',
          enum: ['CONFIRMED', 'DENIED', 'NOT_REACHED'],
        },
      ],
    },
    dispute_transactions: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'role',
          type: 'enum',
          enum: [
            'DISPUTED',
            'PROVISIONAL_CREDIT',
            'CREDIT_REVERSAL',
            'REFUND',
            'RETURN',
            'COMPENSATION',
          ],
        },
        {
          name: 'dispute_request_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'chargeback_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'sepa_dispute_id',
          type: 'uuid',
          foreignKey: true,
        },
      ],
    },
    einvoicing_registrations: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'siren',
          type: 'string',
        },
        {
          name: 'routing_address',
          type: 'string',
        },
        {
          name: 'receiving_platform',
          type: 'enum',
          enum: ['OUR_PLATFORM', 'OTHER_PLATFORM'],
        },
        {
          name: 'other_platform',
          type: 'string',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['PENDING', 'ACTIVE', 'LEFT'],
        },
        {
          name: 'company_size',
          type: 'enum',
          enum: ['MICRO', 'SME', 'MID_SIZE', 'LARGE'],
        },
        {
          name: 'vat_regime',
          type: 'enum',
          enum: ['MONTHLY', 'QUARTERLY', 'SIMPLIFIED'],
        },
        {
          name: 'sending_mandatory_from',
          type: 'date',
        },
        {
          name: 'sends_einvoices',
          type: 'boolean',
        },
        {
          name: 'voluntary_since',
          type: 'date',
        },
        {
          name: 'registered_at',
          type: 'datetime',
        },
        {
          name: 'activated_at',
          type: 'datetime',
        },
        {
          name: 'left_at',
          type: 'datetime',
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
      ],
    },
    invoices: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'invoice_number',
          type: 'string',
        },
        {
          name: 'direction',
          type: 'enum',
          enum: ['ISSUED', 'RECEIVED'],
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'registration_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'counterparty_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'other_party_name',
          type: 'string',
        },
        {
          name: 'other_party_siren',
          type: 'string',
        },
        {
          name: 'other_party_vat_number',
          type: 'string',
        },
        {
          name: 'other_party_address',
          type: 'string',
        },
        {
          name: 'description',
          type: 'string',
        },
        {
          name: 'nature',
          type: 'enum',
          enum: ['GOODS', 'SERVICES', 'MIXED'],
        },
        {
          name: 'vat_on_debits',
          type: 'boolean',
        },
        {
          name: 'amount_excl_vat',
          type: 'decimal',
        },
        {
          name: 'quantity',
          type: 'decimal',
        },
        {
          name: 'unit_price',
          type: 'decimal',
        },
        {
          name: 'vat_rate',
          type: 'decimal',
        },
        {
          name: 'vat_amount',
          type: 'decimal',
        },
        {
          name: 'amount_incl_vat',
          type: 'decimal',
        },
        {
          name: 'currency',
          type: 'string',
        },
        {
          name: 'format',
          type: 'enum',
          enum: ['FACTUR_X', 'UBL', 'CII'],
        },
        {
          name: 'issue_date',
          type: 'date',
        },
        {
          name: 'due_date',
          type: 'date',
        },
        {
          name: 'delivery_date',
          type: 'date',
        },
        {
          name: 'status',
          type: 'enum',
          enum: [
            'SUBMITTED',
            'REJECTED',
            'ISSUED',
            'RECEIVED',
            'APPROVED',
            'DISPUTED',
            'REFUSED',
            'PAYMENT_SENT',
            'CASHED',
          ],
        },
        {
          name: 'status_reason',
          type: 'string',
        },
        {
          name: 'payee_iban',
          type: 'string',
        },
        {
          name: 'iban_check',
          type: 'enum',
          enum: ['KNOWN', 'NEW_SUPPLIER', 'CHANGED'],
        },
        {
          name: 'alert_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'amount_paid',
          type: 'decimal',
        },
        {
          name: 'paid_at',
          type: 'datetime',
        },
        {
          name: 'submitted_at',
          type: 'datetime',
        },
        {
          name: 'updated_at',
          type: 'datetime',
        },
      ],
    },
    invoice_payments: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'invoice_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'transaction_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'amount',
          type: 'decimal',
        },
        {
          name: 'match_status',
          type: 'enum',
          enum: ['AUTO_MATCHED', 'SUGGESTED', 'CONFIRMED', 'DISMISSED'],
        },
        {
          name: 'match_reason',
          type: 'string',
        },
        {
          name: 'matched_by',
          type: 'string',
        },
        {
          name: 'matched_at',
          type: 'datetime',
        },
      ],
    },
    ereporting_submissions: {
      fields: [
        {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
        },
        {
          name: 'reference',
          type: 'string',
        },
        {
          name: 'registration_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'customer_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'business_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'flow',
          type: 'enum',
          enum: ['TRANSACTIONS', 'PAYMENTS'],
        },
        {
          name: 'period_start',
          type: 'date',
        },
        {
          name: 'period_end',
          type: 'date',
        },
        {
          name: 'due_date',
          type: 'date',
        },
        {
          name: 'status',
          type: 'enum',
          enum: ['TO_SUBMIT', 'SUBMITTED', 'ACCEPTED', 'REJECTED'],
        },
        {
          name: 'record_count',
          type: 'integer',
        },
        {
          name: 'amount_excl_vat',
          type: 'decimal',
        },
        {
          name: 'vat_amount',
          type: 'decimal',
        },
        {
          name: 'submitted_at',
          type: 'datetime',
        },
        {
          name: 'answered_at',
          type: 'datetime',
        },
        {
          name: 'rejection_reason',
          type: 'string',
        },
        {
          name: 'replaces_id',
          type: 'uuid',
          foreignKey: true,
        },
        {
          name: 'created_at',
          type: 'datetime',
        },
      ],
    },
  },
  relations: [
    {
      parent: 'customers',
      child: 'alerts',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'cards',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'chargebacks',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'kyc_cases',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'kyc_cases',
      child: 'documents',
      foreignKey: 'kyc_case_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'dispute_requests',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'sar_reports',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'accounts',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'accounts',
      child: 'cards',
      foreignKey: 'account_id',
      oneToOne: false,
    },
    {
      parent: 'accounts',
      child: 'transactions',
      foreignKey: 'account_id',
      oneToOne: false,
    },
    {
      parent: 'counterparties',
      child: 'transactions',
      foreignKey: 'counterparty_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'card_transactions',
      foreignKey: 'transaction_id',
      oneToOne: true,
    },
    {
      parent: 'transactions',
      child: 'direct_debits',
      foreignKey: 'transaction_id',
      oneToOne: true,
    },
    {
      parent: 'transactions',
      child: 'wallet_transfers',
      foreignKey: 'transaction_id',
      oneToOne: true,
    },
    {
      parent: 'cards',
      child: 'card_transactions',
      foreignKey: 'card_id',
      oneToOne: false,
    },
    {
      parent: 'mandates',
      child: 'direct_debits',
      foreignKey: 'mandate_id',
      oneToOne: false,
    },
    {
      parent: 'accounts',
      child: 'mandates',
      foreignKey: 'account_id',
      oneToOne: false,
    },
    {
      parent: 'accounts',
      child: 'wallet_transfers',
      foreignKey: 'peer_account_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'sct_beneficiaries',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'devices',
      child: 'sct_beneficiaries',
      foreignKey: 'added_from_device_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'chargebacks',
      foreignKey: 'transaction_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'dispute_requests',
      foreignKey: 'transaction_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'customer_change_requests',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'alerts',
      child: 'alert_transactions',
      foreignKey: 'alert_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'alert_transactions',
      foreignKey: 'transaction_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'screening_hits',
      foreignKey: 'business_id',
      oneToOne: false,
    },
    {
      parent: 'watchlist_entries',
      child: 'screening_hits',
      foreignKey: 'watchlist_entry_id',
      oneToOne: false,
    },
    {
      parent: 'devices',
      child: 'login_events',
      foreignKey: 'device_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'loan_applications',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'loan_applications',
      child: 'loans',
      foreignKey: 'application_id',
      oneToOne: false,
    },
    {
      parent: 'accounts',
      child: 'loans',
      foreignKey: 'account_id',
      oneToOne: false,
    },
    {
      parent: 'loans',
      child: 'repayments',
      foreignKey: 'loan_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'limit_requests',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'cards',
      child: 'limit_requests',
      foreignKey: 'card_id',
      oneToOne: false,
    },
    {
      parent: 'accounts',
      child: 'limit_requests',
      foreignKey: 'account_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'complaints',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'customers',
      foreignKey: 'business_id',
      oneToOne: true,
    },
    {
      parent: 'individuals',
      child: 'business_members',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'business_members',
      foreignKey: 'business_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'cards',
      foreignKey: 'holder_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'documents',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'customer_change_requests',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'screening_hits',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'devices',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'login_events',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'counterparties',
      child: 'card_merchants',
      foreignKey: 'counterparty_id',
      oneToOne: true,
    },
    {
      parent: 'counterparties',
      child: 'sdd_creditors',
      foreignKey: 'counterparty_id',
      oneToOne: true,
    },
    {
      parent: 'counterparties',
      child: 'wero_contacts',
      foreignKey: 'counterparty_id',
      oneToOne: true,
    },
    {
      parent: 'counterparties',
      child: 'sct_emitters',
      foreignKey: 'counterparty_id',
      oneToOne: false,
    },
    {
      parent: 'counterparties',
      child: 'sct_beneficiaries',
      foreignKey: 'counterparty_id',
      oneToOne: false,
    },
    {
      parent: 'card_merchants',
      child: 'card_transactions',
      foreignKey: 'merchant_id',
      oneToOne: false,
    },
    {
      parent: 'wero_contacts',
      child: 'wero_payments',
      foreignKey: 'wero_contact_id',
      oneToOne: false,
    },
    {
      parent: 'sdd_creditors',
      child: 'mandates',
      foreignKey: 'creditor_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'fees',
      foreignKey: 'transaction_id',
      oneToOne: true,
    },
    {
      parent: 'accounts',
      child: 'fees',
      foreignKey: 'account_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'fees',
      foreignKey: 'triggered_by_transaction_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'customer_members',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'customer_members',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'business_members',
      foreignKey: 'owner_business_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'documents',
      foreignKey: 'business_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'deceased_cases',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'counterparties',
      child: 'screening_hits',
      foreignKey: 'counterparty_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'screening_hits',
      foreignKey: 'transaction_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'transactions',
      foreignKey: 'initiated_by_id',
      oneToOne: false,
    },
    {
      parent: 'devices',
      child: 'transactions',
      foreignKey: 'device_id',
      oneToOne: false,
    },
    {
      parent: 'devices',
      child: 'customer_change_requests',
      foreignKey: 'requested_from_device_id',
      oneToOne: false,
    },
    {
      parent: 'rules',
      child: 'alerts',
      foreignKey: 'rule_id',
      oneToOne: false,
    },
    {
      parent: 'login_events',
      child: 'alerts',
      foreignKey: 'login_event_id',
      oneToOne: false,
    },
    {
      parent: 'investigations',
      child: 'alerts',
      foreignKey: 'investigation_id',
      oneToOne: false,
    },
    {
      parent: 'investigations',
      child: 'sar_reports',
      foreignKey: 'investigation_id',
      oneToOne: false,
    },
    {
      parent: 'investigations',
      child: 'kyc_cases',
      foreignKey: 'investigation_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'investigations',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'investigations',
      child: 'screening_hits',
      foreignKey: 'investigation_id',
      oneToOne: false,
    },
    {
      parent: 'kyc_cases',
      child: 'investigations',
      foreignKey: 'origin_kyc_case_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'information_requests',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'information_requests',
      foreignKey: 'addressed_to_id',
      oneToOne: false,
    },
    {
      parent: 'kyc_cases',
      child: 'information_requests',
      foreignKey: 'kyc_case_id',
      oneToOne: false,
    },
    {
      parent: 'chargebacks',
      child: 'information_requests',
      foreignKey: 'chargeback_id',
      oneToOne: false,
    },
    {
      parent: 'loan_applications',
      child: 'information_requests',
      foreignKey: 'loan_application_id',
      oneToOne: false,
    },
    {
      parent: 'complaints',
      child: 'information_requests',
      foreignKey: 'complaint_id',
      oneToOne: false,
    },
    {
      parent: 'information_requests',
      child: 'documents',
      foreignKey: 'information_request_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'closures',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'accounts',
      child: 'closures',
      foreignKey: 'account_id',
      oneToOne: false,
    },
    {
      parent: 'investigations',
      child: 'closures',
      foreignKey: 'investigation_id',
      oneToOne: false,
    },
    {
      parent: 'deceased_cases',
      child: 'closures',
      foreignKey: 'deceased_case_id',
      oneToOne: false,
    },
    {
      parent: 'insolvency_proceedings',
      child: 'closures',
      foreignKey: 'insolvency_proceeding_id',
      oneToOne: false,
    },
    {
      parent: 'sct_beneficiaries',
      child: 'closures',
      foreignKey: 'payout_beneficiary_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'complaints',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'complaints',
      foreignKey: 'transaction_id',
      oneToOne: false,
    },
    {
      parent: 'fees',
      child: 'complaints',
      foreignKey: 'fee_id',
      oneToOne: false,
    },
    {
      parent: 'chargebacks',
      child: 'complaints',
      foreignKey: 'chargeback_id',
      oneToOne: false,
    },
    {
      parent: 'dispute_requests',
      child: 'complaints',
      foreignKey: 'dispute_request_id',
      oneToOne: false,
    },
    {
      parent: 'kyc_cases',
      child: 'qa_reviews',
      foreignKey: 'kyc_case_id',
      oneToOne: false,
    },
    {
      parent: 'alerts',
      child: 'qa_reviews',
      foreignKey: 'alert_id',
      oneToOne: false,
    },
    {
      parent: 'investigations',
      child: 'qa_reviews',
      foreignKey: 'investigation_id',
      oneToOne: false,
    },
    {
      parent: 'chargebacks',
      child: 'qa_reviews',
      foreignKey: 'chargeback_id',
      oneToOne: false,
    },
    {
      parent: 'complaints',
      child: 'qa_reviews',
      foreignKey: 'complaint_id',
      oneToOne: false,
    },
    {
      parent: 'accounts',
      child: 'holds',
      foreignKey: 'account_id',
      oneToOne: false,
    },
    {
      parent: 'authority_requests',
      child: 'holds',
      foreignKey: 'authority_request_id',
      oneToOne: false,
    },
    {
      parent: 'investigations',
      child: 'holds',
      foreignKey: 'investigation_id',
      oneToOne: false,
    },
    {
      parent: 'alerts',
      child: 'holds',
      foreignKey: 'alert_id',
      oneToOne: false,
    },
    {
      parent: 'insolvency_proceedings',
      child: 'holds',
      foreignKey: 'insolvency_proceeding_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'authority_requests',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'authority_requests',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'authority_requests',
      foreignKey: 'business_id',
      oneToOne: false,
    },
    {
      parent: 'authority_requests',
      child: 'investigations',
      foreignKey: 'origin_authority_request_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'business_events',
      foreignKey: 'business_id',
      oneToOne: false,
    },
    {
      parent: 'kyc_cases',
      child: 'business_events',
      foreignKey: 'kyc_case_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'insolvency_proceedings',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'insolvency_proceedings',
      foreignKey: 'business_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'insolvency_proceedings',
      foreignKey: 'individual_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'sepa_disputes',
      foreignKey: 'transaction_id',
      oneToOne: false,
    },
    {
      parent: 'direct_debits',
      child: 'sepa_disputes',
      foreignKey: 'direct_debit_id',
      oneToOne: false,
    },
    {
      parent: 'dispute_requests',
      child: 'sepa_disputes',
      foreignKey: 'dispute_request_id',
      oneToOne: false,
    },
    {
      parent: 'alerts',
      child: 'sepa_disputes',
      foreignKey: 'alert_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'sepa_disputes',
      foreignKey: 'return_transaction_id',
      oneToOne: false,
    },
    {
      parent: 'sepa_disputes',
      child: 'information_requests',
      foreignKey: 'sepa_dispute_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'loans',
      foreignKey: 'disbursement_transaction_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'repayments',
      foreignKey: 'transaction_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'limit_requests',
      foreignKey: 'requested_by_id',
      oneToOne: false,
    },
    {
      parent: 'loan_applications',
      child: 'guarantees',
      foreignKey: 'loan_application_id',
      oneToOne: false,
    },
    {
      parent: 'loans',
      child: 'guarantees',
      foreignKey: 'loan_id',
      oneToOne: false,
    },
    {
      parent: 'individuals',
      child: 'guarantees',
      foreignKey: 'guarantor_individual_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'guarantees',
      foreignKey: 'guarantor_business_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'collection_cases',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'loans',
      child: 'collection_cases',
      foreignKey: 'loan_id',
      oneToOne: false,
    },
    {
      parent: 'accounts',
      child: 'collection_cases',
      foreignKey: 'account_id',
      oneToOne: false,
    },
    {
      parent: 'insolvency_proceedings',
      child: 'collection_cases',
      foreignKey: 'insolvency_proceeding_id',
      oneToOne: false,
    },
    {
      parent: 'collection_cases',
      child: 'complaints',
      foreignKey: 'collection_case_id',
      oneToOne: false,
    },
    {
      parent: 'collection_cases',
      child: 'information_requests',
      foreignKey: 'collection_case_id',
      oneToOne: false,
    },
    {
      parent: 'accounts',
      child: 'wero_payments',
      foreignKey: 'account_id',
      oneToOne: false,
    },
    {
      parent: 'investigations',
      child: 'investigation_transactions',
      foreignKey: 'investigation_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'investigation_transactions',
      foreignKey: 'transaction_id',
      oneToOne: false,
    },
    {
      parent: 'screening_hits',
      child: 'holds',
      foreignKey: 'screening_hit_id',
      oneToOne: false,
    },
    {
      parent: 'chargebacks',
      child: 'holds',
      foreignKey: 'chargeback_id',
      oneToOne: false,
    },
    {
      parent: 'sepa_disputes',
      child: 'holds',
      foreignKey: 'sepa_dispute_id',
      oneToOne: false,
    },
    {
      parent: 'guarantees',
      child: 'information_requests',
      foreignKey: 'guarantee_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'complaints',
      foreignKey: 'compensation_transaction_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'chargebacks',
      foreignKey: 'provisional_credit_transaction_id',
      oneToOne: false,
    },
    {
      parent: 'dispute_requests',
      child: 'chargebacks',
      foreignKey: 'dispute_request_id',
      oneToOne: false,
    },
    {
      parent: 'documents',
      child: 'customer_members',
      foreignKey: 'proof_document_id',
      oneToOne: false,
    },
    {
      parent: 'cards',
      child: 'cards',
      foreignKey: 'replaces_card_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'fees',
      foreignKey: 'refund_transaction_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'closures',
      foreignKey: 'payout_transaction_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'sct_emitters',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'wero_contacts',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'incoming_transfers',
      foreignKey: 'transaction_id',
      oneToOne: true,
    },
    {
      parent: 'transactions',
      child: 'outgoing_transfers',
      foreignKey: 'transaction_id',
      oneToOne: true,
    },
    {
      parent: 'sct_emitters',
      child: 'incoming_transfers',
      foreignKey: 'emitter_id',
      oneToOne: false,
    },
    {
      parent: 'sct_beneficiaries',
      child: 'outgoing_transfers',
      foreignKey: 'beneficiary_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'wero_payments',
      foreignKey: 'transaction_id',
      oneToOne: true,
    },
    {
      parent: 'customers',
      child: 'mandates',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'documents',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'investigations',
      child: 'information_requests',
      foreignKey: 'investigation_id',
      oneToOne: false,
    },
    {
      parent: 'customer_change_requests',
      child: 'information_requests',
      foreignKey: 'change_request_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'dispute_transactions',
      foreignKey: 'transaction_id',
      oneToOne: false,
    },
    {
      parent: 'dispute_requests',
      child: 'dispute_transactions',
      foreignKey: 'dispute_request_id',
      oneToOne: false,
    },
    {
      parent: 'chargebacks',
      child: 'dispute_transactions',
      foreignKey: 'chargeback_id',
      oneToOne: false,
    },
    {
      parent: 'sepa_disputes',
      child: 'dispute_transactions',
      foreignKey: 'sepa_dispute_id',
      oneToOne: false,
    },
    {
      parent: 'card_transactions',
      child: 'dispute_requests',
      foreignKey: 'card_transaction_id',
      oneToOne: false,
    },
    {
      parent: 'direct_debits',
      child: 'dispute_requests',
      foreignKey: 'direct_debit_id',
      oneToOne: false,
    },
    {
      parent: 'outgoing_transfers',
      child: 'dispute_requests',
      foreignKey: 'outgoing_transfer_id',
      oneToOne: false,
    },
    {
      parent: 'investigations',
      child: 'dispute_requests',
      foreignKey: 'investigation_id',
      oneToOne: false,
    },
    {
      parent: 'card_transactions',
      child: 'chargebacks',
      foreignKey: 'card_transaction_id',
      oneToOne: false,
    },
    {
      parent: 'alerts',
      child: 'chargebacks',
      foreignKey: 'alert_id',
      oneToOne: false,
    },
    {
      parent: 'incoming_transfers',
      child: 'sepa_disputes',
      foreignKey: 'incoming_transfer_id',
      oneToOne: false,
    },
    {
      parent: 'outgoing_transfers',
      child: 'sepa_disputes',
      foreignKey: 'outgoing_transfer_id',
      oneToOne: false,
    },
    {
      parent: 'sepa_disputes',
      child: 'complaints',
      foreignKey: 'sepa_dispute_id',
      oneToOne: false,
    },
    {
      parent: 'dispute_requests',
      child: 'information_requests',
      foreignKey: 'dispute_request_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'einvoicing_registrations',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'einvoicing_registrations',
      foreignKey: 'business_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'invoices',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'invoices',
      foreignKey: 'business_id',
      oneToOne: false,
    },
    {
      parent: 'einvoicing_registrations',
      child: 'invoices',
      foreignKey: 'registration_id',
      oneToOne: false,
    },
    {
      parent: 'counterparties',
      child: 'invoices',
      foreignKey: 'counterparty_id',
      oneToOne: false,
    },
    {
      parent: 'alerts',
      child: 'invoices',
      foreignKey: 'alert_id',
      oneToOne: false,
    },
    {
      parent: 'invoices',
      child: 'invoice_payments',
      foreignKey: 'invoice_id',
      oneToOne: false,
    },
    {
      parent: 'transactions',
      child: 'invoice_payments',
      foreignKey: 'transaction_id',
      oneToOne: false,
    },
    {
      parent: 'einvoicing_registrations',
      child: 'ereporting_submissions',
      foreignKey: 'registration_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'ereporting_submissions',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'ereporting_submissions',
      child: 'ereporting_submissions',
      foreignKey: 'replaces_id',
      oneToOne: false,
    },
    {
      parent: 'alerts',
      child: 'dispute_requests',
      foreignKey: 'alert_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'sepa_disputes',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
    {
      parent: 'businesses',
      child: 'ereporting_submissions',
      foreignKey: 'business_id',
      oneToOne: false,
    },
    {
      parent: 'customers',
      child: 'loans',
      foreignKey: 'customer_id',
      oneToOne: false,
    },
  ],
  manyToMany: [
    {
      from: 'alerts',
      to: 'transactions',
      through: 'alert_transactions',
      originKey: 'alert_id',
      foreignKey: 'transaction_id',
    },
    {
      from: 'accounts',
      to: 'sdd_creditors',
      through: 'mandates',
      originKey: 'account_id',
      foreignKey: 'creditor_id',
    },
    {
      from: 'customers',
      to: 'individuals',
      through: 'customer_members',
      originKey: 'customer_id',
      foreignKey: 'individual_id',
    },
    {
      from: 'investigations',
      to: 'transactions',
      through: 'investigation_transactions',
      originKey: 'investigation_id',
      foreignKey: 'transaction_id',
    },
    {
      from: 'dispute_requests',
      to: 'transactions',
      through: 'dispute_transactions',
      originKey: 'dispute_request_id',
      foreignKey: 'transaction_id',
    },
    {
      from: 'chargebacks',
      to: 'transactions',
      through: 'dispute_transactions',
      originKey: 'chargeback_id',
      foreignKey: 'transaction_id',
    },
    {
      from: 'sepa_disputes',
      to: 'transactions',
      through: 'dispute_transactions',
      originKey: 'sepa_dispute_id',
      foreignKey: 'transaction_id',
    },
    {
      from: 'invoices',
      to: 'transactions',
      through: 'invoice_payments',
      originKey: 'invoice_id',
      foreignKey: 'transaction_id',
    },
  ],
  history: {
    table: 'status_changes',
    key: 'record_id',
  },
};

export default dataModel;
