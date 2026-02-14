"use strict";

const express = require("express");
const {
  createDocument,
  updateDocument,
  deleteDocument,
} = require("../services/vectorMemoryService");

const router = express.Router();

router.post("/createDoc", async (req, res) => {
  try {
    const created = await createDocument(req.body);
    return res.status(201).json({ status: "ok", data: created });
  } catch (error) {
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

router.put("/updateDoc", async (req, res) => {
  try {
    const updated = await updateDocument(req.body);
    return res.status(200).json({ status: "ok", data: updated });
  } catch (error) {
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

router.delete("/deleteDoc", async (req, res) => {
  try {
    const result = await deleteDocument(req.body);
    return res.status(200).json({ status: "ok", data: result });
  } catch (error) {
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
