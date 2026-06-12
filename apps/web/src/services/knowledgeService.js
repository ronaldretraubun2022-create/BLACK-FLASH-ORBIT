import { api, getAuthenticatedHeaders, resolveApiUrl } from "./api";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx"];
const KNOWLEDGE_UPLOAD_ENDPOINT = "/api/knowledge/documents/upload";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKnowledgeDocument(document) {
  return {
    id: document?.id || "",
    content: document?.content || "",
    createdAt: document?.createdAt || document?.created_at || "",
    metadata: document?.metadata || {},
    source: document?.source || "manual",
    title: document?.title || "Untitled Knowledge Document",
    updatedAt: document?.updatedAt || document?.updated_at || "",
    useInAiContext: Boolean(
      document?.useInAiContext ?? document?.use_in_ai_context,
    ),
  };
}

function normalizeResponseDocument(response) {
  return normalizeKnowledgeDocument(response?.data || response);
}

function parseJsonResponse(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getUploadErrorMessage(responseBody, status) {
  return (
    responseBody?.message ||
    responseBody?.error ||
    `Upload gagal dengan status HTTP ${status}.`
  );
}

function requestKnowledgeUpload({ formData, onProgress }) {
  return new Promise(async (resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const headers = await getAuthenticatedHeaders().catch((error) => {
      reject(error);
      return null;
    });

    if (!headers) return;

    xhr.open("POST", resolveApiUrl(KNOWLEDGE_UPLOAD_ENDPOINT));
    xhr.setRequestHeader("Accept", "application/json");

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress?.(35);
        return;
      }

      onProgress?.(Math.round((event.loaded / event.total) * 90));
    };

    xhr.onload = () => {
      const responseBody = parseJsonResponse(xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(responseBody);
        return;
      }

      reject(new Error(getUploadErrorMessage(responseBody, xhr.status)));
    };

    xhr.onerror = () => {
      reject(new Error("Koneksi upload knowledge gagal."));
    };

    xhr.ontimeout = () => {
      reject(new Error("Upload knowledge timeout."));
    };

    xhr.timeout = 60000;
    xhr.send(formData);
  });
}

export function getKnowledgeFileValidation(file) {
  if (!file) return "Pilih file knowledge terlebih dahulu.";

  const lowerName = file.name.toLowerCase();
  const isSupported = SUPPORTED_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension),
  );

  if (!isSupported) {
    return "Format file harus .txt, .md, .pdf, atau .docx.";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return "Ukuran file maksimal 8 MB.";
  }

  return "";
}

export function getKnowledgeFileType(file) {
  const lowerName = String(file?.name || "").toLowerCase();
  const extension = SUPPORTED_EXTENSIONS.find((item) =>
    lowerName.endsWith(item),
  );

  return extension ? extension.slice(1).toUpperCase() : "FILE";
}

export function formatKnowledgeFileSize(value) {
  const bytes = Number(value || 0);

  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export async function getKnowledgeDocuments() {
  const documents = await api.getKnowledgeDocuments();

  return documents.map(normalizeKnowledgeDocument);
}

export async function createKnowledgeDocument({
  content,
  source,
  title,
  useInAiContext,
}) {
  const response = await api.createKnowledgeDocument({
    content: normalizeText(content),
    source: normalizeText(source) || "manual",
    title: normalizeText(title),
    use_in_ai_context: Boolean(useInAiContext),
  });

  return normalizeResponseDocument(response);
}

export async function updateKnowledgeDocument(
  documentId,
  { content, source, title, useInAiContext },
) {
  const response = await api.updateKnowledgeDocument(documentId, {
    content: normalizeText(content),
    source: normalizeText(source) || "manual",
    title: normalizeText(title),
    use_in_ai_context: Boolean(useInAiContext),
  });

  return normalizeResponseDocument(response);
}

export async function toggleKnowledgeAiContext(documentId, useInAiContext) {
  const response = await api.patchKnowledgeDocument(documentId, {
    use_in_ai_context: Boolean(useInAiContext),
  });

  return normalizeResponseDocument(response);
}

export async function deleteKnowledgeDocument(documentId) {
  await api.deleteKnowledgeDocument(documentId);

  return { id: documentId };
}

export async function uploadKnowledgeDocument({
  file,
  onProgress,
  title,
  useInAiContext = true,
}) {
  const validationError = getKnowledgeFileValidation(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", normalizeText(title));
  formData.append("use_in_ai_context", String(Boolean(useInAiContext)));

  const response = await requestKnowledgeUpload({
    formData,
    onProgress,
  });

  return normalizeResponseDocument(response);
}
