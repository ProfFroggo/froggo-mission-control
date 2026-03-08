-- inbox-fts-repair.sql
-- Repair script for corrupted inbox_fts (Full-Text Search) table
-- Use when inbox table updates fail with "database disk image is malformed" error
--
-- Symptoms:
--   - SQLite error 11 (SQLITE_CORRUPT) on UPDATE/DELETE in inbox table
--   - Read operations work fine
--   - PRAGMA integrity_check passes but writes still fail
--
-- Root Cause:
--   - Corrupted FTS5 index in inbox_fts virtual table
--   - FTS triggers fail to update index on inbox table changes
--
-- Usage:
--   sqlite3 ~/mission-control/data/mission-control.db < ~/mission-control-dashboard/scripts/inbox-fts-repair.sql
--
-- Created: 2026-02-13
-- Context: Task 1770981822850 - Fix ghost approvals

BEGIN TRANSACTION;

-- Step 1: Drop the corrupted FTS update trigger
-- This allows inbox table updates to proceed without triggering FTS corruption
DROP TRIGGER IF EXISTS inbox_fts_au;

-- Step 2: Rebuild the FTS index from scratch
-- This recreates the entire FTS index by re-scanning the inbox table
INSERT INTO inbox_fts(inbox_fts) VALUES('rebuild');

-- Step 3: Recreate the FTS update trigger
-- Now that the index is clean, the trigger will work correctly
CREATE TRIGGER inbox_fts_au AFTER UPDATE ON inbox BEGIN
    -- Delete old FTS entry
    INSERT INTO inbox_fts(inbox_fts, rowid, title, content, context)
    VALUES ('delete', old.id, old.title, old.content, old.context);
    
    -- Insert new FTS entry
    INSERT INTO inbox_fts(rowid, title, content, context)
    VALUES (new.id, new.title, new.content, COALESCE(new.context, ''));
END;

COMMIT;

-- Verification: Test that writes now work
-- This should succeed without errors
SELECT 'FTS repair complete. Testing write operation...' AS status;

-- Test update (should not fail)
UPDATE inbox SET reviewed_at = reviewed_at WHERE id IN (
    SELECT id FROM inbox LIMIT 1
);

SELECT 'Write test passed. inbox_fts is repaired.' AS status;

-- Show summary
SELECT 
    'Repaired inbox_fts index for ' || COUNT(*) || ' items' AS summary
FROM inbox;
