#!/usr/bin/env node
/**
 * Snooze API Server
 * Provides REST API for snooze functionality
 * Runs alongside the dashboard
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3742;

// Database path
const DB_PATH = path.join(process.env.HOME, 'clawd', 'data', 'froggo.db');

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('Connected to froggo.db');
});

// Helper: Get current timestamp in milliseconds
const now = () => Date.now();

// Routes

// GET /api/snooze/list - List all snoozed conversations
app.get('/api/snooze/list', (req, res) => {
  const { filter } = req.query; // 'active', 'expired', or 'all'
  
  let whereClause = '';
  const params = [];
  
  if (filter === 'active') {
    whereClause = 'WHERE snooze_until > ?';
    params.push(now());
  } else if (filter === 'expired') {
    whereClause = 'WHERE snooze_until <= ?';
    params.push(now());
  }
  
  const query = `
    SELECT session_id, snooze_until, snooze_reason, reminder_sent, created_at
    FROM conversation_snoozes
    ${whereClause}
    ORDER BY snooze_until ASC
  `;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows || []);
  });
});

// GET /api/snooze/:sessionId - Get snooze details for a conversation
app.get('/api/snooze/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  db.get(
    'SELECT * FROM conversation_snoozes WHERE session_id = ?',
    [sessionId],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Not snoozed' });
      }
      
      res.json(row);
    }
  );
});

// POST /api/snooze - Snooze a conversation
app.post('/api/snooze', (req, res) => {
  const { session_id, until, reason } = req.body;
  
  if (!session_id || !until) {
    return res.status(400).json({ error: 'session_id and until are required' });
  }
  
  if (until <= now()) {
    return res.status(400).json({ error: 'Snooze time must be in the future' });
  }
  
  const timestamp = now();
  
  // Insert or update snooze
  db.run(
    `INSERT INTO conversation_snoozes (session_id, snooze_until, snooze_reason, reminder_sent, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       snooze_until = ?,
       snooze_reason = ?,
       reminder_sent = 0,
       updated_at = ?`,
    [session_id, until, reason || null, timestamp, timestamp, until, reason || null, timestamp],
    function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to snooze conversation' });
      }
      
      // Add to history
      db.run(
        'INSERT INTO snooze_history (session_id, snooze_until, snooze_reason, created_at) VALUES (?, ?, ?, ?)',
        [session_id, until, reason || null, timestamp]
      );
      
      res.json({ success: true, session_id, until });
    }
  );
});

// DELETE /api/snooze/:sessionId - Unsnooze a conversation
app.delete('/api/snooze/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const timestamp = now();
  
  // Update history before deleting
  db.run(
    'UPDATE snooze_history SET unsnoozed_at = ? WHERE session_id = ? AND unsnoozed_at IS NULL',
    [timestamp, sessionId]
  );
  
  db.run('DELETE FROM conversation_snoozes WHERE session_id = ?', [sessionId], function (err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to unsnooze conversation' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'No active snooze found' });
    }
    
    res.json({ success: true, session_id: sessionId });
  });
});

// GET /api/snooze/expired - Get expired snoozes that need reminders
app.get('/api/snooze/expired', (req, res) => {
  db.all(
    'SELECT * FROM conversation_snoozes WHERE snooze_until <= ? AND reminder_sent = 0',
    [now()],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows || []);
    }
  );
});

// POST /api/snooze/mark-reminded/:sessionId - Mark reminder as sent
app.post('/api/snooze/mark-reminded/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  db.run(
    'UPDATE conversation_snoozes SET reminder_sent = 1 WHERE session_id = ?',
    [sessionId],
    function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to mark reminder' });
      }
      
      res.json({ success: true, session_id: sessionId });
    }
  );
});

// GET /api/snooze/history/:sessionId - Get snooze history for a conversation
app.get('/api/snooze/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  db.all(
    'SELECT * FROM snooze_history WHERE session_id = ? ORDER BY created_at DESC',
    [sessionId],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows || []);
    }
  );
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: now() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Snooze API Server running on http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    }
    console.log('Database connection closed');
    process.exit(0);
  });
});
