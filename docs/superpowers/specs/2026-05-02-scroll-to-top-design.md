# Scroll-to-Top Button — Design Spec

Date: 2026-05-02

## Overview

画面右下に固定表示される「ページトップへ戻る」ボタンを追加する。300px 以上スクロールした時点で表示され、クリックするとスムーズスクロールでページ先頭に戻る。

## HTML

`index.html` の `</body>` 直前に1要素追加する。

```html
<button id="scroll-top-btn" aria-label="ページトップへ戻る">↑</button>
```

## CSS

`style.css` に追記。

- `position: fixed; bottom: 24px; right: 24px;` で右下に固定
- 幅・高さ 40px の丸ボタン（`border-radius: 50%`）
- 初期状態は `opacity: 0; pointer-events: none;`
- `.visible` クラス付与時に `opacity: 1; pointer-events: auto;` へフェードイン（`transition: opacity .2s`）
- `z-index: 100`（既存モーダルの `z-index: 500` より下）
- 色はCSS変数 `var(--card)` / `var(--border)` を使い、ダークモード対応

## JS

`app.js` に追記。

```js
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', () => {
  const btn = document.getElementById('scroll-top-btn');
  btn.classList.toggle('visible', window.scrollY > 300);
});
```

## 影響範囲

- 新規追加のみ。既存機能への変更なし
- モーダル・セクションナビ・タブとの z-index 競合なし

## テスト方針

- 300px 未満でボタン非表示、300px 超で表示されることを目視確認
- クリック時にスムーズスクロールでトップに戻ることを確認
- ダークモード切替後も色が適切に表示されることを確認
