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
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = swaggerDocs;
