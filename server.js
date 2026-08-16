import express from "express";
import axios from "axios";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";

import {
  declareDiscoveryExtension,
  bazaarResourceServerExtension,
} from "@x402/extensions/bazaar";

// ============================================================================
// X402 TRENDS SERVER
// PRODUCTION - BASE MAINNET + BAZAAR DISCOVERY
// ============================================================================

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const NETWORK = "eip155:8453";

const PAY_TO = process.env.X402_PAY_TO;

// ============================================================================
// REQUIRED ENVIRONMENT VARIABLES
// ============================================================================

if (
  !PAY_TO ||
  !/^0x[a-fA-F0-9]{40}$/.test(PAY_TO)
) {
  console.error(
    "❌ Missing or invalid X402_PAY_TO."
  );

  process.exit(1);
}

if (!process.env.CDP_API_KEY_ID) {
  console.error(
    "❌ Missing CDP_API_KEY_ID."
  );

  process.exit(1);
}

if (!process.env.CDP_API_KEY_SECRET) {
  console.error(
    "❌ Missing CDP_API_KEY_SECRET."
  );

  process.exit(1);
}

// ============================================================================
// EXPRESS CONFIG
// ============================================================================

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "1mb",
  })
);

// ============================================================================
// FREE HOME ENDPOINT
// ============================================================================

app.get("/", (_req, res) => {
  res.json({
    name: "x402 Trends Server",

    version: "2.1.0",

    status: "online",

    mode: "PRODUCTION",

    network: NETWORK,

    networkName: "Base Mainnet",

    currency: "USDC",

    paymentProtocol: "x402",

    bazaarDiscovery: true,

    receivingWallet: PAY_TO,

    endpoints: {
      health: "/health",

      openapi: "/openapi.json",

      paid: {
        trends: "/api/trends",

        scrape: "/api/scrape",

        parseReceipt:
          "/api/parse-receipt",
      },
    },

    pricing: {
      trends: "$0.02",

      scrape: "$0.005",

      parseReceipt: "$0.05",
    },
  });
});

// ============================================================================
// FREE HEALTH ENDPOINT
// ============================================================================

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",

    service:
      "x402-trends-server",

    version: "2.1.0",

    mode: "PRODUCTION",

    network: NETWORK,

    networkName:
      "Base Mainnet",

    currency: "USDC",

    bazaarDiscovery: true,

    timestamp:
      new Date().toISOString(),
  });
});

// ============================================================================
// OPENAPI
// ============================================================================

const __filename =
  fileURLToPath(
    import.meta.url
  );

const __dirname =
  path.dirname(
    __filename
  );

app.get(
  "/openapi.json",

  (_req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "openapi.json"
      ),

      (error) => {
        if (
          error &&
          !res.headersSent
        ) {
          res
            .status(404)
            .json({
              error:
                "openapi.json was not found.",
            });
        }
      }
    );
  }
);

// ============================================================================
// COINBASE CDP FACILITATOR
// ============================================================================

const facilitatorClient =
  createCdpFacilitatorClient();

// ============================================================================
// X402 RESOURCE SERVER
//
// Register:
// 1. Base Mainnet exact EVM payments
// 2. Bazaar discovery extension
// ============================================================================

const resourceServer =
  new x402ResourceServer(
    facilitatorClient
  )
    .register(
      NETWORK,
      new ExactEvmScheme()
    )
    .registerExtension(
      bazaarResourceServerExtension
    );

// ============================================================================
// PAYMENT LOGGING
// ============================================================================

