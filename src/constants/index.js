// ============================================================
// Shared vocabulary. These strings must match the Postgres enums exactly.
// ============================================================

export const ROLES = {
  ADMIN: 'admin',
  REGISTRATION: 'registration',
  ALT: 'alt',
  FINANCE: 'finance',
  ARCHIVE: 'archive',
}

export const ROLE_LABELS = {
  admin: 'Administrator',
  archive: 'Archive & Records Officer',
  registration: 'Registration',
  alt: 'ALT Department',
  finance: 'Finance',
}

export const STATUS = {
  REGISTERED: 'registered',
  WAITING_ADMIN_APPROVAL: 'waiting_admin_approval',
  WAITING_ALT: 'waiting_alt',
  DOCUMENT_UPLOADED: 'document_uploaded',
  WAITING_PAYMENT: 'waiting_payment',
  PAID: 'paid',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

/** Order of the workflow, used by the timeline and by progress indicators. */
export const STATUS_ORDER = [
  STATUS.REGISTERED,
  STATUS.WAITING_ADMIN_APPROVAL,
  STATUS.WAITING_ALT,
  STATUS.DOCUMENT_UPLOADED,
  STATUS.WAITING_PAYMENT,
  STATUS.PAID,
  STATUS.COMPLETED,
]

export const STATUS_META = {
  draft: { label: 'Draft', tone: 'slate' },
  registered: { label: 'Registered', tone: 'slate' },
  waiting_admin_approval: { label: 'Waiting Admin Approval', tone: 'amber' },
  waiting_alt: { label: 'Waiting ALT', tone: 'blue' },
  document_uploaded: { label: 'Document Uploaded', tone: 'indigo' },
  waiting_payment: { label: 'Waiting Payment', tone: 'orange' },
  paid: { label: 'Paid', tone: 'emerald' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'evc_plus', label: 'EVC Plus' },
  { value: 'zaad', label: 'ZAAD' },
  { value: 'sahal', label: 'SAHAL' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
]

export const PAYMENT_METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
)

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'textarea', label: 'Long text' },
  { value: 'checkbox', label: 'Yes / No' },
  { value: 'phone', label: 'Phone number' },
]

/**
 * Districts of Banadir (Mogadishu). Chosen from a list rather than typed so
 * the same district is never spelled three different ways — which is what
 * makes "clients by district" reporting possible later.
 */
export const MOGADISHU_DISTRICTS = [
  'Boondheere',
  'Cabdulcasiis',
  'Daynille',
  'Dharkenley',
  'Garasbaaley',
  'Gubadley',
  'Hodan',
  'Howl-Wadaag',
  'Huriwaa',
  'Kaaraan',
  'Kaxda',
  'Shangaani',
  'Shibis',
  'Waaberi',
  'Wadajir',
  'Wardhiigleey',
  'Xamar Jajab',
  'Xamar Weyne',
  'Yaaqshiid',
]

/** Accepted forms of identification. The number is entered alongside. */
/** Shown in Somali only — the office works in Somali. */
export const ID_TYPES = [
  { value: 'national_id', label: 'Aqoonsi Qaran' },
  { value: 'passport', label: 'Baasaboor' },
  { value: 'licence', label: 'Laysanka Darawalnimada' },
]

export const ID_TYPE_LABELS = Object.fromEntries(ID_TYPES.map((t) => [t.value, t.label]))

/** Kinds of paper the office notarised before this system existed. */
export const ARCHIVE_DOCUMENT_TYPES = [
  { value: 'Contract', label: 'Contract' },
  { value: 'Sale Agreement', label: 'Sale Agreement' },
  { value: 'Power of Attorney', label: 'Power of Attorney' },
  { value: 'Affidavit', label: 'Affidavit' },
  { value: 'Declaration', label: 'Declaration' },
  { value: 'Translation', label: 'Translation' },
  { value: 'Other', label: 'Other' },
]

