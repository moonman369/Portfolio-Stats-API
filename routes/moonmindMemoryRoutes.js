"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  createDocument,
  updateDocument,
  deleteDocument,
  regenerateDocumentEmbedding,
  regenerateAllEmbeddings,
} = require("../services/vectorMemoryService");
const {
  requireMoonMindPassword,
} = require("../src/middleware/moonmindPasswordAuth");

const router = express.Router();
router.use(requireMoonMindPassword);

// Defense-in-depth on the embedding endpoints: they are authenticated, but each
// call fans out to a paid, rate-limited Gemini API, and the bulk variant can
// issue one request per document in the collection.
const embeddingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many embedding requests, please retry later",
    error: { name: "RateLimitError" },
  },
});

function omitEmbedding(document) {
  if (!document || typeof document !== "object") {
    return document;
  }
  const { embedding, ...publicDocument } = document;
  return publicDocument;
}

function createValidationError(message) {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
}

function isDuplicateKeyError(error) {
  return (
    error?.code === 11000 ||
    /E11000 duplicate key error/i.test(error?.message || "")
  );
}

function serializeRouteError(error) {
  if (isDuplicateKeyError(error)) {
    return {
      name: "ConflictError",
      message: "Document already exists for provided id",
      status: 409,
    };
  }

  if (error?.name === "ValidationError") {
    return { name: error.name, message: error.message, status: 400 };
  }

  if (error?.name === "NotFoundError") {
    return { name: error.name, message: error.message, status: 404 };
  }

  if (error?.name === "EmbeddingError") {
    return { name: error.name, message: error.message, status: 502 };
  }

  // Gemini quota exhausted after the adapter's retries were spent.
  if (error?.name === "RateLimitError") {
    return { name: error.name, message: error.message, status: 429 };
  }

  return {
    name: error?.name || "InternalError",
    message: error?.message || "Server Error",
    status: 500,
  };
}

function sendErrorResponse(res, error) {
  const serialized = serializeRouteError(error);
  return res.status(serialized.status).json({
    status: "error",
    message: serialized.message,
    error: { name: serialized.name },
  });
}

async function createDoc(payload) {
  const created = await createDocument(payload);
  return omitEmbedding(created);
}

