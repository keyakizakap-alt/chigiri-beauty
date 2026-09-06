## 方針の正本

このリポジトリの進め方と設計判断は、2 つのスキルに集約してある。
複製せず参照する（複製すると更新時に内容がずれるため）。

- **`work-directives`** — 作業の進め方、確認を取る操作、成果物の禁則、リサーチの裏取り
- **`ai-product-playbook`** — LLM の境界、API の防御、出荷と品質ゲート

正本: [keyakizakap-alt/dxworkrepository](https://github.com/keyakizakap-alt/dxworkrepository) の
`.claude/skills/`。

**作業を始める前に `work-directives`、設計を変える前に `ai-product-playbook` を読むこと。**
スキル一覧に出てこない場合は、正本がこのセッションに無い。先に取得する。

- Claude Code on the web: `add_repo` で `keyakizakap-alt/dxworkrepository` を追加する
- ローカル: `~/.claude/skills/` へ入れておけば常時読み込まれる（手順は正本の `README.md`）

## このリポジトリで壊してはいけないもの

- **会話オーケストレーションはルールベースの安全判定＋構造化会話メモリ**。
  自然文生成だけを OrcaRouter に任せ、未設定・障害時は領域別の安全なローカル応答へ落とす。
- **LLM へ渡す画像は、現在の所有者がアップロードしたものに限定**する。
- **商品根拠はリポジトリ内の公式確認済みデータのみ。** 候補外の商品情報を生成しない。
  口コミ本文は転載せず、確認導線（楽天市場・@cosme）だけを出す。
- ログイン時はメールアドレスの SHA-256 を所有者キーにする。**メールアドレス自体を DB へ保存しない。**
- 秘密値は Vercel の Environment Variables。`NEXT_PUBLIC_` を付けない。
