const SAFE_METADATA_FIELDS = [
  "domain",
  "subcategory",
  "organization",
  "proficiency_level",
  "verified",
  "date_start",
  "date_end",
  "completion_year",
  "is_active",
];

function sanitizeExternalLinks(externalLinks) {
  if (
    !externalLinks ||
    typeof externalLinks !== "object" ||
    Array.isArray(externalLinks)
  ) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(externalLinks).filter(
    ([key, value]) =>
      typeof key === "string" &&
      key.trim() &&
      typeof value === "string" &&
      value.trim(),
  );

  return sanitizedEntries.length > 0
    ? Object.fromEntries(sanitizedEntries)
    : undefined;
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  const safeMetadata = SAFE_METADATA_FIELDS.reduce((accumulator, field) => {
    const value = metadata[field];
    if (value === undefined || value === null || value === "") {
      return accumulator;
    }

    return {
      ...accumulator,
      [field]: value,
    };
  }, {});

  const externalLinks = sanitizeExternalLinks(metadata.external_links);
  if (externalLinks) {
    safeMetadata.external_links = externalLinks;
  } else if (
    typeof metadata.external_link === "string" &&
    metadata.external_link.trim()
  ) {
    safeMetadata.external_link = metadata.external_link;
  }

  return Object.keys(safeMetadata).length > 0 ? safeMetadata : undefined;
}

function sanitizeSingleDocument(document = {}) {
  if (!document || typeof document !== "object") {
    return null;
  }

  const content = document.summary_for_embedding || document.content_full;
  const metadata = sanitizeMetadata(document.metadata);

  const sanitized = {
    title: document.title || "Untitled",
    content: content || "",
    tags: Array.isArray(document.tags) ? document.tags.filter(Boolean) : [],
  };

  if (metadata) {
    sanitized.metadata = metadata;
  }

  return sanitized;
}

function sanitizeDocumentsForLLM(documents) {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents
    .map((document) => sanitizeSingleDocument(document))
    .filter((document) => Boolean(document));
}

module.exports = {
  sanitizeDocumentsForLLM,
};
