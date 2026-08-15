import express from "express";
import axios from "axios";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { paymentMiddleware } from "@x402/express";
import {
  x402ResourceServer,
  HTTPFacilitatorClient,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

// ============================================================================
// BASIC SERVER CONFIG
// ============================================================================

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

// Your current receiving wallet.
// This is a PUBLIC wallet address, so it is safe for server configuration.
//
// You can override it in Render with:
// X402_PAY_TO=0xYourWalletAddress
const PAY_TO =
  process.env.X402_PAY_TO ||
  "0xF61F957D9aC432309219549b1Ae79Ae8b7C71fF5";

// Base Mainnet by default.
//
// Base Mainnet:  eip155:8453
// Base Sepolia:  eip155:84532
const NETWORK = process.env.X402_NETWORK || "eip155:8453";

// Automatically choose a facilitator.
//
// Base Sepolia uses the x402 test facilitator.
// Base Mainnet uses Coinbase CDP's production facilitator.
const DEFAULT_FACILITATOR_URL =
  NETWORK === "eip155:84532"
    ? "https://x402.org/facilitator"
    : "https://api.cdp.coinbase.com/platform/v2/x402";

const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR_URL;

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
// PUBLIC ROUTES
//
// These are intentionally BEFORE the payment middleware.
// ============================================================================

app.get("/", (req, res) => {
  res.json({
    name: "x402 Trends Server",
    version: "1.1.0",
    status: "online",
    network: NETWORK,
    paymentProtocol: "x402",
    endpoints: {
      health: "/health",
      openapi: "/openapi.json",
      trends: "/api/trends",
      scrape: "/api/scrape",
      parseReceipt: "/api/parse-receipt",
    },
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "x402-trends-server",
    network: NETWORK,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// OPENAPI FILE
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/openapi.json", (req, res) => {
  res.sendFile(path.join(__dirname, "openapi.json"));
});

// ============================================================================
// X402 FACILITATOR + RESOURCE SERVER
// ============================================================================

console.log(`x402 network: ${NETWORK}`);
console.log(`x402 pay-to wallet: ${PAY_TO}`);
console.log(`x402 facilitator: ${FACILITATOR_URL}`);

const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
});

const resourceServer = new x402ResourceServer(facilitatorClient);

resourceServer.register(NETWORK, new ExactEvmScheme());

// ============================================================================
// X402 PAID ROUTES
// ============================================================================

const routesConfig = {
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
      "Fetches a public webpage and returns cleaned readable text.",

    mimeType: "application/json",

    extensions: {
      ...declareDiscoveryExtension({
        input: {
          url: "https://example.com",
        },

        inputSchema: {
          properties: {
            url: {
              type: "string",
              format: "uri",
              description: "Public HTTP or HTTPS webpage URL to scrape.",
            },
          },
          required: ["url"],
        },
      }),
    },
  },

  // --------------------------------------------------------------------------
  // RECEIPT TEXT PARSER
  //
  // Important:
  // This currently parses RECEIPT TEXT.
  // It does not yet perform OCR on receipt images.
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
      "Parses receipt text and extracts items, subtotal, tax, and total.",

    mimeType: "application/json",

    extensions: {
      ...declareDiscoveryExtension({
        input: {
          text: "Coffee 4.50\nSandwich 8.99\nTax 1.08\nTotal 14.57",
        },

        inputSchema: {
          properties: {
            text: {
              type: "string",
              description: "Raw text extracted from a receipt.",
            },
          },
          required: ["text"],
        },
      }),
    },
  },

  // --------------------------------------------------------------------------
  // SPACE / TREND NEWS
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
      "Returns the five newest spaceflight news articles.",

    mimeType: "application/json",

    extensions: {
      ...declareDiscoveryExtension({
        input: {},

        inputSchema: {
          properties: {},
          required: [],
        },
      }),
    },
  },
};

// ============================================================================
// ENABLE X402 PAYMENT PROTECTION
// ============================================================================

app.use(paymentMiddleware(routesConfig, resourceServer));

