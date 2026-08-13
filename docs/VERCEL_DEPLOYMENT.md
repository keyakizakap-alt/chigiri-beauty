# Vercelへのデプロイ

CHIGIRI BeautyはVercelのNext.jsランタイムへ直接デプロイできます。Cloudflare固有のbindingは実行時に使用しません。

## 1. GitHubからプロジェクトを作る

1. Vercel Dashboardの **Add New → Project** を開きます。
2. `keyakizakap-alt/chigiri-beauty` をImportします。
3. Framework Presetは **Next.js**、Root Directoryは `.` のままにします。
4. Build Commandは `npm run build`、Install Commandは `npm ci` です。`vercel.json`にも同じ値を固定しています。

## 2. 保存先を接続する

画面とAPIの形は変えず、Vercelで動く保存先へ接続します。

### Turso

Vercel MarketplaceからTursoを対象プロジェクトへ接続します。次の2変数がProduction・Preview・Developmentへ設定されていることを確認してください。

```text
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
```

初回アクセス時にアプリが必要なテーブルを冪等に作成します。

### Vercel Blob

Vercel StorageからBlobストアを作成し、アクセスを **Private** として対象プロジェクトへ接続します。`@vercel/blob`はVercel上では接続済みストアとOIDCを利用できます。トークン方式を使う場合は次をSecret登録します。

```text
BLOB_READ_WRITE_TOKEN
```

利用者画像は必ずアプリの所有者確認APIを通して返し、BlobのURLを直接公開しません。

## 3. アプリ用の環境変数

Vercelの **Project Settings → Environment Variables** で登録します。

```text
ORCAROUTER_API_KEY       # Secret・本番AI会話に必須
ORCAROUTER_MODEL         # 例: orcarouter/auto
RAKUTEN_APPLICATION_ID  # 任意
RAKUTEN_ACCESS_KEY      # 任意
AUTH_SECRET              # Secret・Auth.jsのセッション暗号化に必須
AUTH_GOOGLE_ID           # Google OAuthクライアントID
AUTH_GOOGLE_SECRET       # Google OAuthクライアントSecret
```

キーを`NEXT_PUBLIC_`変数、GitHub、`vercel.json`へ書かないでください。PreviewとProductionで別のTurso DB・Blobストアを使うと、本番相談ログへの影響を避けられます。

Google Cloud Consoleでは、Vercelの本番URLに合わせて次のURIをOAuth 2.0クライアントの「承認済みのリダイレクトURI」へ追加します。

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

`AUTH_SECRET`はローカルで`npm exec auth secret`を実行して生成し、出力された値だけをVercelのSecretへ登録します。

## 4. ローカル確認

Vercel CLIでプロジェクトをリンクし、環境変数を取得します。

```bash
vercel link
vercel env pull .env.local --yes
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

`.env.local`はGit管理対象外です。

## 5. 公開とロールバック

Git連携ではPRブランチのpushでPreview、`main`へのmergeでProductionが自動デプロイされます。Previewでログ保存・画像送信・OrcaRouter応答を確認してからmergeしてください。問題がある場合はVercelのDeploymentsから直前の正常なデプロイをPromoteして戻せます。

## 確認項目

- トップ画面と5エージェントが表示される
- `/login`でGoogleログインが開始でき、ログイン後にトップへ戻る
- OrcaRouterの応答が返る
- 全担当の相談履歴がサイドバーに表示され、再読み込み後も残る
- 画像を送信でき、別の所有者からは取得できない
- コンディションの保存と削除ができる
- `ORCAROUTER_API_KEY`などのSecretがブラウザへ露出していない
