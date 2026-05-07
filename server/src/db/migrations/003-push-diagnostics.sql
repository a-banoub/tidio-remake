ALTER TABLE push_subscriptions ADD COLUMN last_push_ok_at INTEGER;
ALTER TABLE push_subscriptions ADD COLUMN last_push_fail_reason TEXT;
ALTER TABLE push_subscriptions ADD COLUMN last_push_fail_at INTEGER;
