import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "../src/schemas.js";
import * as fs from "fs";

const generator = new OpenApiGeneratorV3(registry.definitions);

const document = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "Articles Service",
    description: "API for indexing press articles and linking them to outlets, journalists, and topics",
    version: "1.0.0",
  },
  servers: [
    { url: process.env.ARTICLES_SERVICE_URL || "http://localhost:3012" },
  ],
});

fs.writeFileSync("openapi.json", JSON.stringify(document, null, 2));
console.log("[Articles Service] OpenAPI spec generated at openapi.json");