resourceServer.onAfterSettle(
  async ({
    result,
    requirements,
  }) => {
    const amount =
      String(
        requirements?.amount ||
          ""
      );

    const purchasedByAmount = {
      "5000":
        "POST /api/scrape",

      "20000":
        "GET /api/trends",

      "50000":
        "POST /api/parse-receipt",
    };

    console.log("");

    console.log(
      "==================================================="
    );

    console.log(
      "💰 X402 PAYMENT SETTLED"
    );

    console.log(
      "==================================================="
    );

    console.log(
      `Purchased: ${
        purchasedByAmount[
          amount
        ] ||
        "paid API resource"
      }`
    );

    console.log(
      `Payer: ${
        result?.payer ||
        "unknown"
      }`
    );

    console.log(
      `Seller: ${
        requirements?.payTo ||
        PAY_TO
      }`
    );

    console.log(
      `Network: ${
        result?.network ||
        requirements?.network ||
        NETWORK
      }`
    );

    console.log(
      `Transaction: ${
        result?.transaction ||
        "unknown"
      }`
    );

    console.log(
      `Amount: ${
        amount ||
        "unknown"
      } USDC base units`
    );

    console.log(
      `Time: ${
        new Date().toISOString()
      }`
    );

    console.log(
      "==================================================="
    );

    console.log("");
  }
);

// ============================================================================
// BAZAAR DISCOVERY METADATA
// ============================================================================

const trendsDiscovery =
  declareDiscoveryExtension({
    input: {},

    inputSchema: {
      type: "object",

      properties: {},

      required: [],
    },

    output: {
      example: {
        status: "success",

        payment: "verified",

        network:
          "eip155:8453",

        currency: "USDC",

        source:
          "Spaceflight News API",

        count: 5,

        retrievedAt:
          "2026-08-16T01:00:00.000Z",

        data: [
          {
            id: 12345,

            title:
              "Example spaceflight news headline",

            summary:
              "Summary of the latest spaceflight development.",

            url:
              "https://example.com/article",

            imageUrl:
              "https://example.com/image.jpg",

            newsSite:
              "Example News",

            publishedAt:
              "2026-08-16T00:30:00Z",
          },
        ],
      },

      schema: {
        type: "object",

        properties: {
          status: {
            type: "string",
          },

          payment: {
            type: "string",
          },

          network: {
            type: "string",
          },

          currency: {
            type: "string",
          },

          source: {
            type: "string",
          },

          count: {
            type: "integer",
          },

          retrievedAt: {
            type: "string",
          },

          data: {
            type: "array",

            items: {
              type: "object",

              properties: {
                id: {},

                title: {
                  type: "string",
                },

                summary: {
                  type: [
                    "string",
                    "null",
                  ],
                },

                url: {
                  type: "string",
                },

                imageUrl: {
                  type: [
                    "string",
                    "null",
                  ],
                },

                newsSite: {
                  type: [
                    "string",
                    "null",
                  ],
                },

                publishedAt: {
                  type: [
                    "string",
                    "null",
                  ],
                },
              },
            },
          },
        },

        required: [
          "status",
          "count",
          "data",
        ],
      },
    },
  });

const scrapeDiscovery =
  declareDiscoveryExtension({
    bodyType: "json",

    input: {
      url:
        "https://example.com",
    },

    inputSchema: {
      type: "object",

      properties: {
        url: {
          type: "string",

          format: "uri",

          description:
            "Public HTTP or HTTPS webpage to fetch and extract readable text from.",
        },
      },

      required: [
        "url",
      ],

      additionalProperties:
        false,
    },

    output: {
      example: {
        status: "success",

        payment: "verified",

        network:
          "eip155:8453",

        currency: "USDC",

        urlRequested:
          "https://example.com/",

        charactersAvailable:
          1256,

        truncated: false,

        extractedText:
          "Example Domain This domain is for use in illustrative examples...",
      },

      schema: {
        type: "object",

        properties: {
          status: {
            type: "string",
          },

          payment: {
            type: "string",
          },

          network: {
            type: "string",
          },

          currency: {
            type: "string",
          },

          urlRequested: {
            type: "string",
          },

          charactersAvailable:
            {
              type: "integer",
            },

          truncated: {
            type: "boolean",
          },

          extractedText: {
            type: "string",
          },
        },

        required: [
          "status",
          "urlRequested",
          "extractedText",
        ],
      },
    },
  });

