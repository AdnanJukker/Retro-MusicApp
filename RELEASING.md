# Publishing an Android GitHub release

Release APKs use the `release` profile in `eas.json`. It inherits automatic
Android build-number increments from `production`, uses the production EAS
environment, and produces an installable APK. EAS manages the signing key for
`com.adnanjukker.MusicApp`; keep using that key so users can install updates.

## 1. Prepare a version

- Set the same version in `app.json` (`expo.version`) and `package.json`.
  `npm version 1.0.1 --no-git-tag-version` updates the package and lockfile;
  update `app.json` separately.
- Write the release notes in `releases/v1.0.1.md`, including the matching APK filename.
- Run `npm run typecheck`, `npm run lint`, and `npm test`.
- Run `server/.venv/Scripts/python.exe -m unittest discover -s server -v`
  when the Python environment is installed.
- Verify the deployed backend with
  `npm run test:playback -- https://retro-musicapp.onrender.com`.
- Commit and push the release source. Build from a clean working tree.

The commands below use `v1.0.1` as an example; replace it consistently.

## 2. Build the APK

Sign in to the Expo account that owns the project if needed:

```sh
npx eas-cli@24.3.0 login
npx eas-cli@24.3.0 build --platform android --profile release
```

After the build succeeds, confirm its app version and Git commit match the
release source. Download its APK from the EAS build page into `.release/`
and name it `Hi-Fi-Archive-v1.0.1-android.apk`.

Install the APK on a device and check launch, search, playback, seeking, and
saved preferences before publishing. Local automated checks do not replace
this device check.

Create a checksum in PowerShell:

```powershell
$apk = 'Hi-Fi-Archive-v1.0.1-android.apk'
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath ".release/$apk").Hash.ToLowerInvariant()
Set-Content -Encoding ascii -LiteralPath '.release/SHA256SUMS.txt' -Value "$hash  $apk"
```

## 3. Tag and publish

Use [GitHub CLI](https://cli.github.com/) with a signed-in account that has
write access to this repository. Tag the exact commit shown on the successful
EAS build, even if the branch has advanced since the build started.

```sh
git tag -a v1.0.1 BUILD_COMMIT_SHA -m "Hi-Fi Archive v1.0.1"
git push origin refs/tags/v1.0.1
gh release create v1.0.1 .release/Hi-Fi-Archive-v1.0.1-android.apk .release/SHA256SUMS.txt --repo AdnanJukker/Retro-MusicApp --verify-tag --draft --title "Hi-Fi Archive v1.0.1" --notes-file releases/v1.0.1.md
```

Review the draft and its two uploaded assets, then publish it:

```sh
gh release edit v1.0.1 --repo AdnanJukker/Retro-MusicApp --draft=false --latest
```

Open the release, check the APK download, and compare its SHA-256 checksum.
Future updates should use a new version and tag; do not move an existing
release tag to different source code.

Build outputs stay in the ignored `.release/` directory. APKs, signing keys,
and access tokens do not belong in source control.

References: [Expo APK builds](https://docs.expo.dev/build-reference/apk/),
[Expo version management](https://docs.expo.dev/build-reference/app-versions/),
and [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).
