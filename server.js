import express from "express";
import axios from "axios";
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
// x402 AGENT DATA API
// VERSION 2.2.0
// Base Mainnet + Coinbase CDP + Bazaar Discovery
// ============================================================================

const app = express();

app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const VERSION = "2.2.0";
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const NETWORK = "eip155:8453";

const PAY_TO = process.env.X402_PAY_TO;
const SERVICE_CONTACT = process.env.SERVICE_CONTACT;

if (!PAY_TO || !/^0x[a-fA-F0-9]{40}$/.test(PAY_TO)) {
  console.error("❌ Missing or invalid X402_PAY_TO.");
  process.exit(1);
}

if (!process.env.CDP_API_KEY_ID) {
  console.error("❌ Missing CDP_API_KEY_ID.");
  process.exit(1);
}

if (!process.env.CDP_API_KEY_SECRET) {
  console.error("❌ Missing CDP_API_KEY_SECRET.");
  process.exit(1);
}

if (!SERVICE_CONTACT || !SERVICE_CONTACT.includes("@")) {
  console.error("❌ Missing SERVICE_CONTACT.");
  console.error(
    'Add a Render environment variable such as: SERVICE_CONTACT="x402 Agent Data API your-email@example.com"'
  );
  process.exit(1);
}

const APP_USER_AGENT =
  `${SERVICE_CONTACT} x402-agent-data-api/${VERSION}`;

// ============================================================================
// FREE ROUTES
// ============================================================================

