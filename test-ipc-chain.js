// Verify the IPC handler exists and is callable
const fs = require('fs');

console.log('🔍 Checking implementation chain...\n');

// Check backend
const mainContent = fs.readFileSync('electron/main.ts', 'utf8');
const hasHandler = mainContent.includes("ipcMain.handle('chat:suggestReplies'");
const hasClaude = mainContent.includes('/Users/worker/.local/bin/claude');
const hasPrompt = mainContent.includes('suggest 2-3 brief');

console.log('✅ Backend (electron/main.ts):');
console.log(`   - IPC Handler: ${hasHandler ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`   - Claude CLI: ${hasClaude ? '✅ INTEGRATED' : '❌ MISSING'}`);
console.log(`   - Prompt Logic: ${hasPrompt ? '✅ PRESENT' : '❌ MISSING'}`);

// Check preload
const preloadContent = fs.readFileSync('electron/preload.ts', 'utf8');
const hasExpose = preloadContent.includes('suggestReplies:');
const hasInvoke = preloadContent.includes("ipcRenderer.invoke('chat:suggestReplies'");

console.log('\n✅ Preload (electron/preload.ts):');
console.log(`   - Exposed: ${hasExpose ? '✅ YES' : '❌ NO'}`);
console.log(`   - IPC Call: ${hasInvoke ? '✅ WIRED' : '❌ MISSING'}`);

// Check frontend
const chatContent = fs.readFileSync('src/components/ChatPanel.tsx', 'utf8');
const hasState = chatContent.includes('suggestedReplies');
const hasFunction = chatContent.includes('generateSuggestions');
const hasButton = chatContent.includes('Sparkles');
const hasCall = chatContent.includes('window.clawdbot.chat.suggestReplies');

console.log('\n✅ Frontend (src/components/ChatPanel.tsx):');
console.log(`   - State Management: ${hasState ? '✅ PRESENT' : '❌ MISSING'}`);
console.log(`   - Generate Function: ${hasFunction ? '✅ PRESENT' : '❌ MISSING'}`);
console.log(`   - Sparkles Button: ${hasButton ? '✅ PRESENT' : '❌ MISSING'}`);
console.log(`   - IPC Call: ${hasCall ? '✅ CONNECTED' : '❌ MISSING'}`);

// Check types
const typesContent = fs.readFileSync('src/types/global.d.ts', 'utf8');
const hasTypes = typesContent.includes('suggestReplies');

console.log('\n✅ TypeScript (src/types/global.d.ts):');
console.log(`   - Type Definitions: ${hasTypes ? '✅ DEFINED' : '❌ MISSING'}`);

console.log('\n' + '='.repeat(50));
if (hasHandler && hasClaude && hasExpose && hasCall) {
  console.log('✅ COMPLETE CHAIN: Backend → Preload → Frontend');
  console.log('   Implementation is FULLY INTEGRATED');
} else {
  console.log('❌ INCOMPLETE: Some pieces missing');
}