const receiptDiscovery =
  declareDiscoveryExtension({
    bodyType: "json",

    input: {
      text:
        "Coffee 4.50\nSandwich 8.99\nTax 1.08\nTotal 14.57",
    },

    inputSchema: {
      type: "object",

      properties: {
        text: {
          type: "string",

          description:
            "Raw receipt text containing items, prices, tax, subtotal or total values.",
        },
      },

      required: [
        "text",
      ],

      additionalProperties:
        false,
    },

    output: {
      example: {
        status: "success",

        payment: "verified",

        network:
          "eip155:8453",

        currency: "USDC",

        parsedData: {
          items: [
            {
              name: "Coffee",

              amount: 4.5,
            },

            {
              name:
                "Sandwich",

              amount: 8.99,
            },
          ],

          subtotal: 13.49,

          tax: 1.08,

          total: 14.57,

          linesDetected: 4,
        },
      },

      schema: {
        type: "object",

        properties: {
          status: {
            type: "string",
          },

          payment: {
            type: "string",
          },

          network: {
            type: "string",
          },

          currency: {
            type: "string",
          },

          parsedData: {
            type: "object",

            properties: {
              items: {
                type: "array",

                items: {
                  type: "object",

                  properties: {
                    name: {
                      type: "string",
                    },

                    amount: {
                      type: "number",
                    },
                  },
                },
              },

              subtotal: {
                type: [
                  "number",
                  "null",
                ],
              },

              tax: {
                type: [
                  "number",
                  "null",
                ],
              },

              total: {
                type: [
                  "number",
                  "null",
                ],
              },

              linesDetected:
                {
                  type: "integer",
                },
            },
          },
        },

        required: [
          "status",
          "parsedData",
        ],
      },
    },
  });

// ============================================================================
// X402 ROUTES + BAZAAR
// ============================================================================

const routesConfig = {
  // --------------------------------------------------------------------------
  // TRENDS
  // --------------------------------------------------------------------------

  "GET /api/trends": {
    accepts: [
      {
        scheme: "exact",

        network: NETWORK,

        payTo: PAY_TO,

        price: "$0.02",
      },
    ],

    description:
      "Get the five newest spaceflight news stories with titles, summaries, sources, article URLs, images and publication times. Use this endpoint when an agent needs current space industry news involving launches, NASA, SpaceX, Blue Origin, satellites or other spaceflight developments.",

    mimeType:
      "application/json",

    extensions: {
      ...trendsDiscovery,
    },
  },

  // --------------------------------------------------------------------------
  // WEB SCRAPER
  // --------------------------------------------------------------------------

  "POST /api/scrape": {
    accepts: [
      {
        scheme: "exact",

        network: NETWORK,

        payTo: PAY_TO,

        price: "$0.005",
      },
    ],

    description:
      "Fetch a public HTTP or HTTPS webpage and return up to 5,000 characters of cleaned readable text. Use this when an agent needs the textual contents of a webpage for research, summarization, extraction or analysis.",

    mimeType:
      "application/json",

    extensions: {
      ...scrapeDiscovery,
    },
  },

  // --------------------------------------------------------------------------
  // RECEIPT PARSER
  // --------------------------------------------------------------------------

  "POST /api/parse-receipt": {
    accepts: [
      {
        scheme: "exact",

        network: NETWORK,

        payTo: PAY_TO,

        price: "$0.05",
      },
    ],

    description:
      "Parse raw receipt text into structured line items, subtotal, sales tax and total. Use this when an agent already has receipt text and needs machine-readable purchase information. This endpoint does not perform image OCR.",

    mimeType:
      "application/json",

    extensions: {
      ...receiptDiscovery,
    },
  },
};

// ============================================================================
// ENABLE X402
// ============================================================================

app.use(
  paymentMiddleware(
    routesConfig,
    resourceServer
  )
);

// ============================================================================
// SCRAPER SECURITY
// ============================================================================

function isPrivateIPv4(
  address
) {
  const parts =
    address
      .split(".")
      .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (number) =>
        !Number.isInteger(
          number
        ) ||
        number < 0 ||
        number > 255
    )
  ) {
    return true;
  }

  const [a, b] = parts;

  if (a === 0) {
    return true;
  }

  if (a === 10) {
    return true;
  }

  if (a === 127) {
    return true;
  }

  if (
    a === 100 &&
    b >= 64 &&
    b <= 127
  ) {
    return true;
  }

  if (
    a === 169 &&
    b === 254
  ) {
    return true;
  }

  if (
    a === 172 &&
    b >= 16 &&
    b <= 31
  ) {
    return true;
  }

  if (
    a === 192 &&
    b === 168
  ) {
    return true;
  }

  if (a >= 224) {
    return true;
  }

  return false;
}

