# Scroll-to-Top Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 画面右下に固定表示されるスクロールトップボタンを追加する。300px スクロールで表示され、クリックでスムーズスクロール。

**Architecture:** HTML にボタン要素を1つ追加し、CSS で固定配置とフェードアニメーションを定義、JS で scroll イベントによる表示制御とクリックハンドラを追記する。既存コードへの変更は一切なし。

**Tech Stack:** Vanilla HTML / CSS / JS（フレームワーク・ライブラリなし）

---

### Task 1: HTML にボタンを追加

**Files:**
- Modify: `index.html:347`（`</body>` の直前）

- [ ] **Step 1: ボタン要素を追加する**

`index.html` の 347 行目（`</body>` タグ）の直前に以下を挿入する：

```html
<button id="scroll-top-btn" aria-label="ページトップへ戻る">↑</button>
```

挿入後の該当箇所は以下のようになる：

```html
<script src="app.js?v=4"></script>
<button id="scroll-top-btn" aria-label="ページトップへ戻る">↑</button>
</body>
</html>
```

- [ ] **Step 2: ブラウザで要素が存在することを確認**

ブラウザの DevTools（Elements タブ）で `#scroll-top-btn` が DOM に存在することを確認する。この時点ではスタイルが当たっていないため見た目は崩れていてよい。

- [ ] **Step 3: コミット**

```bash
git add index.html
git commit -m "feat: scroll-to-topボタンのHTML要素を追加"
```

---

### Task 2: CSS でボタンをスタイリング

**Files:**
- Modify: `style.css`（末尾の `@media(max-width:600px)` ブロックの直前に追記）

- [ ] **Step 1: スタイルを追記する**

`style.css` の 336 行目（`@media(max-width:600px){` の直前）に以下を挿入する：

```css
#scroll-top-btn{position:fixed;bottom:24px;right:24px;width:40px;height:40px;border-radius:50%;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:18px;cursor:pointer;z-index:100;opacity:0;pointer-events:none;transition:opacity .2s;display:flex;align-items:center;justify-content:center}
#scroll-top-btn.visible{opacity:1;pointer-events:auto}
```

- [ ] **Step 2: ブラウザで見た目を確認**

DevTools Console で以下を実行し、ボタンが右下に表示されることを確認する（この時点では JS が未実装のため手動で表示させる）：

```js
document.getElementById('scroll-top-btn').classList.add('visible')
```

ライトモード・ダークモードそれぞれで色が自然に見えることを確認する。

- [ ] **Step 3: コミット**

```bash
git add style.css
git commit -m "feat: scroll-to-topボタンのCSSスタイルを追加"
```

---

### Task 3: JS でスクロール制御を追加

**Files:**
- Modify: `app.js`（末尾の `});` の直前、1357 行目付近に追記）

- [ ] **Step 1: scrollToTop 関数と scroll イベントリスナーを追記する**

`app.js` の末尾（1357 行目の `});` の直前）に以下を挿入する：

```js
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', function() {
  var btn = document.getElementById('scroll-top-btn');
  if (!btn) return;
  btn.classList.toggle('visible', window.scrollY > 300);
});
```

挿入後の末尾は以下のようになる：

```js
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', function() {
  var btn = document.getElementById('scroll-top-btn');
  if (!btn) return;
  btn.classList.toggle('visible', window.scrollY > 300);
});

  updateAdminUI();
  initApp();
});
```

- [ ] **Step 2: HTML の onclick を確認する**

`index.html` のボタン要素に `onclick="scrollToTop()"` が設定されていなければ追加する：

```html
<button id="scroll-top-btn" aria-label="ページトップへ戻る" onclick="scrollToTop()">↑</button>
```

- [ ] **Step 3: 動作を目視確認する**

ブラウザでページを開き、以下を順に確認する：

1. ページトップの状態（scrollY = 0）でボタンが非表示であること
2. 300px 以上スクロールするとボタンがフェードインして現れること
3. ボタンをクリックするとスムーズスクロールでページ先頭に戻ること
4. 戻ったあとにボタンが非表示になること
5. ダークモードに切り替えてもボタンの色が自然であること

- [ ] **Step 4: コミット**

```bash
git add app.js index.html
git commit -m "feat: scroll-to-topボタンのJS実装を追加"
```
