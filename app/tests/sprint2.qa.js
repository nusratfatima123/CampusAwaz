/**
 * Sprint 2 QA harness — pure-logic checks that need no live Supabase.
 *
 * Run:
 *   npm run test:sprint2
 *
 * Covers the parts of the QA checklist that are verifiable offline:
 *   - evidence MIME / size / count validation
 *   - complaint title & description bounds
 *   - privacy-mode tamper rejection
 *   - tracking-ID format + uniqueness + per-university-per-year sequencing
 *   - anonymous alias shape
 *   - identity-exposure redaction rules (mirrors lib/complaints.ts)
 *   - sensitive-case access rules (mirrors the RLS policies in 002_complaints.sql)
 *   - sensitive-case handler routing precedence
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  validateEvidenceFile,
  validateEvidenceSet,
  validateComplaintTitle,
  validateComplaintDescription,
  validatePrivacyMode,
  isTrackingIdShape,
} = require('../.qa-build/validators.js');
const {
  MAX_EVIDENCE_FILES,
  MAX_EVIDENCE_FILE_BYTES,
  EVIDENCE_SIGNED_URL_TTL_SECONDS,
  EVIDENCE_BUCKET,
  ALLOWED_EVIDENCE_MIME_TYPES,
} = require('../.qa-build/constants.js');

let pass = 0;
const failures = [];

function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS  ' + name);
  } catch (err) {
    failures.push(name + ' :: ' + err.message);
    console.log('  FAIL  ' + name + ' :: ' + err.message);
  }
}

// ---------------------------------------------------------------- evidence
console.log('\n--- Evidence validation ---');
t('accepts a 1 MB JPEG', () => {
  assert.equal(
    validateEvidenceFile({ type: 'image/jpeg', size: 1024 * 1024, name: 'a.jpg' })
      .valid,
    true
  );
});
t('accepts a PDF', () => {
  assert.equal(
    validateEvidenceFile({ type: 'application/pdf', size: 2048, name: 'a.pdf' }).valid,
    true
  );
});
t('rejects a wrong MIME type (video/mp4)', () => {
  const r = validateEvidenceFile({ type: 'video/mp4', size: 1000, name: 'a.mp4' });
  assert.equal(r.valid, false);
  assert.match(r.error, /not a supported type/);
});
t('rejects an executable renamed to .jpg', () => {
  assert.equal(
    validateEvidenceFile({
      type: 'application/x-msdownload',
      size: 1000,
      name: 'x.jpg',
    }).valid,
    false
  );
});
t('rejects an oversized file (5 MB + 1 byte)', () => {
  const r = validateEvidenceFile({
    type: 'image/png',
    size: MAX_EVIDENCE_FILE_BYTES + 1,
    name: 'big.png',
  });
  assert.equal(r.valid, false);
  assert.match(r.error, /too large/);
});
t('accepts exactly 5 MB', () => {
  assert.equal(
    validateEvidenceFile({
      type: 'image/png',
      size: MAX_EVIDENCE_FILE_BYTES,
      name: 'edge.png',
    }).valid,
    true
  );
});
t('rejects an empty file', () => {
  assert.equal(
    validateEvidenceFile({ type: 'image/png', size: 0, name: 'e.png' }).valid,
    false
  );
});
t('accepts exactly 5 files', () => {
  const files = Array.from({ length: 5 }, (_, i) => ({
    type: 'image/png',
    size: 100,
    name: `f${i}.png`,
  }));
  assert.equal(validateEvidenceSet(files).valid, true);
});
t('rejects 6 files', () => {
  const files = Array.from({ length: 6 }, (_, i) => ({
    type: 'image/png',
    size: 100,
    name: `f${i}.png`,
  }));
  const r = validateEvidenceSet(files);
  assert.equal(r.valid, false);
  assert.match(r.error, /at most 5 files/);
});
t('one bad file fails the whole set', () => {
  assert.equal(
    validateEvidenceSet([
      { type: 'image/png', size: 100, name: 'ok.png' },
      { type: 'text/html', size: 100, name: 'bad.html' },
    ]).valid,
    false
  );
});

// ------------------------------------------------------------------- text
console.log('\n--- Complaint text validation ---');
t('rejects an empty title', () =>
  assert.equal(validateComplaintTitle('').valid, false));
t('rejects a too-short title', () =>
  assert.equal(validateComplaintTitle('short').valid, false));
t('accepts a normal title', () =>
  assert.equal(validateComplaintTitle('Lab equipment broken').valid, true));
t('rejects a title over 140 chars', () =>
  assert.equal(validateComplaintTitle('x'.repeat(141)).valid, false));
t('rejects a description under 30 chars', () =>
  assert.equal(validateComplaintDescription('too short').valid, false));
t('accepts a description of exactly 30 chars', () =>
  assert.equal(validateComplaintDescription('a'.repeat(30)).valid, true));
t('rejects a description over 5000 chars', () =>
  assert.equal(validateComplaintDescription('a'.repeat(5001)).valid, false));

// ---------------------------------------------------------------- privacy
console.log('\n--- Privacy modes ---');
for (const mode of ['identified', 'confidential', 'anonymous']) {
  t(`accepts privacy mode "${mode}"`, () =>
    assert.equal(validatePrivacyMode(mode).valid, true));
}
t('rejects a tampered privacy mode', () =>
  assert.equal(validatePrivacyMode('public').valid, false));
t('rejects an empty privacy mode', () =>
  assert.equal(validatePrivacyMode('').valid, false));

// ------------------------------------------------------------- tracking id
console.log('\n--- Tracking ID format ---');
const PATTERN = /^CA-[A-Z0-9-]{2,20}-\d{4}-\d{5,}$/;
t('CA-FAST-2026-00001 matches the spec', () => {
  assert.equal(isTrackingIdShape('CA-FAST-2026-00001'), true);
  assert.equal(PATTERN.test('CA-FAST-2026-00001'), true);
});
t('CA-FAST-NU-2026-00042 (hyphenated code) matches', () =>
  assert.equal(isTrackingIdShape('CA-FAST-NU-2026-00042'), true));
t('lower-case input is normalised', () =>
  assert.equal(isTrackingIdShape('ca-lums-2026-00007'), true));
t('rejects a 4-digit sequence', () =>
  assert.equal(isTrackingIdShape('CA-FAST-2026-0001'), false));
t('rejects a missing year', () =>
  assert.equal(isTrackingIdShape('CA-FAST-00001'), false));
t('rejects a SQL-injection-shaped tracking id', () =>
  assert.equal(isTrackingIdShape("CA-FAST-2026-00001' OR '1'='1"), false));
t('rejects a path-traversal tracking id', () =>
  assert.equal(isTrackingIdShape('../../etc/passwd'), false));

console.log('\n--- Tracking ID sequencing (mirrors generate_tracking_id) ---');
function simulateGenerate(code, year, counters) {
  const key = `${code}:${year}`;
  counters[key] = (counters[key] ?? 0) + 1;
  return `CA-${code}-${year}-${String(counters[key]).padStart(5, '0')}`;
}
t('first ID for a university-year is 00001', () =>
  assert.equal(simulateGenerate('FAST', 2026, {}), 'CA-FAST-2026-00001'));
t('250 sequential IDs are all unique and well-formed', () => {
  const counters = {};
  const seen = new Set();
  for (let i = 0; i < 250; i++) {
    const id = simulateGenerate('FAST', 2026, counters);
    assert.equal(seen.has(id), false, 'duplicate: ' + id);
    assert.equal(PATTERN.test(id), true);
    seen.add(id);
  }
  assert.equal(seen.size, 250);
});
t('sequences are independent per university and per year', () => {
  const counters = {};
  assert.equal(simulateGenerate('FAST', 2026, counters), 'CA-FAST-2026-00001');
  assert.equal(simulateGenerate('LUMS', 2026, counters), 'CA-LUMS-2026-00001');
  assert.equal(simulateGenerate('FAST', 2027, counters), 'CA-FAST-2027-00001');
  assert.equal(simulateGenerate('FAST', 2026, counters), 'CA-FAST-2026-00002');
});

// ------------------------------------------------------------------ alias
console.log('\n--- Anonymous alias ---');
function generateAlias() {
  const short = crypto.randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `Student-${short}`;
}
t('alias matches Student-XXXX', () =>
  assert.match(generateAlias(), /^Student-[0-9A-F]{4}$/));
t('alias leaks no more than 4 hex chars of the uuid', () =>
  assert.equal(generateAlias().length, 12));

// --------------------------------------------------- identity redaction
console.log('\n--- Identity exposure (mirrors getAssignedSensitiveCases) ---');
function identityVisible(privacyMode, exposedTo, viewerId) {
  return (
    privacyMode === 'identified' ||
    (privacyMode === 'confidential' && exposedTo.includes(viewerId))
  );
}
t('anonymous hides identity from the assigned handler', () =>
  assert.equal(identityVisible('anonymous', ['ffp'], 'ffp'), false));
t('anonymous hides identity from everyone else too', () =>
  assert.equal(identityVisible('anonymous', [], 'admin'), false));
t('confidential exposes identity to the assigned handler only', () => {
  assert.equal(identityVisible('confidential', ['ffp'], 'ffp'), true);
  assert.equal(identityVisible('confidential', ['ffp'], 'proctor'), false);
  assert.equal(identityVisible('confidential', ['ffp'], 'admin'), false);
});
t('identified exposes identity to an authorized handler', () =>
  assert.equal(identityVisible('identified', [], 'ffp'), true));

// ------------------------------------------------------------------- RLS
console.log('\n--- Sensitive-case access (mirrors complaints_select_* policies) ---');
function canRead({ complaint, viewer, assignments }) {
  if (complaint.student_id === viewer.id) return true;
  if (
    assignments.some(
      (a) => a.complaint_id === complaint.id && a.user_id === viewer.id
    )
  ) {
    return true;
  }
  return Boolean(
    viewer.isStaff &&
      !complaint.is_sensitive &&
      complaint.university_id === viewer.university_id
  );
}

const sensitiveCase = {
  id: 'c1',
  student_id: 'studentA',
  is_sensitive: true,
  university_id: 'u1',
};
const normalCase = {
  id: 'c2',
  student_id: 'studentA',
  is_sensitive: false,
  university_id: 'u1',
};
const assignments = [{ complaint_id: 'c1', user_id: 'ffp1' }];

t('reporting student can read their own sensitive case', () =>
  assert.equal(
    canRead({
      complaint: sensitiveCase,
      viewer: { id: 'studentA', isStaff: false, university_id: 'u1' },
      assignments,
    }),
    true
  ));
t('assigned Female Focal Person can read the sensitive case', () =>
  assert.equal(
    canRead({
      complaint: sensitiveCase,
      viewer: { id: 'ffp1', isStaff: true, university_id: 'u1' },
      assignments,
    }),
    true
  ));
t('UNASSIGNED admin cannot read the sensitive case', () =>
  assert.equal(
    canRead({
      complaint: sensitiveCase,
      viewer: { id: 'admin1', isStaff: true, university_id: 'u1' },
      assignments,
    }),
    false
  ));
t('FFP from another university cannot read it', () =>
  assert.equal(
    canRead({
      complaint: sensitiveCase,
      viewer: { id: 'ffp2', isStaff: true, university_id: 'u2' },
      assignments,
    }),
    false
  ));
t('another student cannot read someone else\u2019s complaint', () =>
  assert.equal(
    canRead({
      complaint: normalCase,
      viewer: { id: 'studentB', isStaff: false, university_id: 'u1' },
      assignments,
    }),
    false
  ));
t('same-university staff can read a NON-sensitive complaint', () =>
  assert.equal(
    canRead({
      complaint: normalCase,
      viewer: { id: 'hod1', isStaff: true, university_id: 'u1' },
      assignments,
    }),
    true
  ));
t('other-university staff cannot read a non-sensitive complaint', () =>
  assert.equal(
    canRead({
      complaint: normalCase,
      viewer: { id: 'hod2', isStaff: true, university_id: 'u2' },
      assignments,
    }),
    false
  ));
t('FFP sees ONLY her assigned sensitive cases', () => {
  const all = [sensitiveCase, { ...sensitiveCase, id: 'c3' }, normalCase];
  const visible = all.filter(
    (complaint) =>
      complaint.is_sensitive &&
      canRead({
        complaint,
        viewer: { id: 'ffp1', isStaff: true, university_id: 'u1' },
        assignments,
      })
  );
  assert.deepEqual(
    visible.map((x) => x.id),
    ['c1']
  );
});

// -------------------------------------------------------------- routing
console.log('\n--- Handler routing precedence (mirrors resolveSensitiveHandlers) ---');
const ORDER = ['female_focal_person', 'proctor', 'admin', 'counselor'];
function resolveHandler(rolesAtUniversity) {
  for (const role of ORDER) {
    const found = rolesAtUniversity.find((r) => r.role === role);
    if (found) return [{ user_id: found.user_id, role }];
  }
  return [];
}
t('picks the Female Focal Person first', () =>
  assert.deepEqual(
    resolveHandler([
      { user_id: 'a', role: 'admin' },
      { user_id: 'f', role: 'female_focal_person' },
      { user_id: 'p', role: 'proctor' },
    ]),
    [{ user_id: 'f', role: 'female_focal_person' }]
  ));
t('falls back to the Proctor when no FFP exists', () =>
  assert.deepEqual(
    resolveHandler([
      { user_id: 'a', role: 'admin' },
      { user_id: 'p', role: 'proctor' },
    ]),
    [{ user_id: 'p', role: 'proctor' }]
  ));
t('falls back to Admin when neither FFP nor Proctor exists', () =>
  assert.deepEqual(resolveHandler([{ user_id: 'a', role: 'admin' }]), [
    { user_id: 'a', role: 'admin' },
  ]));
t('returns no handler when the university has none configured', () =>
  assert.deepEqual(resolveHandler([{ user_id: 'h', role: 'hostel_warden' }]), []));

// ------------------------------------------------------------ constants
console.log('\n--- Constants match the SRS ---');
t('max 5 files', () => assert.equal(MAX_EVIDENCE_FILES, 5));
t('max 5 MB per file', () =>
  assert.equal(MAX_EVIDENCE_FILE_BYTES, 5 * 1024 * 1024));
t('signed URLs expire in 1 hour', () =>
  assert.equal(EVIDENCE_SIGNED_URL_TTL_SECONDS, 3600));
t('bucket is complaint-evidence', () =>
  assert.equal(EVIDENCE_BUCKET, 'complaint-evidence'));
t('MIME allow-list is images + PDF only', () =>
  assert.deepEqual([...ALLOWED_EVIDENCE_MIME_TYPES], [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]));

console.log(
  `\n=========================\n${pass} passed, ${failures.length} failed\n=========================`
);
if (failures.length) {
  failures.forEach((f) => console.log('FAILED: ' + f));
  process.exit(1);
}
