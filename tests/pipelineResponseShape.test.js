const test = require("node:test");
const assert = require("node:assert/strict");

const { buildResponseDocuments } = require("../src/moonmind/pipeline");

test("buildResponseDocuments removes summary_for_embedding and keeps content_full", () => {
  const documents = [
    {
      id: "doc-1",
      title: "Doc",
      summary_for_embedding: "Internal summary only",
      content_full: "Public content",
      score: 0.91,
      metadata: { domain: "skills" },
    },
  ];

  const responseDocuments = buildResponseDocuments(documents);

  assert.equal(responseDocuments.length, 1);
  assert.equal(responseDocuments[0].content_full, "Public content");
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      responseDocuments[0],
      "summary_for_embedding",
    ),
    false,
  );
});

test("buildResponseDocuments always includes content_full in response shape", () => {
  const documents = [
    {
      id: "doc-2",
      title: "Doc 2",
      summary_for_embedding: "Internal summary only",
      score: 0.5,
      metadata: { domain: "projects" },
    },
  ];

  const responseDocuments = buildResponseDocuments(documents);

  assert.equal(
    Object.prototype.hasOwnProperty.call(responseDocuments[0], "content_full"),
    true,
  );
  assert.equal(responseDocuments[0].content_full, null);
});
