const test = require("node:test");
const assert = require("node:assert/strict");

const { buildMessages } = require("../src/moonmind/responseGenerator");

test("buildMessages marks no-doc state and instructs non-generic response", () => {
  const messages = buildMessages({
    query: "Does Ayan have an oracle certification?",
    documents: [],
    intent: "question",
  });

  assert.equal(Array.isArray(messages), true);
  assert.equal(messages.length, 2);
  assert.match(
    messages[0].content,
    /do NOT return a generic refusal/i,
  );
  assert.match(
    messages[0].content,
    /answer the user's actual query/i,
  );

  const payload = JSON.parse(messages[1].content);
  assert.equal(payload.no_documents_found, true);
});

test("buildMessages includes greeting-only handling guidance", () => {
  const messages = buildMessages({
    query: "Hi",
    documents: [],
    intent: "greeting",
  });

  assert.match(
    messages[0].content,
    /greeting-only, return a friendly greeting/i,
  );
});