function isPrivateIPv6(
  address
) {
  const value =
    address.toLowerCase();

  if (
    value === "::1" ||
    value === "::"
  ) {
    return true;
  }

  if (
    value.startsWith("fc") ||
    value.startsWith("fd")
  ) {
    return true;
  }

  if (
    /^fe[89ab]/.test(
      value
    )
  ) {
    return true;
  }

  if (
    value.startsWith(
      "::ffff:"
    )
  ) {
    const ipv4 =
      value.slice(7);

    if (
      isIP(ipv4) === 4
    ) {
      return isPrivateIPv4(
        ipv4
      );
    }
  }

  return false;
}

function isPrivateAddress(
  address
) {
  if (
    isIP(address) === 4
  ) {
    return isPrivateIPv4(
      address
    );
  }

  if (
    isIP(address) === 6
  ) {
    return isPrivateIPv6(
      address
    );
  }

  return true;
}

async function validatePublicUrl(
  rawUrl
) {
  let parsed;

  try {
    parsed =
      new URL(rawUrl);
  } catch {
    throw new Error(
      "Invalid URL."
    );
  }

  if (
    ![
      "http:",
      "https:",
    ].includes(
      parsed.protocol
    )
  ) {
    throw new Error(
      "Only HTTP and HTTPS URLs are allowed."
    );
  }

  if (
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      "URLs containing credentials are not allowed."
    );
  }

  const hostname =
    parsed.hostname.toLowerCase();

  if (
    hostname ===
      "localhost" ||
    hostname.endsWith(
      ".localhost"
    )
  ) {
    throw new Error(
      "Local/private URLs are not allowed."
    );
  }

  if (
    isIP(hostname)
  ) {
    if (
      isPrivateAddress(
        hostname
      )
    ) {
      throw new Error(
        "Local/private URLs are not allowed."
      );
    }

    return parsed.toString();
  }

  const addresses =
    await lookup(
      hostname,
      {
        all: true,

        verbatim: true,
      }
    );

  if (
    !addresses.length
  ) {
    throw new Error(
      "Could not resolve hostname."
    );
  }

  for (
    const entry of
      addresses
  ) {
    if (
      isPrivateAddress(
        entry.address
      )
    ) {
      throw new Error(
        "Local/private URLs are not allowed."
      );
    }
  }

  return parsed.toString();
}

// ============================================================================
// TOOL #1
// SPACE TRENDS
// ============================================================================

app.get(
  "/api/trends",

  async (
    _req,
    res
  ) => {
    try {
      const response =
        await axios.get(
          "https://api.spaceflightnewsapi.net/v4/articles/",

          {
            timeout: 15000,

            params: {
              limit: 5,

              ordering:
                "-published_at",
            },

            headers: {
              Accept:
                "application/json",

              "User-Agent":
                "x402-trends-server/2.1",
            },
          }
        );

      const articles =
        Array.isArray(
          response.data
            ?.results
        )
          ? response.data
              .results
          : [];

      const trends =
        articles
          .slice(0, 5)
          .map(
            (
              article
            ) => ({
              id:
                article.id,

              title:
                article.title,

              summary:
                article.summary,

              url:
                article.url,

              imageUrl:
                article.image_url,

              newsSite:
                article.news_site,

              publishedAt:
                article.published_at,

              updatedAt:
                article.updated_at,
            })
          );

      res.json({
        status:
          "success",

        payment:
          "verified",

        network:
          NETWORK,

        currency:
          "USDC",

        source:
          "Spaceflight News API",

        count:
          trends.length,

        retrievedAt:
          new Date().toISOString(),

        data:
          trends,
      });
    } catch (error) {
      console.error(
        "Trends error:",

        error.response
          ?.data ||
          error.message
      );

      res
        .status(502)
        .json({
          error:
            "Failed to retrieve space news.",
        });
    }
  }
);

// ============================================================================
// TOOL #2
// WEB SCRAPER
// ============================================================================

