CREATE TABLE IF NOT EXISTS cs_messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL,
  receiver_id INTEGER NOT NULL REFERENCES users(id),
  receiver_role TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  status TEXT NOT NULL DEFAULT 'unread',
  related_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cs_messages_sender ON cs_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_cs_messages_receiver ON cs_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_cs_messages_pair ON cs_messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_cs_messages_unread ON cs_messages(receiver_id, status);
