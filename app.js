// ══════════════════════════════════════
//  医学知識ライブラリ — app.js
//  Firebase Realtime Database + Authentication 対応
// ══════════════════════════════════════

// ── タブ定義（固定） ──
var TABS = [
  {id:'area',  name:'領域別'},
  {id:'cross', name:'横断テーマ'},
  {id:'exam',  name:'検査'}
];

// ── SM-2 / localStorage キー ──
var STORE_KEY  = 'ml-data-v2';
var THEME_KEY  = 'ml-theme';

// ── インメモリ状態 ──
var CATEGORIES   = [];   // Firebase から再構築
var sectionsData = {};   // {sectionId: {...}}
var itemsData    = {};   // {slug: {...}}
var data         = {};   // SM-2 学習進捗（Realtime Database / インメモリ）

// ── Firebase ──
var db   = null;
var auth = null;

// ── 認証状態 ──
var currentUser = null;
var isAdmin     = false;

// ── 学習進捗リスナー解除用 ──
var progressRef      = null;
var progressListener = null;

// ── UI 状態 ──
var currentTab     = 'area';
var editMode       = false;
var studyTarget    = null;
var addTargetSec   = null;
var urlTargetSlug  = null;
var secEditTargetId = null;
var secAddTargetTab = null;
var sm_score = 3;
var sm_stage = 1;
var savedOpenSecs = [];

// ══════════════════════════════════════
//  学習進捗の読み込み / 保存（Realtime Database）
// ══════════════════════════════════════

// localStorage から旧データを読む（移行用）
function loadDataFromLocal() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch(e) { return {}; }
}

// 単一アイテムの進捗を Realtime Database に保存
function saveProgressItem(slug, record) {
  if (!currentUser || !db) return;
  db.ref('userProgress/' + currentUser.uid + '/' + slug).set(record, function(err) {
    if (err) {
      console.error('学習進捗の保存に失敗:', err);
      showToast('進捗の保存に失敗しました');
    }
  });
}

// 単一アイテムの進捗を Realtime Database から削除
function removeProgressItem(slug) {
  if (!currentUser || !db) return;
  db.ref('userProgress/' + currentUser.uid + '/' + slug).remove();
}

// ログイン時: userProgress/{uid} を購読して data に反映
function subscribeProgress(uid) {
  unsubscribeProgress(); // 既存リスナーを解除
  progressRef = db.ref('userProgress/' + uid);
  progressListener = progressRef.on('value', function(snap) {
    data = snap.val() || {};
    rebuildAndRender();
  }, function(err) {
    console.error('学習進捗の読み込みに失敗:', err);
    data = {};
    rebuildAndRender();
  });
}

// ログアウト時: リスナー解除 & data クリア
function unsubscribeProgress() {
  if (progressRef && progressListener) {
    progressRef.off('value', progressListener);
  }
  progressRef = null;
  progressListener = null;
}

// ログイン後、DB に進捗が無ければ localStorage から一度だけ移行
function migrateLocalIfNeeded(uid) {
  db.ref('userProgress/' + uid).once('value', function(snap) {
    if (snap.exists()) return; // 既にデータあり → 何もしない
    var local = loadDataFromLocal();
    if (!local || Object.keys(local).length === 0) return;
    db.ref('userProgress/' + uid).set(local, function(err) {
      if (err) {
        console.error('localStorage 移行失敗:', err);
      } else {
        showToast('既存の学習記録を同期しました');
      }
    });
  });
}

// 後方互換: saveData は何もしない（呼び出し元が残っていても安全）
function saveData(d) {
  // no-op: 進捗は saveProgressItem() で個別保存
}

// ══════════════════════════════════════
//  SM-2 アルゴリズム
// ══════════════════════════════════════
function sm2(card, score) {
  var s = score - 1;
  var ef = card.ef || 2.5;
  var interval = card.interval || 0;
  var reps = card.reps || 0;

  if (s < 2) {
    reps = 0; interval = 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ef);
    reps++;
  }
  ef = Math.max(1.3, ef + 0.1 - (4 - s) * (0.08 + (4 - s) * 0.02));

  var nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    ef: Math.round(ef * 100) / 100,
    interval: interval,
    reps: reps,
    nextReview: nextDate.toISOString().slice(0, 10)
  };
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  var today = new Date(); today.setHours(0,0,0,0);
  var d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}

// ══════════════════════════════════════
//  Firebase 初期化
// ══════════════════════════════════════
function initApp() {
  data = {}; // 学習進捗はログイン後に Realtime Database から取得

  // Firebase 設定チェック
  if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
    document.getElementById('hdr-sub').textContent = 'Firebase未設定 — firebase-config.js を作成してください';
    document.getElementById('main-content').innerHTML =
      '<div class="loading-msg">firebase-config.js が見つかりません。README を参照してセットアップしてください。</div>';
    updateAdminUI();
    return;
  }

  firebase.initializeApp(firebaseConfig);
  db   = firebase.database();
  auth = firebase.auth();

  // 認証状態の監視
  auth.onAuthStateChanged(handleAuthStateChanged);

  // データ監視（sections と items）
  db.ref('sections').on('value', function(snap) {
    sectionsData = snap.val() || {};
    rebuildAndRender();
  });
  db.ref('items').on('value', function(snap) {
    itemsData = snap.val() || {};
    rebuildAndRender();
  });
}

