/**
 * Module registration entry point.
 *
 * Import this file in App.tsx (after CoreViews) to register all modules.
 * Each module's index.ts self-registers with the ModuleLoader on import.
 *
 * To add a new module:
 * 1. Create src/modules/<name>/
 * 2. Add module.json and index.ts
 * 3. Add import below
 */

// Finance module (proof-of-concept)
import './finance';

// Future modules:
// import './writing';
// import './twitter';
// import './comms';
