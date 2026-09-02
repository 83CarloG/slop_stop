"use strict";

function addRequestIdHeaders(openapiObject) {
    for (const pathItem of Object.values(openapiObject.paths || {})) {
        for (const operation of Object.values(pathItem)) {
            if (!operation || typeof operation !== "object" || !operation.responses) {
                continue;
            }

            for (const response of Object.values(operation.responses)) {
                response.headers = response.headers || {};
                response.headers["X-Request-Id"] = {
                    $ref: "#/components/headers/RequestId"
                };
            }
        }
    }

    return openapiObject;
}

module.exports = function getOpenApiConfig() {
    return {
        hideUntagged: true,
        openapi: {
            components: {
                headers: {
                    RequestId: {
                        description: "Identifier generated for tracing one API request.",
                        schema: {
                            format: "uuid",
                            type: "string"
                        }
                    }
                }
            },
            info: {
                description: "Executable API contract for the Slop Stop MVP.",
                title: "Slop Stop API",
                version: "0.1.0"
            },
            openapi: "3.0.3",
            tags: [
                {description: "Runtime readiness.", name: "System"},
                {description: "Versioned functional requirement governance.", name: "Functional requirements"},
                {description: "Versioned technical requirements derived from approved functional origins.", name: "Technical requirements"},
                {description: "Versioned task drafts derived from approved technical origins.", name: "Tasks"},
                {description: "Optional, explicitly confirmed Codex operations.", name: "Codex"}
            ]
        },
        transformObject: function ({openapiObject}) {
            return addRequestIdHeaders(openapiObject);
        }
    };
};