/**
 * @swagger
 * /api/v1/moonmind/createDoc:
 *   post:
 *     summary: Create a vector memory document
 *     description: >
 *       Validates the payload, embeds title + tags + summary + content with
 *       Gemini, then persists the document and its vector.
 *     tags: [MoonMind Vector Docs]
 *     security:
 *       - MoonMindPassword: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VectorDocumentPayload'
 *     responses:
 *       201:
 *         description: Document created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VectorDocumentSuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Dependency not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       502:
 *         description: Embedding provider error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/createDoc", async (req, res) => {
  try {
    const created = await createDoc(req.body);
    return res.status(201).json({ status: "ok", data: created });
  } catch (error) {
    console.error("moonmindMemory.createDoc.error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    return sendErrorResponse(res, error);
  }
});

/**
 * @swagger
 * /api/v1/moonmind/bulkCreateDoc:
 *   post:
 *     summary: Bulk create vector memory documents
 *     description: >
 *       Documents are created one at a time. A failure on one document does not
 *       abort the rest; failures are returned in `errors`, keyed by array index.
 *     tags: [MoonMind Vector Docs]
 *     security:
 *       - MoonMindPassword: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             minItems: 1
 *             items:
 *               $ref: '#/components/schemas/VectorDocumentPayload'
 *     responses:
 *       201:
 *         description: All documents created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkCreateResponse'
 *       207:
 *         description: Partial success (some created, some failed)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkCreateResponse'
 *       400:
 *         description: Validation error (body is not a non-empty array)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Duplicate document id conflict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkCreateResponse'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       502:
 *         $ref: '#/components/responses/EmbeddingProviderError'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/bulkCreateDoc", async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      throw createValidationError(
        "Request body must be an array of document payloads",
      );
    }

    if (req.body.length === 0) {
      throw createValidationError(
        "Request body array must contain at least one document payload",
      );
    }

    const created = [];
    const errors = [];

    for (let index = 0; index < req.body.length; index += 1) {
      try {
        const createdDoc = await createDoc(req.body[index]);
        created.push(createdDoc);
      } catch (error) {
        const serialized = serializeRouteError(error);
        errors.push({
          index,
          status: serialized.status,
          message: serialized.message,
          error: { name: serialized.name },
        });
      }
    }

    if (errors.length === 0) {
      return res.status(201).json({ status: "ok", data: created });
    }

    if (created.length > 0) {
      return res.status(207).json({
        status: "partial",
        data: created,
        errors,
      });
    }

    const hasMixedErrorStatuses = errors.some(
      (failure) => failure.status !== errors[0].status,
    );
    const status = hasMixedErrorStatuses ? 500 : errors[0].status;

    return res.status(status).json({
      status: "error",
      message: "Bulk create failed for all documents",
      errors,
    });
  } catch (error) {
    console.error("moonmindMemory.bulkCreateDoc.error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    return sendErrorResponse(res, error);
  }
});

/**
 * @swagger
 * /api/v1/moonmind/updateDoc:
 *   put:
 *     summary: Update an existing vector memory document
 *     description: >
 *       Re-embeds only when the embedding input (title, tags, summary or
 *       content_full) actually changed, or when the stored document has no
 *       vector yet.
 *     tags: [MoonMind Vector Docs]
 *     security:
 *       - MoonMindPassword: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VectorDocumentPayload'
 *     responses:
 *       200:
 *         description: Document updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VectorDocumentSuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       502:
 *         description: Embedding provider error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.put("/updateDoc", async (req, res) => {
  try {
    const updated = await updateDocument(req.body);
    return res.status(200).json({ status: "ok", data: omitEmbedding(updated) });
  } catch (error) {
    console.error("moonmindMemory.updateDoc.error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    return sendErrorResponse(res, error);
  }
});

/**
 * @swagger
 * /api/v1/moonmind/deleteDoc:
 *   delete:
 *     summary: Delete a vector memory document
 *     tags: [MoonMind Vector Docs]
 *     security:
 *       - MoonMindPassword: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VectorDeletePayload'
 *     responses:
 *       200:
 *         description: Document deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VectorDeleteSuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.delete("/deleteDoc", async (req, res) => {
  try {
    const result = await deleteDocument(req.body);
    return res.status(200).json({ status: "ok", data: omitEmbedding(result) });
  } catch (error) {
    console.error("moonmindMemory.deleteDoc.error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    return sendErrorResponse(res, error);
  }
});

/**
 * @swagger
 * /api/v1/moonmind/documents/embeddings/regenerate:
 *   post:
 *     summary: Regenerate embeddings for all documents
 *     description: >
 *       Re-embeds every document in the vector collection with Gemini.
 *       Set `onlyMissing` to true to embed only documents that have no vector
 *       yet. Documents are processed sequentially; per-document failures are
 *       reported in `failures` without aborting the run.
 *
 *
 *       Rate limited to 10 requests per 15 minutes. For an initial backfill of a
 *       large collection prefer `node scripts/reembed.js --only-missing`, which
 *       is not subject to an HTTP proxy read timeout.
 *     tags: [MoonMind Embeddings]
 *     security:
 *       - MoonMindPassword: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmbeddingRegenerateRequest'
 *     responses:
 *       200:
 *         description: All documents re-embedded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmbeddingRegenerateResponse'
 *       207:
 *         description: Partial success (some documents failed)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmbeddingRegenerateResponse'
 *       400:
 *         description: Validation error (onlyMissing is not a boolean)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       502:
 *         description: Embedding regeneration failed for every document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmbeddingRegenerateResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/documents/embeddings/regenerate", embeddingRateLimiter, async (req, res) => {
  try {
    const { onlyMissing } = req.body || {};

    if (onlyMissing !== undefined && typeof onlyMissing !== "boolean") {
      throw createValidationError("onlyMissing must be a boolean");
    }

    const result = await regenerateAllEmbeddings({
      onlyMissing: Boolean(onlyMissing),
    });

    // Nothing succeeded and something failed: surface it as an outright error.
    if (result.updated === 0 && result.failed > 0) {
      return res.status(502).json({
        status: "error",
        message: "Embedding regeneration failed for all documents",
        data: result,
      });
    }

    return res.status(result.failed > 0 ? 207 : 200).json({
      status: result.failed > 0 ? "partial" : "ok",
      data: result,
    });
  } catch (error) {
    console.error("moonmindMemory.regenerateAllEmbeddings.error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    return sendErrorResponse(res, error);
  }
});

/**
 * @swagger
 * /api/v1/moonmind/documents/{id}/embedding:
 *   post:
 *     summary: Regenerate the embedding for a single document
 *     description: >
 *       Re-embeds one document in place with Gemini, rewriting only `embedding`
 *       and `updated_at`. Rate limited to 10 requests per 15 minutes.
 *     tags: [MoonMind Embeddings]
 *     security:
 *       - MoonMindPassword: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID of the document to re-embed.
 *         schema:
 *           type: string
 *           format: uuid
 *         example: f95f41ee-2dfb-4ba8-a724-8083c0f06910
 *     responses:
 *       200:
 *         description: Embedding regenerated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleEmbeddingResponse'
 *       400:
 *         description: Validation error (id is not a valid UUID)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       502:
 *         $ref: '#/components/responses/EmbeddingProviderError'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/documents/:id/embedding", embeddingRateLimiter, async (req, res) => {
  try {
    const result = await regenerateDocumentEmbedding(req.params.id);
    return res.status(200).json({ status: "ok", data: result });
  } catch (error) {
    console.error("moonmindMemory.regenerateDocumentEmbedding.error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    return sendErrorResponse(res, error);
  }
});

module.exports = router;