app.post(
  "/api/scrape",

  async (
    req,
    res
  ) => {
    try {
      const { url } =
        req.body || {};

      if (
        !url ||
        typeof url !==
          "string"
      ) {
        return res
          .status(400)
          .json({
            error:
              "Please provide a URL.",

            example: {
              url:
                "https://example.com",
            },
          });
      }

      const targetUrl =
        await validatePublicUrl(
          url
        );

      const response =
        await axios.get(
          targetUrl,

          {
            timeout: 12000,

            maxRedirects: 0,

            responseType:
              "text",

            maxContentLength:
              2_000_000,

            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; x402-trends-server/2.1)",

              Accept:
                "text/html,text/plain;q=0.9,*/*;q=0.5",
            },

            validateStatus:
              (
                status
              ) =>
                status >=
                  200 &&
                status <
                  300,
          }
        );

      const contentType =
        String(
          response.headers[
            "content-type"
          ] || ""
        ).toLowerCase();

      if (
        !contentType.includes(
          "text/html"
        ) &&
        !contentType.includes(
          "text/plain"
        ) &&
        !contentType.includes(
          "application/xhtml"
        )
      ) {
        return res
          .status(415)
          .json({
            error:
              "The requested URL did not return readable webpage text.",

            contentType,
          });
      }

      const cleanText =
        String(
          response.data
        )

          .replace(
            /<script[\s\S]*?<\/script>/gi,
            " "
          )

          .replace(
            /<style[\s\S]*?<\/style>/gi,
            " "
          )

          .replace(
            /<noscript[\s\S]*?<\/noscript>/gi,
            " "
          )

          .replace(
            /<svg[\s\S]*?<\/svg>/gi,
            " "
          )

          .replace(
            /<[^>]+>/g,
            " "
          )

          .replace(
            /&nbsp;/gi,
            " "
          )

          .replace(
            /&amp;/gi,
            "&"
          )

          .replace(
            /&quot;/gi,
            '"'
          )

          .replace(
            /&#39;/gi,
            "'"
          )

          .replace(
            /\s+/g,
            " "
          )

          .trim();

      const MAX_LENGTH =
        5000;

      res.json({
        status:
          "success",

        payment:
          "verified",

        network:
          NETWORK,

        currency:
          "USDC",

        urlRequested:
          targetUrl,

        charactersAvailable:
          cleanText.length,

        truncated:
          cleanText.length >
          MAX_LENGTH,

        extractedText:
          cleanText.slice(
            0,
            MAX_LENGTH
          ),
      });
    } catch (error) {
      console.error(
        "Scrape error:",

        error.message
      );

      if (
        error.message ===
          "Invalid URL." ||
        error.message.includes(
          "not allowed"
        ) ||
        error.message.includes(
          "Only HTTP"
        ) ||
        error.message.includes(
          "resolve hostname"
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              error.message,
          });
      }

      if (
        error.response
      ) {
        return res
          .status(502)
          .json({
            error:
              "The remote website rejected or failed the request.",

            remoteStatus:
              error.response
                .status,
          });
      }

      res
        .status(500)
        .json({
          error:
            "Failed to scrape the webpage.",
        });
    }
  }
);

// ============================================================================
// RECEIPT FUNCTIONS
// ============================================================================

