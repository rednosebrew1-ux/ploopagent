# ploop for Mac

The ploop desktop app: ploop's chat (`examples/next-agent`) in its own window, plus a **vault** for the usernames and passwords of your website accounts. ploop can sign in to a site for you after you approve it, without ever seeing the password.

## Install

1. Open the [latest release](https://github.com/rednosebrew1-ux/ploopagent/releases/latest) and download the `.dmg` for your Mac: `arm64` for Apple Silicon (M1 and later), `x64` for Intel.
2. Drag **ploop** into Applications and open it.
3. These builds aren't signed with an Apple Developer ID yet, so macOS will refuse the first launch. Right-click ploop, choose **Open**, then **Open** again. If macOS says the app is damaged, run `xattr -cr /Applications/ploop.app` once.
4. On first launch ploop opens the **Keys** section. Paste your OpenRouter API key (required). Tavily and Resend keys are optional.

Updates: ploop checks GitHub Releases at startup (and under **ploop > Check for Updates**). An unsigned build tells you a new version exists and opens the download page. A build signed with a Developer ID (see below) downloads and installs the update itself, after you agree.

## What the vault does

Add a login on the **Vault** page: the sign-in page address, username, password, and whether ploop may use it. Then ask ploop to do something that needs the account. The chat shows a card, "Sign in to github.com as you", and nothing happens until you click **Sign in**.

ploop has three vault tools:

| Tool           | What it does                                                                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listLogins`   | Shows the logins you allowed it to use: site and username only.                                                                                                                                                      |
| `loginToSite`  | Opens a ploop browser window for that site, fills the saved password itself, and reports whether it worked. Needs your approval each time. If the site asks for a code or captcha, the window comes forward for you. |
| `readSitePage` | Reads the text of a page on the same site, as the signed-in user. Only works after a sign-in, and only on that site.                                                                                                 |

Each login gets its own browser window with its own cookies, which survive restarts, so a site stays signed in and two accounts never mix.

## How passwords are protected

- **At rest.** The vault and your keys are each one file, encrypted as a whole with Electron's `safeStorage`, whose key lives in the macOS Keychain. Nothing readable (not even site names) is on disk. The files are owner-only. A file the app can't decrypt is never overwritten.
- **From the agent.** The agent runs in a separate local server process. Its only way to the vault is a private Unix socket in a 0700 folder, guarded by a random token that changes every launch. The socket offers three requests: list logins (no passwords), sign in, read a page. No request returns a password.
- **From the model.** Passwords never enter the chat, the prompt or the logs. The sign-in script returns only which stage of the form it found.
- **From lookalike sites.** ploop fills a form only while the page is on the saved address's exact origin, and only over `https` (or `http` on localhost, for testing). `readSitePage` refuses addresses on other sites. If a site redirects somewhere else, ploop stops.
- **From the page.** Only the chat window's own page can call the vault, and only from its top frame. Showing or copying a password asks for Touch ID (or a confirmation on Macs without it) in the app's main process, which a web page can't answer. A copied password clears from the clipboard after 30 seconds.
- **Approvals.** `loginToSite` needs your click in the chat. The app gives the server a random approval secret, so a page can't forge that click.

Not covered: another program running as you on your Mac, or malware that can read the Keychain. The vault is as safe as your user account. Memory and plans (not passwords) are stored as plain JSON in `~/Library/Application Support/ploop/data`.

## Develop

From the repository root:

```bash
pnpm install
pnpm --filter "@example/next-agent^..." build   # builds the workspace packages
cd examples/ploop-desktop
pnpm dev        # bundles the app, downloads Electron if needed, runs it
pnpm test       # vault, sign-in, bridge and resolver tests
pnpm type-check
```

`pnpm dev` starts `next dev` from `examples/next-agent` for you. Run it on a Mac: the vault needs the macOS Keychain, and the app refuses to start without it.

To build the installers yourself:

```bash
pnpm dist       # bundles the app, builds + tests ploop's server, runs electron-builder
```

`scripts/prepare-next.mjs` builds `examples/next-agent` as a Next.js standalone server, copies it into `build-next/`, starts that copy and fetches a page from it, so a broken package fails here and not on your Mac.

## Releasing

Bump `version` in `package.json`, then push a tag with the same number:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The **ploop desktop** workflow tests, builds both Mac architectures and attaches the `.dmg` and `.zip` files and `latest-mac.yml` to a GitHub release. Pull requests run the same build without publishing.

To sign and notarize (needed for self-updating and for a normal first launch), add these repository secrets: `MAC_CERT_P12_BASE64` and `MAC_CERT_PASSWORD` (a Developer ID Application certificate), and `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (notarization). Without them the workflow signs ad hoc.

## Layout

| Path                           | What it is                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `src/main.ts`                  | App startup, window, menu, IPC, the chat server's lifecycle.                        |
| `src/vault.ts`                 | The encrypted login store. `encrypted-file.ts` is the encryption layer.             |
| `src/sign-in.ts`               | Fills a sign-in form and reports the result. `fill-script.ts` runs inside the page. |
| `src/login-service.ts`         | The only code that touches saved passwords. `resolve.ts` picks the right login.     |
| `src/bridge.ts`                | The private socket the agent's server uses.                                         |
| `src/site-windows.ts`          | One browser window and cookie jar per login.                                        |
| `src/settings.ts`              | Encrypted API keys, passed to the server as environment variables.                  |
| `src/preload.ts`, `src/api.ts` | `window.ploop`, the API the Vault page uses.                                        |
