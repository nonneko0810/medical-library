---
title: 全カテゴリ閉じるボタン
date: 2026-05-02
status: approved
---

## 概要

タブ行の右端に「全て閉じる」ボタンを追加し、現在開いているすべての大項目（カテゴリ）を一括で閉じる機能を実装する。

## 対象ファイル

- `index.html` — ボタンのHTML要素追加
- `app.js` — `closeAllCats()` 関数追加
- `style.css` — タブ行レイアウト調整

## 設計

### HTML (`index.html`)

`<div class="tabs">` 内の末尾にボタンを追加する。

```html
<div class="tabs">
  <button class="tab on" onclick="switchTab('area',this)">領域別</button>
  ...
  <button class="ghost-btn close-all-btn" onclick="closeAllCats()">
    <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
    <span>全て閉じる</span>
  </button>
</div>
```

### JavaScript (`app.js`)

```js
function closeAllCats() {
  document.querySelectorAll('.cat-body.open').forEach(function(body) {
    body.classList.remove('open');
  });
  document.querySelectorAll('.chev.open').forEach(function(chev) {
    chev.classList.remove('open');
  });
}
```

### CSS (`style.css`)

- `.tabs` に `justify-content: space-between` を追加
- `.close-all-btn` はタブと区別するため既存の `ghost-btn` スタイルを流用し、`margin-left: auto` で右端に寄せる

## 動作仕様

- クリック時: 現在 `.open` 状態の全 `.cat-body` と `.chev` から `.open` を除去
- 全て閉じ済みの場合: 何も起こらない（副作用なし）
- タブ切り替え後にも機能する（再レンダリング後の要素にも適用）

## スコープ外

- 「全て開く」機能は含まない
- 個別カテゴリの開閉状態の永続化には影響しない
