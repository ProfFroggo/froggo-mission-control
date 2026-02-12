/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.froggo.dev',
  productName: 'Froggo Dev',
  npmRebuild: false,
  directories: {
    output: 'release/dev',
  },
  files: ['dist/**/*', 'dist-electron/**/*'],
  asar: false,
  extraResources: [
    {
      from: 'public/models',
      to: 'models',
      filter: ['**/*'],
    },
  ],
  mac: {
    category: 'public.app-category.productivity',
    target: 'dir',
    icon: 'build/icon.icns',
    extendInfo: {
      NSMicrophoneUsageDescription:
        'Froggo uses your microphone for voice commands and meeting transcription.',
      NSCameraUsageDescription:
        'Froggo uses your camera for video chat and visual context during voice conversations.',
      NSSpeechRecognitionUsageDescription:
        'Froggo uses speech recognition for voice commands.',
    },
  },
  extraMetadata: {
    main: 'dist-electron/main.js',
  },
};
