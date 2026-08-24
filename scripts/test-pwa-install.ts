import assert from 'node:assert/strict';
import {
  PWA_REMINDER_INTERVAL_DAYS,
  PWA_REMINDER_INTERVAL_MS,
  parsePwaReminderState,
  shouldShowPwaReminder,
} from '../lib/pwa-install';

const now = Date.UTC(2026, 7, 21, 12);

assert.equal(PWA_REMINDER_INTERVAL_DAYS >= 7 && PWA_REMINDER_INTERVAL_DAYS <= 14, true);
assert.equal(shouldShowPwaReminder({ version: 1 }, { now }), true, 'first WhatsApp send should show reminder');
assert.equal(shouldShowPwaReminder({ version: 1 }, { now, installed: true }), false, 'installed PWA must not show reminder');
assert.equal(shouldShowPwaReminder({ version: 1, installedAt: now - 1 }, { now }), false, 'recorded install must suppress reminder');
assert.equal(shouldShowPwaReminder({ version: 1, neverShowAgain: true }, { now }), false, 'never-show flag must suppress reminder');
assert.equal(
  shouldShowPwaReminder({ version: 1, nextReminderAt: now + PWA_REMINDER_INTERVAL_MS }, { now }),
  false,
  'reminder must not repeat immediately',
);
assert.equal(
  shouldShowPwaReminder({ version: 1, nextReminderAt: now }, { now }),
  true,
  'reminder should return when the due date is reached',
);
assert.deepEqual(parsePwaReminderState('{broken'), { version: 1 });
assert.deepEqual(parsePwaReminderState(JSON.stringify({ version: 99, neverShowAgain: true })), { version: 1 });

console.log('PWA reminder logic: OK');
