DROP TABLE IF EXISTS Users;
CREATE TABLE Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT 0
);

DROP TABLE IF EXISTS AccessKeys;
CREATE TABLE AccessKeys (
  key_string TEXT PRIMARY KEY,
  is_used BOOLEAN DEFAULT 0,
  claimed_by_user_id INTEGER,
  FOREIGN KEY (claimed_by_user_id) REFERENCES Users(id)
);

DROP TABLE IF EXISTS MediaPayloads;
CREATE TABLE MediaPayloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_data BLOB,
  mime_type TEXT,
  created_at INTEGER
);

DROP TABLE IF EXISTS Messages;
CREATE TABLE Messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  text_content TEXT,
  media_id_ref INTEGER,
  timestamp INTEGER,
  FOREIGN KEY (sender_id) REFERENCES Users(id),
  FOREIGN KEY (receiver_id) REFERENCES Users(id),
  FOREIGN KEY (media_id_ref) REFERENCES MediaPayloads(id)
);
