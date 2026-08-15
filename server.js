import express from "express";
import axios from "axios";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  paymentMiddleware,
  x402ResourceServer,
} from "@x402/express";

import { HTTPFacilitatorClient } from "@x402/core/server";

import { ExactEvmScheme } from "@x402/evm/exact/server";

// ============================================================================
// X402 TRENDS SERVER
// TEST MODE - BASE SEPOLIA
// ============================================================================

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

// ============================================================================
// TESTNET CONFIGURATION
//
// IMPORTANT:
// We are deliberately hard-coding these for now.
//
// Base Sepolia = TEST NETWORK
// x402.org facilitator = TEST FACILITATOR
//
// No Coinbase CDP account or API key is required.
// ============================================================================

const NETWORK = "eip155:84532";

const FACILITATOR_URL =
  "https://x402.org/facilitator";

// Your PUBLIC EVM wallet address.
// Never put your private key in this server.
const PAY_TO =
  "0xF61F957D9aC432309219549b1Ae79Ae8b7C71fF5";

// ============================================================================
// EXPRESS CONFIG
// ============================================================================

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "1mb",
  }),
);

// ============================================================================
// FREE ROUTES
// ============================================================================

app.get("/", (req, res) => {
  res.json({
    name: "x402 Trends Server",
    version: "1.3.0",
    status: "online",

    mode: "TESTNET",

    network: NETWORK,

    facilitator: FACILITATOR_URL,

    paymentProtocol: "x402",

    endpoints: {
      home: "/",
      health: "/health",
      openapi: "/openapi.json",

      paid: {
        trends: "/api/trends",
        scrape: "/api/scrape",
        parseReceipt: "/api/parse-receipt",
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
// HEALTH CHECK
// ============================================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",

    service: "x402-trends-server",

    version: "1.3.0",

    mode: "TESTNET",

    network: NETWORK,

    facilitator: FACILITATOR_URL,

    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// OPENAPI FILE
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/openapi.json", (req, res) => {
  const openApiPath = path.join(
    __dirname,
    "openapi.json",
  );

  res.sendFile(openApiPath, (error) => {
    if (error && !res.headersSent) {
      res.status(404).json({
        error: "openapi.json was not found.",
      });
    }
  });
});

// ============================================================================
// X402 FACILITATOR
// ============================================================================

console.log("");
console.log("Creating x402 facilitator client...");
console.log(`Facilitator URL: ${FACILITATOR_URL}`);
console.log(`Network: ${NETWORK}`);

// This is the official test facilitator.
// No Coinbase credentials are used here.

const facilitatorClient =
  new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
  });

// ============================================================================
// X402 RESOURCE SERVER
// ============================================================================

const resourceServer =
  new x402ResourceServer(
    facilitatorClient,
  ).register(
    NETWORK,
    new ExactEvmScheme(),
  );

// ============================================================================
// PAID ENDPOINT CONFIGURATION
// ============================================================================

const routesConfig = {
  // --------------------------------------------------------------------------
  // SPACE NEWS
  // --------------------------------------------------------------------------

  "GET /api/trends": {
    accepts: [
      {
        scheme: "exact",
        price: "$0.02",
        network: NETWORK,
        payTo: PAY_TO,
      },
    ],

    description:
      "Returns the five newest spaceflight news articles.",

    mimeType: "application/json",
  },

  // --------------------------------------------------------------------------
  // WEBSITE SCRAPER
  // --------------------------------------------------------------------------

  "POST /api/scrape": {
    accepts: [
      {
        scheme: "exact",
        price: "$0.005",
        network: NETWORK,
        payTo: PAY_TO,
      },
    ],

    description:
      "Fetches a public webpage and returns cleaned readable text.",

    mimeType: "application/json",
  },

  // --------------------------------------------------------------------------
  // RECEIPT PARSER
  // --------------------------------------------------------------------------

  "POST /api/parse-receipt": {
    accepts: [
      {
        scheme: "exact",
        price: "$0.05",
        network: NETWORK,
        payTo: PAY_TO,
      },
    ],

    description:
      "Parses receipt text and extracts items, subtotal, tax, and total.",

    mimeType: "application/json",
  },
};

// ============================================================================
// ENABLE X402 PAYMENT PROTECTION
// ============================================================================

app.use(
  paymentMiddleware(
    routesConfig,
    resourceServer,
  ),
);

// ============================================================================
// TOOL #1
// SPACEFLIGHT TRENDS
// ============================================================================

app.get(
  "/api/trends",

  async (req, res) => {
    try {
      const response = await axios.get(
        "https://api.spaceflightnewsapi.net/v4/articles/",
        {
          timeout: 15000,

          params: {
            limit: 5,
            ordering: "-published_at",
          },

          headers: {
            Accept: "application/json",

            "User-Agent":
              "x402-trends-server/1.3",
          },
        },
      );

      const articles =
        Array.isArray(
          response.data?.results,
        )
          ? response.data.results
          : [];

      const trends = articles
        .slice(0, 5)
        .map((article) => {
          return {
            id: article.id,

            title: article.title,

            summary:
              article.summary,

            url: article.url,

            imageUrl:
              article.image_url,

            newsSite:
              article.news_site,

            publishedAt:
              article.published_at,
          };
        });

      return res.json({
        status: "success",

        payment:
          "verified",

        network: NETWORK,

        source:
          "Spaceflight News API",

        count:
          trends.length,

        retrievedAt:
          new Date().toISOString(),

        data: trends,
      });
    } catch (error) {
      console.error(
        "Trends error:",
        error.response?.data ||
          error.message,
      );

      return res.status(502).json({
        error:
          "Failed to retrieve space news.",
      });
    }
  },
);

// ============================================================================
// TOOL #2
// WEBSITE SCRAPER
// ============================================================================

app.post(
  "/api/scrape",

  async (req, res) => {
    try {
      const { url } =
        req.body || {};

      if (
        !url ||
        typeof url !== "string"
      ) {
        return res.status(400).json({
          error:
            "Please provide a URL.",

          example: {
            url:
              "https://example.com",
          },
        });
      }

      let parsedUrl;

      try {
        parsedUrl =
          new URL(url);
      } catch {
        return res.status(400).json({
          error:
            "Invalid URL.",
        });
      }

      if (
        parsedUrl.protocol !==
          "http:" &&
        parsedUrl.protocol !==
          "https:"
      ) {
        return res.status(400).json({
          error:
            "Only HTTP and HTTPS URLs are supported.",
        });
      }

      // Basic protection against obvious local-server requests.

      const blockedHosts = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "169.254.169.254",
      ];

      if (
        blockedHosts.includes(
          parsedUrl.hostname.toLowerCase(),
        )
      ) {
        return res.status(400).json({
          error:
            "Local/private URLs are not allowed.",
        });
      }

      const response =
        await axios.get(
          parsedUrl.toString(),
          {
            timeout: 12000,

            maxRedirects: 3,

            responseType:
              "text",

            maxContentLength:
              2_000_000,

            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; x402-trends-server/1.3)",

              Accept:
                "text/html,text/plain;q=0.9,*/*;q=0.5",
            },
          },
        );

      const html =
        String(
          response.data,
        );

      const cleanText =
        html
          .replace(
            /<script[\s\S]*?<\/script>/gi,
            " ",
          )

          .replace(
            /<style[\s\S]*?<\/style>/gi,
            " ",
          )

          .replace(
            /<noscript[\s\S]*?<\/noscript>/gi,
            " ",
          )

          .replace(
            /<svg[\s\S]*?<\/svg>/gi,
            " ",
          )

          .replace(
            /<[^>]+>/g,
            " ",
          )

          .replace(
            /&nbsp;/gi,
            " ",
          )

          .replace(
            /&amp;/gi,
            "&",
          )

          .replace(
            /&quot;/gi,
            '"',
          )

          .replace(
            /&#39;/gi,
            "'",
          )

          .replace(
            /\s+/g,
            " ",
          )

          .trim();

      const MAX_LENGTH =
        5000;

      return res.json({
        status: "success",

        payment:
          "verified",

        network:
          NETWORK,

        urlRequested:
          parsedUrl.toString(),

        charactersAvailable:
          cleanText.length,

        truncated:
          cleanText.length >
          MAX_LENGTH,

        extractedText:
          cleanText.slice(
            0,
            MAX_LENGTH,
          ),
      });
    } catch (error) {
      console.error(
        "Scrape error:",
        error.response?.status ||
          error.message,
      );

      return res.status(502).json({
        error:
          "Failed to scrape the webpage.",
      });
    }
  },
);