// ══════════════════════════════════════
//  Firebase データ → CATEGORIES 再構築
// ══════════════════════════════════════
function rebuildCategories() {
  // タブごとに空の配列を用意
  CATEGORIES = TABS.map(function(t) {
    return {id: t.id, tab: t.id, sections: []};
  });

  // sections を sortOrder でソートして各タブに振り分け
  var secList = Object.keys(sectionsData).map(function(id) {
    var s = sectionsData[id];
    return {
      id: id,
      name: s.name || id,
      tab: s.tab || 'area',
      color: s.color || '--a1',
      ci: s.ci || 'ci1',
      icon: s.icon || '<circle cx="12" cy="12" r="9"/>',
      sortOrder: s.sortOrder || 0,
      items: []
    };
  });
  secList.sort(function(a, b) { return a.sortOrder - b.sortOrder; });

  secList.forEach(function(sec) {
    var cat = null;
    CATEGORIES.forEach(function(c) { if (c.tab === sec.tab) cat = c; });
    if (cat) cat.sections.push(sec);
  });

  // items を sortOrder でソートして各 section に追加
  var itemList = Object.keys(itemsData).map(function(slug) {
    var it = itemsData[slug];
    return {
      slug: slug,
      name: it.name || slug,
      url: it.url || null,
      linkName: it.linkName || it.name || slug,
      sectionId: it.sectionId || '',
      sortOrder: it.sortOrder || 0
    };
  });
  itemList.sort(function(a, b) { return a.sortOrder - b.sortOrder; });

  itemList.forEach(function(item) {
    CATEGORIES.forEach(function(cat) {
      cat.sections.forEach(function(sec) {
        if (sec.id === item.sectionId) {
          sec.items.push({
            slug: item.slug,
            name: item.name,
            url: item.url,
            linkName: item.linkName
          });
        }
      });
    });
  });
}

function rebuildAndRender() {
  rebuildCategories();
  updateStats();
  renderAll();
}

// ══════════════════════════════════════
//  認証
// ══════════════════════════════════════
function handleAuthStateChanged(user) {
  currentUser = user;
  if (user && db) {
    // 管理者チェック
    db.ref('admins/' + user.uid).once('value', function(snap) {
      isAdmin = snap.val() === true;
      updateAdminUI();
    });
    // 学習進捗を購読 & localStorage 移行
    migrateLocalIfNeeded(user.uid);
    subscribeProgress(user.uid);
  } else {
    isAdmin = false;
    // 編集モードを解除
    if (editMode) {
      editMode = false;
      document.body.classList.remove('edit-mode');
    }
    // 進捗リスナー解除 & データクリア
    unsubscribeProgress();
    data = {};
    rebuildAndRender();
    updateAdminUI();
  }
}

function updateAdminUI() {
  var loginBtn  = document.getElementById('login-btn');
  var logoutBtn = document.getElementById('logout-btn');
  var editBtn   = document.getElementById('edit-btn');

  if (currentUser && isAdmin) {
    if (loginBtn)  loginBtn.style.display  = 'none';
    if (logoutBtn) logoutBtn.style.display = '';
    if (editBtn)   editBtn.style.display   = '';
  } else {
    if (loginBtn)  loginBtn.style.display  = '';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (editBtn)   editBtn.style.display   = 'none';
    // 編集ボタンの見た目をリセット
    if (editBtn) {
      editBtn.style.borderColor = '';
      editBtn.style.color = '';
      var span = editBtn.querySelector('span');
      if (span) span.textContent = '編集モード';
    }
  }
}

// ── ログイン / 新規登録モード ──
var loginMode = 'login'; // 'login' | 'register'

function openLoginModal() {
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  var errEl = document.getElementById('login-error');
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
  switchLoginTab('login'); // 常にログインタブで開く
  openModalById('login-modal');
}

function switchLoginTab(mode) {
  loginMode = mode;
  var isLogin = mode === 'login';

  // タブの見た目
  var tabLogin    = document.getElementById('auth-tab-login');
  var tabRegister = document.getElementById('auth-tab-register');
  if (tabLogin) {
    tabLogin.style.background  = isLogin ? '#fff' : 'transparent';
    tabLogin.style.color       = isLogin ? '#111' : '#888';
    tabLogin.style.fontWeight  = isLogin ? '600'  : '500';
  }
  if (tabRegister) {
    tabRegister.style.background = isLogin ? 'transparent' : '#fff';
    tabRegister.style.color      = isLogin ? '#888' : '#111';
    tabRegister.style.fontWeight = isLogin ? '500' : '600';
  }

  // タイトルとボタンラベル
  var title  = document.getElementById('login-modal-title');
  var submit = document.getElementById('auth-submit-btn');
  if (title)  title.textContent  = isLogin ? '管理者ログイン' : 'アカウント新規登録';
  if (submit) submit.textContent = isLogin ? 'ログイン'       : '登録する';

  // エラーをリセット
  var errEl = document.getElementById('login-error');
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
}

// ログイン / 新規登録の振り分け
function doSubmitAuth() {
  if (loginMode === 'register') { doRegister(); } else { doLogin(); }
}

function doLogin() {
  if (!auth) return;
  var email = document.getElementById('login-email').value.trim();
  var pass  = document.getElementById('login-password').value;
  var errEl = document.getElementById('login-error');

  if (!email || !pass) {
    if (errEl) { errEl.textContent = 'メールアドレスとパスワードを入力してください'; errEl.classList.add('show'); }
    return;
  }

  auth.signInWithEmailAndPassword(email, pass)
    .then(function() {
      closeModal('login-modal');
      showToast('ログインしました');
    })
    .catch(function(err) {
      var msg = 'ログインに失敗しました';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' ||
          err.code === 'auth/invalid-credential') {
        msg = 'メールアドレスまたはパスワードが正しくありません';
      }
      if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
    });
}

