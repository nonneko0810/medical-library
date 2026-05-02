# Claude Code に渡す前のチェックリスト

## できれば先に用意するもの
- 現在の `index.html`
- 現在の画面スクリーンショット
- 現在のデータ例（数件で可）
- 「変えてほしくない点」のメモ
- Firebase プロジェクト作成後の config 値

## Claude Code に最初に伝える短文
以下をそのまま使えます。

```text
このフォルダ（またはこのリポジトリ）に対して、`/mnt/data/claude_code_medical_library_instructions.md` の指示書に従って作業してください。
まずはコードを読んだうえで、実装前に「設計提案と変更方針」を先に示してください。
```

## 補足
- Firebase 側の最終設定は自分で行う場面が残る可能性があります
- テストモードのまま運用しないこと
- GitHub Pages 継続・HTML/CSS/JS 維持を優先すること
