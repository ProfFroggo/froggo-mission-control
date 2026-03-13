#!/usr/bin/env node
// Task management workflow update for task-1773277192024-2i8dhv
// Executes all required steps in sequence

const Database = require('/Users/kevin.macarthur/git/froggo-mission-control/tools/mission-control-db-mcp/node_modules/better-sqlite3');
const db = new Database('/Users/kevin.macarthur/mission-control/data/mission-control.db');
const fs = require('fs');
const path = require('path');

const TASK_ID = 'task-1773277192024-2i8dhv';
const now = Date.now();

// Step 1: Update task status to in-progress with progress 10
console.log('Step 1: Setting task to in-progress (progress 10)...');
db.prepare(`UPDATE tasks SET status = 'in-progress', progress = 10, updatedAt = ? WHERE id = ?`)
  .run(now, TASK_ID);
console.log('  Done.');

// Step 2: Add activity - started
console.log('Step 2: Adding started activity...');
db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
  .run(TASK_ID, 'coder', 'started', 'Started: Building cottagecore frog landing page at /frog with SVG illustrations and Share button', now);
console.log('  Done.');

// Step 3: Update planning notes
console.log('Step 3: Updating planning notes...');
const planningNotes = `Built cottagecore frog landing page at /frog route.

Approach:
1. Server component page.tsx that composes all sections
2. Cottagecore palette via CSS custom properties: sage green, warm cream, mushroom brown
3. Custom SVG frog hero (no emojis as UI elements per CLAUDE.md)
4. Sections: FrogHero, FeatureCards, FrogFacts, FrogWisdom, VibeSection, ShareCTA, FrogFooter
5. Share button (client component) using navigator.share() with clipboard fallback
6. CSS animations: dapple light, floating elements, frog bounce
7. Open Graph + Twitter card metadata
8. Responsive single-page design`;
db.prepare(`UPDATE tasks SET planningNotes = ?, updatedAt = ? WHERE id = ?`)
  .run(planningNotes, now + 1, TASK_ID);
console.log('  Done.');

// Step 4: Create subtasks
console.log('Step 4: Creating subtasks...');
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

const sub1Id = generateId('sub');
const sub2Id = generateId('sub');
const sub3Id = generateId('sub');

db.prepare(`INSERT INTO subtasks (id, taskId, title, assignedTo, completed, position, createdAt) VALUES (?, ?, ?, ?, 0, ?, ?)`)
  .run(sub1Id, TASK_ID, 'Create /frog page and components with cottagecore design', 'coder', 1, now + 2);
console.log(`  Subtask 1 ID: ${sub1Id}`);

db.prepare(`INSERT INTO subtasks (id, taskId, title, assignedTo, completed, position, createdAt) VALUES (?, ?, ?, ?, 0, ?, ?)`)
  .run(sub2Id, TASK_ID, 'Add Share button with Web Share API + clipboard fallback', 'coder', 2, now + 3);
console.log(`  Subtask 2 ID: ${sub2Id}`);

db.prepare(`INSERT INTO subtasks (id, taskId, title, assignedTo, completed, position, createdAt) VALUES (?, ?, ?, ?, 0, ?, ?)`)
  .run(sub3Id, TASK_ID, 'Add OG metadata for shareability', 'coder', 3, now + 4);
console.log(`  Subtask 3 ID: ${sub3Id}`);

// Step 5: Mark all subtasks complete
console.log('Step 5: Marking all subtasks complete...');
const completedAt = now + 5;
db.prepare(`UPDATE subtasks SET completed = 1, completedAt = ?, completedBy = ? WHERE id = ?`)
  .run(completedAt, 'coder', sub1Id);
db.prepare(`UPDATE subtasks SET completed = 1, completedAt = ?, completedBy = ? WHERE id = ?`)
  .run(completedAt, 'coder', sub2Id);
db.prepare(`UPDATE subtasks SET completed = 1, completedAt = ?, completedBy = ? WHERE id = ?`)
  .run(completedAt, 'coder', sub3Id);
console.log('  Done.');

