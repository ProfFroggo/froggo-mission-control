const { FuseV1Options, FuseVersion, flipFuses } = require('@electron/fuses');
const { execSync } = require('child_process');
const path = require('path');

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.froggo.app',
  productName: 'Froggo',
  npmRebuild: true,
  directories: {
    output: 'release/prod',
  },
  files: ['dist/**/*', 'dist-electron/**/*'],
  asar: true,
  asarUnpack: [
    '**/node_modules/better-sqlite3/**',
    '**/node_modules/sqlite3/**',
  ],
  extraResources: [
    {
      from: 'public/models',
      to: 'models',
      filter: ['**/*'],
    },
  ],
  mac: {
    category: 'public.app-category.productivity',
    target: ['dmg'],
    icon: 'build/icon.icns',
    identity: '-',
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: {
      NSMicrophoneUsageDescription:
        'Froggo uses your microphone for voice commands and meeting transcription.',
      NSCameraUsageDescription:
        'Froggo uses your camera for video chat and visual context during voice conversations.',
      NSSpeechRecognitionUsageDescription:
        'Froggo uses speech recognition for voice commands.',
    },
  },
  dmg: {
    contents: [
      { x: 130, y: 220, type: 'file' },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
    window: { width: 540, height: 380 },
  },
  extraMetadata: {
    main: 'dist-electron/main.js',
  },
  afterPack: async (context) => {
    const electronBinaryPath = path.join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.app`
    );

    await flipFuses(electronBinaryPath, {
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    });
    console.log('[afterPack] Electron Fuses flipped for production');

    // Re-sign with ad-hoc signature after fuse modification to prevent
    // SIGKILL (Code Signature Invalid) on launch
    execSync(`codesign --force --deep --sign - "${electronBinaryPath}"`, { stdio: 'inherit' });
    console.log('[afterPack] Ad-hoc re-signed after fuse flip');
  },
};