// ============================================================================
// SECURITY HELPERS FOR WEB SCRAPER
// ============================================================================

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);

  if (parts.length !== 4) {
    return true;
  }

  const [a, b] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;

  // 10.0.0.0/8
  if (a === 10) return true;

  // 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8
  if (a === 127) return true;

  // 169.254.0.0/16
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // Multicast / reserved ranges
  if (a >= 224) return true;

  return false;
}

function isPrivateIPv6(address) {
  const value = address.toLowerCase();

  if (value === "::1") return true;
  if (value === "::") return true;

  // Unique local
  if (value.startsWith("fc")) return true;
  if (value.startsWith("fd")) return true;

  // Link local
  if (
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb")
  ) {
    return true;
  }

  // IPv4 mapped IPv6
  if (value.startsWith("::ffff:")) {
    const ipv4 = value.replace("::ffff:", "");

    if (isIP(ipv4) === 4) {
      return isPrivateIPv4(ipv4);
    }
  }

  return false;
}

function isPrivateAddress(address) {
  const version = isIP(address);

  if (version === 4) {
    return isPrivateIPv4(address);
  }

  if (version === 6) {
    return isPrivateIPv6(address);
  }

  return true;
}

async function validatePublicUrl(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed.");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0"
  ) {
    throw new Error("Local network URLs are not allowed.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("Private network URLs are not allowed.");
    }

    return parsed.toString();
  }

  const addresses = await lookup(hostname, {
    all: true,
    verbatim: true,
  });

  if (!addresses.length) {
    throw new Error("Could not resolve hostname.");
  }

  for (const result of addresses) {
    if (isPrivateAddress(result.address)) {
      throw new Error("Private network URLs are not allowed.");
    }
  }

  return parsed.toString();
}

// ============================================================================
// TOOL #1
// WEB SCRAPER
// ============================================================================

app.post("/api/scrape", async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({
        error: "Please provide a URL.",
        example: {
          url: "https://example.com",
        },
      });
    }

    const targetUrl = await validatePublicUrl(url);

    const response = await axios.get(targetUrl, {
      timeout: 12000,
      maxRedirects: 0,
      responseType: "text",
      maxContentLength: 2_000_000,

      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; x402-trends-server/1.1)",
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.5",
      },

      validateStatus(status) {
        return status >= 200 && status < 300;
      },
    });

    const contentType = String(
      response.headers["content-type"] || "",
    ).toLowerCase();

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml")
    ) {
      return res.status(415).json({
        error: "The requested URL did not return readable webpage text.",
        contentType,
      });
    }

    const html = String(response.data);

    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();

    const MAX_OUTPUT_LENGTH = 5000;

    res.json({
      status: "success",
      message: "Payment verified. Webpage scraped successfully.",
      urlRequested: targetUrl,
      charactersAvailable: cleanText.length,
      truncated: cleanText.length > MAX_OUTPUT_LENGTH,
      extractedText: cleanText.slice(0, MAX_OUTPUT_LENGTH),
    });
  } catch (error) {
    console.error("Scrape error:", error.message);

    if (
      error.message === "Invalid URL." ||
      error.message.includes("not allowed") ||
      error.message.includes("Only HTTP") ||
      error.message.includes("resolve hostname")
    ) {
      return res.status(400).json({
        error: error.message,
      });
    }

    if (error.response) {
      return res.status(502).json({
        error: "The remote website rejected or failed the request.",
        remoteStatus: error.response.status,
      });
    }

    res.status(500).json({
      error: "Failed to scrape the webpage.",
    });
  }
});

// ============================================================================
// RECEIPT PARSER HELPERS
// ============================================================================

