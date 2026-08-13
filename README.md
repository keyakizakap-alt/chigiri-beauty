# CHIGIRI Beauty

5人の美容コンシェルジュが、スキンケア・ヘア／頭皮・ボディ・メイク・ネイル／ハンドの相談を担当するAI美容アプリです。手持ち品を優先し、会話履歴と任意のコンディション記録を踏まえて提案します。

> Theme: 本番で通用する次世代のAI Product

商品詳細では、公式情報をもとにした注目成分の役割、合わない可能性を切り分ける観察点、手持ちとの違い、変化を見る時期、楽天市場と@cosmeの確認導線を表示します。口コミ本文は転載しません。

Next.js App RouterをVercelへ直接デプロイできる構成です。相談ログはTurso、
利用者が送信した非公開画像はVercel Blobへ保存します。

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
| `TURSO_DATABASE_URL` | 相談履歴・コンディション・画像台帳の保存先 | 必須。Vercel MarketplaceのTurso連携で設定 |
| `TURSO_AUTH_TOKEN` | Tursoへの接続トークン | 必須。Vercel MarketplaceのTurso連携で設定 |
| `BLOB_READ_WRITE_TOKEN` | 非公開画像を保存するVercel Blobトークン | 必須。Blobストア接続時に設定。Vercel上ではOIDC利用も可 |
| `AUTH_SECRET` | ログインセッションの暗号化 | Googleログインに必須。`npm exec auth secret`で生成 |
| `AUTH_GOOGLE_ID` | Google OAuthクライアントID | Googleログインに必須 |
| `AUTH_GOOGLE_SECRET` | Google OAuthクライアントSecret | Googleログインに必須 |

秘密値はVercelのEnvironment Variablesで管理し、リポジトリやログへ保存しません。楽天の認証情報がない場合も、楽天市場・@cosmeの検索導線は利用できます。

ローカルでは`.env.example`を`.env.local`へコピーし、必要な値だけ設定してください。実値を含む`.env*`はGit管理対象外です。

## Architecture

- 会話オーケストレーション: ルールベースの安全判定＋構造化会話メモリ
- 自然言語生成: OrcaRouter（未設定・障害時は安全なローカル応答へフォールバック）
- 永続化: Turso（相談履歴・手持ち品・コンディション）
- 画像: Vercel Blobのprivateストア。LLMへ渡す画像は現在の所有者がアップロードしたものに限定
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

## Vercel deployment

GitHubリポジトリをVercelへImportし、Framework Presetを`Next.js`、Root Directoryを`.`に設定してください。その後、MarketplaceでTursoを接続し、StorageからprivateのVercel Blobストアを接続します。Google OAuthとOrcaRouter等のキーはEnvironment Variablesへ追加して再デプロイします。

詳細な初回設定と確認手順は[`docs/VERCEL_DEPLOYMENT.md`](docs/VERCEL_DEPLOYMENT.md)を参照してください。

## Optional Sites lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout and then validates the Sites artifact. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `auth.ts` and `app/login/` provide optional Google account sign-in through Auth.js
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Google account sign-in

`/login`からGoogleアカウントでログインできます。Auth.jsの暗号化JWTセッションを使い、Googleのアクセストークンは商品提案や相談APIへ渡しません。ログイン済みのメールアドレスはサーバー上でハッシュ化し、相談履歴の所有者キーとして利用します。

Google Cloud ConsoleのOAuthクライアントには本番ドメインと、次の承認済みリダイレクトURIを登録してください。

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

未ログインでも相談でき、履歴は端末内へ保存されます。ログイン後はゲスト所有の履歴を同じブラウザ上でアカウントへ移行します。

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Next.js development server
- `npm run build`: create the Vercel-compatible Next.js production build
- `npm run start`: start the built Next.js application
- `npm test`: run the behavior and deployment configuration tests
- `npm run dev:sites`: start the optional Vite/Vinext development server
- `npm run build:sites`: build and validate the optional Sites artifact
- `npm run start:sites`: start the optional Vinext build
- `npm run validate:artifact`: recheck an existing artifact's manifest and ESM `default.fetch` export
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build and validation commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