export const ARCHIVE_STATUSES = [
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

/** Used to tag an expense or income to the part of the office it belongs to. */
export const DEPARTMENTS = [
  { value: 'Registration', label: 'Registration' },
  { value: 'ALT', label: 'ALT' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Administration', label: 'Administration' },
]

export const DISCOUNT_REASONS = [
  'Repeat Customer',
  'Elderly Client',
  'Office Manager Request',
  'Family Discount',
  'Charity Case',
  'Government Employee',
  'Bulk Service',
]

export const PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/** Uploads are checked in the browser before a single byte leaves the machine. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
}
export const ALLOWED_IMAGE_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
}

/**
 * Sidebar definition. `roles` decides who ever sees the link at all.
 * `tKey` is the translation key; `label` stays as the English fallback.
 */
export const NAV_ITEMS = [
  { to: '/admin', tKey: 'nav.dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: ['admin'], end: true },
  { to: '/admin/discounts', tKey: 'nav.pendingDiscounts', label: 'Pending Discounts', icon: 'BadgePercent', roles: ['admin'], badge: 'discounts' },
  { to: '/admin/employees', tKey: 'nav.employees', label: 'Employees', icon: 'Users', roles: ['admin'] },
  { to: '/admin/services', tKey: 'nav.services', label: 'Services', icon: 'Briefcase', roles: ['admin'] },
  { to: '/admin/settings', tKey: 'nav.officeSettings', label: 'Office Settings', icon: 'Settings', roles: ['admin'] },
  { to: '/admin/logs', tKey: 'nav.activityLogs', label: 'Activity Logs', icon: 'ScrollText', roles: ['admin'] },
  { to: '/admin/backup', tKey: 'nav.backup', label: 'Backup', icon: 'DatabaseBackup', roles: ['admin'] },

  { to: '/registration', tKey: 'nav.dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: ['registration'], end: true },
  { to: '/registration/new', tKey: 'nav.newClient', label: 'New Client', icon: 'UserPlus', roles: ['registration'] },
  { to: '/registration/drafts', tKey: 'nav.drafts', label: 'Drafts', icon: 'FileClock', roles: ['registration'], badge: 'drafts' },
  { to: '/registration/clients', tKey: 'nav.myClients', label: 'My Clients', icon: 'Users', roles: ['registration'] },

  { to: '/alt', tKey: 'nav.dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: ['alt'], end: true },
  { to: '/alt/queue', tKey: 'nav.workQueue', label: 'Work Queue', icon: 'Inbox', roles: ['alt'], badge: 'altQueue' },
  { to: '/alt/documents', tKey: 'nav.documentCenter', label: 'Document Center', icon: 'FolderOpen', roles: ['alt'] },

  { to: '/finance', tKey: 'nav.dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: ['finance'], end: true },
  { to: '/finance/pending', tKey: 'nav.pendingPayments', label: 'Pending Payments', icon: 'Wallet', roles: ['finance'], badge: 'pendingPayments' },
  { to: '/finance/receipts', tKey: 'nav.receipts', label: 'Receipts', icon: 'ReceiptText', roles: ['finance'] },
  { to: '/finance/invoices', tKey: 'nav.invoices', label: 'Invoices', icon: 'FileText', roles: ['finance'] },
  { to: '/finance/expenses', tKey: 'nav.expenses', label: 'Expenses', icon: 'TrendingDown', roles: ['finance'] },
  { to: '/finance/reports', tKey: 'nav.reports', label: 'Reports', icon: 'BarChart3', roles: ['finance'] },

  // Admin reaches every department view through its own section
  { to: '/finance/pending', tKey: 'nav.payments', label: 'Payments', icon: 'Wallet', roles: ['admin'], badge: 'pendingPayments' },
  { to: '/finance/expenses', tKey: 'nav.expenses', label: 'Expenses', icon: 'TrendingDown', roles: ['admin'] },
  { to: '/finance/reports', tKey: 'nav.reports', label: 'Reports', icon: 'BarChart3', roles: ['admin'] },
  { to: '/alt/documents', tKey: 'nav.documents', label: 'Documents', icon: 'FolderOpen', roles: ['admin'] },

  { to: '/archive', tKey: 'nav.archive', label: 'Archive', icon: 'Archive', roles: ['admin', 'archive'], end: true },

  { to: '/clients', tKey: 'nav.clientSearch', label: 'Client Search', icon: 'Search', roles: ['admin', 'registration', 'alt', 'finance', 'archive'] },
]

export const HOME_BY_ROLE = {
  admin: '/admin',
  registration: '/registration',
  alt: '/alt',
  finance: '/finance',
  // The Archive officer has one job, so the archive itself is their home.
  archive: '/archive',
}
