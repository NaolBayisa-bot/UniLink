-- Rollback for 0004_create_safety_tables: drop the safety tables in reverse dependency order.
DROP TABLE reveal_consents;
DROP TABLE blocks;
DROP TABLE reports;