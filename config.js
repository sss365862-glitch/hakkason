// ============================================================
// 設定だけを書くファイル（文章・名前・色・画像はここを直す）
// ============================================================

// 待ち時間など
const SETTINGS = {
  apiTimeoutMs: 4000,     // Geminiを待つ最大時間（4秒）。過ぎたら予備ルート
  thoughtReadMs: 1000,    // 思考の文字を読ませる時間（0.8〜1.2秒の目安）
};

// 名前の接頭語（形態1〜4）。全系統で共通
// ここの数が形態の数になる（4つ＝孵化＋進化3回）。最後の形態で爆発する
const PREFIXES = ["", "超", "究極超絶", "終焉究極超絶"];

// 感情の系統。images に画像のパスを入れると、その形態だけ画像で表示する
// 例：images: ["aseri1.png", "aseri2.png", "", ""]
// 空欄や読み込み失敗のときは図形で表示する
const EMOTIONS = {
  "焦り":     { shape: "triangle", color: "#f5c518", base: "アセリム", images: ["aseri1.webp", "aseri2.webp", "aseri3.webp", "aseri4.webp"] },
  "恐怖":     { shape: "diamond",  color: "#9b5de5", base: "コワルム", images: ["kowarum1.webp", "kowarum2.webp", "kowarum3.webp", "kowarum4.webp"] },
  "怒り":     { shape: "star",     color: "#ef233c", base: "イカルム", images: ["ikarum1.webp", "ikarum2.webp", "ikarum3.webp", "ikarum4.webp"] },
  "恥ずかしさ": { shape: "circle",   color: "#ff70a6", base: "テレム",   images: ["terem1.webp", "terem2.webp", "terem3.webp", "terem4.webp"] },
  "後悔":     { shape: "square",   color: "#3a86ff", base: "クイルム", images: ["kuirum1.webp", "kuirum2.webp", "kuirum3.webp", "kuirum4.webp"] },
};

// 予備ルート（AIが応答しないとき）。「遅刻した」の1本だけ
const SAMPLE_ROUTE = {
  first: "遅刻した",
  emotion: "焦り",
  // 進化の回数と同じ数（3つ）
  thoughts: [
    "出席確認、終わったかも",
    "次も遅刻したら単位落とすかも",
    "留年したらどうしよう",
  ],
};

// AIの返答にこの言葉が入っていたら使わずに予備ルートへ（実在の名前対策）
const NG_WORDS = [
  "LINE", "Instagram", "インスタ", "TikTok", "Twitter", "YouTube", "Google", "Apple", "iPhone", "Amazon",
  "ポケモン", "ドラえもん", "ディズニー", "ジブリ", "マリオ", "ドラクエ",
];
