# 医学知識ライブラリ

病理・医学知識の学習リンクをカテゴリ別に管理し、SM-2アルゴリズムで復習スケジュールを管理するライブラリサイト。

## 現在の構成

```
medical-library/
├── index.html                  # HTML（構造のみ）
├── style.css                   # スタイルシート
├── app.js                      # アプリケーションロジック
├── firebase-config.js          # ★ 設定ファイル（.gitignore対象・要作成）
├── firebase-config.example.js  # 設定ファイルのテンプレート
├── migrate-data.js             # 既存データの初期投入スクリプト
└── README.md
```

- **ホスティング**: GitHub Pages
- **データ保存**: Firebase Realtime Database
- **認証**: Firebase Authentication（Email/Password）
- **学習進捗（SM-2）**: localStorage（デバイス個別）

---

## セットアップ手順

### 1. Firebase プロジェクト作成

1. [Firebase Console](https://console.firebase.google.com/) を開く
2. 「プロジェクトを追加」
3. プロジェクト名を入力（例: `medical-library`）
4. Google アナリティクスは任意（不要なら OFF）
5. 「プロジェクトを作成」

### 2. Realtime Database 有効化

1. 左メニュー「構築」→「Realtime Database」
2. 「データベースを作成」
3. ロケーションを選択（asia-southeast1 推奨）
4. **「ロックモードで開始」を選択**（テストモードは選ばないこと）
5. 「有効にする」

### 3. Authentication 有効化

1. 左メニュー「構築」→「Authentication」
2. 「始める」
3. 「Sign-in method」タブ → 「メール/パスワード」→ 有効にして保存

### 4. 必要な Firebase 設定値の取得

1. プロジェクトの歯車アイコン → 「プロジェクトの設定」
2. 「マイアプリ」セクション → 「ウェブアプリを追加」（`</>`アイコン）
3. アプリのニックネームを入力（例: `medical-library-web`）
4. 「Firebase Hosting のセットアップも行います」は **チェックしない**
5. 「アプリを登録」
6. 表示される `firebaseConfig` の値をコピー

### 5. 設定ファイルの作成

`firebase-config.example.js` をコピーして `firebase-config.js` を作成し、取得した値を入力：

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "your-project.firebaseapp.com",
  databaseURL:       "https://your-project-default-rtdb.firebaseio.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc..."
};
```

> ⚠️ `firebase-config.js` は `.gitignore` に含まれており、リポジトリにはコミットされません。

### 6. Realtime Database Security Rules の設定

Firebase Console → Realtime Database → 「ルール」タブに以下を貼り付けて「公開」：

```json
{
  "rules": {
    "sections": {
      ".read": true,
      ".write": "auth != null && root.child('admins').child(auth.uid).val() === true"
    },
    "items": {
      ".read": true,
      ".write": "auth != null && root.child('admins').child(auth.uid).val() === true"
    },
    "admins": {
      ".read": "auth != null",
      ".write": false
    }
  }
}
```

### 7. 管理者アカウントの作成

**ステップ A: Firebase Auth でアカウント作成**

1. Firebase Console → Authentication → 「ユーザー」タブ
2. 「ユーザーを追加」
3. メールアドレスとパスワードを設定
4. 作成後に表示される「UID」をコピー

**ステップ B: admins に UID を登録**

1. Firebase Console → Realtime Database → 「データ」タブ
2. 「+」ボタンで追加：
   - キー: `admins`
   - その下に: キー = コピーした UID、値 = `true`

```
admins
  └── AbCdEfGhIjKlMnOpQrSt  : true
```

### 8. 既存データの移行（初回のみ）

```bash
# Node.js がインストールされていること
npm install firebase-admin

# Firebase Console → プロジェクト設定 → サービスアカウント
# → 「新しい秘密鍵を生成」→ serviceAccountKey.json としてこのディレクトリに保存

node migrate-data.js
```

> ⚠️ `serviceAccountKey.json` は絶対にコミットしないこと（`.gitignore` に追加済み）

### 9. GitHub Pages への反映

```bash
git add index.html style.css app.js firebase-config.example.js migrate-data.js README.md .gitignore
git commit -m "Firebase対応"
git push origin main
```

GitHub リポジトリの Settings → Pages → Source を `main` ブランチに設定。

---

## 使い方

### 閲覧（一般）
- ページを開くだけで全アイテムを閲覧可能
- 学習記録（SM-2）はブラウザの localStorage に保存される

### 編集（管理者）
1. 右上「ログイン」ボタンからメールアドレスとパスワードでログイン
2. 「編集モード」ボタンが表示されるのでクリック
3. 各カテゴリに「項目を追加」ボタン、各アイテムに「削除」「URLを変更」ボタンが表示される
4. 変更はリアルタイムで Firebase に保存され、他のデバイスにも即反映される

---

## データ構造（Firebase Realtime Database）

```json
{
  "sections": {
    "mouth": {
      "name": "口腔",
      "tab": "area",
      "color": "--a1",
      "ci": "ci1",
      "icon": "...",
      "sortOrder": 1
    }
  },
  "items": {
    "fibroma-tongue": {
      "name": "線維腫（舌）",
      "url": "https://...",
      "linkName": "舌線維腫の病理鑑別ガイド",
      "sectionId": "mouth",
      "sortOrder": 1,
      "createdAt": 1710000000000,
      "updatedAt": 1710000000000
    }
  },
  "admins": {
    "<uid>": true
  }
}
```

**タブ構造**（コード内固定）: `area`（領域別）/ `cross`（横断テーマ）/ `exam`（検査）

---

## 今後の保守ポイント

- **アイテム追加**: 管理者ログイン → 編集モード → 各カテゴリの「項目を追加」
- **カテゴリ追加**: 管理者ログイン → 編集モード → ページ下部の「カテゴリを追加」
- **管理者追加**: Firebase Console で Authentication にユーザー追加 → UID を `admins/` に登録
- **Firebase config 変更**: `firebase-config.js` を更新（コミット不要）
- **Security Rules 変更**: Firebase Console → Realtime Database → ルール
- **SM-2 学習データ**: localStorage に保存。ブラウザのストレージをクリアすると消えるため、「エクスポート」機能でバックアップ可能
