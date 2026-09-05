## 実装方針の正本

このリポジトリの設計判断は、スキル **`ai-product-playbook`** に集約してある。
複製せず参照する（複製すると更新時に内容がずれるため）。

- 正本: [keyakizakap-alt/dxworkrepository](https://github.com/keyakizakap-alt/dxworkrepository) の `.claude/skills/ai-product-playbook/`
- 全プロジェクトで自動ロードさせる手順: 同リポジトリの `README.md`

設計を変える前に必ず読むこと。

## このリポジトリで壊してはいけないもの

- **会話オーケストレーションはルールベースの安全判定＋構造化会話メモリ**。
  自然文生成だけを OrcaRouter に任せ、未設定・障害時は領域別の安全なローカル応答へ落とす。
- **LLM へ渡す画像は、現在の所有者がアップロードしたものに限定**する。
- **商品根拠はリポジトリ内の公式確認済みデータのみ。** 候補外の商品情報を生成しない。
  口コミ本文は転載せず、確認導線（楽天市場・@cosme）だけを出す。
- ログイン時はメールアドレスの SHA-256 を所有者キーにする。**メールアドレス自体を DB へ保存しない。**
- 秘密値は Vercel の Environment Variables。`NEXT_PUBLIC_` を付けない。