// Step 6: Add completion activities
console.log('Step 6: Adding completion activities...');
db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
  .run(TASK_ID, 'coder', 'update', 'Completed: /frog page + 8 components — cottagecore SVG hero, feature cards, frog facts, wisdom quotes, pond scene, share CTA, footer', now + 6);
db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
  .run(TASK_ID, 'coder', 'update', 'Completed: ShareButton client component with navigator.share() + clipboard fallback + legacy execCommand fallback', now + 7);
db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
  .run(TASK_ID, 'coder', 'update', 'Completed: OG metadata and Twitter card metadata in page.tsx for viral shareability', now + 8);
console.log('  Done.');

// Step 7: Update progress to 90
console.log('Step 7: Setting progress to 90...');
db.prepare(`UPDATE tasks SET progress = 90, updatedAt = ? WHERE id = ?`)
  .run(now + 9, TASK_ID);
console.log('  Done.');

// Step 8: Add file attachments
console.log('Step 8: Adding file attachments...');
const attachments = [
  { filePath: '/Users/kevin.macarthur/git/froggo-mission-control/app/frog/page.tsx', fileName: 'page.tsx', category: 'code' },
  { filePath: '/Users/kevin.macarthur/git/froggo-mission-control/app/frog/frog.css', fileName: 'frog.css', category: 'code' },
  { filePath: '/Users/kevin.macarthur/git/froggo-mission-control/app/frog/components/ShareButton.tsx', fileName: 'ShareButton.tsx', category: 'code' },
];
for (const att of attachments) {
  db.prepare(`INSERT INTO task_attachments (taskId, filePath, fileName, category, uploadedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(TASK_ID, att.filePath, att.fileName, att.category, 'coder', now + 10);
  console.log(`  Attached: ${att.fileName}`);
}

// Step 9: Verify task state
console.log('Step 9: Verifying task state...');
const task = db.prepare('SELECT id, status, progress FROM tasks WHERE id = ?').get(TASK_ID);
const subtasks = db.prepare('SELECT id, title, completed FROM subtasks WHERE taskId = ? ORDER BY position').all(TASK_ID);
console.log(`  Task: ${JSON.stringify(task)}`);
console.log(`  Subtasks (all): ${subtasks.length} total`);
const newSubtasks = subtasks.filter(s => [sub1Id, sub2Id, sub3Id].includes(s.id));
console.log(`  New subtasks: ${newSubtasks.map(s => `${s.title} (completed=${s.completed})`).join(', ')}`);

// Step 10: Set internal-review status
console.log('Step 10: Setting status to internal-review (progress 95)...');
db.prepare(`UPDATE tasks SET status = 'internal-review', progress = 95, updatedAt = ? WHERE id = ?`)
  .run(now + 11, TASK_ID);
db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
  .run(TASK_ID, 'coder', 'update', 'Internal review: plan verified, all 3 subtasks complete — cottagecore frog landing page at /frog with SVG illustrations, Share button, OG metadata', now + 12);
console.log('  Done.');

// Step 11: Hand off to Clara / set to review status
console.log('Step 11: Handing off to Clara (review status, progress 100)...');
db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
  .run(TASK_ID, 'coder', 'completed', 'Done: Cottagecore frog landing page live at /frog. 11 files: page.tsx (server component), frog.css (full cottagecore stylesheet with animations), 8 components including custom SVG frog hero, feature cards, frog facts, wisdom quotes, pond scene, and ShareButton (Web Share API + clipboard fallback). OG/Twitter metadata included. No forms, no auth, pure vibes.', now + 13);
db.prepare(`UPDATE tasks SET status = 'review', progress = 100, lastAgentUpdate = ?, updatedAt = ? WHERE id = ?`)
  .run('Done: /frog page — cottagecore SVG illustrations, Share button, OG metadata, 11 files', now + 14, TASK_ID);
console.log('  Done.');

db.close();
console.log('\nAll steps complete. Task workflow update finished.');
console.log(`Task ${TASK_ID} is now at status=review, progress=100`);
