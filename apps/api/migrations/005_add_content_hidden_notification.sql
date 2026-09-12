BEGIN;

ALTER TABLE notifications
  DROP CONSTRAINT notifications_type_check,
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'withdrawal_requested',
      'withdrawal_approved',
      'withdrawal_rejected',
      'writer_application_approved',
      'writer_application_rejected',
      'content_hidden'
    )
  );

COMMIT;
