-- Migration: support Google OAuth (password_hash no longer required)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;