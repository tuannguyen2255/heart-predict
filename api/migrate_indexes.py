"""Run once before starting workers: cd api; python migrate_indexes.py."""
import mysql.connector
from app.config import DB_CONFIG

# Explicit migration: index creation on a large table may take time.
INDEXES = (
    ("prediction_history", "idx_prediction_user_time", "user_id, timestamp, id"),
    ("chatbot_history", "idx_chat_user_time", "user_id, timestamp, id"),
    ("chatbot_history", "idx_chat_user_role_time", "user_id, role, timestamp"),
    ("users", "idx_users_email", "email"),
    ("users", "idx_users_phone", "phone"),
)


def migrate(conn):
    cursor = conn.cursor()
    try:
        for table, name, columns in INDEXES:
            cursor.execute(
                "SELECT COUNT(*) FROM information_schema.statistics "
                "WHERE table_schema = DATABASE() AND table_name = %s AND index_name = %s",
                (table, name),
            )
            if cursor.fetchone()[0] == 0:
                # All identifiers come from the fixed allowlist above.
                cursor.execute(f"CREATE INDEX {name} ON {table} ({columns})")
                print(f"Created {name}")
        conn.commit()
    finally:
        cursor.close()


if __name__ == "__main__":
    conn = mysql.connector.connect(**DB_CONFIG)
    try:
        migrate(conn)
    finally:
        conn.close()
