"use strict";

const express = require("express");
const {
  createDocument,
  updateDocument,
  deleteDocument,
} = require("../services/vectorMemoryService");

const router = express.Router();

function omitEmbedding(document) {
  if (!document || typeof document !== "object") {
    return document;
  }
  const { embedding, ...publicDocument } = document;
  return publicDocument;
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
    const created = await createDocument(req.body);
    return res.status(201).json({ status: "ok", data: omitEmbedding(created) });
  } catch (error) {
    console.error("moonmindMemory.createDoc.error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    const status =
      error.name === "ValidationError"
        ? 400
        : error.name === "NotFoundError"
          ? 404
          : error.name === "EmbeddingError"
            ? 502
            : 500;
    return res.status(status).json({
      status: "error",
      message: error.message,
      error: { name: error.name },
    });
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
    const status =
      error.name === "ValidationError"
        ? 400
        : error.name === "NotFoundError"
          ? 404
          : error.name === "EmbeddingError"
            ? 502
            : 500;
    return res.status(status).json({
      status: "error",
      message: error.message,
      error: { name: error.name },
    });
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
    const status =
      error.name === "ValidationError"
        ? 400
        : error.name === "NotFoundError"
          ? 404
          : 500;
    return res.status(status).json({
      status: "error",
      message: error.message,
      error: { name: error.name },
    });
  }
});

module.exports = router;