// ============================================================================
// RECEIPT FUNCTIONS
// ============================================================================

function extractMoney(
  line,
) {
  const matches = [
    ...line.matchAll(
      /(?:\$|USD\s*)?(-?\d{1,7}(?:,\d{3})*(?:\.\d{2}))/gi,
    ),
  ];

  if (
    matches.length === 0
  ) {
    return null;
  }

  const lastMatch =
    matches[
      matches.length - 1
    ];

  const value =
    lastMatch[1].replace(
      /,/g,
      "",
    );

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return null;
  }

  return number;
}

function findValue(
  lines,
  patterns,
) {
  for (
    const line of lines
  ) {
    const matches =
      patterns.some(
        (pattern) =>
          pattern.test(
            line,
          ),
      );

    if (!matches) {
      continue;
    }

    const amount =
      extractMoney(
        line,
      );

    if (
      amount !== null
    ) {
      return amount;
    }
  }

  return null;
}

function parseReceipt(
  text,
) {
  const lines =
    text
      .split(/\r?\n/)
      .map(
        (line) =>
          line.trim(),
      )
      .filter(Boolean);

  const subtotal =
    findValue(
      lines,
      [
        /\bsubtotal\b/i,
        /\bsub total\b/i,
      ],
    );

  const tax =
    findValue(
      lines,
      [
        /\btax\b/i,
        /\bsales tax\b/i,
      ],
    );

  const total =
    findValue(
      lines,
      [
        /\bgrand total\b/i,
        /\bamount due\b/i,
        /\bbalance due\b/i,
        /^total\b/i,
      ],
    );

  const ignored =
    /\b(subtotal|sub total|tax|grand total|amount due|balance due|total|change|cash|visa|mastercard|amex|credit|debit)\b/i;

  const items = [];

  for (
    const line of lines
  ) {
    if (
      ignored.test(line)
    ) {
      continue;
    }

    const amount =
      extractMoney(
        line,
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
          "",
        )

        .trim();

    if (!name) {
      continue;
    }

    items.push({
      name,
      amount,
    });
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

  async (req, res) => {
    try {
      const { text } =
        req.body || {};

      if (
        !text ||
        typeof text !==
          "string"
      ) {
        return res.status(400).json({
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
        50000
      ) {
        return res.status(400).json({
          error:
            "Receipt text is too large.",
        });
      }

      const parsed =
        parseReceipt(
          text,
        );

      return res.json({
        status: "success",

        payment:
          "verified",

        network:
          NETWORK,

        parsedData:
          parsed,
      });
    } catch (error) {
      console.error(
        "Receipt error:",
        error.message,
      );

      return res.status(500).json({
        error:
          "Failed to parse receipt.",
      });
    }
  },
);

// ============================================================================
// 404
// ============================================================================

app.use(
  (req, res) => {
    return res
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
  },
);

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

app.use(
  (
    error,
    req,
    res,
    next,
  ) => {
    console.error(
      "Server error:",
      error,
    );

    if (
      res.headersSent
    ) {
      return next(
        error,
      );
    }

    return res
      .status(500)
      .json({
        error:
          "Internal server error.",
      });
  },
);

// ============================================================================
// START SERVER
// ============================================================================

app.listen(
  PORT,
  HOST,
  () => {
    console.log("");
    console.log(
      "===================================================",
    );

    console.log(
      "🚀 x402 Trends Server is ONLINE",
    );

    console.log(
      "===================================================",
    );

    console.log(
      `Host: ${HOST}`,
    );

    console.log(
      `Port: ${PORT}`,
    );

    console.log(
      "Mode: TESTNET",
    );

    console.log(
      `Network: ${NETWORK}`,
    );

    console.log(
      `Facilitator: ${FACILITATOR_URL}`,
    );

    console.log(
      `Pay-to wallet: ${PAY_TO}`,
    );

    console.log("");
    console.log(
      "Free endpoints:",
    );

    console.log(
      "  GET  /",
    );

    console.log(
      "  GET  /health",
    );

    console.log(
      "  GET  /openapi.json",
    );

    console.log("");

    console.log(
      "Paid endpoints:",
    );

    console.log(
      "  GET  /api/trends          $0.02",
    );

    console.log(
      "  POST /api/scrape          $0.005",
    );

    console.log(
      "  POST /api/parse-receipt   $0.05",
    );

    console.log(
      "===================================================",
    );

    console.log(
      "✅ TESTNET facilitator configured.",
    );

    console.log(
      "✅ No Coinbase credentials required.",
    );

    console.log(
      "===================================================",
    );

    console.log("");
  },
);
