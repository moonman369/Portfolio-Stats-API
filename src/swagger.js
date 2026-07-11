const swaggerJsDoc = require("swagger-jsdoc");

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Portfolio Stats API",
      version: "1.0.0",
      description:
        "Portfolio stats + MoonMind RAG API.\n\n" +
        "**Authentication:** protected endpoints expect the MoonMind password in a " +
        "`password` request header. Click **Authorize** and paste it once — Swagger UI " +
        "will attach it to every secured request.\n\n" +
        "`GET /api/v1/refresh` is the exception: it authenticates with a `secret` " +
        "query parameter instead.",
    },
    servers: [
      // Relative first, so "Try it out" targets whatever origin is serving the
      // docs — works unchanged in local, staging and production.
      { url: "/", description: "Current origin" },
      { url: "http://localhost:8000", description: "Local development" },
    ],
    tags: [
      { name: "Health", description: "Liveness probes" },
      { name: "Stats", description: "GitHub and LeetCode statistics" },
      { name: "MoonMind Chat", description: "Intent-driven RAG chat" },
      { name: "MoonMind Vector Docs", description: "Vector memory CRUD" },
      {
        name: "MoonMind Embeddings",
        description: "Gemini embedding regeneration",
      },
    ],
    components: {
      securitySchemes: {
        MoonMindPassword: {
          type: "apiKey",
          in: "header",
          name: "password",
          description:
            "Value of the MOONMIND_PASSWORD env var (falls back to REFRESH_SECRET).",
        },
      },
      schemas: {
        LeetcodeResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "success" },
            totalSolved: { type: "integer", example: 219 },
            totalQuestions: { type: "integer", example: 3491 },
            easySolved: { type: "integer", example: 121 },
            totalEasy: { type: "integer", example: 867 },
            mediumSolved: { type: "integer", example: 94 },
            totalMedium: { type: "integer", example: 1813 },
            hardSolved: { type: "integer", example: 4 },
            totalHard: { type: "integer", example: 811 },
            ranking: { type: "integer", example: 512680 },
          },
        },
        GithubResponse: {
          type: "array",
          items: {
            type: "object",
            properties: {
              _id: { type: "string", example: "65d4daea3c822f9149ce7684" },
              stats: {
                type: "object",
                properties: {
                  repos: { type: "integer", example: 106 },
                  commits: { type: "integer", example: 1854 },
                  pulls: { type: "integer", example: 45 },
                  stars: { type: "integer", example: 238 },
                },
              },
            },
          },
        },
        VectorDocumentMetadata: {
          type: "object",
          required: [
            "domain",
            "subcategory",
            "verified",
            "proficiency_level",
            "organization",
            "impact_score",
            "is_active",
          ],
          properties: {
            domain: {
              type: "string",
              enum: [
                "skills",
                "projects",
                "experience",
                "profile",
                "certifications",
                "education",
                "achievements",
                "research",
                "hobbies",
              ],
            },
            subcategory: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "programming-language",
                  "backend",
                  "frontend",
                  "fullstack",
                  "database",
                  "devops",
                  "cloud",
                  "architecture",
                  "api-design",
                  "system-design",
                  "distributed-systems",
                  "security",
                  "testing",
                  "performance-optimization",
                  "data-engineering",
                  "machine-learning",
                  "generative-ai",
                  "rag",
                  "vector-databases",
                  "problem-solving",
                  "communication",
                  "teamwork",
                  "leadership",
                  "adaptability",
                  "creativity",
                  "critical-thinking",
                  "decision-making",
                  "time-management",
                  "ownership",
                  "ai",
                  "automation",
                  "api",
                  "search",
                  "chatbot",
                  "analytics",
                  "open-source",
                  "experimental",
                  "production-grade",
                  "scalable",
                  "high-performance",
                  "integration",
                  "enterprise-systems",
                  "microservices",
                  "computer-science",
                  "software-engineering",
                  "data-science",
                  "artificial-intelligence",
                  "mathematics",
                  "hackathon",
                  "competition",
                  "ranking",
                  "award",
                  "recognition",
                  "community",
                  "nlp",
                  "algorithms",
                  "experimentation",
                  "technical",
                  "non-technical",
                  "competitive-programming",
                  "writing",
                  "gaming",
                  "learning",
                ],
              },
              example: ["backend", "api-design"],
            },
            date_start: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Optional.",
              example: "2023-01-01T00:00:00.000Z",
            },
            date_end: {
              type: "string",
              format: "date-time",
              nullable: true,
              description:
                "Optional. If omitted/null and date_start is set, treated as ongoing.",
              example: null,
            },
            completion_year: {
              type: "integer",
              nullable: true,
              description: "Optional.",
              example: null,
            },
            verified: { type: "boolean", example: true },
            proficiency_level: {
              type: "string",
              enum: ["beginner", "intermediate", "advanced", "expert"],
              nullable: true,
              example: "expert",
            },
            organization: {
              type: "string",
              nullable: true,
              example: "MoonMind",
            },
            impact_score: {
              type: "number",
              nullable: true,
              minimum: 0,
              maximum: 100,
              example: 91,
            },
            is_active: { type: "boolean", example: true },
            external_link: {
              type: "string",
              format: "uri",
              nullable: true,
              description:
                "Legacy field; preserved for backward compatibility.",
              example: "https://moonman.in",
            },
            external_links: {
              type: "object",
              nullable: true,
              additionalProperties: {
                type: "string",
              },
              example: {
                portfolio: "https://moonman.in",
                github: "https://github.com/moonman",
              },
            },
          },
        },
        VectorDocumentPayload: {
          type: "object",
          required: [
            "id",
            "title",
            "category",
            "tags",
            "content_full",
            "metadata",
          ],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "f95f41ee-2dfb-4ba8-a724-8083c0f06910",
            },
            title: { type: "string", example: "Node.js API Architecture" },
            category: {
              type: "string",
              enum: [
                "skill",
                "certification",
                "credential",
                "education",
                "experience",
                "profile",
                "project",
                "hobby",
                "topic",
              ],
              example: "skill",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              example: ["nodejs", "express", "mongodb", "api-design"],
            },
            summary_for_embedding: {
              type: "string",
              description: "Optional. Generated automatically if omitted.",
              example:
                "Built backend APIs with Node.js and Express for portfolio analytics workloads. Used MongoDB indexes and aggregation pipelines between 2023 and 2025 to optimize retrieval. Implemented deterministic validation and schema-first request handling. Delivered measurable latency reduction for production chat and analytics endpoints.",
            },
            content_full: {
              type: "string",
              nullable: true,
              example:
                "Designed and maintained production backend services for portfolio stats retrieval, ingestion, and deterministic search alignment.",
            },
            metadata: { $ref: "#/components/schemas/VectorDocumentMetadata" },
          },
        },
        VectorDocumentStored: {
          allOf: [
            { $ref: "#/components/schemas/VectorDocumentPayload" },
            {
              type: "object",
              required: ["summary_for_embedding", "created_at", "updated_at"],
              properties: {
                created_at: {
                  type: "string",
                  format: "date-time",
                  example: "2026-02-14T13:00:00.000Z",
                },
                updated_at: {
                  type: "string",
                  format: "date-time",
                  example: "2026-02-14T13:00:00.000Z",
                },
              },
            },
          ],
        },
        VectorDeletePayload: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "f95f41ee-2dfb-4ba8-a724-8083c0f06910",
            },
          },
        },
        VectorDocumentSuccessResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
            data: { $ref: "#/components/schemas/VectorDocumentStored" },
          },
        },
        VectorDeleteSuccessResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
            data: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                  example: "f95f41ee-2dfb-4ba8-a724-8083c0f06910",
                },
                deleted: { type: "boolean", example: true },
              },
            },
          },
        },
        ApiErrorResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "error" },
            message: { type: "string", example: "Validation error details" },
            error: {
              type: "object",
              properties: {
                name: { type: "string", example: "ValidationError" },
              },
            },
          },
        },
        ChatRequest: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: {
              type: "string",
              example: "What projects has Ayan built using RAG?",
            },
            sessionId: {
              type: "string",
              nullable: true,
              description: "Optional. Correlates turns in a conversation.",
              example: "8f2b0c1e-4c3a-4d1f-9f0e-6a2b7d3c5e91",
            },
            metadata: {
              type: "object",
              nullable: true,
              description:
                "Optional. Each key/value becomes an equality filter on metadata.<key>.",
              additionalProperties: true,
              example: { verified: true },
            },
          },
        },
        ChatResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "success" },
            data: {
              type: "object",
              properties: {
                summary: {
                  type: "string",
                  example:
                    "Ayan built the MoonMind search engine, a retrieval pipeline combining semantic, keyword and metadata arms.",
                },
                documents: {
                  type: "array",
                  items: { $ref: "#/components/schemas/VectorDocumentStored" },
                },
              },
            },
          },
        },
        EmbeddingRegenerateRequest: {
          type: "object",
          properties: {
            onlyMissing: {
              type: "boolean",
              default: false,
              description:
                "When true, embeds only documents that have no vector yet. Use this for the initial backfill.",
              example: true,
            },
          },
        },
        SingleEmbeddingResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
            data: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                  example: "f95f41ee-2dfb-4ba8-a724-8083c0f06910",
                },
                dimensions: { type: "integer", example: 768 },
                updated_at: {
                  type: "string",
                  format: "date-time",
                  example: "2026-07-10T13:00:00.000Z",
                },
              },
            },
          },
        },
        EmbeddingRegenerateResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["ok", "partial"],
              example: "ok",
            },
            data: {
              type: "object",
              properties: {
                onlyMissing: { type: "boolean", example: true },
                processed: { type: "integer", example: 40 },
                updated: { type: "integer", example: 40 },
                failed: { type: "integer", example: 0 },
                failures: {
                  type: "array",
                  description:
                    "Per-document failures. A failing document does not abort the run.",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      message: { type: "string" },
                      error: {
                        type: "object",
                        properties: {
                          name: { type: "string", example: "EmbeddingError" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        BulkCreateResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["ok", "partial"],
              example: "partial",
            },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/VectorDocumentStored" },
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: {
                    type: "integer",
                    description: "Position in the submitted array.",
                    example: 2,
                  },
                  status: { type: "integer", example: 409 },
                  message: { type: "string" },
                  error: {
                    type: "object",
                    properties: {
                      name: { type: "string", example: "ConflictError" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Missing or incorrect `password` header",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorResponse" },
              example: {
                status: "error",
                message: "Unauthorized",
                error: { name: "UnauthorizedError" },
              },
            },
          },
        },
        RateLimited: {
          description:
            "Local rate limiter tripped, or Gemini quota exhausted after retries",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorResponse" },
              example: {
                status: "error",
                message: "Too many embedding requests, please retry later",
                error: { name: "RateLimitError" },
              },
            },
          },
        },
        EmbeddingProviderError: {
          description: "Gemini embedding provider error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorResponse" },
              example: {
                status: "error",
                message: "Gemini embedding request failed: 400 ...",
                error: { name: "EmbeddingError" },
              },
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js", "./routes/*.js", "./api/index.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = swaggerDocs;
