# Claude Code 指示書: medical-library を GitHub Pages + Firebase Realtime Database 化する

## 目的

既存の GitHub Pages サイト `medical-library` を、**Firebase Realtime Database を使ってページ上から直接追加・編集・削除できる構成**へ移行したいです。

私は**フロントはシンプルな HTML / CSS / JavaScript のまま維持**したいです。  
フレームワークは使わず、**既存UIの雰囲気をできるだけ保ちながら**、データだけ外部化してください。

---

## 対象

- GitHub repository: `nonneko0810/medical-library`
- 公開URL: `https://nonneko0810.github.io/medical-library/`

---

## 現在の状況

- `index.html` 1ファイル構成
- ライブラリデータ（カテゴリ、アイテム、リンク一覧）は `index.html` 内の JavaScript 配列に直書き
- GitHub Pages で静的サイトとして公開中
- 現状は、1件追加するだけでも HTML を編集して push する必要がある

---

## 実現したいこと

### 必須
1. ページ上のUIからリンク項目を追加できる
2. ページ上のUIからリンク項目を編集できる
3. ページ上のUIからリンク項目を削除できる
4. データは Firebase Realtime Database に保存する
5. 更新内容は複数デバイスから見ても反映される
6. GitHub Pages は継続利用する
7. フロントエンドは HTML / CSS / JavaScript のみ
8. フレームワークは使わない
9. 既存UIの雰囲気はなるべく維持する
10. 管理者のみ編集可能にする
11. 一般閲覧者には編集UIを表示しない
12. Firebase Security Rules を本番向けに設定する
13. README にセットアップ手順を書く
14. 既存データを Firebase に移行できるようにする

### できればほしい
- 検索機能
- カテゴリごとの見やすい整理
- スマホでも最低限見やすい表示
- 並び順の制御
- カテゴリ追加/編集のしやすさ

---

## 絶対に避けてほしいこと

- React / Vue / Next.js などへの全面リプレイス
- GitHub Pages をやめる提案
- Firebase のテストモードを本番運用すること
- 既存UIを無視した全面デザイン変更
- 秘密情報をリポジトリにハードコードすること

---

## 技術方針

### 採用したい構成
- ホスティング: GitHub Pages
- フロント: HTML / CSS / JavaScript
- データ保存: Firebase Realtime Database
- 認証: Firebase Authentication
- 編集権限: 管理者のみ

### 期待する役割分担
- GitHub Pages: 静的フロント配信
- Firebase Realtime Database: ライブラリデータ保存
- Firebase Authentication: 管理者ログイン制御

---

## 期待する作業順序

**いきなり全面改修せず、以下の順序で進めてください。**

### Step 1. 現状分析
- 既存 `index.html` の構造を読む
- 現在のデータ構造を整理する
- UI とデータロジックの分離ポイントを特定する

### Step 2. 設計提案
まず、以下を文章で提案してください。

1. Firebase Realtime Database のデータ構造案
2. 認証方式
3. 編集UIの出し分け方法
4. 既存コードのどこをどう分割・修正するか
5. ファイル構成の変更案
6. データ移行方法
7. セキュリティルール案

### Step 3. 実装
設計提案の後に実装してください。

### Step 4. ドキュメント整備
README とセットアップ手順を整理してください。

---

## 期待するファイル構成（例）

既存の1ファイル構成を壊しすぎず、必要ならこの程度まで分けてください。

- `index.html`
- `style.css`
- `app.js`
- `firebase-config.example.js` またはそれに準ずる設定例
- `migrate-data.js` または初期投入用スクリプト
- `README.md`

※ 必ずしもこの構成に固定ではないですが、**保守しやすい最小限の分離**を希望します。

---

## 希望するデータ項目

最低限、以下を持てるようにしたいです。

- `id`
- `title`
- `url`
- `category`
- `note`
- `sortOrder`
- `createdAt`
- `updatedAt`

必要なら追加可:
- `tags`
- `favorite`
- `archived`

---

## Firebase Realtime Database のデータ構造イメージ

実装しやすければ別案でもよいですが、例えば以下のような構造を想定しています。

```json
{
  "categories": {
    "cat_001": {
      "name": "消化管",
      "sortOrder": 1
    }
  },
  "items": {
    "item_001": {
      "title": "胃炎",
      "url": "https://example.com",
      "category": "cat_001",
      "note": "基本事項",
      "sortOrder": 1,
      "createdAt": 1710000000000,
      "updatedAt": 1710000000000
    }
  }
}
```

もしより適切な構造があれば改善提案してください。

---

## 認証・権限の要件

### やりたいこと
- 一般閲覧者: 読み取りのみ
- 管理者: ログイン後に追加・編集・削除可能

### 実装方針
- Firebase Authentication を利用
- 管理者だけ編集可能
- 編集UIは管理者ログイン時のみ表示
- 未ログイン状態では閲覧専用

### セキュリティ
- Realtime Database Rules を必ず本番向けに設定
- テストモードのままにしない
- 「APIキーを隠す」よりも、Rules と Auth を正しく設計することを優先

---

## UI要件

### 基本方針
- できるだけ現状の見た目を維持
- 1ページで完結
- 見た目はシンプル
- 医学リンクライブラリとして使いやすいことを優先

### ほしいUI
- カテゴリごとの表示
- 項目追加フォーム
- 項目編集フォーム
- 項目削除ボタン
- ログイン時だけ編集操作を表示
- 可能なら検索欄

### 避けたいUI
- 不必要に派手なデザイン
- モーダル乱用
- SPA風の複雑なUI
- 学習コストの高い操作

---

## 実装上の注意

1. **既存コードを極力活かす**
2. **全面書き換えではなく段階的移行を意識する**
3. **GitHub Pages でそのまま動くこと**
4. **ローカルでも最低限動作確認しやすいこと**
5. **今後自分で手直ししやすいシンプルなコードにすること**
6. **コメントを適度に入れて可読性を確保すること**
7. **Firebase 設定値の差し替え箇所を明確にすること**

---

## README に必ず書いてほしい内容

1. プロジェクト概要
2. 現在の構成
3. Firebase プロジェクト作成手順
4. Realtime Database 有効化手順
5. Authentication 有効化手順
6. 必要な Firebase 設定値
7. 設定ファイルの作り方
8. Realtime Database Rules
9. 管理者アカウントの作成方法
10. 既存データの移行方法
11. GitHub Pages への反映方法
12. 今後の保守ポイント

---

## 欲しい成果物

最終的に以下を揃えてください。

- 動作するコード一式
- Firebase Realtime Database 用のデータ設計
- Firebase Authentication を使った管理者制御
- CRUD UI
- データ移行用スクリプト
- 本番向け Security Rules
- README
- 変更内容の要約

---

## 作業の進め方に関する希望

- 最初に**設計提案と変更方針**を出してください
- その後に実装へ進んでください
- 不明点があれば、推測で大きく書き換えず、まず仮定を明示してください
- ただし、軽微な判断は自律的に進めて構いません
- 変更差分が多い場合は、どこをどう変えたかを最後に整理してください

---

## こちらが後で渡せるもの

必要であれば、以下を追加で渡します。

- 現在の `index.html`
- 現在の画面スクリーンショット
- 現在のデータ例
- 絶対に変えたくないUIポイント
- Firebase プロジェクト作成後の config 値

---

## 最後に

今回は「見た目を大きく変えること」よりも、**今のサイトを保ったまま、データ管理だけをFirebase化して編集しやすくすること**が最重要です。

その方針で、**保守しやすい最小限の構成変更**を優先して進めてください。
