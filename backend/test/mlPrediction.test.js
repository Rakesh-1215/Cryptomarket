const test = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("../server");

async function withServer(callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    return await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("predictable coins endpoint exposes the supported ML universe", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai/predictable-coins`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.ok(Array.isArray(payload.coins));
    assert.ok(payload.coins.length > 0);
    assert.ok(payload.coins.some((coin) => coin.symbol === "BTC"));
  });
});

test("health endpoint reports the ML backend status", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai/health`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.ok(typeof payload.python === "string");
    assert.ok(typeof payload.message === "string");
  });
});

test("prediction endpoint returns evaluation and explainability details", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai/price-prediction?symbol=BTC&days=90`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.ok(payload.evaluation);
    assert.ok(payload.explainability);
    assert.ok(payload.evaluation.regression);
    assert.ok(payload.explanation);
  });
});
