# CHIGIRI Beauty

5人の美容コンシェルジュが、スキンケア・ヘア／頭皮・ボディ・メイク・ネイル／ハンドの相談を担当するAI美容アプリです。手持ち品を優先し、会話履歴と任意のコンディション記録を踏まえて提案します。

> Theme: 本番で通用する次世代のAI Product

商品詳細では、公式情報をもとにした注目成分の役割、合わない可能性を切り分ける観察点、手持ちとの違い、変化を見る時期、楽天市場と@cosmeの確認導線を表示します。口コミ本文は転載しません。

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `24.14.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Runtime configuration

| Key | Purpose | Required |
| --- | --- | --- |
| `ORCAROUTER_API_KEY` | OrcaRouterによる会話生成 | 本番AI会話では必須。未設定時は領域別の安全なローカル応答へフォールバック |
| `ORCAROUTER_MODEL` | OrcaRouterのモデル指定 | 任意。既定値は `orcarouter/auto` |
| `RAKUTEN_APPLICATION_ID` | 楽天市場の商品評価取得 | 評価点・件数の自動表示に必要 |
| `RAKUTEN_ACCESS_KEY` | 楽天市場APIのアクセスキー | 評価点・件数の自動表示に必要 |

秘密値はデプロイ先の本番環境変数で管理し、リポジトリやログへ保存しません。楽天の認証情報がない場合も、楽天市場・@cosmeの検索導線は利用できます。

`ORCAROUTER_API_KEY` はSitesでは対象プロジェクトの本番Secret、Cloudflare Workersでは対象Workerの **Settings → Variables & Secrets** に登録します。Cloudflare Pagesの設定やソースコードへ直接書き込まないでください。登録後はデプロイ先で再デプロイします。

ローカルでは`.env.example`を`.env.local`へコピーし、必要な値だけ設定してください。実値を含む`.env*`はGit管理対象外です。

## Architecture

- 会話オーケストレーション: ルールベースの安全判定＋構造化会話メモリ
- 自然言語生成: OrcaRouter（未設定・障害時は安全なローカル応答へフォールバック）
- 永続化: Cloudflare D1（相談履歴・手持ち品・コンディション）
- 画像: Cloudflare R2。LLMへ渡す画像は現在の所有者がアップロードしたものに限定
- 商品根拠: リポジトリ内の公式確認済み商品データ。候補外の商品情報を生成しない

詳しい設計と審査基準への対応は[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)と[`docs/JUDGING.md`](docs/JUDGING.md)を参照してください。

## Quality gates

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm audit --omit=dev --audit-level=high
```

Pull Requestでは同じ検証をGitHub Actionsで実行します。

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout and then validates the Sites artifact. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `server/account-auth.ts` verifies Google Identity Services credentials and signs private app sessions
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Google account sign-in

The application remains usable without an account. Google sign-in links an
anonymous device history to a verified email address so that consultations can
be opened from another device.

Configure these hosted environment variables:

- `GOOGLE_CLIENT_ID`: OAuth 2.0 Web client ID from Google Cloud Console
- `AUTH_SECRET`: random session-signing secret of at least 32 characters

Add the production origin to **Authorized JavaScript origins** and
`https://<production-host>/api/auth/google/callback` to **Authorized redirect
URIs** in the Google OAuth client. The callback verifies Google's RS256
signature, issuer, audience, expiry, CSRF token, and verified-email claim. The
application stores neither the Google password nor Google access tokens.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build and validate the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build, validate, and verify the rendered development-preview metadata
- `npm run validate:artifact`: recheck an existing artifact's manifest and ESM `default.fetch` export
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Cloudflare Workers / OpenNext

OpenNext用の`wrangler.jsonc`と`open-next.config.ts`を同梱しています。既存のSitesビルドを維持したまま、`npm run cf:build`、`npm run cf:preview`、`npm run cf:deploy`を利用できます。D1・R2の作成、Secret登録、GitHub連携の具体的な手順は[`docs/CLOUDFLARE_WORKERS.md`](docs/CLOUDFLARE_WORKERS.md)を参照してください。

Use build and validation commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
