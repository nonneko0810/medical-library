# 全カテゴリ閉じるボタン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タブ行の右端に「全て閉じる」ボタンを追加し、開いているすべての大項目を一括で閉じる。

**Architecture:** `.tabs` を `div.tabs-row` でラップし、タブのピル型スタイルを崩さずにボタンを右端へ配置する。JS は `closeAllCats()` を追加し、`.cat-body.open` と `.chev.open` の `.open` クラスを一括除去する。

**Tech Stack:** Vanilla HTML/CSS/JS（フレームワークなし）

---

### Task 1: HTMLにボタンと wrapper を追加

**Files:**
- Modify: `index.html:97-102`

- [ ] **Step 1: `.tabs` を `div.tabs-row` でラップし、ボタンを追加**

`index.html` の96〜102行目を以下に置き換える:

```html
<!-- Tabs -->
<div class="tabs-row">
  <div class="tabs">
    <button class="tab on" onclick="switchTab('area',this)">領域別</button>
    <button class="tab" onclick="switchTab('cross',this)">横断テーマ</button>
    <button class="tab" onclick="switchTab('exam',this)">検査</button>
    <button class="tab" onclick="switchTab('all',this)">全て</button>
  </div>
  <button class="ghost-btn" onclick="closeAllCats()">
    <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
    <span>全て閉じる</span>
  </button>
</div>
```

- [ ] **Step 2: ブラウザで表示確認**

`index.html` をブラウザで開き、タブ行の右端にボタンが表示されることを目視確認する。

---

### Task 2: CSS に `.tabs-row` スタイルを追加

**Files:**
- Modify: `style.css`

- [ ] **Step 1: `.tabs-row` スタイルを追加**

`style.css` の `.tabs{...}` 行（145行目付近）の直前に以下を挿入する:

```css
.tabs-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem}
```

- [ ] **Step 2: `.tabs` から `margin-bottom` を削除**

現在の `.tabs` は `margin-bottom:1.1rem` を持っているが、`tabs-row` がその役割を引き受けるため削除する。

変更前:
```css
.tabs{display:flex;gap:2px;margin-bottom:1.1rem;background:var(--card);padding:3px;border-radius:9px;width:fit-content;border:1px solid var(--border)}
```

変更後:
```css
.tabs{display:flex;gap:2px;background:var(--card);padding:3px;border-radius:9px;width:fit-content;border:1px solid var(--border)}
```

- [ ] **Step 3: ブラウザで目視確認**

タブのピル型スタイルが崩れていないこと、ボタンが右端に位置していることを確認する。

- [ ] **Step 4: コミット**

```bash
git add index.html style.css
git commit -m "feat: 全て閉じるボタンのHTMLとCSSを追加"
```

---

### Task 3: JS に `closeAllCats()` を実装

**Files:**
- Modify: `app.js`

- [ ] **Step 1: `closeAllCats()` を `toggleCat()` の直下に追加**

`app.js` の `toggleCat()` 関数（650〜656行目）の直後に以下を追加する:

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

- [ ] **Step 2: 動作確認**

ブラウザで以下を確認する:
1. いくつかの大項目を開いた状態にする
2. 「全て閉じる」ボタンをクリック
3. すべての大項目が閉じること（`.cat-body` が非表示、シェブロンが上向きに戻る）
4. すでに全て閉じている状態でクリックしても何も起きない（エラーなし）

- [ ] **Step 3: コミット**

```bash
git add app.js
git commit -m "feat: closeAllCats関数を実装"
```