function doRegister() {
  if (!auth) return;
  var email = document.getElementById('login-email').value.trim();
  var pass  = document.getElementById('login-password').value;
  var errEl = document.getElementById('login-error');

  if (!email || !pass) {
    if (errEl) { errEl.textContent = 'メールアドレスとパスワードを入力してください'; errEl.classList.add('show'); }
    return;
  }
  if (pass.length < 6) {
    if (errEl) { errEl.textContent = 'パスワードは6文字以上で入力してください'; errEl.classList.add('show'); }
    return;
  }

  auth.createUserWithEmailAndPassword(email, pass)
    .then(function(cred) {
      closeModal('login-modal');
      showToast('アカウントを作成しました。UID: ' + cred.user.uid);
      // 管理者権限は Firebase Console で admins/{uid}: true を手動登録が必要
      alert('アカウントを作成しました。\n\n編集権限を得るには Firebase Console の\nRealtime Database → admins ノードに\n以下の UID を登録してください。\n\nUID: ' + cred.user.uid);
    })
    .catch(function(err) {
      var msg = '登録に失敗しました';
      if (err.code === 'auth/email-already-in-use') msg = 'このメールアドレスはすでに登録されています';
      if (err.code === 'auth/invalid-email')        msg = 'メールアドレスの形式が正しくありません';
      if (err.code === 'auth/weak-password')        msg = 'パスワードは6文字以上にしてください';
      if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
    });
}

function doLogout() {
  if (!auth) return;
  auth.signOut().then(function() {
    showToast('ログアウトしました');
  });
}