function getMoneyValue(line) {
  const matches = [
    ...line.matchAll(
      /(?:\$|USD\s*)?(-?\d{1,7}(?:,\d{3})*(?:\.\d{2}))/gi,
    ),
  ];

  if (!matches.length) {
    return null;
  }

  const value = matches[matches.length - 1][1].replace(/,/g, "");

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function findReceiptValue(lines, patterns) {
  for (const line of lines) {
    if (patterns.some((pattern) => pattern.test(line))) {
      const value = getMoneyValue(line);

      if (value !== null) {
        return value;
      }
    }
  }

  return null;
}

function parseReceiptText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const subtotal = findReceiptValue(lines, [
    /\bsubtotal\b/i,
    /\bsub total\b/i,
  ]);

  const tax = findReceiptValue(lines, [
    /\btax\b/i,
    /\bsales tax\b/i,
  ]);

  const total = findReceiptValue(lines, [
    /\bgrand total\b/i,
    /\bamount due\b/i,
    /\bbalance due\b/i,
    /^total\b/i,
  ]);

  const ignoredLine =
    /\b(subtotal|sub total|tax|grand total|amount due|balance due|total|change|cash|visa|mastercard|amex|credit|debit)\b/i;

  const items = [];

  for (const line of lines) {
    if (ignoredLine.test(line)) {
      continue;
    }

    const amount = getMoneyValue(line);

    if (amount === null) {
      continue;
    }

    const itemName = line
      .replace(
        /(?:\$|USD\s*)?-?\d{1,7}(?:,\d{3})*(?:\.\d{2})\s*$/i,
        "",
      )
      .trim();

    if (!itemName) {
      continue;
    }

    items.push({
      name: itemName,
      amount,
    });
  }

  return {
    items,
    subtotal,
    tax,
    total,
    linesDetected: lines.length,
  };
}

// ============================================================================
// TOOL #2
// RECEIPT TEXT PARSER
// ============================================================================

app.post("/api/parse-receipt", async (req, res) => {
  try {
    const { text } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Please provide receipt text.",
        example: {
          text: "Coffee 4.50\nSandwich 8.99\nTax 1.08\nTotal 14.57",
        },
      });
    }

    if (text.length > 50_000) {
      return res.status(400).json({
        error: "Receipt text is too large.",
      });
    }

    const parsedData = parseReceiptText(text);

    res.json({
      status: "success",
      message: "Payment verified. Receipt text parsed successfully.",
      parsedData,
    });
  } catch (error) {
    console.error("Receipt parser error:", error);

    res.status(500).json({
      error: "Failed to parse receipt.",
    });
  }
});

// ============================================================================
// TOOL #3
// CURRENT SPACE NEWS / TRENDS
// ============================================================================

app.get("/api/trends", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.spaceflightnewsapi.net/v4/articles/",
      {
        timeout: 12000,

        params: {
          limit: 5,
          ordering: "-published_at",
        },

        headers: {
          Accept: "application/json",
          "User-Agent": "x402-trends-server/1.1",
        },
      },
    );

    const articles = Array.isArray(response.data?.results)
      ? response.data.results
      : [];

    const trends = articles.slice(0, 5).map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      url: article.url,
      imageUrl: article.image_url,
      newsSite: article.news_site,
      publishedAt: article.published_at,
      updatedAt: article.updated_at,
    }));

    res.json({
      status: "success",
      message: "Payment verified. Latest space trends retrieved.",
      source: "Spaceflight News API",
      count: trends.length,
      retrievedAt: new Date().toISOString(),
      data: trends,
    });
  } catch (error) {
    console.error(
      "Trends API error:",
      error.response?.data || error.message,
    );

    res.status(502).json({
      error: "Failed to gather the latest space trends.",
    });
  }
});

// ============================================================================
// 404 HANDLER
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found.",
    availableEndpoints: [
      "GET /",
      "GET /health",
      "GET /openapi.json",
      "GET /api/trends",
      "POST /api/scrape",
      "POST /api/parse-receipt",
    ],
  });
});

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Internal server error.",
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, HOST, () => {
  console.log("");
  console.log("============================================");
  console.log("🚀 x402 Trends Server is ONLINE");
  console.log("============================================");
  console.log(`Host: ${HOST}`);
  console.log(`Port: ${PORT}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Pay-to wallet: ${PAY_TO}`);
  console.log(`Facilitator: ${FACILITATOR_URL}`);
  console.log("");
  console.log("Free endpoints:");
  console.log("  GET /");
  console.log("  GET /health");
  console.log("  GET /openapi.json");
  console.log("");
  console.log("Paid endpoints:");
  console.log("  GET  /api/trends          $0.02");
  console.log("  POST /api/scrape          $0.005");
  console.log("  POST /api/parse-receipt   $0.05");
  console.log("============================================");
  console.log("");
});
