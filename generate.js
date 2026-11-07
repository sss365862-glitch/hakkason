// ============================================================
// Vercel側の小さな処理：入力された一言をGeminiに送り、
// 感情1つと、次に浮かぶ思考（進化の回数分。今は3つ）を返す
// APIキー：環境変数 GEMINI_API_KEY（ファイルには書かない）
// モデル　：環境変数 GEMINI_MODEL（未設定なら gemini-3.5-flash-lite）
// ============================================================

const EMOTIONS = ["焦り", "恐怖", "怒り", "恥ずかしさ", "後悔"];

function buildPrompt(text, n) {
  const empty = Array(n).fill('""').join(",");
  return `ユーザーが小さな不安を一言入力しました：「${text}」

この一言から、次の2つを作ってください。
1. emotion：一番近い感情を、次の5つから1つだけ選ぶ → ${EMOTIONS.join("・")}
2. thoughts：この一言のあとに頭に浮かぶ思考を${n}つ。
   - 1つ目は入力の一言を受けて、2つ目以降は一つ前の思考を受けて、少しずつ大げさに飛躍させる
   - ${n}つ目が一番大きな不安になるようにする
   - それぞれ20文字前後の短い一言。想像として書く
   - 入力の一言そのものは書き直さない

ルール：
- 実在の企業名・人名・商品名・サービス名・作品名・キャラクター名を使わない
- 暴力・差別・性的な内容、自分を傷つける内容は書かない
- 日本語で書く

次のJSONだけを返してください：
{"emotion":"","thoughts":[${empty}]}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 20) : "";
  if (!text) {
    res.status(400).json({ error: "empty text" });
    return;
  }

  const count = Math.min(6, Math.max(1, parseInt(req.body?.count, 10) || 3)); // 思考の数（進化の回数）

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "no api key" });
    return;
  }
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(text, count) }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
        }),
      }
    );
    if (!r.ok) {
      res.status(502).json({ error: "gemini " + r.status });
      return;
    }
    const json = await r.json();
    const out = JSON.parse(json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    res.status(200).json({ emotion: out.emotion, thoughts: out.thoughts });
  } catch (e) {
    res.status(502).json({ error: "gemini failed" });
  }
}