// ══════════════════════════════════════
//  テーマ
// ══════════════════════════════════════
var themeNames = {neon:'Neon dark', pastel:'Pastel dark', light:'Light'};
function setTheme(t, btn) {
  document.getElementById('app').setAttribute('data-theme', t);
  document.getElementById('th-name').textContent = themeNames[t];
  document.querySelectorAll('.tb').forEach(function(b){ b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  try { localStorage.setItem(THEME_KEY, t); } catch(e) {}
}
(function(){
  try {
    var saved = localStorage.getItem(THEME_KEY) || 'neon';
    var btn = document.querySelector('.tb-' + saved);
    setTheme(saved, btn);
  } catch(e) { setTheme('neon', document.querySelector('.tb-neon')); }
})();

// ══════════════════════════════════════
//  レンダリング
// ══════════════════════════════════════
function getAllItems() {
  var all = [];
  CATEGORIES.forEach(function(cat) {
    cat.sections.forEach(function(sec) {
      sec.items.forEach(function(item) {
        all.push({item:item, sec:sec, cat:cat});
      });
    });
  });
  return all;
}

function updateStats() {
  var all = getAllItems();
  var total = all.length;
  var studied = 0, master = 0, learn = 0, due = 0, overdue = 0;

  all.forEach(function(r) {
    var d = data[r.item.slug];
    if (!d) return;
    if (d.stage > 0) studied++;
    if (d.stage === 3) master++;
    if (d.stage === 2) learn++;
    if (d.nextReview) {
      var diff = daysUntil(d.nextReview);
      if (diff <= 0) { due++; if (diff < 0) overdue++; }
    }
  });

  function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
  function setWidth(id, val) { var el = document.getElementById(id); if (el) el.style.width = val; }

  setText('st-total', total);
  setText('st-cats', CATEGORIES.reduce(function(a,c){ return a + c.sections.length; }, 0) + '領域');
  setText('st-studied', studied);
  setText('st-studied-pct', total > 0 ? Math.round(studied/total*100) + '%' : '0%');
  setWidth('sf-studied', total > 0 ? Math.round(studied/total*100) + '%' : '0%');
  setText('st-master', master);
  setText('st-learn', '定着中 ' + learn + '件');
  setWidth('sf-master', total > 0 ? Math.round(master/total*100) + '%' : '0%');
  setText('st-due', due);
  setText('st-overdue', '期限超過 ' + overdue + '件');
  setWidth('sf-due', due > 0 ? '100%' : '0%');
  setText('hdr-sub', total + ' items · ' + studied + ' 件学習済み');

  // 復習バナー
  var dueItems = [];
  all.forEach(function(r) {
    var d = data[r.item.slug];
    if (d && d.nextReview) {
      var diff = daysUntil(d.nextReview);
      if (diff <= 0) dueItems.push({name: r.item.name, diff: diff, slug: r.item.slug});
    }
  });
  dueItems.sort(function(a,b){ return a.diff - b.diff; });

  var ot = document.getElementById('overdue-count');
  var chips = document.getElementById('review-chips');
  if (ot) ot.textContent = overdue + '件 期限超過';
  if (chips) {
    if (dueItems.length === 0) {
      chips.innerHTML = '<span class="no-review">今日の復習はありません 🎉</span>';
    } else {
      var shown = dueItems.slice(0, 4);
      var extra = dueItems.length - shown.length;
      chips.innerHTML = shown.map(function(it) {
        return '<span class="chip" onclick="openStudyModal(\'' + esc(it.slug) + '\',\'' + esc(it.name) + '\')">' + it.name + '</span>';
      }).join('') + (extra > 0 ? '<span class="chip chip-more">+ ' + extra + '件</span>' : '');
    }
  }
}

function stageLabel(s) { return ['未着手','一読','定着中','マスター'][s] || '未着手'; }
function stageCls(s)   { return ['b-none','b-read','b-learn','b-master'][s] || 'b-none'; }

// 文字列を onclick 属性内でエスケープ
function esc(str) { return (str || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function renderStars(slug) {
  var d = data[slug];
  var score = d ? (d.lastScore || 0) : 0;
  var html = '<div class="stars">';
  for (var i = 1; i <= 5; i++) {
    html += '<span class="star' + (i <= score ? ' on' : '') + '" onclick="quickScore(\'' + esc(slug) + '\',' + i + ')">★</span>';
  }
  return html + '</div>';
}

function renderItem(item, sec) {
  var d = data[item.slug] || {};
  var stage = d.stage || 0;
  var untouched = stage === 0 && !d.nextReview;
  var diff = d.nextReview ? daysUntil(d.nextReview) : null;
  var isOverdue = diff !== null && diff < 0;
  var isDue     = diff !== null && diff === 0;

  var nextText = '';
  if (isOverdue) nextText = '<span class="overdue-lbl">' + Math.abs(diff) + '日超過</span>';
  else if (isDue) nextText = '<span class="overdue-lbl">今日期限</span>';
  else if (diff !== null) nextText = '<span class="next-rv">次回: ' + diff + '日後</span>';

  var editPencil = '<button class="link-edit-btn" title="リンクを編集" onclick="event.stopPropagation();openUrlModal(\'' + esc(item.slug) + '\')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';

  var linkRow = item.url
    ? '<div class="item-link-row"><svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:var(--a1);fill:none;stroke-width:2;flex-shrink:0"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg><a class="item-link" href="' + item.url + '" target="_blank" rel="noopener">' + (item.linkName || item.url) + '</a>' + editPencil + '</div>'
    : '<div class="item-link-row"><button class="no-link-btn" onclick="openUrlModal(\'' + esc(item.slug) + '\')"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>リンクを追加</button></div>';

  var studyBtnLabel = stage > 0 ? '復習した' : '学習した';
  var studyBtnIcon  = stage > 0
    ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';

  var editRow = '<div class="edit-actions"><button class="edit-url" onclick="openUrlModal(\'' + esc(item.slug) + '\')">URLを変更</button><button class="edit-del" onclick="deleteItem(\'' + esc(item.slug) + '\')">削除</button></div>';

  return '<div class="item-card' + (untouched ? ' untouched' : '') + '" id="card-' + item.slug + '">'
    + '<span class="item-name">' + item.name + '</span>'
    + linkRow
    + '<div class="item-foot"><span class="badge ' + stageCls(stage) + '">' + stageLabel(stage) + '</span>' + nextText + '</div>'
    + '<div class="item-actions"><button class="study-btn" onclick="openStudyModal(\'' + esc(item.slug) + '\',\'' + esc(item.name) + '\')">' + studyBtnIcon + studyBtnLabel + '</button>' + renderStars(item.slug) + '</div>'
    + editRow
    + '</div>';
}

function renderSection(sec, searchQ) {
  var items = sec.items;
  if (searchQ) {
    items = items.filter(function(it) {
      return it.name.toLowerCase().indexOf(searchQ) >= 0 || (it.linkName || '').toLowerCase().indexOf(searchQ) >= 0;
    });
  }
  if (searchQ && items.length === 0) return '';

  var studied = items.filter(function(it){ var d = data[it.slug]; return d && d.stage > 0; }).length;
  var pct = items.length > 0 ? Math.round(studied / items.length * 100) : 0;

  var itemsHtml = items.map(function(it){ return renderItem(it, sec); }).join('');

  // 追加ボタンは管理者かつ編集モード時のみ（body.edit-mode CSS で制御）
  var addBtn = '<button class="add-btn" onclick="openAddModal(\'' + esc(sec.id) + '\')"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>項目を追加</button>';

  var bodyOpen = searchQ || studied > 0 || items.some(function(it){ var d = data[it.slug]; return d && d.nextReview && daysUntil(d.nextReview) <= 0; });
  var chevOpen = bodyOpen ? ' open' : '';

  var secEditBtns = '<div class="sec-edit-btns" onclick="event.stopPropagation()">'
    + '<button class="sec-btn" onclick="openSecEditModal(\'' + esc(sec.id) + '\')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>名前変更</button>'
    + '<button class="sec-btn sec-btn-del" onclick="deleteSection(\'' + esc(sec.id) + '\',\'' + esc(sec.name) + '\')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>削除</button>'
    + '</div>';

  return '<div class="cat-section" id="sec-' + sec.id + '">'
    + '<div class="cat-hdr" onclick="toggleCat(this)">'
    + '<div class="cat-ico" style="background:var(' + sec.ci + ')"><svg viewBox="0 0 24 24" style="stroke:var(' + sec.color + ')">' + sec.icon + '</svg></div>'
    + '<span class="cat-name">' + sec.name + '</span>'
    + '<div class="cat-meta"><div class="prog"><div class="prog-f" style="width:' + pct + '%;background:var(' + sec.color + ')"></div></div><span class="cat-cnt">' + studied + ' / ' + items.length + '</span></div>'
    + secEditBtns
    + '<div class="chev' + chevOpen + '"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></div>'
    + '</div>'
    + '<div class="cat-body' + (bodyOpen ? ' open' : '') + '">'
    + '<div class="item-grid">' + itemsHtml + '</div>'
    + addBtn
    + '</div>'
    + '</div>';
}

function renderAll() {
  var q = '';
  var si = document.getElementById('search-input');
  if (si) q = si.value.trim().toLowerCase();

  var html = '';
  var navHtml = '';
  CATEGORIES.forEach(function(cat) {
    if (currentTab !== 'all' && cat.tab !== currentTab) return;
    cat.sections.forEach(function(sec) {
      html += renderSection(sec, q);
      navHtml += '<button class="snav-btn" onclick="scrollToSection(\'' + esc(sec.id) + '\')">'
        + esc(sec.name) + '</button>';
    });
  });

  var sn = document.getElementById('section-nav');
  if (sn) sn.innerHTML = navHtml;

  if (!html) html = '<div class="loading-msg">該当するアイテムが見つかりませんでした</div>';

  // セクション追加ボタン（編集モード時のみ CSS で表示）
  html += '<button class="add-section-btn" onclick="openSecAddModal(\'' + currentTab + '\')">'
    + '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    + 'カテゴリを追加'
    + '</button>';

  var mc = document.getElementById('main-content');
  if (mc) mc.innerHTML = html;
}

function scrollToSection(secId) {
  var el = document.getElementById('sec-' + secId);
  if (!el) return;
  var offset = el.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({top: offset, behavior: 'smooth'});
}

// ══════════════════════════════════════
//  インタラクション
// ══════════════════════════════════════
function toggleCat(hdr) {
  var chev = hdr.querySelector('.chev');
  var body = hdr.nextElementSibling;
  var open = body.classList.contains('open');
  body.classList.toggle('open', !open);
  chev.classList.toggle('open', !open);
}

function switchTab(t, btn) {
  currentTab = t;
  document.querySelectorAll('.tab').forEach(function(b){ b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  renderAll();
}

function toggleEdit() {
  if (!isAdmin) { showToast('編集には管理者ログインが必要です'); return; }
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
  var editBtn = document.getElementById('edit-btn');
  if (editBtn) {
    editBtn.style.borderColor = editMode ? 'var(--a1)' : '';
    editBtn.style.color       = editMode ? 'var(--a1)' : '';
    var span = editBtn.querySelector('span');
    if (span) span.textContent = editMode ? '編集中...' : '編集モード';
  }
  showToast(editMode ? '編集モード ON — 削除・URL変更が可能です' : '編集モード OFF');
}

// 開閉状態を復元して再描画
function renderAllAndRestore(openSecs) {
  updateStats();
  renderAll();
  openSecs.forEach(function(secId) {
    var secEl = document.getElementById(secId);
    if (secEl) {
      var body = secEl.querySelector('.cat-body');
      var chev = secEl.querySelector('.chev');
      if (body) body.classList.add('open');
      if (chev) chev.classList.add('open');
    }
  });
}

// ══════════════════════════════════════
//  学習記録
// ══════════════════════════════════════
function openStudyModal(slug, name) {
  studyTarget = slug;
  sm_score = 3; sm_stage = 1;
  var d = data[slug] || {};
  sm_stage = d.stage || 0;
  document.getElementById('sm-title').textContent = '記録: ' + name;
  document.querySelectorAll('.stage-opt').forEach(function(b, i){ b.classList.toggle('on', i === sm_stage); });
  selScore(d.lastScore || 3);

  savedOpenSecs = [];
  document.querySelectorAll('#main-content .cat-section').forEach(function(el) {
    if (el.querySelector('.cat-body.open')) savedOpenSecs.push(el.id);
  });
  openModalById('study-modal');
}

function selStage(i) {
  sm_stage = i;
  document.querySelectorAll('.stage-opt').forEach(function(b, j){ b.classList.toggle('on', j === i); });
}

var hintTexts = ['1/5 → 翌日に再復習','2/5 → 翌日に再復習','3/5 → 次回: 約6日後','4/5 → 次回: 約10日後','5/5 → 次回: 約14日後'];
function selScore(n) {
  sm_score = n;
  var hint = document.getElementById('sm-hint');
  if (hint) hint.textContent = hintTexts[n - 1];
  document.querySelectorAll('#sm-stars .sl').forEach(function(s, j){ s.classList.toggle('on', j < n); });
}

function saveStudy() {
  if (!studyTarget) return;
  if (!currentUser) {
    showToast('学習記録の同期にはログインが必要です');
    closeModal('study-modal');
    return;
  }
  var old = data[studyTarget] || { ef: 2.5, interval: 0, reps: 0 };
  var result = sm2(old, sm_score);
  var record = {
    ef: result.ef,
    interval: result.interval,
    reps: result.reps,
    nextReview: result.nextReview,
    stage: sm_stage,
    lastScore: sm_score,
    lastStudied: new Date().toISOString().slice(0, 10)
  };
  data[studyTarget] = record;
  saveProgressItem(studyTarget, record);
  closeModal('study-modal');
  showToast('記録しました！次回: ' + record.nextReview);
  renderAllAndRestore(savedOpenSecs);
}

function quickScore(slug, score) {
  if (!currentUser) {
    showToast('学習記録の同期にはログインが必要です');
    return;
  }
  var old = data[slug] || { ef: 2.5, interval: 0, reps: 0, stage: 0 };
  var result = sm2(old, score);
  var record = {
    ef: result.ef,
    interval: result.interval,
    reps: result.reps,
    nextReview: result.nextReview,
    lastScore: score,
    stage: Math.max(old.stage || 0, 1),
    lastStudied: new Date().toISOString().slice(0, 10)
  };
  data[slug] = record;
  saveProgressItem(slug, record);

  var openSecs = [];
  document.querySelectorAll('#main-content .cat-section').forEach(function(el) {
    if (el.querySelector('.cat-body.open')) openSecs.push(el.id);
  });
  showToast('理解度 ' + score + '/5 で記録しました');
  renderAllAndRestore(openSecs);
}

// ══════════════════════════════════════
//  アイテム CRUD（Firebase）
// ══════════════════════════════════════
function openAddModal(secId) {
  if (!isAdmin) return;
  addTargetSec = secId;
  document.getElementById('add-name').value = '';
  document.getElementById('add-url').value = '';
  document.getElementById('add-link-name').value = '';
  openModalById('add-modal');
}

function saveAdd() {
  var name     = document.getElementById('add-name').value.trim();
  if (!name) { showToast('疾患名を入力してください'); return; }
  var url      = document.getElementById('add-url').value.trim();
  var linkName = document.getElementById('add-link-name').value.trim() || name;

  // slug 生成（sectionId + タイムスタンプ）
  var slug = 'custom-' + addTargetSec + '-' + Date.now();

  // Firebase の items 内の最大 sortOrder を取得して +1
  var maxOrder = 0;
  Object.keys(itemsData).forEach(function(k) {
    if (itemsData[k].sectionId === addTargetSec && (itemsData[k].sortOrder || 0) > maxOrder) {
      maxOrder = itemsData[k].sortOrder || 0;
    }
  });

  var newItem = {
    name:      name,
    url:       url || null,
    linkName:  linkName,
    sectionId: addTargetSec,
    sortOrder: maxOrder + 1,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  db.ref('items/' + slug).set(newItem, function(err) {
    if (err) { showToast('エラー: ' + err.message); return; }
    closeModal('add-modal');
    showToast('「' + name + '」を追加しました');
  });
}

function deleteItem(slug) {
  if (!isAdmin) return;
  // アイテム名を取得
  var itemName = slug;
  CATEGORIES.forEach(function(cat) {
    cat.sections.forEach(function(sec) {
      sec.items.forEach(function(it) { if (it.slug === slug) itemName = it.name; });
    });
  });

  if (!confirm('「' + itemName + '」を削除しますか？')) return;

  db.ref('items/' + slug).remove(function(err) {
    if (err) { showToast('エラー: ' + err.message); return; }
    // 学習データも Realtime Database から削除
    delete data[slug];
    removeProgressItem(slug);
    showToast('削除しました');
  });
}

// ── URL 編集 ──
function openUrlModal(slug) {
  if (!isAdmin) return;
  urlTargetSlug = slug;
  var item = null;
  CATEGORIES.forEach(function(cat){ cat.sections.forEach(function(sec){ sec.items.forEach(function(it){ if(it.slug===slug) item=it; }); }); });
  document.getElementById('url-modal-title').textContent = (item ? item.name : 'リンク') + ' — リンクを編集';
  document.getElementById('url-input').value      = item ? (item.url || '') : '';
  document.getElementById('url-name-input').value = item ? (item.linkName || '') : '';
  openModalById('url-modal');
}

function saveUrl() {
  var url      = document.getElementById('url-input').value.trim();
  var linkName = document.getElementById('url-name-input').value.trim();
  db.ref('items/' + urlTargetSlug).update({
    url:       url || null,
    linkName:  linkName || urlTargetSlug,
    updatedAt: Date.now()
  }, function(err) {
    if (err) { showToast('エラー: ' + err.message); return; }
    closeModal('url-modal');
    showToast(url ? 'リンクを更新しました' : 'リンクを削除しました');
  });
}

function clearUrl() {
  if (!confirm('リンクを削除してURLなしにしますか？\n学習データは保持されます。')) return;
  db.ref('items/' + urlTargetSlug).update({url: null, updatedAt: Date.now()}, function(err) {
    if (err) { showToast('エラー: ' + err.message); return; }
    closeModal('url-modal');
    showToast('リンクを削除しました');
  });
}

// ══════════════════════════════════════
//  セクション CRUD（Firebase）
// ══════════════════════════════════════
function openSecAddModal(tab) {
  if (!isAdmin) return;
  secAddTargetTab = tab;
  document.getElementById('sec-add-name').value = '';
  openModalById('sec-add-modal');
}

function saveSecAdd() {
  var name = document.getElementById('sec-add-name').value.trim();
  if (!name) { showToast('カテゴリ名を入力してください'); return; }

  var colors = ['--a1','--a2b','--a3','--a4'];
  var cis    = ['ci1','ci2','ci3','ci4'];
  var idx    = Object.keys(sectionsData).length % 4;
  var secId  = 'custom-sec-' + Date.now();

  // 最大 sortOrder
  var maxOrder = 0;
  Object.keys(sectionsData).forEach(function(k) {
    if ((sectionsData[k].sortOrder || 0) > maxOrder) maxOrder = sectionsData[k].sortOrder || 0;
  });

  var newSec = {
    name:      name,
    tab:       secAddTargetTab,
    color:     colors[idx],
    ci:        cis[idx],
    icon:      '<circle cx="12" cy="12" r="9"/>',
    sortOrder: maxOrder + 1
  };

  db.ref('sections/' + secId).set(newSec, function(err) {
    if (err) { showToast('エラー: ' + err.message); return; }
    closeModal('sec-add-modal');
    showToast('「' + name + '」カテゴリを追加しました');
  });
}

function openSecEditModal(secId) {
  if (!isAdmin) return;
  secEditTargetId = secId;
  var sec = sectionsData[secId];
  document.getElementById('sec-edit-name').value = sec ? sec.name : '';
  openModalById('sec-edit-modal');
}

function saveSecEdit() {
  var name = document.getElementById('sec-edit-name').value.trim();
  if (!name) { showToast('カテゴリ名を入力してください'); return; }
  db.ref('sections/' + secEditTargetId + '/name').set(name, function(err) {
    if (err) { showToast('エラー: ' + err.message); return; }
    closeModal('sec-edit-modal');
    showToast('カテゴリ名を変更しました');
  });
}

function deleteSection(secId, secName) {
  if (!isAdmin) return;
  // セクション内のアイテム数を確認
  var itemCount = 0;
  Object.keys(itemsData).forEach(function(k) {
    if (itemsData[k].sectionId === secId) itemCount++;
  });

  var msg = '「' + secName + '」を削除しますか？' + (itemCount > 0 ? '\n（この中の' + itemCount + '件の項目もすべて削除されます）' : '');
  if (!confirm(msg)) return;

  var updates = {};
  updates['sections/' + secId] = null;
  // 配下のアイテムも削除
  var deletedSlugs = [];
  Object.keys(itemsData).forEach(function(k) {
    if (itemsData[k].sectionId === secId) {
      updates['items/' + k] = null;
      delete data[k];
      deletedSlugs.push(k);
    }
  });
  // 学習進捗も Realtime Database から削除
  deletedSlugs.forEach(function(slug) { removeProgressItem(slug); });

  db.ref().update(updates, function(err) {
    if (err) { showToast('エラー: ' + err.message); return; }
    showToast('「' + secName + '」を削除しました');
  });
}

// ══════════════════════════════════════
//  統計詳細モーダル
// ══════════════════════════════════════
function makeRow(r, extraRight) {
  var slug = esc(r.item.slug);
  var d = data[r.item.slug] || {};
  var stage = d.stage || 0;
  var cls = stageCls(stage);
  var badge = '<span class="sd-badge ' + cls + '">' + stageLabel(stage) + '</span>';
  return '<div class="sd-item-wrap" id="sdw-' + r.item.slug + '">'
    + '<div class="sd-row" onclick="toggleItemDetail(this,\'' + slug + '\')">'
    + '<div class="sd-left"><span class="sd-name">' + r.item.name + '</span><span class="sd-sec">' + r.sec.name + '</span></div>'
    + '<div class="sd-right">' + badge + (extraRight || '') + '<span class="sd-chevron">›</span></div>'
    + '</div>'
    + '<div class="item-detail-panel" id="idp-' + r.item.slug + '"></div>'
    + '</div>';
}

function toggleItemDetail(rowEl, slug) {
  var panel = document.getElementById('idp-' + slug);
  if (!panel) return;
  var isOpen = panel.classList.contains('open');
  document.querySelectorAll('.item-detail-panel.open').forEach(function(p){ p.classList.remove('open'); });
  if (isOpen) return;

  var item = null; var sec = null;
  CATEGORIES.forEach(function(cat){ cat.sections.forEach(function(s){ s.items.forEach(function(it){ if(it.slug===slug){item=it;sec=s;} }); }); });
  if (!item) return;

  var d = data[slug] || {};
  var stage = d.stage || 0;
  var diff = d.nextReview ? daysUntil(d.nextReview) : null;
  var starsHtml = '<div class="idp-stars">';
  for (var i=1;i<=5;i++) starsHtml += '<span class="idp-star' + (i<=(d.lastScore||0)?' on':'') + '">★</span>';
  starsHtml += '</div>';

  var nextValHtml = diff === null
    ? '<span class="idp-val">未記録</span>'
    : diff < 0 ? '<span class="idp-val-danger">' + Math.abs(diff) + '日超過</span>'
    : diff === 0 ? '<span class="idp-val-danger">今日期限</span>'
    : '<span class="idp-val-ok">'+diff+'日後</span>';

  var linkHtml = item.url
    ? '<a class="idp-link" href="' + item.url + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' + (item.linkName || item.url) + '</a>'
    : '<span class="idp-no-link">リンクなし</span>';

  var cls = stageCls(stage);

  panel.innerHTML =
    '<div class="idp-header">'
    + '<div class="idp-title">' + item.name + '</div>'
    + linkHtml
    + '</div>'
    + '<div class="idp-body">'
    + '<div class="idp-row"><span class="idp-lbl">習熟段階</span><span class="sd-badge ' + cls + '" style="font-size:11px">' + stageLabel(stage) + '</span></div>'
    + '<div class="idp-row"><span class="idp-lbl">理解度</span>' + starsHtml + '</div>'
    + '<div class="idp-row"><span class="idp-lbl">次回復習</span>' + nextValHtml + '</div>'
    + '<div class="idp-row"><span class="idp-lbl">最終学習</span><span class="idp-val">' + (d.lastStudied || '未記録') + '</span></div>'
    + '<div class="idp-row"><span class="idp-lbl">カテゴリ</span><span class="idp-val">' + sec.name + '</span></div>'
    + '</div>'
    + '<div class="idp-actions">'
    + '<button class="idp-study-btn" onclick="event.stopPropagation();closeModal(\'stat-detail-modal\');openStudyModal(\'' + esc(slug) + '\',\'' + esc(item.name) + '\')">'
    + (stage > 0 ? '復習を記録する' : '学習を記録する')
    + '</button>'
    + '</div>';

  panel.classList.add('open');
}

function openStatDetail(type) {
  var all   = getAllItems();
  var title = '';
  var rows  = [];

  if (type === 'total') {
    title = '全アイテム一覧（' + all.length + '件）';
    var bySec = {};
    all.forEach(function(r) {
      if (!bySec[r.sec.name]) bySec[r.sec.name] = [];
      bySec[r.sec.name].push(r);
    });
    Object.keys(bySec).forEach(function(secName) {
      rows.push('<div class="sd-section-hdr">' + secName + '</div>');
      bySec[secName].forEach(function(r) { rows.push(makeRow(r, '')); });
    });

  } else if (type === 'studied') {
    var studied = all.filter(function(r){ var d=data[r.item.slug]; return d && d.stage > 0; });
    title = '学習済みアイテム（' + studied.length + '件）';
    if (studied.length === 0) {
      rows.push('<div class="sd-empty">まだ学習済みのアイテムはありません</div>');
    } else {
      studied.forEach(function(r) {
        var d = data[r.item.slug];
        var diff = d.nextReview ? daysUntil(d.nextReview) : null;
        var nextHtml = diff === null ? '' : diff < 0
          ? '<span class="sd-next-danger">' + Math.abs(diff) + '日超過</span>'
          : diff === 0 ? '<span class="sd-next-danger">今日期限</span>'
          : '<span class="sd-next">次回 ' + diff + '日後</span>';
        rows.push(makeRow(r, nextHtml));
      });
    }

  } else if (type === 'master') {
    var mastered = all.filter(function(r){ var d=data[r.item.slug]; return d && d.stage === 3; });
    var learning = all.filter(function(r){ var d=data[r.item.slug]; return d && d.stage === 2; });
    title = 'マスター ' + mastered.length + '件 · 定着中 ' + learning.length + '件';
    if (mastered.length === 0 && learning.length === 0) {
      rows.push('<div class="sd-empty">マスター・定着中のアイテムはまだありません</div>');
    } else {
      if (mastered.length > 0) {
        rows.push('<div class="sd-section-hdr">マスター</div>');
        mastered.forEach(function(r) {
          var d = data[r.item.slug];
          var nextHtml = d.nextReview ? '<span class="sd-next">次回 ' + daysUntil(d.nextReview) + '日後</span>' : '';
          rows.push(makeRow(r, nextHtml));
        });
      }
      if (learning.length > 0) {
        rows.push('<div class="sd-section-hdr">定着中</div>');
        learning.forEach(function(r) {
          var d = data[r.item.slug];
          var nextHtml = d.nextReview ? '<span class="sd-next">次回 ' + daysUntil(d.nextReview) + '日後</span>' : '';
          rows.push(makeRow(r, nextHtml));
        });
      }
    }

  } else if (type === 'due') {
    var overdueItems = all.filter(function(r){ var d=data[r.item.slug]; return d && d.nextReview && daysUntil(d.nextReview) < 0; });
    var todayItems   = all.filter(function(r){ var d=data[r.item.slug]; return d && d.nextReview && daysUntil(d.nextReview) === 0; });
    title = '今日の復習（' + (overdueItems.length + todayItems.length) + '件）';
    if (overdueItems.length === 0 && todayItems.length === 0) {
      rows.push('<div class="sd-empty">今日の復習はありません 🎉</div>');
    } else {
      if (overdueItems.length > 0) {
        rows.push('<div class="sd-section-hdr">期限超過</div>');
        overdueItems.sort(function(a,b){ return daysUntil(data[a.item.slug].nextReview) - daysUntil(data[b.item.slug].nextReview); });
        overdueItems.forEach(function(r) {
          var diff = daysUntil(data[r.item.slug].nextReview);
          rows.push(makeRow(r, '<span class="sd-next-danger">' + Math.abs(diff) + '日超過</span>'));
        });
      }
      if (todayItems.length > 0) {
        rows.push('<div class="sd-section-hdr">本日期限</div>');
        todayItems.forEach(function(r){ rows.push(makeRow(r, '<span class="sd-next-danger">今日期限</span>')); });
      }
    }
  }

  document.getElementById('stat-detail-title').textContent = title;
  document.getElementById('stat-detail-body').innerHTML = '<div class="stat-detail-list">' + rows.join('') + '</div>';
  openModalById('stat-detail-modal');
}

// ══════════════════════════════════════
//  エクスポート
// ══════════════════════════════════════
function exportData() {
  var out = {
    exportedAt:  new Date().toISOString(),
    studyData:   data,
    sectionsData: sectionsData,
    itemsData:   itemsData
  };
  var blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'medical-library-export-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  showToast('エクスポートしました');
}

// ══════════════════════════════════════
//  モーダルヘルパー
// ══════════════════════════════════════
var ALL_MODALS = ['study-modal','add-modal','url-modal','sec-add-modal','sec-edit-modal','stat-detail-modal','login-modal'];

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
function openModalById(id) {
  ALL_MODALS.forEach(function(mid) {
    if (mid !== id) {
      var el = document.getElementById(mid);
      if (el) el.classList.remove('open');
    }
  });
  var el = document.getElementById(id);
  if (!el) return;
  el.style.top = (window.scrollY || document.documentElement.scrollTop) + 'px';
  el.classList.add('open');
}

// ── Enter キーでログイン ──
document.addEventListener('keydown', function(e) {
  var lm = document.getElementById('login-modal');
  if (lm && lm.classList.contains('open') && e.key === 'Enter') {
    doSubmitAuth();
  }
});

// ══════════════════════════════════════
//  トースト
// ══════════════════════════════════════
var toastTimer;
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 2500);
}

// ══════════════════════════════════════
//  初期化
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  var areaTab = document.querySelector('.tab');
  if (areaTab) switchTab('area', areaTab);
  updateAdminUI();
  initApp();
});