app.get("/", (_req, res) => {
  res.json({
    name: "x402 Agent Data API",
    version: VERSION,
    status: "online",
    mode: "PRODUCTION",

    network: NETWORK,
    networkName: "Base Mainnet",

    currency: "USDC",
    paymentProtocol: "x402",

    bazaarDiscovery: true,

    receivingWallet: PAY_TO,

    paidEndpoints: {
      scrape: {
        method: "POST",
        path: "/api/scrape",
        price: "$0.005",
      },

      exchangeRate: {
        method: "GET",
        path: "/api/exchange-rate",
        price: "$0.01",
      },

      trends: {
        method: "GET",
        path: "/api/trends",
        price: "$0.02",
      },

      weather: {
        method: "GET",
        path: "/api/weather",
        price: "$0.02",
      },

      urlAnalyze: {
        method: "POST",
        path: "/api/url-analyze",
        price: "$0.03",
      },

      parseReceipt: {
        method: "POST",
        path: "/api/parse-receipt",
        price: "$0.05",
      },

      newsBrief: {
        method: "GET",
        path: "/api/news-brief",
        price: "$0.05",
      },

      secCompany: {
        method: "GET",
        path: "/api/sec-company",
        price: "$0.05",
      },

      websiteResearch: {
        method: "POST",
        path: "/api/website-research",
        price: "$0.10",
      },
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",

    service:
      "x402-agent-data-api",

    version:
      VERSION,

    mode:
      "PRODUCTION",

    network:
      NETWORK,

    bazaarDiscovery:
      true,

    timestamp:
      new Date().toISOString(),
  });
});

// ============================================================================
// OPENAPI
// ============================================================================

app.get("/openapi.json", (_req, res) => {
  res.json({
    openapi:
      "3.1.0",

    info: {
      title:
        "x402 Agent Data API",

      version:
        VERSION,

      description:
        "Paid AI-agent data tools using x402 on Base Mainnet.",
    },

    servers: [
      {
        url:
          "https://x402-trends-server.onrender.com",
      },
    ],

    paths: {
      "/api/scrape": {
        post: {
          summary:
            "Extract readable webpage text",

          responses: {
            402: {
              description:
                "Payment required",
            },

            200: {
              description:
                "Success",
            },
          },
        },
      },

      "/api/exchange-rate": {
        get: {
          summary:
            "Convert currencies",

          responses: {
            402: {
              description:
                "Payment required",
            },

            200: {
              description:
                "Success",
            },
          },
        },
      },

      "/api/trends": {
        get: {
          summary:
            "Latest spaceflight news",

          responses: {
            402: {
              description:
                "Payment required",
            },

            200: {
              description:
                "Success",
            },
          },
        },
      },

      "/api/weather": {
        get: {
          summary:
            "U.S. weather forecast by coordinates",

          responses: {
            402: {
              description:
                "Payment required",
            },

            200: {
              description:
                "Success",
            },
          },
        },
      },

      "/api/url-analyze": {
        post: {
          summary:
            "Analyze webpage structure and metadata",

          responses: {
            402: {
              description:
                "Payment required",
            },

            200: {
              description:
                "Success",
            },
          },
        },
      },

      "/api/parse-receipt": {
        post: {
          summary:
            "Parse receipt text",

          responses: {
            402: {
              description:
                "Payment required",
            },

            200: {
              description:
                "Success",
            },
          },
        },
      },

      "/api/news-brief": {
        get: {
          summary:
            "Search recent news by topic",

          responses: {
            402: {
              description:
                "Payment required",
            },

            200: {
              description:
                "Success",
            },
          },
        },
      },

      "/api/sec-company": {
        get: {
          summary:
            "SEC company and recent filing data",

          responses: {
            402: {
              description:
                "Payment required",
            },

            200: {
              description:
                "Success",
            },
          },
        },
      },

      "/api/website-research": {
        post: {
          summary:
            "Detailed website research snapshot",

          responses: {
            402: {
              description:
                "Payment required",
            },

            200: {
              description:
                "Success",
            },
          },
        },
      },
    },
  });
});

// ============================================================================
// X402 / COINBASE CDP / BAZAAR
// ============================================================================

const facilitatorClient =
  createCdpFacilitatorClient();

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
// SUCCESSFUL PAYMENT LOGGING
// ============================================================================

resourceServer.onAfterSettle(
  async ({
    result,
    requirements,
  }) => {
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
        String(
          requirements?.amount ||
          "unknown"
        )
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
// BAZAAR DISCOVERY HELPERS
// ============================================================================

function makeDiscovery({
  input = {},
  inputSchema,
  outputExample,
  outputSchema,
  bodyType,
}) {
  return declareDiscoveryExtension({
    ...(
      bodyType
        ? {
            bodyType,
          }
        : {}
    ),

    input,

    inputSchema,

    output: {
      example:
        outputExample,

      schema:
        outputSchema,
    },
  });
}

const simpleObjectSchema = {
  type:
    "object",

  additionalProperties:
    true,
};

// ============================================================================
// BAZAAR: SPACE TRENDS
// ============================================================================

const trendsDiscovery =
  makeDiscovery({
    input: {},

    inputSchema: {
      type:
        "object",

      properties: {},

      required: [],
    },

    outputExample: {
      status:
        "success",

      source:
        "Spaceflight News API",

      count:
        5,

      data: [
        {
          title:
            "Example headline",

          url:
            "https://example.com/article",
        },
      ],
    },

    outputSchema:
      simpleObjectSchema,
  });

// ============================================================================
// BAZAAR: SCRAPER
// ============================================================================

const scrapeDiscovery =
  makeDiscovery({
    bodyType:
      "json",

    input: {
      url:
        "https://example.com",
    },

    inputSchema: {
      type:
        "object",

      properties: {
        url: {
          type:
            "string",

          format:
            "uri",
        },
      },

      required: [
        "url",
      ],

      additionalProperties:
        false,
    },

    outputExample: {
      status:
        "success",

      urlRequested:
        "https://example.com/",

      extractedText:
        "Example Domain...",
    },

    outputSchema:
      simpleObjectSchema,
  });

// ============================================================================
// BAZAAR: EXCHANGE RATE
// ============================================================================

const exchangeDiscovery =
  makeDiscovery({
    input: {
      from:
        "USD",

      to:
        "EUR",

      amount:
        100,
    },

    inputSchema: {
      type:
        "object",

      properties: {
        from: {
          type:
            "string",
        },

        to: {
          type:
            "string",
        },

        amount: {
          type:
            "number",
        },
      },

      required: [
        "from",
        "to",
      ],
    },

    outputExample: {
      status:
        "success",

      from:
        "USD",

      to:
        "EUR",

      amount:
        100,

      rate:
        0.86,

      convertedAmount:
        86,
    },

    outputSchema:
      simpleObjectSchema,
  });

// ============================================================================
// BAZAAR: WEATHER
// ============================================================================

const weatherDiscovery =
  makeDiscovery({
    input: {
      lat:
        33.68,

      lon:
        -117.18,
    },

    inputSchema: {
      type:
        "object",

      properties: {
        lat: {
          type:
            "number",

          minimum:
            -90,

          maximum:
            90,
        },

        lon: {
          type:
            "number",

          minimum:
            -180,

          maximum:
            180,
        },
      },

      required: [
        "lat",
        "lon",
      ],
    },

    outputExample: {
      status:
        "success",

      source:
        "NOAA National Weather Service",

      location: {
        city:
          "Example City",

        state:
          "CA",
      },

      periods: [
        {
          name:
            "Tonight",

          temperature:
            65,

          temperatureUnit:
            "F",

          shortForecast:
            "Mostly Clear",
        },
      ],
    },

    outputSchema:
      simpleObjectSchema,
  });

// ============================================================================
// BAZAAR: URL ANALYZER
// ============================================================================

const urlAnalyzeDiscovery =
  makeDiscovery({
    bodyType:
      "json",

    input: {
      url:
        "https://example.com",
    },

    inputSchema: {
      type:
        "object",

      properties: {
        url: {
          type:
            "string",

          format:
            "uri",
        },
      },

      required: [
        "url",
      ],

      additionalProperties:
        false,
    },

    outputExample: {
      status:
        "success",

      url:
        "https://example.com/",

      title:
        "Example Domain",

      wordCount:
        350,

      headings: [
        "Example Domain",
      ],

      linkCount:
        4,
    },

    outputSchema:
      simpleObjectSchema,
  });

// ============================================================================
// BAZAAR: RECEIPT PARSER
// ============================================================================

const receiptDiscovery =
  makeDiscovery({
    bodyType:
      "json",

    input: {
      text:
        "Coffee 4.50\nTax 0.36\nTotal 4.86",
    },

    inputSchema: {
      type:
        "object",

      properties: {
        text: {
          type:
            "string",
        },
      },

      required: [
        "text",
      ],

      additionalProperties:
        false,
    },

    outputExample: {
      status:
        "success",

      parsedData: {
        items: [
          {
            name:
              "Coffee",

            amount:
              4.5,
          },
        ],

        tax:
          0.36,

        total:
          4.86,
      },
    },

    outputSchema:
      simpleObjectSchema,
  });

// ============================================================================
// BAZAAR: NEWS
// ============================================================================

const newsDiscovery =
  makeDiscovery({
    input: {
      topic:
        "artificial intelligence",

      limit:
        10,

      timespan:
        "24h",
    },

    inputSchema: {
      type:
        "object",

      properties: {
        topic: {
          type:
            "string",
        },

        limit: {
          type:
            "integer",

          minimum:
            1,

          maximum:
            25,
        },

        timespan: {
          type:
            "string",
        },
      },

      required: [
        "topic",
      ],
    },

    outputExample: {
      status:
        "success",

      topic:
        "artificial intelligence",

      count:
        10,

      articles: [
        {
          title:
            "Example article",

          url:
            "https://example.com/news",
        },
      ],
    },

    outputSchema:
      simpleObjectSchema,
  });

// ============================================================================
// BAZAAR: SEC
// ============================================================================

const secDiscovery =
  makeDiscovery({
    input: {
      ticker:
        "TSLA",
    },

    inputSchema: {
      type:
        "object",

      properties: {
        ticker: {
          type:
            "string",
        },
      },

      required: [
        "ticker",
      ],
    },

    outputExample: {
      status:
        "success",

      source:
        "U.S. SEC EDGAR",

      ticker:
        "TSLA",

      company:
        "Tesla, Inc.",

      recentFilings: [
        {
          form:
            "10-Q",

          filingDate:
            "2026-07-24",
        },
      ],
    },

    outputSchema:
      simpleObjectSchema,
  });

// ============================================================================
// BAZAAR: WEBSITE RESEARCH
// ============================================================================

const researchDiscovery =
  makeDiscovery({
    bodyType:
      "json",

    input: {
      url:
        "https://example.com",
    },

    inputSchema: {
      type:
        "object",

      properties: {
        url: {
          type:
            "string",

          format:
            "uri",
        },
      },

      required: [
        "url",
      ],

      additionalProperties:
        false,
    },

    outputExample: {
      status:
        "success",

      url:
        "https://example.com/",

      domain:
        "example.com",

      profile: {
        title:
          "Example Domain",

        wordCount:
          350,
      },

      topExternalDomains: [],

      textExcerpt:
        "Example Domain...",
    },

    outputSchema:
      simpleObjectSchema,
  });

// ============================================================================
// PAID X402 ROUTES
// ============================================================================

const routesConfig = {
  "POST /api/scrape": {
    accepts: [
      {
        scheme:
          "exact",

        network:
          NETWORK,

        payTo:
          PAY_TO,

        price:
          "$0.005",
      },
    ],

    description:
      "Fetch a public webpage and return cleaned readable text for agent research, extraction, summarization, or analysis.",

    mimeType:
      "application/json",

    extensions: {
      ...scrapeDiscovery,
    },
  },

  "GET /api/exchange-rate": {
    accepts: [
      {
        scheme:
          "exact",

        network:
          NETWORK,

        payTo:
          PAY_TO,

        price:
          "$0.01",
      },
    ],

    description:
      "Convert an amount between two currency codes using current reference exchange-rate data.",

    mimeType:
      "application/json",

    extensions: {
      ...exchangeDiscovery,
    },
  },

  "GET /api/trends": {
    accepts: [
      {
        scheme:
          "exact",

        network:
          NETWORK,

        payTo:
          PAY_TO,

        price:
          "$0.02",
      },
    ],

    description:
      "Get the five newest spaceflight news stories with titles, summaries, sources, article URLs, images, and publication times.",

    mimeType:
      "application/json",

    extensions: {
      ...trendsDiscovery,
    },
  },

  "GET /api/weather": {
    accepts: [
      {
        scheme:
          "exact",

        network:
          NETWORK,

        payTo:
          PAY_TO,

        price:
          "$0.02",
      },
    ],

    description:
      "Get a U.S. National Weather Service forecast for latitude and longitude coordinates.",

    mimeType:
      "application/json",

    extensions: {
      ...weatherDiscovery,
    },
  },

  "POST /api/url-analyze": {
    accepts: [
      {
        scheme:
          "exact",

        network:
          NETWORK,

        payTo:
          PAY_TO,

        price:
          "$0.03",
      },
    ],

    description:
      "Analyze a public webpage and return title, description, headings, word count, links, emails, social links, and page metadata.",

    mimeType:
      "application/json",

    extensions: {
      ...urlAnalyzeDiscovery,
    },
  },

  "POST /api/parse-receipt": {
    accepts: [
      {
        scheme:
          "exact",

        network:
          NETWORK,

        payTo:
          PAY_TO,

        price:
          "$0.05",
      },
    ],

    description:
      "Parse raw receipt text into structured line items, subtotal, tax, and total. This endpoint does not perform image OCR.",

    mimeType:
      "application/json",

    extensions: {
      ...receiptDiscovery,
    },
  },

  "GET /api/news-brief": {
    accepts: [
      {
        scheme:
          "exact",

        network:
          NETWORK,

        payTo:
          PAY_TO,

        price:
          "$0.05",
      },
    ],

    description:
      "Search recent global news for a topic and return structured headlines, source domains, URLs, dates, and source counts.",

    mimeType:
      "application/json",

    extensions: {
      ...newsDiscovery,
    },
  },

  "GET /api/sec-company": {
    accepts: [
      {
        scheme:
          "exact",

        network:
          NETWORK,

        payTo:
          PAY_TO,

        price:
          "$0.05",
      },
    ],

    description:
      "Get U.S. SEC EDGAR company information and recent filings for a public-company ticker symbol.",

    mimeType:
      "application/json",

    extensions: {
      ...secDiscovery,
    },
  },

  "POST /api/website-research": {
    accepts: [
      {
        scheme:
          "exact",

        network:
          NETWORK,

        payTo:
          PAY_TO,

        price:
          "$0.10",
      },
    ],

    description:
      "Create a detailed research snapshot of a public website including metadata, headings, text, social links, emails, and external-domain analysis.",

    mimeType:
      "application/json",

    extensions: {
      ...researchDiscovery,
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
// PUBLIC-WEB SAFETY
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
      (n) =>
        !Number.isInteger(n) ||
        n < 0 ||
        n > 255
    )
  ) {
    return true;
  }

  const [a, b] =
    parts;

  if (
    a === 0 ||
    a === 10 ||
    a === 127
  ) {
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

  if (
    a >= 224
  ) {
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
    value.startsWith(
      "fc"
    ) ||
    value.startsWith(
      "fd"
    )
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
      new URL(
        rawUrl
      );
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
    isIP(
      hostname
    )
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
        all:
          true,

        verbatim:
          true,
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
// HTML HELPERS
// ============================================================================

function decodeHtmlEntities(
  text
) {
  return String(
    text
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
      /&lt;/gi,
      "<"
    )

    .replace(
      /&gt;/gi,
      ">"
    );
}

function htmlToText(
  html
) {
  return decodeHtmlEntities(
    String(
      html
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
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function firstMatch(
  html,
  regex
) {
  const match =
    String(
      html
    ).match(
      regex
    );

  return match?.[1]
    ? decodeHtmlEntities(
        match[1].trim()
      )
    : null;
}

function unique(
  values
) {
  return [
    ...new Set(
      values.filter(
        Boolean
      )
    ),
  ];
}

function absoluteUrl(
  value,
  baseUrl
) {
  try {
    return new URL(
      value,
      baseUrl
    ).toString();
  } catch {
    return null;
  }
}

// ============================================================================
// SAFE WEBPAGE FETCHER
// ============================================================================

async function fetchPublicPage(
  rawUrl
) {
  const targetUrl =
    await validatePublicUrl(
      rawUrl
    );

  const response =
    await axios.get(
      targetUrl,

      {
        timeout:
          12000,

        maxRedirects:
          0,

        responseType:
          "text",

        maxContentLength:
          2_000_000,

        headers: {
          "User-Agent":
            `Mozilla/5.0 (compatible; x402-agent-data-api/${VERSION})`,

          Accept:
            "text/html,text/plain;q=0.9,*/*;q=0.5",
        },

        validateStatus:
          (
            status
          ) =>
            status >= 200 &&
            status < 300,
      }
    );

  const contentType =
    String(
      response.headers[
        "content-type"
      ] ||
      ""
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
    const error =
      new Error(
        "The requested URL did not return readable webpage text."
      );

    error.statusCode =
      415;

    throw error;
  }

  return {
    targetUrl,

    html:
      String(
        response.data
      ),

    contentType,
  };
}

// ============================================================================
// WEBSITE ANALYSIS
// ============================================================================

function analyzeHtml(
  html,
  baseUrl
) {
  const text =
    htmlToText(
      html
    );

  const title =
    firstMatch(
      html,
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  const description =
    firstMatch(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i
    ) ||

    firstMatch(
      html,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i
    );

  const canonicalRaw =
    firstMatch(
      html,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i
    ) ||

    firstMatch(
      html,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i
    );

  const language =
    firstMatch(
      html,
      /<html[^>]+lang=["']([^"']+)["'][^>]*>/i
    );

  const headingMatches = [
    ...String(
      html
    ).matchAll(
      /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
    ),
  ];

  const headings =
    unique(
      headingMatches
        .map(
          (m) =>
            htmlToText(
              m[1]
            )
        )
        .filter(
          Boolean
        )
    ).slice(
      0,
      50
    );

  const hrefMatches = [
    ...String(
      html
    ).matchAll(
      /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
    ),
  ];

  const links =
    unique(
      hrefMatches
        .map(
          (m) =>
            absoluteUrl(
              m[1],
              baseUrl
            )
        )
        .filter(
          Boolean
        )
    ).slice(
      0,
      500
    );

  const baseHost =
    new URL(
      baseUrl
    )
      .hostname
      .replace(
        /^www\./i,
        ""
      );

  const externalLinks =
    links.filter(
      (link) => {
        try {
          return (
            new URL(
              link
            )
              .hostname
              .replace(
                /^www\./i,
                ""
              ) !==
            baseHost
          );
        } catch {
          return false;
        }
      }
    );

  const emails =
    unique([
      ...[
        ...String(
          html
        ).matchAll(
          /mailto:([^?"'<>\s]+)/gi
        ),
      ].map(
        (m) =>
          m[1]
      ),

      ...[
        ...text.matchAll(
          /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
        ),
      ].map(
        (m) =>
          m[0]
      ),
    ]).slice(
      0,
      25
    );

  const socialDomains = {
    linkedin:
      "linkedin.com",

    x:
      "x.com",

    twitter:
      "twitter.com",

    facebook:
      "facebook.com",

    instagram:
      "instagram.com",

    youtube:
      "youtube.com",

    github:
      "github.com",

    tiktok:
      "tiktok.com",
  };

  const socialLinks = {};

  for (
    const [
      name,
      domain,
    ] of
      Object.entries(
        socialDomains
      )
  ) {
    const found =
      links.find(
        (link) => {
          try {
            return (
              new URL(
                link
              )
                .hostname
                .toLowerCase()
                .includes(
                  domain
                )
            );
          } catch {
            return false;
          }
        }
      );

    if (found) {
      socialLinks[
        name
      ] =
        found;
    }
  }

  return {
    title,

    description,

    canonical:
      canonicalRaw
        ? absoluteUrl(
            canonicalRaw,
            baseUrl
          )
        : null,

    language,

    wordCount:
      text
        ? text
            .split(
              /\s+/
            )
            .filter(
              Boolean
            )
            .length
        : 0,

    headings,

    linkCount:
      links.length,

    externalLinkCount:
      externalLinks.length,

    emails,

    socialLinks,

    links,

    text,
  };
}

function buildExternalDomainCounts(
  links,
  baseUrl
) {
  const baseHost =
    new URL(
      baseUrl
    )
      .hostname
      .replace(
        /^www\./i,
        ""
      );

  const counts =
    new Map();

  for (
    const link of
      links
  ) {
    try {
      const host =
        new URL(
          link
        )
          .hostname
          .replace(
            /^www\./i,
            ""
          );

      if (
        host &&
        host !==
          baseHost
      ) {
        counts.set(
          host,

          (
            counts.get(
              host
            ) ||
            0
          ) +
            1
        );
      }
    } catch {
      // Ignore bad links.
    }
  }

  return [
    ...counts.entries(),
  ]
    .map(
      ([
        domain,
        linksCount,
      ]) => ({
        domain,

        links:
          linksCount,
      })
    )

    .sort(
      (a, b) =>
        b.links -
        a.links
    )

    .slice(
      0,
      15
    );
}

// ============================================================================
// WEBPAGE ERROR HANDLER
// ============================================================================

function handlePublicPageError(
  error,
  res
) {
  console.error(
    "Public page error:",

    error.response?.data ||
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
    error.statusCode ===
    415
  ) {
    return res
      .status(415)
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

  return res
    .status(500)
    .json({
      error:
        "Failed to process the webpage.",
    });
}

// ============================================================================
// TOOL #1
// WEB SCRAPER
// $0.005
// ============================================================================

app.post(
  "/api/scrape",

  async (
    req,
    res
  ) => {
    const { url } =
      req.body ||
      {};

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

    try {
      const {
        targetUrl,
        html,
      } =
        await fetchPublicPage(
          url
        );

      const cleanText =
        htmlToText(
          html
        );

      const MAX_LENGTH =
        5000;

      return res.json({
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
    } catch (
      error
    ) {
      return handlePublicPageError(
        error,
        res
      );
    }
  }
);

// ============================================================================
// TOOL #2
// EXCHANGE RATE
// $0.01
// ============================================================================

app.get(
  "/api/exchange-rate",

  async (
    req,
    res
  ) => {
    const from =
      String(
        req.query.from ||
        ""
      )
        .trim()
        .toUpperCase();

    const to =
      String(
        req.query.to ||
        ""
      )
        .trim()
        .toUpperCase();

    const amount =
      req.query.amount ===
      undefined
        ? 1
        : Number(
            req.query.amount
          );

    if (
      !/^[A-Z]{3}$/.test(
        from
      ) ||

      !/^[A-Z]{3}$/.test(
        to
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "from and to must be three-letter currency codes, such as USD and EUR.",
        });
    }

    if (
      !Number.isFinite(
        amount
      ) ||

      amount <= 0 ||

      amount >
        1_000_000_000
    ) {
      return res
        .status(400)
        .json({
          error:
            "amount must be a positive number no greater than 1,000,000,000.",
        });
    }

    if (
      from ===
      to
    ) {
      return res.json({
        status:
          "success",

        payment:
          "verified",

        source:
          "Identity conversion",

        date:
          new Date()
            .toISOString()
            .slice(
              0,
              10
            ),

        from,

        to,

        amount,

        rate:
          1,

        convertedAmount:
          amount,
      });
    }

    try {
      const response =
        await axios.get(
          "https://api.frankfurter.app/latest",

          {
            timeout:
              12000,

            params: {
              from,

              to,

              amount,
            },

            headers: {
              Accept:
                "application/json",

              "User-Agent":
                `x402-agent-data-api/${VERSION}`,
            },
          }
        );

      const convertedAmount =
        Number(
          response.data
            ?.rates?.[
              to
            ]
        );

      if (
        !Number.isFinite(
          convertedAmount
        )
      ) {
        return res
          .status(502)
          .json({
            error:
              "Exchange-rate provider did not return the requested conversion.",
          });
      }

      return res.json({
        status:
          "success",

        payment:
          "verified",

        source:
          "Frankfurter",

        date:
          response.data
            ?.date ||
          null,

        from,

        to,

        amount,

        rate:
          convertedAmount /
          amount,

        convertedAmount,
      });
    } catch (
      error
    ) {
      console.error(
        "Exchange-rate error:",

        error.response
          ?.data ||
          error.message
      );

      return res
        .status(502)
        .json({
          error:
            "Failed to retrieve exchange-rate data.",
        });
    }
  }
);

// ============================================================================
// TOOL #3
// SPACE TRENDS
// $0.02
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
            timeout:
              15000,

            params: {
              limit:
                5,

              ordering:
                "-published_at",
            },

            headers: {
              Accept:
                "application/json",

              "User-Agent":
                `x402-agent-data-api/${VERSION}`,
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

      const data =
        articles
          .slice(
            0,
            5
          )
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

      return res.json({
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
          data.length,

        retrievedAt:
          new Date().toISOString(),

        data,
      });
    } catch (
      error
    ) {
      console.error(
        "Trends error:",

        error.response
          ?.data ||
          error.message
      );

      return res
        .status(502)
        .json({
          error:
            "Failed to retrieve space news.",
        });
    }
  }
);

// ============================================================================
// TOOL #4
// WEATHER
// $0.02
// ============================================================================

app.get(
  "/api/weather",

  async (
    req,
    res
  ) => {
    const lat =
      Number(
        req.query.lat
      );

    const lon =
      Number(
        req.query.lon
      );

    if (
      !Number.isFinite(
        lat
      ) ||

      lat < -90 ||

      lat > 90 ||

      !Number.isFinite(
        lon
      ) ||

      lon < -180 ||

      lon > 180
    ) {
      return res
        .status(400)
        .json({
          error:
            "Provide valid lat and lon coordinates.",
        });
    }

    try {
      const pointsResponse =
        await axios.get(
          `https://api.weather.gov/points/${lat},${lon}`,

          {
            timeout:
              12000,

            headers: {
              Accept:
                "application/geo+json",

              "User-Agent":
                APP_USER_AGENT,
            },
          }
        );

      const properties =
        pointsResponse.data
          ?.properties;

      const forecastUrl =
        properties
          ?.forecast;

      if (
        !forecastUrl
      ) {
        return res
          .status(404)
          .json({
            error:
              "National Weather Service forecast is unavailable for these coordinates.",
          });
      }

      const forecastResponse =
        await axios.get(
          forecastUrl,

          {
            timeout:
              12000,

            headers: {
              Accept:
                "application/geo+json",

              "User-Agent":
                APP_USER_AGENT,
            },
          }
        );

      const periods =
        Array.isArray(
          forecastResponse
            .data
            ?.properties
            ?.periods
        )
          ? forecastResponse
              .data
              .properties
              .periods
              .slice(
                0,
                10
              )
              .map(
                (
                  period
                ) => ({
                  name:
                    period.name,

                  startTime:
                    period.startTime,

                  endTime:
                    period.endTime,

                  isDaytime:
                    period.isDaytime,

                  temperature:
                    period.temperature,

                  temperatureUnit:
                    period.temperatureUnit,

                  windSpeed:
                    period.windSpeed,

                  windDirection:
                    period.windDirection,

                  shortForecast:
                    period.shortForecast,

                  detailedForecast:
                    period.detailedForecast,
                })
              )
          : [];

      return res.json({
        status:
          "success",

        payment:
          "verified",

        source:
          "NOAA National Weather Service",

        coordinates: {
          lat,

          lon,
        },

        location: {
          city:
            properties
              ?.relativeLocation
              ?.properties
              ?.city ||
            null,

          state:
            properties
              ?.relativeLocation
              ?.properties
              ?.state ||
            null,
        },

        periods,

        retrievedAt:
          new Date().toISOString(),
      });
    } catch (
      error
    ) {
      console.error(
        "Weather error:",

        error.response
          ?.data ||
          error.message
      );

      if (
        error.response
          ?.status ===
        404
      ) {
        return res
          .status(404)
          .json({
            error:
              "National Weather Service data is unavailable for these coordinates. This endpoint is intended for U.S. NWS coverage.",
          });
      }

      return res
        .status(502)
        .json({
          error:
            "Failed to retrieve weather data.",
        });
    }
  }
);

// ============================================================================
// TOOL #5
// URL ANALYZER
// $0.03
// ============================================================================

app.post(
  "/api/url-analyze",

  async (
    req,
    res
  ) => {
    const { url } =
      req.body ||
      {};

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

    try {
      const {
        targetUrl,
        html,
        contentType,
      } =
        await fetchPublicPage(
          url
        );

      const analysis =
        analyzeHtml(
          html,
          targetUrl
        );

      return res.json({
        status:
          "success",

        payment:
          "verified",

        url:
          targetUrl,

        contentType,

        title:
          analysis.title,

        description:
          analysis.description,

        canonical:
          analysis.canonical,

        language:
          analysis.language,

        wordCount:
          analysis.wordCount,

        headings:
          analysis.headings,

        linkCount:
          analysis.linkCount,

        externalLinkCount:
          analysis.externalLinkCount,

        emails:
          analysis.emails,

        socialLinks:
          analysis.socialLinks,

        retrievedAt:
          new Date().toISOString(),
      });
    } catch (
      error
    ) {
      return handlePublicPageError(
        error,
        res
      );
    }
  }
);

// ============================================================================
// RECEIPT HELPERS
// ============================================================================

function extractMoney(
  line
) {
  const matches = [
    ...String(
      line
    ).matchAll(
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
      matches.length -
      1
    ][1].replace(
      /,/g,
      ""
    );

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function findReceiptValue(
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

function parseReceiptText(
  text
) {
  const lines =
    String(
      text
    )
      .split(
        /\r?\n/
      )

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
    findReceiptValue(
      lines,

      [
        /\bsubtotal\b/i,

        /\bsub total\b/i,
      ]
    );

  const tax =
    findReceiptValue(
      lines,

      [
        /\btax\b/i,

        /\bsales tax\b/i,
      ]
    );

  const total =
    findReceiptValue(
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
      amount ===
      null
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

    if (
      name
    ) {
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
// TOOL #6
// RECEIPT PARSER
// $0.05
// ============================================================================

app.post(
  "/api/parse-receipt",

  (
    req,
    res
  ) => {
    try {
      const { text } =
        req.body ||
        {};

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

      return res.json({
        status:
          "success",

        payment:
          "verified",

        network:
          NETWORK,

        currency:
          "USDC",

        parsedData:
          parseReceiptText(
            text
          ),
      });
    } catch (
      error
    ) {
      console.error(
        "Receipt parser error:",

        error.message
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to parse receipt.",
        });
    }
  }
);

// ============================================================================
// TOOL #7
// NEWS BRIEF
// $0.05
// ============================================================================

app.get(
  "/api/news-brief",

  async (
    req,
    res
  ) => {
    const topic =
      String(
        req.query.topic ||
        ""
      ).trim();

    const limitRaw =
      req.query.limit ===
      undefined
        ? 10
        : Number(
            req.query.limit
          );

    const limit =
      Math.min(
        Math.max(
          Math.floor(
            limitRaw
          ),
          1
        ),
        25
      );

    const timespan =
      String(
        req.query.timespan ||
        "24h"
      )
        .trim()
        .toLowerCase();

    if (
      !topic ||
      topic.length < 2 ||
      topic.length > 200
    ) {
      return res
        .status(400)
        .json({
          error:
            "topic must contain between 2 and 200 characters.",
        });
    }

    if (
      !Number.isFinite(
        limitRaw
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "limit must be a number between 1 and 25.",
        });
    }

    if (
      !/^\d+(min|h|day|days|week|weeks|month|months)$/.test(
        timespan
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "timespan must look like 30min, 24h, 3days, 1week, or 1month.",
        });
    }

    try {
      const response =
        await axios.get(
          "https://api.gdeltproject.org/api/v2/doc/doc",

          {
            timeout:
              15000,

            params: {
              query:
                topic,

              mode:
                "artlist",

              format:
                "json",

              maxrecords:
                limit,

              sort:
                "datedesc",

              timespan,
            },

            headers: {
              Accept:
                "application/json",

              "User-Agent":
                `x402-agent-data-api/${VERSION}`,
            },
          }
        );

      const articles =
        Array.isArray(
          response.data
            ?.articles
        )
          ? response.data
              .articles
          : [];

      const data =
        articles
          .slice(
            0,
            limit
          )

          .map(
            (
              article
            ) => ({
              title:
                article.title ||
                null,

              url:
                article.url ||
                null,

              mobileUrl:
                article.url_mobile ||
                null,

              domain:
                article.domain ||
                null,

              language:
                article.language ||
                null,

              sourceCountry:
                article.sourcecountry ||
                null,

              seenDate:
                article.seendate ||
                null,

              socialImage:
                article.socialimage ||
                null,
            })
          );

      const sources =
        unique(
          data.map(
            (
              item
            ) =>
              item.domain
          )
        );

      return res.json({
        status:
          "success",

        payment:
          "verified",

        topic,

        timespan,

        source:
          "GDELT DOC 2.0",

        count:
          data.length,

        sourceCount:
          sources.length,

        sources,

        retrievedAt:
          new Date().toISOString(),

        articles:
          data,
      });
    } catch (
      error
    ) {
      console.error(
        "News brief error:",

        error.response
          ?.data ||
          error.message
      );

      return res
        .status(502)
        .json({
          error:
            "Failed to retrieve topic news from GDELT.",
        });
    }
  }
);

// ============================================================================
// SEC CACHE
// ============================================================================

let tickerCache = {
  expiresAt:
    0,

  rows:
    [],
};

const companyCache =
  new Map();

function secHeaders() {
  return {
    Accept:
      "application/json",

    "Accept-Encoding":
      "gzip, deflate",

    "User-Agent":
      APP_USER_AGENT,
  };
}

async function getSecTickerRows() {
  const now =
    Date.now();

  if (
    tickerCache
      .rows
      .length &&

    tickerCache
      .expiresAt >
      now
  ) {
    return tickerCache
      .rows;
  }

  const response =
    await axios.get(
      "https://www.sec.gov/files/company_tickers.json",

      {
        timeout:
          15000,

        headers:
          secHeaders(),
      }
    );

  const rows =
    Object.values(
      response.data ||
      {}
    ).filter(
      (
        row
      ) =>
        row &&
        row.ticker &&
        row.cik_str
    );

  tickerCache = {
    rows,

    expiresAt:
      now +
      60 *
      60 *
      1000,
  };

  return rows;
}

function buildSecFilingUrl(
  cik,
  accessionNumber,
  primaryDocument
) {
  if (
    !accessionNumber ||
    !primaryDocument
  ) {
    return null;
  }

  const cikNoLeadingZeros =
    String(
      Number(
        cik
      )
    );

  const accessionNoDashes =
    String(
      accessionNumber
    ).replace(
      /-/g,
      ""
    );

  return (
    `https://www.sec.gov/Archives/edgar/data/` +
    `${cikNoLeadingZeros}/` +
    `${accessionNoDashes}/` +
    `${primaryDocument}`
  );
}

function mapRecentSecFilings(
  cik,
  recent,
  limit = 12
) {
  const result = [];

  const forms =
    Array.isArray(
      recent?.form
    )
      ? recent.form
      : [];

  for (
    let i = 0;

    i <
      forms.length &&
    result.length <
      limit;

    i += 1
  ) {
    const accessionNumber =
      recent
        .accessionNumber?.[
          i
        ] ||
      null;

    const primaryDocument =
      recent
        .primaryDocument?.[
          i
        ] ||
      null;

    result.push({
      form:
        forms[i] ||
        null,

      filingDate:
        recent
          .filingDate?.[
            i
          ] ||
        null,

      reportDate:
        recent
          .reportDate?.[
            i
          ] ||
        null,

      acceptanceDateTime:
        recent
          .acceptanceDateTime?.[
            i
          ] ||
        null,

      accessionNumber,

      primaryDocument,

      description:
        recent
          .primaryDocDescription?.[
            i
          ] ||
        null,

      url:
        buildSecFilingUrl(
          cik,
          accessionNumber,
          primaryDocument
        ),
    });
  }

  return result;
}

// ============================================================================
// TOOL #8
// SEC COMPANY INTELLIGENCE
// $0.05
// ============================================================================

app.get(
  "/api/sec-company",

  async (
    req,
    res
  ) => {
    const ticker =
      String(
        req.query.ticker ||
        ""
      )
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z0-9.-]{1,10}$/.test(
        ticker
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Please provide a valid ticker, such as TSLA or AAPL.",
        });
    }

    try {
      const cached =
        companyCache.get(
          ticker
        );

      if (
        cached &&
        cached.expiresAt >
          Date.now()
      ) {
        return res.json(
          cached.value
        );
      }

      const tickerRows =
        await getSecTickerRows();

      const match =
        tickerRows.find(
          (
            row
          ) =>
            String(
              row.ticker
            ).toUpperCase() ===
            ticker
        );

      if (
        !match
      ) {
        return res
          .status(404)
          .json({
            error:
              `Ticker ${ticker} was not found in the SEC ticker list.`,
          });
      }

      const cik =
        String(
          match.cik_str
        ).padStart(
          10,
          "0"
        );

      const response =
        await axios.get(
          `https://data.sec.gov/submissions/CIK${cik}.json`,

          {
            timeout:
              15000,

            headers:
              secHeaders(),
          }
        );

      const company =
        response.data ||
        {};

      const recentFilings =
        mapRecentSecFilings(
          cik,

          company.filings
            ?.recent,

          12
        );

      const value = {
        status:
          "success",

        payment:
          "verified",

        source:
          "U.S. SEC EDGAR",

        ticker,

        company:
          company.name ||
          match.title,

        cik,

        sic:
          company.sic ||
          null,

        sicDescription:
          company.sicDescription ||
          null,

        stateOfIncorporation:
          company.stateOfIncorporation ||
          null,

        fiscalYearEnd:
          company.fiscalYearEnd ||
          null,

        exchanges:
          company.exchanges ||
          [],

        tickers:
          company.tickers ||
          [
            ticker,
          ],

        website:
          company.website ||
          null,

        investorWebsite:
          company.investorWebsite ||
          null,

        recentFilings,

        keyFilings:
          recentFilings.filter(
            (
              filing
            ) =>
              [
                "10-K",
                "10-Q",
                "8-K",
                "20-F",
                "6-K",
              ].includes(
                filing.form
              )
          ),

        retrievedAt:
          new Date().toISOString(),
      };

      companyCache.set(
        ticker,

        {
          value,

          expiresAt:
            Date.now() +
            60 *
            1000,
        }
      );

      return res.json(
        value
      );
    } catch (
      error
    ) {
      console.error(
        "SEC company error:",

        error.response
          ?.data ||
          error.message
      );

      if (
        error.response
          ?.status ===
        404
      ) {
        return res
          .status(404)
          .json({
            error:
              `SEC data was not found for ticker ${ticker}.`,
          });
      }

      return res
        .status(502)
        .json({
          error:
            "Failed to retrieve SEC company data.",
        });
    }
  }
);

// ============================================================================
// TOOL #9
// WEBSITE RESEARCH
// $0.10
// ============================================================================

app.post(
  "/api/website-research",

  async (
    req,
    res
  ) => {
    const { url } =
      req.body ||
      {};

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

    try {
      const {
        targetUrl,
        html,
        contentType,
      } =
        await fetchPublicPage(
          url
        );

      const analysis =
        analyzeHtml(
          html,
          targetUrl
        );

      return res.json({
        status:
          "success",

        payment:
          "verified",

        network:
          NETWORK,

        currency:
          "USDC",

        url:
          targetUrl,

        domain:
          new URL(
            targetUrl
          ).hostname,

        contentType,

        profile: {
          title:
            analysis.title,

          description:
            analysis.description,

          canonical:
            analysis.canonical,

          language:
            analysis.language,

          wordCount:
            analysis.wordCount,

          headings:
            analysis.headings.slice(
              0,
              20
            ),

          emails:
            analysis.emails,

          socialLinks:
            analysis.socialLinks,

          linkCount:
            analysis.linkCount,

          externalLinkCount:
            analysis.externalLinkCount,
        },

        topExternalDomains:
          buildExternalDomainCounts(
            analysis.links,
            targetUrl
          ),

        textExcerpt:
          analysis.text.slice(
            0,
            12000
          ),

        textCharactersAvailable:
          analysis.text.length,

        textTruncated:
          analysis.text.length >
          12000,

        retrievedAt:
          new Date().toISOString(),
      });
    } catch (
      error
    ) {
      return handlePublicPageError(
        error,
        res
      );
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
    return res
      .status(404)
      .json({
        error:
          "Endpoint not found.",

        availableEndpoints: [
          "GET /",
          "GET /health",
          "GET /openapi.json",
          "POST /api/scrape",
          "GET /api/exchange-rate",
          "GET /api/trends",
          "GET /api/weather",
          "POST /api/url-analyze",
          "POST /api/parse-receipt",
          "GET /api/news-brief",
          "GET /api/sec-company",
          "POST /api/website-research",
        ],
      });
  }
);

// ============================================================================
// GLOBAL ERROR HANDLER
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

    return res
      .status(500)
      .json({
        error:
          "Internal server error.",
      });
  }
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
      "==================================================="
    );

    console.log(
      "🚀 x402 Agent Data API ONLINE"
    );

    console.log(
      "==================================================="
    );

    console.log(
      `Version: ${VERSION}`
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

    console.log(
      "Render Trust Proxy: ENABLED"
    );

    console.log("");

    console.log(
      "Paid endpoints:"
    );

    console.log(
      "POST /api/scrape             $0.005"
    );

    console.log(
      "GET  /api/exchange-rate      $0.01"
    );

    console.log(
      "GET  /api/trends             $0.02"
    );

    console.log(
      "GET  /api/weather            $0.02"
    );

    console.log(
      "POST /api/url-analyze        $0.03"
    );

    console.log(
      "POST /api/parse-receipt      $0.05"
    );

    console.log(
      "GET  /api/news-brief         $0.05"
    );

    console.log(
      "GET  /api/sec-company        $0.05"
    );

    console.log(
      "POST /api/website-research   $0.10"
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
