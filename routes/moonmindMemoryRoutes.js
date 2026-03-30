"use strict";

const express = require("express");
const {
  createDocument,
  updateDocument,
  deleteDocument,
} = require("../services/vectorMemoryService");
const {
  requireMoonMindPassword,
} = require("../src/middleware/moonmindPasswordAuth");

const router = express.Router();
router.use(requireMoonMindPassword);

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
 *     tags: [MoonMind Vector Docs]
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
 *     tags: [MoonMind Vector Docs]
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
 *       207:
 *         description: Partial success (some created, some failed)
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate document id conflict
 *       502:
 *         description: Embedding provider error
 *       500:
 *         description: Server error
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
 *     tags: [MoonMind Vector Docs]
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
 *       404:
 *         description: Document not found
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

module.exports = router;