function extractMoney(
  line
) {
  const matches = [
    ...line.matchAll(
      /(?:\$|USD\s*)?(-?\d{1,7}(?:,\d{3})*(?:\.\d{2}))/gi
    ),
  ];

  if (
    !matches.length
  ) {
    return null;
  }

  const value =
    matches[
      matches.length - 1
    ][1].replace(
      /,/g,
      ""
    );

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function findValue(
  lines,
  patterns
) {
  for (
    const line of
      lines
  ) {
    if (
      patterns.some(
        (
          pattern
        ) =>
          pattern.test(
            line
          )
      )
    ) {
      const amount =
        extractMoney(
          line
        );

      if (
        amount !==
        null
      ) {
        return amount;
      }
    }
  }

  return null;
}

function parseReceipt(
  text
) {
  const lines =
    text
      .split(/\r?\n/)
      .map(
        (
          line
        ) =>
          line.trim()
      )
      .filter(
        Boolean
      );

  const subtotal =
    findValue(
      lines,
      [
        /\bsubtotal\b/i,

        /\bsub total\b/i,
      ]
    );

  const tax =
    findValue(
      lines,
      [
        /\btax\b/i,

        /\bsales tax\b/i,
      ]
    );

  const total =
    findValue(
      lines,
      [
        /\bgrand total\b/i,

        /\bamount due\b/i,

        /\bbalance due\b/i,

        /^total\b/i,
      ]
    );

  const ignored =
    /\b(subtotal|sub total|tax|grand total|amount due|balance due|total|change|cash|visa|mastercard|amex|credit|debit)\b/i;

  const items = [];

  for (
    const line of
      lines
  ) {
    if (
      ignored.test(
        line
      )
    ) {
      continue;
    }

    const amount =
      extractMoney(
        line
      );

    if (
      amount === null
    ) {
      continue;
    }

    const name =
      line
        .replace(
          /(?:\$|USD\s*)?-?\d{1,7}(?:,\d{3})*(?:\.\d{2})\s*$/i,
          ""
        )

        .trim();

    if (name) {
      items.push({
        name,

        amount,
      });
    }
  }

  return {
    items,

    subtotal,

    tax,

    total,

    linesDetected:
      lines.length,
  };
}

// ============================================================================
// TOOL #3
// RECEIPT PARSER
// ============================================================================

app.post(
  "/api/parse-receipt",

  (
    req,
    res
  ) => {
    try {
      const { text } =
        req.body || {};

      if (
        !text ||
        typeof text !==
          "string"
      ) {
        return res
          .status(400)
          .json({
            error:
              "Please provide receipt text.",

            example: {
              text:
                "Coffee 4.50\nSandwich 8.99\nTax 1.08\nTotal 14.57",
            },
          });
      }

      if (
        text.length >
        50_000
      ) {
        return res
          .status(400)
          .json({
            error:
              "Receipt text is too large.",
          });
      }

      res.json({
        status:
          "success",

        payment:
          "verified",

        network:
          NETWORK,

        currency:
          "USDC",

        parsedData:
          parseReceipt(
            text
          ),
      });
    } catch (error) {
      console.error(
        "Receipt parser error:",

        error.message
      );

      res
        .status(500)
        .json({
          error:
            "Failed to parse receipt.",
        });
    }
  }
);

// ============================================================================
// 404
// ============================================================================

app.use(
  (
    _req,
    res
  ) => {
    res
      .status(404)
      .json({
        error:
          "Endpoint not found.",

        availableEndpoints:
          [
            "GET /",

            "GET /health",

            "GET /openapi.json",

            "GET /api/trends",

            "POST /api/scrape",

            "POST /api/parse-receipt",
          ],
      });
  }
);

// ============================================================================
// ERROR HANDLER
// ============================================================================

app.use(
  (
    error,
    _req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",

      error
    );

    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    res
      .status(500)
      .json({
        error:
          "Internal server error.",
      });
  }
);

// ============================================================================
// START
// ============================================================================

app.listen(
  PORT,
  HOST,

  () => {
    console.log("");

    console.log(
      "==================================================="
    );

    console.log(
      "🚀 x402 Trends Server ONLINE"
    );

    console.log(
      "==================================================="
    );

    console.log(
      "Mode: PRODUCTION"
    );

    console.log(
      `Network: ${NETWORK}`
    );

    console.log(
      "Network Name: Base Mainnet"
    );

    console.log(
      "Currency: REAL USDC"
    );

    console.log(
      `Receiving Wallet: ${PAY_TO}`
    );

    console.log(
      "Facilitator: Coinbase CDP"
    );

    console.log(
      "Bazaar Discovery: ENABLED"
    );

    console.log("");

    console.log(
      "Paid endpoints:"
    );

    console.log(
      "GET  /api/trends          $0.02"
    );

    console.log(
      "POST /api/scrape          $0.005"
    );

    console.log(
      "POST /api/parse-receipt   $0.05"
    );

    console.log(
      "==================================================="
    );

    console.log(
      "⚠️ REAL MONEY MODE ENABLED"
    );

    console.log(
      "==================================================="
    );

    console.log("");
  }
);
