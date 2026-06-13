const path = require("path");
const express = require("express");
const mammoth = require("mammoth");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const supabaseDatabase = require("../lib/supabase");
const { requireAuth } = require("../middleware/requireAuth");
const {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  searchKnowledgeDocuments,
  updateKnowledgeDocument,
} = require("../lib/orbitKnowledge");

const router = express.Router();
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const SUPPORTED_UPLOAD_EXTENSIONS = new Set([".txt", ".md", ".pdf", ".docx"]);

const upload = multer({
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
  storage: multer.memoryStorage(),
});

function parseKnowledgeUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      return sendError(
        res,
        createHttpError(
          error.code === "LIMIT_FILE_SIZE"
            ? "Ukuran file maksimal 8 MB."
            : "Upload knowledge tidak valid.",
          400,
          "knowledge_upload_invalid",
        ),
        "Gagal upload knowledge document.",
      );
    }

    return sendError(
      res,
      createHttpError(
        "Gagal membaca upload knowledge.",
        400,
        "knowledge_upload_invalid",
      ),
      "Gagal upload knowledge document.",
    );
  });
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();

  return trimmed || fallback;
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const cleanValue = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(cleanValue)) return true;
    if (["0", "false", "no", "off"].includes(cleanValue)) return false;
  }

  return fallback;
}

function createHttpError(message, statusCode = 500, code = "SERVER_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getAuthenticatedEmail(req) {
  const email = normalizeEmail(req.user?.email || req.userEmail);

  if (!email) {
    throw createHttpError(
      "Email user login tidak tersedia.",
      400,
      "knowledge_user_required",
    );
  }

  return email;
}

function sendError(res, error, fallbackMessage) {
  const status = error.statusCode || error.status || 500;

  return res.status(status).json({
    success: false,
    code: error.code || "knowledge_request_failed",
    message: error.message || fallbackMessage,
  });
}

function getUploadExtension(file) {
  return path.extname(file?.originalname || "").toLowerCase();
}

function logUploadExtractionWarning(file) {
  console.warn("[ORBIT Knowledge Upload] extraction failed", {
    extension: getUploadExtension(file) || "unknown",
    size: file?.size || 0,
  });
}

function createUploadExtractionError() {
  return createHttpError(
    "Gagal memproses dokumen upload.",
    400,
    "knowledge_upload_parse_failed",
  );
}

function createUploadTitle(file, fallbackTitle) {
  const cleanTitle = normalizeText(fallbackTitle);

  if (cleanTitle) return cleanTitle;

  const originalName = normalizeText(file?.originalname, "Uploaded Document");

  return originalName.replace(/\.[^.]+$/, "") || "Uploaded Document";
}

async function extractUploadedText(file) {
  if (!file?.buffer?.length) {
    throw createHttpError(
      "File upload wajib tersedia.",
      400,
      "knowledge_upload_required",
    );
  }

  const extension = getUploadExtension(file);

  if (!SUPPORTED_UPLOAD_EXTENSIONS.has(extension)) {
    throw createHttpError(
      "Format file tidak didukung. Gunakan .txt, .md, .pdf, atau .docx.",
      400,
      "knowledge_upload_type_unsupported",
    );
  }

  if (extension === ".txt" || extension === ".md") {
    try {
      return file.buffer.toString("utf8");
    } catch {
      logUploadExtractionWarning(file);
      throw createUploadExtractionError();
    }
  }

  if (extension === ".pdf") {
    try {
      const parsedPdf = await pdfParse(file.buffer);

      return parsedPdf.text || "";
    } catch {
      logUploadExtractionWarning(file);
      throw createUploadExtractionError();
    }
  }

  try {
    const parsedDocx = await mammoth.extractRawText({ buffer: file.buffer });

    return parsedDocx.value || "";
  } catch {
    logUploadExtractionWarning(file);
    throw createUploadExtractionError();
  }
}

function createUploadMetadata(file) {
  const extension = getUploadExtension(file);

  return {
    extension,
    mimeType: file?.mimetype || "application/octet-stream",
    originalFilename: file?.originalname || "upload",
    size: file?.size || 0,
    uploadedAt: new Date().toISOString(),
  };
}

router.use(requireAuth);

router.get("/documents", async (req, res) => {
  try {
    const userEmail = getAuthenticatedEmail(req);
    const documents = await listKnowledgeDocuments({
      db: supabaseDatabase,
      userEmail,
    });

    return res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil knowledge documents.");
  }
});

router.post("/documents", async (req, res) => {
  try {
    const userEmail = getAuthenticatedEmail(req);
    const document = await createKnowledgeDocument({
      db: supabaseDatabase,
      input: req.body,
      userEmail,
    });

    return res.status(201).json({
      success: true,
      data: document,
    });
  } catch (error) {
    return sendError(res, error, "Gagal menyimpan knowledge document.");
  }
});

router.post("/documents/upload", parseKnowledgeUpload, async (req, res) => {
  try {
    const userEmail = getAuthenticatedEmail(req);
    const content = await extractUploadedText(req.file);
    const document = await createKnowledgeDocument({
      db: supabaseDatabase,
      input: {
        content,
        metadata: createUploadMetadata(req.file),
        source: "upload",
        title: createUploadTitle(req.file, req.body?.title),
        use_in_ai_context: normalizeBoolean(
          req.body?.use_in_ai_context ?? req.body?.useInAiContext,
          true,
        ),
      },
      userEmail,
    });

    return res.status(201).json({
      success: true,
      data: document,
    });
  } catch (error) {
    return sendError(res, error, "Gagal upload knowledge document.");
  }
});

router.put("/documents/:id", async (req, res) => {
  try {
    const userEmail = getAuthenticatedEmail(req);
    const document = await updateKnowledgeDocument({
      db: supabaseDatabase,
      documentId: req.params.id,
      input: req.body,
      userEmail,
    });

    return res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    return sendError(res, error, "Gagal update knowledge document.");
  }
});

router.patch("/documents/:id", async (req, res) => {
  try {
    const userEmail = getAuthenticatedEmail(req);
    const document = await updateKnowledgeDocument({
      db: supabaseDatabase,
      documentId: req.params.id,
      input: req.body,
      userEmail,
    });

    return res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    return sendError(res, error, "Gagal update knowledge document.");
  }
});

router.delete("/documents/:id", async (req, res) => {
  try {
    const userEmail = getAuthenticatedEmail(req);
    const deleted = await deleteKnowledgeDocument({
      db: supabaseDatabase,
      documentId: req.params.id,
      userEmail,
    });

    return res.json({
      success: true,
      data: {
        deleted,
        id: req.params.id,
      },
    });
  } catch (error) {
    return sendError(res, error, "Gagal menghapus knowledge document.");
  }
});

router.get("/search", async (req, res) => {
  try {
    const userEmail = getAuthenticatedEmail(req);
    const documents = await searchKnowledgeDocuments({
      db: supabaseDatabase,
      onlyEnabled: normalizeBoolean(req.query?.only_enabled, false),
      query: req.query?.q || req.query?.query || "",
      userEmail,
    });

    return res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    return sendError(res, error, "Gagal mencari knowledge documents.");
  }
});

module.exports = router;
