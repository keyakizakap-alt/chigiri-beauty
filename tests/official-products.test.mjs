import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../data/official-products.ts", import.meta.url), "utf8");
const expansionSource = await readFile(new URL("../data/specialist-catalog-expansion.ts", import.meta.url), "utf8");
const expansionRows = [...expansionSource.matchAll(/^  \["([^"]+)", "([^"]+)", "[^"]+", "([^"]+)".*?"(https:\/\/[^"\s]+)"/gm)];
const ids = [
  ...[...source.matchAll(/\n    id: "([^"]+)"/g)].map((match) => match[1]),
  ...expansionRows.map((match) => match[1]),
];
const urls = [
  ...[...source.matchAll(/\n    officialUrl: "([^"]+)"/g)].map((match) => match[1]),
  ...expansionRows.map((match) => match[4]),
];
const brands = [
  ...[...source.matchAll(/\n    brand: "([^"]+)"/g)].map((match) => match[1]),
  ...expansionRows.map((match) => match[2]),
];

const allowedOfficialHosts = new Set([
  "jp.rohto.com",
  "www.kao-kirei.com",
  "torriden.jp",
  "etvos.com",
  "www.shiseido.co.jp",
  "www.muji.com",
  "www.fancl.co.jp",
  "anuashop.jp",
  "vtcosmetics.jp",
  "tirtir.co.jp",
  "manyo-japanese.com",
  "www.cosrx.com",
  "www.daiichisankyo-hc.co.jp",
  "www.nivea.co.jp",
  "www.canmake.com",
  "www.cezanne.co.jp",
  "www.nomorerules.net",
  "maquillage.shiseido.co.jp",
  "ukakau.com",
  "www.kose.co.jp",
  "www.kracie.co.jp",
  "salon.shiseido.co.jp",
  "www.nivea.co.jp",
]);

test("catalog has at least 250 unique official products", () => {
  assert.ok(ids.length >= 250);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(urls.length, ids.length);
  assert.equal(brands.length, ids.length);
});

test("every source URL is HTTPS and belongs to an approved official host", () => {
  for (const value of urls) {
    const url = new URL(value);
    assert.equal(url.protocol, "https:");
    assert.ok(allowedOfficialHosts.has(url.hostname), `unapproved source host: ${url.hostname}`);
  }
});

test("catalog includes major Japanese and Korean brand coverage", () => {
  const uniqueBrands = new Set(brands);
  for (const brand of ["肌ラボ", "ELIXIR", "無印良品", "FANCL", "ANESSA"]) {
    assert.ok(uniqueBrands.has(brand), `missing Japanese brand: ${brand}`);
  }
  for (const brand of ["Torriden", "Anua", "VT", "TIRTIR", "ma:nyo", "COSRX"]) {
    assert.ok(uniqueBrands.has(brand), `missing Korean brand: ${brand}`);
  }
});

test("catalog covers every specialist with several official products", () => {
  const categories = [
    ...[...source.matchAll(/\n    category: "([^"]+)"/g)].map((match) => match[1]),
    ...expansionRows.map((match) => match[3]),
  ];
  const coverage = {
    hair: ["hair_shampoo", "hair_treatment", "scalp_care"],
    body: ["body_moisturizer", "body_uv"],
    makeup: ["makeup_base", "face_powder", "lip_color"],
    nail: ["nail_oil", "nail_color", "hand_cream", "cuticle_care"],
  };
  for (const [specialist, allowed] of Object.entries(coverage)) {
    const count = categories.filter((category) => allowed.includes(category)).length;
    assert.ok(count >= 50, `${specialist} has only ${count} products`);
  }
});

test("large catalog is progressively rendered on mobile-friendly batches", async () => {
  const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
  assert.match(component, /visibleProducts\.slice\(0, catalogLimit\)/);
  assert.match(component, /さらに表示/);
  assert.match(component, /current \+ 60/);
  assert.match(component, /brandSearchAliases/);
  assert.match(component, /recommendationTags/);
});

test("chat renders verified recommendation cards from the server response", async () => {
  const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
  const router = await readFile(new URL("../server/orca.ts", import.meta.url), "utf8");
  assert.match(component, /message-products/);
  assert.match(component, /data\.recommendedProducts/);
  assert.match(router, /rankOfficialProducts/);
  assert.match(router, /公式製品候補/);
});

test("recommendation UI separates product details, purchase action, and evidence", async () => {
  const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
  assert.match(component, /どんなアイテム？/);
  assert.match(component, /公式サイトで購入する/);
  assert.match(component, /公式サイトで購入先を確認/);
  assert.match(component, /商品情報を確認/);
  assert.match(component, /noopener noreferrer/);
});

test("CHIGIRI PLAN generates 100 combinations, compares the top three, and returns one", async () => {
  const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
  assert.match(component, /careFocuses\.flatMap/);
  assert.match(component, /lifeRhythms\.flatMap/);
  assert.match(component, /shoppingStyles\.map/);
  assert.match(component, /selectBestFromTopThree/);
  assert.match(component, /plans\.slice\(0, 3\)/);
  assert.match(component, /まずはこの内容で試してみましょう/);
  assert.doesNotMatch(component, /Background comparison complete/);
  assert.doesNotMatch(component, /次の3案/);
});

test("chat stays available after a proposal and offers refinement prompts", async () => {
  const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
  assert.match(component, /気になる点や変えたいことを入力/);
  assert.match(component, /もっと予算を抑えたい/);
  assert.match(component, /買い足しなしで考えたい/);
  assert.doesNotMatch(component, /stage === "complete"\) return/);
  assert.doesNotMatch(component, /stage === "inventory" \|\| stage === "complete"/);
});

test("chat history can be opened and closed from the mobile header", async () => {
  const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(component, /mobile-history-button/);
  assert.match(component, /相談履歴を開く/);
  assert.match(component, /history-backdrop/);
  assert.match(styles, /\.rail\.mobile-open/);
  assert.match(styles, /\.history-backdrop\.visible/);
});

test("chat supports safe image attachment and a removable preview", async () => {
  const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
  const uploadRoute = await readFile(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8");
  assert.match(component, /type="file"/);
  assert.match(component, /pendingImages/);
  assert.match(component, /message-images/);
  assert.match(component, /image\/jpeg,image\/png,image\/webp/);
  assert.match(uploadRoute, /image\/jpeg/);
  assert.match(uploadRoute, /5 \* 1024 \* 1024/);
  assert.match(uploadRoute, /X-Content-Type-Options/);
});

test("every specialist exposes ingredient, comparison, timing, and review guidance", async () => {
  const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
  const insights = await readFile(new URL("../data/product-insights.ts", import.meta.url), "utf8");
  const reviewRoute = await readFile(new URL("../app/api/reviews/route.ts", import.meta.url), "utf8");
  const reviewEvidence = await readFile(new URL("../server/review-evidence.ts", import.meta.url), "utf8");
  for (const phrase of ["気になる成分と役割", "合わないと感じたら", "使い心地を見直す時期", "手持ちとの違い", "口コミを確認する"]) {
    assert.match(component, new RegExp(phrase));
  }
  for (const category of ["hair_shampoo", "hair_treatment", "scalp_care", "body_moisturizer", "body_uv", "makeup_base", "face_powder", "lip_color", "nail_oil", "nail_color", "hand_cream", "cuticle_care"]) {
    assert.match(insights, new RegExp(`${category}:`));
  }
  assert.match(component, /全成分表示を撮って相談する/);
  assert.match(reviewEvidence, /RAKUTEN_APPLICATION_ID/);
  assert.match(reviewEvidence, /RAKUTEN_ACCESS_KEY/);
  assert.match(reviewRoute, /productId/);
  assert.doesNotMatch(reviewRoute, /searchParams\.get\("keyword"\)/);
});

test("review UI links to sources without copying review text", async () => {
  const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
  const reviewEvidence = await readFile(new URL("../server/review-evidence.ts", import.meta.url), "utf8");
  for (const source of ["LIPS", "@cosme", "Qoo10", "楽天市場", "Amazon"]) assert.match(component, new RegExp(source));
  assert.match(component, /確認するサイト/);
  assert.match(component, /口コミは個人の感想/);
  assert.match(component, /proposal-review/);
  assert.match(component, /recommendationReviews/);
  assert.match(reviewEvidence, /reviewAverage/);
  assert.match(reviewEvidence, /reviewCount/);
  assert.match(reviewEvidence, /AbortController/);
  for (const key of ["lips", "cosme", "qoo10", "rakuten", "amazon"]) assert.match(reviewEvidence, new RegExp(`${key}:`));
});
