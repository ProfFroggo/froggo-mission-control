# CI/CD Setup - Automated Dashboard Builds

## Overview
Automatic Electron app builds are now configured via GitHub Actions. Every push to the `main` branch triggers a macOS build automatically.

## Workflow File
**Location:** `.github/workflows/build-electron.yml`

## How It Works

### Trigger
- **Automatic:** Every `git push` to `main` branch
- **Manual:** Via GitHub Actions UI (workflow_dispatch)

### Build Process
1. Checks out latest code
2. Sets up Node.js 18 environment
3. Installs dependencies (`npm ci`)
4. Runs Electron build (`npm run electron:build`)
5. Uploads `Froggo.app` as artifact
6. Creates release info with timestamp, commit hash, version

### Build Output
**Artifact Name:** `froggo-macos-arm64`  
**Contents:** `Froggo.app` (macOS arm64 application bundle)  
**Retention:** 30 days

## Accessing Builds

### Via GitHub Actions UI
1. Go to repository on GitHub
2. Click "Actions" tab
3. Click on the latest workflow run
4. Scroll to "Artifacts" section
5. Download `froggo-macos-arm64.zip`
6. Extract and run `Froggo.app`

### Via GitHub CLI
```bash
# List recent builds
gh run list --workflow build-electron.yml

# Download latest artifact
gh run download --name froggo-macos-arm64

# Or download specific run
gh run download <run-id> --name froggo-macos-arm64
```

## Build Status

### Check Status
```bash
# Via GitHub CLI
gh run list --workflow build-electron.yml --limit 5

# Via web
# Visit: https://github.com/YOUR-ORG/clawd-dashboard/actions
```

### Build Notifications
- ✅ Success: Artifacts uploaded successfully
- ❌ Failure: Check logs in GitHub Actions UI
- Build status shown in workflow summary

## Local Development

### Build Locally (Same as CI)
```bash
cd ~/clawd/clawd-dashboard
npm ci
npm run electron:build
```

Build output: `release/mac-arm64/Froggo.app`

### Quick Development Build
```bash
npm run electron:dev
```

## Deployment Workflow

### For Developers
1. Make changes to dashboard code
2. Commit and push to feature branch
3. Create pull request to `main`
4. After PR merge, build triggers automatically
5. Download artifact from GitHub Actions
6. Test the build
7. Deploy to production if validated

### For Production Deployment
```bash
# Option 1: Download from GitHub Actions
gh run download --name froggo-macos-arm64
unzip froggo-macos-arm64.zip
cp -r Froggo.app ~/Applications/  # Or wherever needed

# Option 2: Build locally from main
git checkout main
git pull
npm ci
npm run electron:build
cp -r release/mac-arm64/Froggo.app ~/Applications/
```

## Troubleshooting

### Build Fails on CI
1. Check GitHub Actions logs for errors
2. Verify `package.json` scripts are correct
3. Ensure all dependencies are in `package.json` (not just dev installed)
4. Test build locally: `npm ci && npm run electron:build`

### Artifact Upload Fails
- **Cause:** Build didn't produce `release/mac-arm64/Froggo.app`
- **Fix:** Check electron-builder config in `package.json`
- **Verify:** Run build locally and check output directory

### Build Triggered Unexpectedly
- Workflow only runs on `main` branch pushes
- Check `.github/workflows/build-electron.yml` trigger config
- Use `git push --no-verify` to skip hooks (doesn't affect GitHub Actions)

### No Builds Showing Up
1. Verify workflow file is in `main` branch
2. Check workflow is enabled in GitHub Actions settings
3. Look for workflow errors in Actions tab

## Configuration

### Workflow Settings
Edit `.github/workflows/build-electron.yml` to customize:

**Change trigger branches:**
```yaml
on:
  push:
    branches: [ main, develop ]  # Add more branches
```

**Change retention:**
```yaml
retention-days: 7  # Keep artifacts for 7 days instead of 30
```

**Add notifications:**
```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
```

### Build Options
Edit `package.json` `electron:build` script:

```json
{
  "scripts": {
    "electron:build": "npm run electron:compile && vite build && electron-builder --mac --arm64"
  }
}
```

## Performance

### Build Time
- **Expected:** 3-5 minutes on GitHub Actions
- **Local:** 1-2 minutes (depending on hardware)

### Caching
- Node modules cached by GitHub Actions
- Speeds up subsequent builds by ~30-60 seconds

## Security

### Secrets
- `GITHUB_TOKEN`: Auto-provided by GitHub Actions
- No additional secrets required for basic builds
- Add `GH_TOKEN` if code signing needed

### Artifact Access
- Artifacts visible to repository collaborators
- 30-day retention (configurable)
- Not publicly accessible unless repository is public

## Future Enhancements

### Potential Additions
1. **Code Signing:** Add macOS app signing for distribution
2. **Auto-versioning:** Bump version on successful builds
3. **Release Creation:** Auto-create GitHub releases with changelogs
4. **Multi-platform:** Add Windows and Linux builds
5. **Auto-deploy:** Push builds to distribution server
6. **Notifications:** Slack/Discord notifications on build status
7. **Smoke Tests:** Run basic tests against built app

### Example: Auto-release on Tag
```yaml
on:
  push:
    tags:
      - 'v*'  # Trigger on version tags (v1.0.0, etc.)
```

## Comparison with Previous Workflow

### Before CI/CD
- ❌ Manual builds: `npm run electron:build` when remembered
- ❌ Builds out of sync with commits
- ❌ No build artifacts tracking
- ❌ Inconsistent build environment

### After CI/CD
- ✅ Automatic builds on every commit to main
- ✅ Builds always in sync with codebase
- ✅ Build artifacts stored and versioned
- ✅ Consistent build environment
- ✅ Build history and logs available
- ✅ Easy rollback to previous builds

## Support

**Issues:** Check GitHub Actions logs first  
**Questions:** See [GitHub Actions Docs](https://docs.github.com/en/actions)  
**Config:** `.github/workflows/build-electron.yml`

---

**Created:** 2026-02-11  
**Status:** Active  
**Last Updated:** 2026-02-11
