const swaggerJsDoc = require("swagger-jsdoc");

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Express API",
      version: "1.0.0",
      description: "API Documentation for Express.js",
    },
    servers: [{ url: "http://localhost:8000" }],
    components: {
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
            "date_start",
            "date_end",
            "completion_year",
            "verified",
            "proficiency_level",
            "organization",
            "impact_score",
            "is_active",
            "external_link",
          ],
          properties: {
            domain: {
              type: "string",
              enum: [
                "skills",
                "experience",
                "certifications",
                "projects",
                "hobbies",
                "topics",
              ],
            },
            subcategory: { type: "string", nullable: true, example: "backend" },
            date_start: {
              type: "string",
              format: "date-time",
              nullable: true,
              example: "2023-01-01T00:00:00.000Z",
            },
            date_end: {
              type: "string",
              format: "date-time",
              nullable: true,
              example: null,
            },
            completion_year: { type: "integer", nullable: true, example: null },
            verified: { type: "boolean", example: true },
            proficiency_level: {
              type: "string",
              enum: ["beginner", "intermediate", "advanced", "expert"],
              nullable: true,
              example: "expert",
            },
            organization: { type: "string", nullable: true, example: "MoonMind" },
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
              example: "https://moonman.in",
            },
          },
        },
        VectorDocumentPayload: {
          type: "object",
          required: ["id", "title", "category", "tags", "content_full", "metadata"],
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
                "experience",
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
      },
    },
  },
  apis: ["./src/routes/*.js", "./routes/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = swaggerDocs;
