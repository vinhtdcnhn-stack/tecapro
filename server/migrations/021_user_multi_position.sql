-- Junction table: một user có nhiều vị trí
CREATE TABLE IF NOT EXISTS app_user_position (
  user_id     BIGINT  NOT NULL,
  position_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_app_user_position_user ON app_user_position(user_id);

-- Migrate dữ liệu hiện có từ cột position_id đơn sang junction table
INSERT INTO app_user_position (user_id, position_id)
SELECT id, position_id FROM app_user WHERE position_id IS NOT NULL
ON CONFLICT DO NOTHING;
