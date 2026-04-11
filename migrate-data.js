/**
 * migrate-data.js
 * 既存の index.html のハードコードデータを Firebase Realtime Database へ移行するスクリプト。
 *
 * 使い方:
 *   1. npm install firebase-admin
 *   2. Firebase Console → プロジェクト設定 → サービスアカウント → 新しい秘密鍵を生成
 *   3. ダウンロードした JSON を serviceAccountKey.json として同ディレクトリに置く
 *   4. DATABASE_URL を自分のプロジェクトのものに変更
 *   5. node migrate-data.js
 *
 * ※ 実行は一度きりでOK。既存データがあれば上書きされます。
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

const DATABASE_URL = 'https://medicallibrary-4e1c7-default-rtdb.asia-southeast1.firebasedatabase.app';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL
});

const db = admin.database();

// ══════════════════════════════════════
//  移行データ（既存 index.html から抽出）
// ══════════════════════════════════════

const sectionsRaw = [
  // ── 領域別 ──
  {id:'mouth',     name:'口腔',         tab:'area',  color:'--a1',  ci:'ci1', icon:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', sortOrder:1},
  {id:'resp',      name:'呼吸器',       tab:'area',  color:'--a1',  ci:'ci1', icon:'<circle cx="12" cy="12" r="3"/><path d="M3 12h3m12 0h3M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/>', sortOrder:2},
  {id:'headneck',  name:'頭頸部',       tab:'area',  color:'--a2b', ci:'ci2', icon:'<circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2-8 4v2h16v-2c0-2-3-4-8-4z"/>', sortOrder:3},
  {id:'neuro',     name:'神経',         tab:'area',  color:'--a3',  ci:'ci3', icon:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>', sortOrder:4},
  {id:'bone-soft', name:'骨軟部',       tab:'area',  color:'--a4',  ci:'ci4', icon:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>', sortOrder:5},
  {id:'thymus',    name:'胸腺',         tab:'area',  color:'--a1',  ci:'ci1', icon:'<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>', sortOrder:6},
  {id:'cardio',    name:'循環器',       tab:'area',  color:'--a2b', ci:'ci2', icon:'<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>', sortOrder:7},
  {id:'gi',        name:'消化管',       tab:'area',  color:'--a4',  ci:'ci4', icon:'<path d="M3 12h18M12 3c-4 0-7 4-7 9s3 9 7 9 7-4 7-9-3-9-7-9z"/>', sortOrder:8},
  {id:'hepato',    name:'肝胆膵',       tab:'area',  color:'--a2b', ci:'ci2', icon:'<path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>', sortOrder:9},
  {id:'hema',      name:'血液',         tab:'area',  color:'--a2b', ci:'ci2', icon:'<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>', sortOrder:10},
  {id:'uro',       name:'腎泌尿器',     tab:'area',  color:'--a1',  ci:'ci1', icon:'<path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7z"/>', sortOrder:11},
  {id:'endo',      name:'内分泌',       tab:'area',  color:'--a3',  ci:'ci3', icon:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', sortOrder:12},
  {id:'gyneco',    name:'婦人科',       tab:'area',  color:'--a5',  ci:'ci5', icon:'<path d="M12 22V12m0 0C12 7 8 4 4 6M12 12c0-5 4-8 8-6"/>', sortOrder:13},
  {id:'breast',    name:'乳腺',         tab:'area',  color:'--a2b', ci:'ci2', icon:'<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>', sortOrder:14},
  {id:'skin',      name:'皮膚',         tab:'area',  color:'--a1',  ci:'ci1', icon:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', sortOrder:15},
  {id:'ortho',     name:'整形外科',     tab:'area',  color:'--a4',  ci:'ci4', icon:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>', sortOrder:16},
  // ── 横断テーマ ──
  {id:'ihc',       name:'免疫染色',     tab:'cross', color:'--a2b', ci:'ci2', icon:'<path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>', sortOrder:1},
  {id:'mol',       name:'分子異常',     tab:'cross', color:'--a3',  ci:'ci3', icon:'<circle cx="12" cy="12" r="3"/><circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><line x1="12" y1="7" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="17"/><line x1="7" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="17" y2="12"/>', sortOrder:2},
  {id:'genetic',   name:'遺伝性疾患',   tab:'cross', color:'--a4',  ci:'ci4', icon:'<path d="M2 12C2 6.5 6.5 2 12 2s10 4.5 10 10-4.5 10-10 10S2 17.5 2 12"/><path d="M12 8v4l3 3"/>', sortOrder:3},
  {id:'infect',    name:'感染症',       tab:'cross', color:'--a1',  ci:'ci1', icon:'<circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.33 4.06-7.9 6.4-14.5 6.23"/>', sortOrder:4},
  {id:'terms',     name:'用語・所見集', tab:'cross', color:'--a3',  ci:'ci3', icon:'<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>', sortOrder:5},
  // ── 検査 ──
  {id:'nuclear-med', name:'核医学検査', tab:'exam',  color:'--a4',  ci:'ci4', icon:'<circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85"/>', sortOrder:1},
  {id:'imaging',     name:'画像検査',   tab:'exam',  color:'--a1',  ci:'ci1', icon:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>', sortOrder:2},
];

const itemsRaw = [
  // 口腔
  {slug:'fibroma-tongue',          name:'線維腫（舌）',                            sectionId:'mouth',      url:'https://claude.ai/public/artifacts/ae87f4bb-f9d0-4ab9-8ce9-1b5957a51154', linkName:'舌線維腫の病理鑑別ガイド',                      sortOrder:1},
  // 呼吸器
  {slug:'pneumothorax',            name:'気胸・ブラ・ブレブ',                       sectionId:'resp',       url:'https://claude.ai/public/artifacts/1a1bedd8-6a1d-4b71-a40c-483e68ba3814', linkName:'気胸・ブラ・ブレブ 病理解説',                    sortOrder:1},
  {slug:'op-pneumonia',            name:'器質化肺炎',                              sectionId:'resp',       url:'https://claude.ai/public/artifacts/3287c4c8-ecc8-4bfb-b42a-3aef55e638ac', linkName:'op_pathology.html',                              sortOrder:2},
  {slug:'pulm-sarcomatoid',        name:'肺・肉腫様癌',                             sectionId:'resp',       url:'https://claude.ai/public/artifacts/b28c7d47-0a32-494f-95ec-b5b8add3216d', linkName:'肺・肉腫様癌',                                   sortOrder:3},
  // 頭頸部
  {slug:'nasal-undiff',            name:'鼻腔未分化悪性腫瘍',                       sectionId:'headneck',   url:'https://claude.ai/public/artifacts/d8ef79fd-8796-4d41-bf3a-71c9d9ab575e', linkName:'nasal_undiff_tumor_lineage.html',                sortOrder:1},
  {slug:'salivary-tumor',          name:'唾液腺腫瘍',                              sectionId:'headneck',   url:'https://claude.ai/public/artifacts/f37db937-927d-41a2-97f3-d2a2c8ad70c7', linkName:'salivary_gland_tumors.html',                     sortOrder:2},
  // 神経
  {slug:'glioma-who2021',          name:'神経膠腫（WHO 2021分類）',                  sectionId:'neuro',      url:'https://claude.ai/public/artifacts/a9456867-f397-4b98-bb0e-3b4042893232', linkName:'WHO 2021神経膠腫分類ガイド',                      sortOrder:1},
  {slug:'pituitary-path',          name:'下垂体病理学習',                           sectionId:'neuro',      url:'https://claude.ai/public/artifacts/55dbedb9-0bc3-4484-af8b-be47d6972c18', linkName:'下垂体病理学習ガイド',                            sortOrder:2},
  {slug:'schwannoma-nf',           name:'神経鞘腫 & 神経線維腫',                    sectionId:'neuro',      url:'https://claude.ai/public/artifacts/c4ed13c6-afe8-4acc-9b8c-817121d95287', linkName:'神経線維腫 vs 神経鞘腫 鑑別ガイド',               sortOrder:3},
  // 骨軟部
  {slug:'ups',                     name:'未分化多形肉腫（UPS）',                     sectionId:'bone-soft',  url:'https://claude.ai/public/artifacts/a0026e51-d8b8-4b84-9068-c272c6a36e01', linkName:'ups_pathology.html',                             sortOrder:1},
  {slug:'lch-bone',                name:'LCH（ランゲルハンス細胞組織球症）',          sectionId:'bone-soft',  url:'https://claude.ai/public/artifacts/aadfd5d0-6f90-4ebb-b637-9f3ce77df8c3', linkName:'lch_patho_note.html',                            sortOrder:2},
  {slug:'pecoma',                  name:'PEComa',                                  sectionId:'bone-soft',  url:'https://claude.ai/public/artifacts/4f8cb4a1-f5e4-478f-bdab-92052af0cdf6', linkName:'PEComa 学習リファレンス',                         sortOrder:3},
  // 胸腺
  {slug:'hassall',                 name:'ハッサル小体',                             sectionId:'thymus',     url:'https://claude.ai/public/artifacts/0dd32c6c-2965-494a-a0de-f9c99c086552', linkName:'ハッサル小体：胸腺髄質の組織学的ガイド',           sortOrder:1},
  // 循環器
  {slug:'cardiac-valve',           name:'心臓弁',                                  sectionId:'cardio',     url:'https://claude.ai/public/artifacts/602c3b01-94cd-41b6-bc0d-e6363c1b9da3', linkName:'心臓弁 病理学習リファレンス',                     sortOrder:1},
  // 消化管
  {slug:'raspberry-fovea',         name:'ラズベリー様腺窩上皮型腫瘍',               sectionId:'gi',         url:'https://claude.ai/public/artifacts/89353eb7-420c-45ea-98f2-1c0cf4ed399a', linkName:'ラズベリー様腺窩上皮型腫瘍リファレンス',           sortOrder:1},
  {slug:'aig',                     name:'自己免疫性胃炎',                           sectionId:'gi',         url:'https://claude.ai/public/artifacts/5ab63ad3-9bf2-4cce-8151-431ec02aa952', linkName:'aig_pathology.html',                             sortOrder:2},
  {slug:'hp-neg-gastric',          name:'H.pylori陰性胃癌',                         sectionId:'gi',         url:'https://claude.ai/public/artifacts/580cba4a-7189-4ac1-8cc7-84230af0885d', linkName:'HP陰性胃癌：発生機序・分類・病理診断',            sortOrder:3},
  {slug:'ewing-gi',                name:'Ewing肉腫（消化管）',                       sectionId:'gi',         url:'https://claude.ai/public/artifacts/80a1dd76-4d5f-4643-b12d-0f8c202776ec', linkName:'Ewing肉腫：病理学習ガイド',                      sortOrder:4},
  {slug:'appendicitis',            name:'虫垂炎',                                   sectionId:'gi',         url:'https://claude.ai/public/artifacts/f843895f-5b41-4aac-82ae-9cf6b8b178a2', linkName:'虫垂炎の組織学的分類：4段階進行ガイド',           sortOrder:5},
  {slug:'ileal-pouch',             name:'回腸嚢',                                   sectionId:'gi',         url:'https://claude.ai/public/artifacts/2625d7f3-0864-4c7c-bdf8-4aee1da348e8', linkName:'ileal_pouch.html',                               sortOrder:6},
  {slug:'colorectal-lymph',        name:'大腸癌リンパ節',                            sectionId:'gi',         url:'https://claude.ai/public/artifacts/1d5cd8ee-093e-45ef-b60f-3b74c9dce1f5', linkName:'colorectal_lymph_nodes_final.html',              sortOrder:7},
  {slug:'crohn',                   name:'クローン病の病理診断',                       sectionId:'gi',         url:'https://claude.ai/public/artifacts/e885ce9c-65ca-48c3-a3a8-4ca15f8bc435', linkName:'クローン病の病理診断：完全解説ガイド',            sortOrder:8},
  // 肝胆膵
  {slug:'liver-cirrhosis',         name:'肝硬変',                                   sectionId:'hepato',     url:'https://claude.ai/public/artifacts/648ddc1d-16c9-476f-a42d-6a5934b27790', linkName:'liver_cirrhosis_classification.html',            sortOrder:1},
  {slug:'pancreas-mass',           name:'膵腫瘤',                                   sectionId:'hepato',     url:'https://claude.ai/public/artifacts/f79b470e-c0a7-4093-b7d5-db74a2b0e58e', linkName:'pancreatic_tail_ct.html',                        sortOrder:2},
  {slug:'cholecystitis',           name:'胆嚢炎',                                   sectionId:'hepato',     url:'https://claude.ai/public/artifacts/115c995b-e765-47cf-bb03-0660d44aed15', linkName:'cholecystitis_classification.html',              sortOrder:3},
  // 血液
  {slug:'lymph-node-struct',       name:'リンパ節正常構造',                          sectionId:'hema',       url:'https://claude.ai/public/artifacts/a1b240c0-a2e1-4489-bbf0-1de250fbfc7b', linkName:'lymph_node_structure.html',                      sortOrder:1},
  {slug:'dlbcl',                   name:'DLBCL 病理学習ツール',                      sectionId:'hema',       url:'https://claude.ai/public/artifacts/99e76080-1f0d-4772-943a-5906f4514f17', linkName:'DLBCL 診断・分類・IHC完全ガイド',                sortOrder:2},
  {slug:'lch-hema',                name:'LCH 病理診断レファレンス',                   sectionId:'hema',       url:'https://claude.ai/public/artifacts/f6d8f9d6-e6bd-40e7-9539-b9be8b0470e2', linkName:'LCH病理診断レファレンス',                         sortOrder:3},
  // 腎泌尿器
  {slug:'bladder-non-neo',         name:'膀胱・尿路非腫瘍性病変',                    sectionId:'uro',        url:'https://claude.ai/public/artifacts/df130ccc-2ab8-4575-872a-1087b6dc254f', linkName:'膀胱・尿路の非腫瘍性病変 診断ガイド',            sortOrder:1},
  {slug:'bladder-sarcoma',         name:'膀胱肉腫',                                 sectionId:'uro',        url:'https://claude.ai/public/artifacts/018dab4e-40f8-49b9-af31-9c57d47b151b', linkName:'bladder_sarcoma_ref.html',                       sortOrder:2},
  {slug:'bladder-spindle-flow',    name:'膀胱紡錘形細胞 診断フロー',                  sectionId:'uro',        url:'https://claude.ai/public/artifacts/d51e0683-a020-44ab-a376-f520bb11648c', linkName:'診断フロー全体 会話形式',                         sortOrder:3},
  {slug:'ccrcc-vs-chrcc',          name:'淡明細胞型 vs 嫌色素性腎細胞癌',             sectionId:'uro',        url:'https://claude.ai/public/artifacts/c8bbcb0c-7727-4261-8b9c-d2f37b7df39b', linkName:'ccrcc_vs_chrcc.html',                            sortOrder:4},
  {slug:'prostatitis',             name:'前立腺炎',                                 sectionId:'uro',        url:'https://claude.ai/public/artifacts/03bf6249-7718-4c34-91f2-bbd93e52bd9d', linkName:'前立腺炎 病理学習リファレンス',                   sortOrder:5},
  // 内分泌
  {slug:'ectopic-adrenal',         name:'小児の異所性副腎',                          sectionId:'endo',       url:'https://claude.ai/public/artifacts/6ab4606b-aa39-4f88-8ac4-f2bf1758ca3d', linkName:'小児の異所性副腎：病理学習リファレンス',           sortOrder:1},
  // 婦人科
  {slug:'ovarian-cyst',            name:'卵巣腫瘍',                                 sectionId:'gyneco',     url:'https://claude.ai/public/artifacts/eabea2ed-dbe0-4860-aeaf-01ef2b506f59', linkName:'ovarian_cysts_pathology.html',                   sortOrder:1},
  {slug:'endometrium-normal',      name:'子宮内膜（正常）',                           sectionId:'gyneco',     url:'https://claude.ai/public/artifacts/9b692e58-8f18-4ac9-934f-5d9ea6d4e84e', linkName:'子宮内膜病理学習リファレンス',                    sortOrder:2},
  {slug:'cin-p16',                 name:'子宮頸癌 CIN / p16',                        sectionId:'gyneco',     url:'https://claude.ai/public/artifacts/6889b282-c7e2-4d05-a74a-6a1defd8aedd', linkName:'cin2_p16_quiz.html',                             sortOrder:3},
  {slug:'endocervical-polyp',      name:'子宮頸管ポリープ',                          sectionId:'gyneco',     url:'https://claude.ai/public/artifacts/ca3ea58f-93f2-4d71-aed1-b409619a9f67', linkName:'endocervical_polyp.html',                        sortOrder:4},
  {slug:'legh',                    name:'LEGH（分節状頸管腺増殖症）',                  sectionId:'gyneco',     url:'https://claude.ai/public/artifacts/d73379e3-eb39-40b0-b2ab-55f081237a1e', linkName:'LEGH 病理診断ガイド',                            sortOrder:5},
  {slug:'endometrial-mpa',         name:'MPA療法後の子宮体癌',                        sectionId:'gyneco',     url:'https://claude.ai/public/artifacts/e166a473-af2f-46c2-8a68-5660f1331fd1', linkName:'MPA療法後の子宮体癌病理診断ガイド',               sortOrder:6},
  {slug:'endometrial-cancer',      name:'子宮体癌',                                  sectionId:'gyneco',     url:'https://claude.ai/public/artifacts/21b43327-f0b4-431c-8757-efd795f9a6ce', linkName:'endometrial_cancer.html',                        sortOrder:7},
  {slug:'leiomyoma',               name:'子宮筋腫',                                 sectionId:'gyneco',     url:'https://claude.ai/public/artifacts/17275bfc-615c-4dbb-985c-b02929ffd197', linkName:'uterine-leiomyoma.html',                         sortOrder:8},
  {slug:'ovary-normal',            name:'正常卵巣',                                 sectionId:'gyneco',     url:'https://claude.ai/public/artifacts/c1729825-d846-4d9e-8d0f-655de724d7c4', linkName:'正常卵巣の病理学習リファレンス',                   sortOrder:9},
  // 乳腺
  {slug:'breast-overview',         name:'乳腺良性病変 概要',                          sectionId:'breast',     url:'https://claude.ai/public/artifacts/a93fd9c3-4b20-493e-8e63-a533058c0d6a', linkName:'breast_map.html',                                sortOrder:1},
  {slug:'granuloma-mastitis',      name:'肉芽腫性乳腺炎',                             sectionId:'breast',     url:'https://claude.ai/public/artifacts/dac500d8-55d1-4deb-9295-646681fcaa52', linkName:'granulomatous_mastitis.html',                    sortOrder:2},
  {slug:'breast-cancer-overview',  name:'乳癌 概要',                                 sectionId:'breast',     url:'https://claude.ai/public/artifacts/85b53498-5d94-49e6-b7c8-8ab9e6fbf80f', linkName:'breast_cancer_overview.html',                    sortOrder:3},
  {slug:'apocrine-ca',             name:'アポクリン癌',                              sectionId:'breast',     url:'https://claude.ai/public/artifacts/809f0b80-473d-489a-b750-746df9f3a3b4', linkName:'乳腺アポクリン癌の病理診断ガイド',                sortOrder:4},
  {slug:'breast-ihc',              name:'乳腺IHCマーカー解説',                        sectionId:'breast',     url:'https://claude.ai/public/artifacts/113d92bd-5e06-42aa-a37a-1f160519cbe6', linkName:'乳腺免疫染色（IHC）マーカー解説ガイド',           sortOrder:5},
  // 皮膚
  {slug:'melanoma',                name:'悪性黒色腫 / メラノーマ',                    sectionId:'skin',       url:'https://claude.ai/public/artifacts/56d61938-0dba-4ff7-afbc-18b27c98aeb3', linkName:'melanoma_overview_japanese.html',                sortOrder:1},
  {slug:'dermatofibroma',          name:'皮膚線維腫',                                sectionId:'skin',       url:'https://claude.ai/public/artifacts/ea30a634-303d-473e-ad2f-b4aca9c0c5c9', linkName:'dermatofibroma_ref.html',                        sortOrder:2},
  {slug:'pg-pg',                   name:'壊疽性膿皮症',                              sectionId:'skin',       url:'https://claude.ai/public/artifacts/4cfef6f0-996e-420c-bc3d-8f25333ae778', linkName:'pg_learning.html',                               sortOrder:3},
  {slug:'deep-mycosis',            name:'深在性真菌症',                              sectionId:'skin',       url:'https://claude.ai/public/artifacts/5c4c4538-6286-4d7b-8d88-0b709cc78e3b', linkName:'deep_mycosis.html',                              sortOrder:4},
  {slug:'mycosis-fung',            name:'菌状息肉腫',                               sectionId:'skin',       url:'https://claude.ai/public/artifacts/fcfd1493-d83c-41f8-84e7-4b02d621935b', linkName:'mycosis-fungoides.html',                         sortOrder:5},
  {slug:'sebaceous-ca',            name:'脂腺癌',                                   sectionId:'skin',       url:'https://claude.ai/public/artifacts/12617318-1236-40c6-9cdf-354f09117d3c', linkName:'sebaceous_carcinoma.html',                       sortOrder:6},
  {slug:'soft-fibroma',            name:'軟線維腫',                                 sectionId:'skin',       url:'https://claude.ai/public/artifacts/40fb57db-1529-4419-af0a-302cc588d3a0', linkName:'soft_fibroma_explainer.html',                    sortOrder:7},
  {slug:'livedoid-vasc',           name:'血栓性微小血管障害',                         sectionId:'skin',       url:'https://claude.ai/public/artifacts/aeaa8896-a94e-4420-9069-4be70db5829e', linkName:'Livedoid Vasculopathy: Pathology Guide',         sortOrder:8},
  {slug:'hybrid-cysts',            name:'ハイブリッド嚢胞',                          sectionId:'skin',       url:'https://claude.ai/public/artifacts/2501600e-2f44-41af-80fd-344d9e12444a', linkName:'hybrid_cysts.html',                              sortOrder:9},
  {slug:'lobular-cap-hema',        name:'分葉状毛細血管血管腫 / 化膿性肉芽腫',         sectionId:'skin',       url:'https://claude.ai/public/artifacts/953d8195-18a6-4aa6-bd83-e869e8920f52', linkName:'lobular-capillary-hemangioma.html',              sortOrder:10},
  // 整形外科
  {slug:'dupuytren',               name:'デュピュイトラン拘縮',                       sectionId:'ortho',      url:'https://claude.ai/public/artifacts/8fa2d7e5-c8d4-4a07-b02c-eb93222c9cfb', linkName:'dupuytren.html',                                 sortOrder:1},
  // 免疫染色
  {slug:'sox10-s100',              name:'SOX10 & S100',                             sectionId:'ihc',        url:'https://claude.ai/public/artifacts/0e94322c-1882-4009-acc1-6dcbbe555805', linkName:'S100 vs SOX10: メラノーマIHC診断ガイド',          sortOrder:1},
  {slug:'erg-cd31',                name:'ERG & CD31',                               sectionId:'ihc',        url:'https://claude.ai/public/artifacts/95e26588-d8ee-42a4-8f78-4e6cf306122e', linkName:'erg_cd31_reference.html',                        sortOrder:2},
  {slug:'breast-ihc-cross',        name:'乳腺IHCマーカー',                           sectionId:'ihc',        url:'https://claude.ai/public/artifacts/113d92bd-5e06-42aa-a37a-1f160519cbe6', linkName:'乳腺免疫染色（IHC）マーカー解説ガイド',           sortOrder:3},
  // 分子異常
  {slug:'braf-kras',               name:'BRAF / KRAS',                              sectionId:'mol',        url:'https://claude.ai/public/artifacts/62ecfc6c-cb8f-4751-8f65-b91d92b6ea7c', linkName:'braf_kras_reference.html',                       sortOrder:1},
  // 遺伝性疾患
  {slug:'pjs',                     name:'ポイツ・イェガース症候群',                    sectionId:'genetic',    url:'https://claude.ai/public/artifacts/39beec34-e98b-4b7f-92e3-7c470a50216f', linkName:'pjs_reference.html',                             sortOrder:1},
  {slug:'nf1',                     name:'NF1 神経線維腫症1型',                        sectionId:'genetic',    url:'https://claude.ai/public/artifacts/c565cf9d-a53e-405a-8f26-487d1643f671', linkName:'NF1病理学習：神経線維腫症1型の完全ガイド',        sortOrder:2},
  // 感染症
  {slug:'syphilis',                name:'梅毒',                                     sectionId:'infect',     url:'https://claude.ai/public/artifacts/f003c05d-73e4-4a48-9ede-16a0271239a7', linkName:'梅毒病理学習ガイド：Warthin-Starry染色',          sortOrder:1},
  {slug:'ntm-mac',                 name:'NTM / MAC',                                sectionId:'infect',     url:'https://claude.ai/public/artifacts/21eb285c-99af-48be-ac03-e3663abebde8', linkName:'ntm_mac_reference.html',                         sortOrder:2},
  // 用語・所見集
  {slug:'paradox-mat',             name:'逆説的成熟現象',                             sectionId:'terms',      url:'https://claude.ai/public/artifacts/c261f48f-1951-4735-bcfe-5f6d69dd6588', linkName:'paradoxical_maturation.html',                    sortOrder:1},
  {slug:'thyroid-mol-symp',        name:'甲状腺シンポジウム 分子病理',                 sectionId:'terms',      url:'https://claude.ai/public/artifacts/3ad82731-7c9f-41f4-8909-721aacb5f4ed', linkName:'甲状腺分子病理シンポジウム学習参照ガイド',        sortOrder:2},
  {slug:'grenz-zone',              name:'Grenz zone',                               sectionId:'terms',      url:'https://claude.ai/public/artifacts/f24b327d-ede7-42f0-8bdb-7f5df6802f61', linkName:'grenz_zone.html',                                sortOrder:3},
  {slug:'macrophage-names',        name:'マクロファージの呼称',                        sectionId:'terms',      url:'https://claude.ai/public/artifacts/c1868a8e-1324-4508-9a8a-4d07f9613d70', linkName:'マクロファージ・組織球・泡沫細胞の違い',          sortOrder:4},
  {slug:'eosinophil',              name:'好酸球',                                   sectionId:'terms',      url:'https://claude.ai/public/artifacts/2be7eb60-7c85-473f-a7b2-69da99cc5713', linkName:'好酸球の成熟過程と病的増多の鑑別',                sortOrder:5},
  {slug:'fibroma-explorer',        name:'線維腫 整理',                               sectionId:'terms',      url:'https://claude.ai/public/artifacts/2b1e55d8-6de5-4c6f-8705-da592bd57d7d', linkName:'fibroma-explorer.jsx',                           sortOrder:6},
  // 核医学検査
  {slug:'fdg-pet-ga',              name:'FDG-PET & ガリウムシンチ',                   sectionId:'nuclear-med',url:'https://claude.ai/public/artifacts/24640bc0-d2b4-4bd4-9ecb-1fcfa72c851f', linkName:'pet_gallium_archfact_complete.html',             sortOrder:1},
  // 画像検査
  {slug:'mri-signal',              name:'MRI信号強度 学習ツール',                      sectionId:'imaging',    url:'https://claude.ai/public/artifacts/a6f94d07-96f8-47b2-bab9-74b1774deb28', linkName:'MRI Signal Intensity Learning Tool',             sortOrder:1},
];

// ══════════════════════════════════════
//  Firebase への書き込み
// ══════════════════════════════════════
async function migrate() {
  const now = Date.now();
  const updates = {};

  // sections
  for (const sec of sectionsRaw) {
    const {id, ...rest} = sec;
    updates[`sections/${id}`] = rest;
  }

  // items
  for (const item of itemsRaw) {
    const {slug, ...rest} = item;
    updates[`items/${slug}`] = {
      ...rest,
      createdAt: now,
      updatedAt: now
    };
  }

  console.log(`sections: ${sectionsRaw.length} 件`);
  console.log(`items: ${itemsRaw.length} 件`);
  console.log('Firebase へ書き込み中...');

  await db.ref().update(updates);
  console.log('完了しました！');
  process.exit(0);
}

migrate().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
