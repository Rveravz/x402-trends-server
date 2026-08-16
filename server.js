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

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const VERSION = "2.5.0";
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const NETWORK = "eip155:8453";
const PAY_TO = process.env.X402_PAY_TO;
const SERVICE_CONTACT = process.env.SERVICE_CONTACT;
const BALLDONTLIE_API_KEY = process.env.BALLDONTLIE_API_KEY;

// ============================================================================
// REQUIRED ENVIRONMENT VARIABLES
// ============================================================================

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
  process.exit(1);
}

if (!BALLDONTLIE_API_KEY || BALLDONTLIE_API_KEY.length < 8) {
  console.error("❌ Missing BALLDONTLIE_API_KEY.");
  process.exit(1);
}

const APP_USER_AGENT =
  `${SERVICE_CONTACT} x402-agent-data-api/${VERSION}`;

// ============================================================================
// FREE ROUTES
// ============================================================================

const paidEndpoints = {
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

  cryptoMarket: {
    method: "GET",
    path: "/api/crypto-market",
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

  sportsGameBrief: {
    method: "GET",
    path: "/api/sports-game-brief",
    price: "$0.05",
  },
};

app.get(
  "/",

  (_req, res) => {
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
      sportsProvider: "BALLDONTLIE",

      sportsLeagues: [
        "NBA",
        "NFL",
        "MLB",
        "EPL",
      ],

      paidEndpoints,
    });
  }
);

app.get(
  "/health",

  (_req, res) => {
    res.json({
      status: "ok",
      service: "x402-agent-data-api",
      version: VERSION,
      mode: "PRODUCTION",
      network: NETWORK,
      bazaarDiscovery: true,
      discoveryMetadataVersion: VERSION,

      cryptoMarketSource:
        "Coinbase Exchange public market data",

      sportsProvider:
        "BALLDONTLIE",

      sportsConfigured:
        Boolean(BALLDONTLIE_API_KEY),

      sportsLeagues: [
        "NBA",
        "NFL",
        "MLB",
        "EPL",
      ],

      timestamp:
        new Date().toISOString(),
    });
  }
);

app.get(
  "/openapi.json",

  (_req, res) => {
    res.json({
      openapi: "3.1.0",

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
              "Scrape a public webpage into clean readable text",
          },
        },

        "/api/exchange-rate": {
          get: {
            summary:
              "Convert currencies using current reference rates",
          },
        },

        "/api/trends": {
          get: {
            summary:
              "Get the latest spaceflight news stories",
          },
        },

        "/api/weather": {
          get: {
            summary:
              "Get a U.S. National Weather Service forecast",
          },
        },

        "/api/url-analyze": {
          post: {
            summary:
              "Analyze webpage metadata and structure",
          },
        },

        "/api/parse-receipt": {
          post: {
            summary:
              "Parse receipt text into structured purchase data",
          },
        },

        "/api/crypto-market": {
          get: {
            summary:
              "Get live Coinbase crypto market data",
          },
        },

        "/api/sec-company": {
          get: {
            summary:
              "Get SEC company data and recent filings",
          },
        },

        "/api/website-research": {
          post: {
            summary:
              "Create a detailed website research snapshot",
          },
        },

        "/api/sports-game-brief": {
          get: {
            summary:
              "Get normalized NBA, NFL, MLB, or EPL schedules and scores",

            parameters: [
              {
                name: "league",
                in: "query",
                required: true,

                schema: {
                  type: "string",

                  enum: [
                    "NBA",
                    "NFL",
                    "MLB",
                    "EPL",
                  ],
                },
              },

              {
                name: "date",
                in: "query",
                required: false,

                schema: {
                  type: "string",
                },
              },

              {
                name: "team",
                in: "query",
                required: false,

                schema: {
                  type: "string",
                },
              },

              {
                name: "limit",
                in: "query",
                required: false,

                schema: {
                  type: "integer",
                  minimum: 1,
                  maximum: 20,
                },
              },
            ],
          },
        },
      },
    });
  }
);

// ============================================================================
// X402 + BAZAAR
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
// JSON SCHEMA HELPERS
// ============================================================================

const str = {
  type: "string",
};

const nullableStr = {
  type: [
    "string",
    "null",
  ],
};

const num = {
  type: "number",
};

const nullableNum = {
  type: [
    "number",
    "null",
  ],
};

const bool = {
  type: "boolean",
};

const nullableBool = {
  type: [
    "boolean",
    "null",
  ],
};

const integer = {
  type: "integer",
};

const nullableInteger = {
  type: [
    "integer",
    "null",
  ],
};

function objectSchema(
  properties,
  required = [],
  additionalProperties = false
) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties,
  };
}

function arraySchema(
  items
) {
  return {
    type: "array",
    items,
  };
}

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

const teamOutputSchema =
  objectSchema(
    {
      name:
        str,

      abbreviation:
        nullableStr,
    },

    [
      "name",
      "abbreviation",
    ]
  );

// ============================================================================
// SCRAPER DISCOVERY
// ============================================================================

const scrapeDiscovery =
  makeDiscovery({
    bodyType:
      "json",

    input: {
      url:
        "https://example.com",
    },

    inputSchema:
      objectSchema(
        {
          url: {
            type:
              "string",

            description:
              "Public HTTP or HTTPS webpage URL to scrape and convert into clean readable text.",
          },
        },

        [
          "url",
        ]
      ),

    outputExample: {
      status:
        "success",

      payment:
        "verified",

      network:
        NETWORK,

      currency:
        "USDC",

      urlRequested:
        "https://example.com/",

      charactersAvailable:
        125,

      truncated:
        false,

      extractedText:
        "Example Domain This domain is for use in illustrative examples in documents.",
    },

    outputSchema:
      objectSchema(
        {
          status:
            str,

          payment:
            str,

          network:
            str,

          currency:
            str,

          urlRequested:
            str,

          charactersAvailable:
            integer,

          truncated:
            bool,

          extractedText:
            str,
        },

        [
          "status",
          "urlRequested",
          "charactersAvailable",
          "truncated",
          "extractedText",
        ]
      ),
  });

// ============================================================================
// EXCHANGE RATE DISCOVERY
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

    inputSchema:
      objectSchema(
        {
          from: {
            type:
              "string",

            description:
              "Three-letter source currency code such as USD, EUR, GBP, or JPY.",
          },

          to: {
            type:
              "string",

            description:
              "Three-letter target currency code such as EUR, USD, GBP, or JPY.",
          },

          amount: {
            type:
              "number",

            exclusiveMinimum:
              0,

            description:
              "Amount of source currency to convert. Defaults to 1.",
          },
        },

        [
          "from",
          "to",
        ]
      ),

    outputExample: {
      status:
        "success",

      payment:
        "verified",

      source:
        "Frankfurter",

      date:
        "2026-08-15",

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
      objectSchema(
        {
          status:
            str,

          payment:
            str,

          source:
            str,

          date:
            nullableStr,

          from:
            str,

          to:
            str,

          amount:
            num,

          rate:
            num,

          convertedAmount:
            num,
        },

        [
          "status",
          "from",
          "to",
          "amount",
          "rate",
          "convertedAmount",
        ]
      ),
  });

// ============================================================================
// SPACE NEWS DISCOVERY
// ============================================================================

const trendsDiscovery =
  makeDiscovery({
    input:
      {},

    inputSchema:
      objectSchema(
        {},
        []
      ),

    outputExample: {
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
        5,

      retrievedAt:
        "2026-08-15T20:00:00.000Z",

      data: [
        {
          id:
            12345,

          title:
            "Example spaceflight headline",

          summary:
            "Example summary of a recent launch or spaceflight story.",

          url:
            "https://example.com/article",

          imageUrl:
            "https://example.com/image.jpg",

          newsSite:
            "Example News",

          publishedAt:
            "2026-08-15T19:30:00Z",

          updatedAt:
            "2026-08-15T19:45:00Z",
        },
      ],
    },

    outputSchema:
      objectSchema(
        {
          status:
            str,

          payment:
            str,

          network:
            str,

          currency:
            str,

          source:
            str,

          count:
            integer,

          retrievedAt:
            str,

          data:
            arraySchema(
              objectSchema(
                {
                  id: {
                    type: [
                      "integer",
                      "string",
                      "null",
                    ],
                  },

                  title:
                    nullableStr,

                  summary:
                    nullableStr,

                  url:
                    nullableStr,

                  imageUrl:
                    nullableStr,

                  newsSite:
                    nullableStr,

                  publishedAt:
                    nullableStr,

                  updatedAt:
                    nullableStr,
                },

                [
                  "title",
                  "url",
                ]
              )
            ),
        },

        [
          "status",
          "source",
          "count",
          "retrievedAt",
          "data",
        ]
      ),
  });

// ============================================================================
// WEATHER DISCOVERY
// ============================================================================

const weatherDiscovery =
  makeDiscovery({
    input: {
      lat:
        33.68,

      lon:
        -117.18,
    },

    inputSchema:
      objectSchema(
        {
          lat: {
            type:
              "number",

            minimum:
              -90,

            maximum:
              90,

            description:
              "Latitude for the U.S. forecast location.",
          },

          lon: {
            type:
              "number",

            minimum:
              -180,

            maximum:
              180,

            description:
              "Longitude for the U.S. forecast location.",
          },
        },

        [
          "lat",
          "lon",
        ]
      ),

    outputExample: {
      status:
        "success",

      payment:
        "verified",

      source:
        "NOAA National Weather Service",

      coordinates: {
        lat:
          33.68,

        lon:
          -117.18,
      },

      location: {
        city:
          "Menifee",

        state:
          "CA",
      },

      periods: [
        {
          name:
            "Tonight",

          startTime:
            "2026-08-15T18:00:00-07:00",

          endTime:
            "2026-08-16T06:00:00-07:00",

          isDaytime:
            false,

          temperature:
            68,

          temperatureUnit:
            "F",

          windSpeed:
            "5 mph",

          windDirection:
            "SW",

          shortForecast:
            "Mostly Clear",

          detailedForecast:
            "Mostly clear overnight with light winds.",
        },
      ],

      retrievedAt:
        "2026-08-15T20:00:00.000Z",
    },

    outputSchema:
      objectSchema(
        {
          status:
            str,

          payment:
            str,

          source:
            str,

          coordinates:
            objectSchema(
              {
                lat:
                  num,

                lon:
                  num,
              },

              [
                "lat",
                "lon",
              ]
            ),

          location:
            objectSchema(
              {
                city:
                  nullableStr,

                state:
                  nullableStr,
              },

              [
                "city",
                "state",
              ]
            ),

          periods:
            arraySchema(
              objectSchema({
                name:
                  nullableStr,

                startTime:
                  nullableStr,

                endTime:
                  nullableStr,

                isDaytime:
                  nullableBool,

                temperature:
                  nullableNum,

                temperatureUnit:
                  nullableStr,

                windSpeed:
                  nullableStr,

                windDirection:
                  nullableStr,

                shortForecast:
                  nullableStr,

                detailedForecast:
                  nullableStr,
              })
            ),

          retrievedAt:
            str,
        },

        [
          "status",
          "source",
          "coordinates",
          "location",
          "periods",
          "retrievedAt",
        ]
      ),
  });

// ============================================================================
// URL ANALYZER DISCOVERY
// ============================================================================

const urlAnalyzeDiscovery =
  makeDiscovery({
    bodyType:
      "json",

    input: {
      url:
        "https://example.com",
    },

    inputSchema:
      objectSchema(
        {
          url: {
            type:
              "string",

            description:
              "Public webpage URL to inspect for SEO metadata, headings, links, email addresses, social links, and content statistics.",
          },
        },

        [
          "url",
        ]
      ),

    outputExample: {
      status:
        "success",

      payment:
        "verified",

      url:
        "https://example.com/",

      contentType:
        "text/html",

      title:
        "Example Domain",

      description:
        "Example page description",

      canonical:
        "https://example.com/",

      language:
        "en",

      wordCount:
        125,

      headings: [
        "Example Domain",
      ],

      linkCount:
        4,

      externalLinkCount:
        1,

      emails: [
        "hello@example.com",
      ],

      socialLinks: {
        github:
          "https://github.com/example",
      },

      retrievedAt:
        "2026-08-15T20:00:00.000Z",
    },

    outputSchema:
      objectSchema(
        {
          status:
            str,

          payment:
            str,

          url:
            str,

          contentType:
            str,

          title:
            nullableStr,

          description:
            nullableStr,

          canonical:
            nullableStr,

          language:
            nullableStr,

          wordCount:
            integer,

          headings:
            arraySchema(
              str
            ),

          linkCount:
            integer,

          externalLinkCount:
            integer,

          emails:
            arraySchema(
              str
            ),

          socialLinks: {
            type:
              "object",

            additionalProperties: {
              type:
                "string",
            },
          },

          retrievedAt:
            str,
        },

        [
          "status",
          "url",
          "wordCount",
          "headings",
          "linkCount",
          "externalLinkCount",
          "emails",
          "socialLinks",
          "retrievedAt",
        ]
      ),
  });

// ============================================================================
// RECEIPT DISCOVERY
// ============================================================================

const receiptDiscovery =
  makeDiscovery({
    bodyType:
      "json",

    input: {
      text:
        "Coffee 4.50\nTax 0.36\nTotal 4.86",
    },

    inputSchema:
      objectSchema(
        {
          text: {
            type:
              "string",

            description:
              "Raw receipt text. Use after OCR when the source is an image; this endpoint itself does not perform OCR.",
          },
        },

        [
          "text",
        ]
      ),

    outputExample: {
      status:
        "success",

      payment:
        "verified",

      network:
        NETWORK,

      currency:
        "USDC",

      parsedData: {
        items: [
          {
            name:
              "Coffee",

            amount:
              4.5,
          },
        ],

        subtotal:
          null,

        tax:
          0.36,

        total:
          4.86,

        linesDetected:
          3,
      },
    },

    outputSchema:
      objectSchema(
        {
          status:
            str,

          payment:
            str,

          network:
            str,

          currency:
            str,

          parsedData:
            objectSchema(
              {
                items:
                  arraySchema(
                    objectSchema(
                      {
                        name:
                          str,

                        amount:
                          num,
                      },

                      [
                        "name",
                        "amount",
                      ]
                    )
                  ),

                subtotal:
                  nullableNum,

                tax:
                  nullableNum,

                total:
                  nullableNum,

                linesDetected:
                  integer,
              },

              [
                "items",
                "subtotal",
                "tax",
                "total",
                "linesDetected",
              ]
            ),
        },

        [
          "status",
          "parsedData",
        ]
      ),
  });

// ============================================================================
// CRYPTO DISCOVERY
// ============================================================================

const cryptoDiscovery =
  makeDiscovery({
    input: {
      pair:
        "BTC-USD",
    },

    inputSchema:
      objectSchema({
        pair: {
          type:
            "string",

          description:
            "Coinbase Exchange trading pair such as BTC-USD, ETH-USD, or SOL-USD. Defaults to BTC-USD.",
        },
      }),

    outputExample: {
      status:
        "success",

      payment:
        "verified",

      source:
        "Coinbase Exchange",

      pair:
        "BTC-USD",

      price:
        "63058.25",

      lastTradeSize:
        "0.001",

      bestBid:
        "63058.24",

      bestAsk:
        "63058.25",

      open24h:
        "62000.00",

      high24h:
        "64000.00",

      low24h:
        "61500.00",

      last24h:
        "63058.25",

      volume24h:
        "10000.0",

      volume30d:
        "300000.0",

      tickerTime:
        "2026-08-15T20:00:00.000Z",

      retrievedAt:
        "2026-08-15T20:00:00.000Z",

      cached:
        false,
    },

    outputSchema:
      objectSchema(
        {
          status:
            str,

          payment:
            str,

          source:
            str,

          pair:
            str,

          price:
            nullableStr,

          lastTradeSize:
            nullableStr,

          bestBid:
            nullableStr,

          bestAsk:
            nullableStr,

          open24h:
            nullableStr,

          high24h:
            nullableStr,

          low24h:
            nullableStr,

          last24h:
            nullableStr,

          volume24h:
            nullableStr,

          volume30d:
            nullableStr,

          tickerTime:
            nullableStr,

          retrievedAt:
            str,

          cached:
            bool,
        },

        [
          "status",
          "source",
          "pair",
          "price",
          "bestBid",
          "bestAsk",
          "open24h",
          "high24h",
          "low24h",
          "volume24h",
          "volume30d",
          "retrievedAt",
          "cached",
        ]
      ),
  });

// ============================================================================
// SEC DISCOVERY
// ============================================================================

const secFilingSchema =
  objectSchema({
    form:
      nullableStr,

    filingDate:
      nullableStr,

    reportDate:
      nullableStr,

    acceptanceDateTime:
      nullableStr,

    accessionNumber:
      nullableStr,

    primaryDocument:
      nullableStr,

    description:
      nullableStr,

    url:
      nullableStr,
  });

const secDiscovery =
  makeDiscovery({
    input: {
      ticker:
        "TSLA",
    },

    inputSchema:
      objectSchema(
        {
          ticker: {
            type:
              "string",

            description:
              "U.S. public-company ticker such as TSLA, AAPL, MSFT, NVDA, or AMZN.",
          },
        },

        [
          "ticker",
        ]
      ),

    outputExample: {
      status:
        "success",

      payment:
        "verified",

      source:
        "U.S. SEC EDGAR",

      ticker:
        "TSLA",

      company:
        "Tesla, Inc.",

      cik:
        "0001318605",

      sic:
        "3711",

      sicDescription:
        "Motor Vehicles & Passenger Car Bodies",

      stateOfIncorporation:
        "TX",

      fiscalYearEnd:
        "1231",

      exchanges: [
        "Nasdaq",
      ],

      tickers: [
        "TSLA",
      ],

      website:
        "https://www.tesla.com",

      investorWebsite:
        "https://ir.tesla.com",

      recentFilings: [
        {
          form:
            "10-Q",

          filingDate:
            "2026-07-24",

          reportDate:
            "2026-06-30",

          url:
            "https://www.sec.gov/Archives/edgar/data/example",
        },
      ],

      keyFilings:
        [],

      retrievedAt:
        "2026-08-15T20:00:00.000Z",
    },

    outputSchema:
      objectSchema(
        {
          status:
            str,

          payment:
            str,

          source:
            str,

          ticker:
            str,

          company:
            str,

          cik:
            str,

          sic:
            nullableStr,

          sicDescription:
            nullableStr,

          stateOfIncorporation:
            nullableStr,

          fiscalYearEnd:
            nullableStr,

          exchanges:
            arraySchema(
              str
            ),

          tickers:
            arraySchema(
              str
            ),

          website:
            nullableStr,

          investorWebsite:
            nullableStr,

          recentFilings:
            arraySchema(
              secFilingSchema
            ),

          keyFilings:
            arraySchema(
              secFilingSchema
            ),

          retrievedAt:
            str,
        },

        [
          "status",
          "source",
          "ticker",
          "company",
          "cik",
          "recentFilings",
          "keyFilings",
          "retrievedAt",
        ]
      ),
  });

// ============================================================================
// WEBSITE RESEARCH DISCOVERY
// ============================================================================

const researchDiscovery =
  makeDiscovery({
    bodyType:
      "json",

    input: {
      url:
        "https://example.com",
    },

    inputSchema:
      objectSchema(
        {
          url: {
            type:
              "string",

            description:
              "Public website URL to research for metadata, readable text, contacts, social links, headings, and external-domain relationships.",
          },
        },

        [
          "url",
        ]
      ),

    outputExample: {
      status:
        "success",

      payment:
        "verified",

      network:
        NETWORK,

      currency:
        "USDC",

      url:
        "https://example.com/",

      domain:
        "example.com",

      contentType:
        "text/html",

      profile: {
        title:
          "Example Domain",

        description:
          "Example website",

        canonical:
          "https://example.com/",

        language:
          "en",

        wordCount:
          125,

        headings: [
          "Example Domain",
        ],

        emails: [
          "hello@example.com",
        ],

        socialLinks:
          {},

        linkCount:
          4,

        externalLinkCount:
          1,
      },

      topExternalDomains: [
        {
          domain:
            "iana.org",

          links:
            1,
        },
      ],

      textExcerpt:
        "Example Domain This domain is for use in illustrative examples in documents.",

      textCharactersAvailable:
        125,

      textTruncated:
        false,

      retrievedAt:
        "2026-08-15T20:00:00.000Z",
    },

    outputSchema:
      objectSchema(
        {
          status:
            str,

          payment:
            str,

          network:
            str,

          currency:
            str,

          url:
            str,

          domain:
            str,

          contentType:
            str,

          profile:
            objectSchema(
              {
                title:
                  nullableStr,

                description:
                  nullableStr,

                canonical:
                  nullableStr,

                language:
                  nullableStr,

                wordCount:
                  integer,

                headings:
                  arraySchema(
                    str
                  ),

                emails:
                  arraySchema(
                    str
                  ),

                socialLinks: {
                  type:
                    "object",

                  additionalProperties: {
                    type:
                      "string",
                  },
                },

                linkCount:
                  integer,

                externalLinkCount:
                  integer,
              },

              [
                "wordCount",
                "headings",
                "emails",
                "socialLinks",
                "linkCount",
                "externalLinkCount",
              ]
            ),

          topExternalDomains:
            arraySchema(
              objectSchema(
                {
                  domain:
                    str,

                  links:
                    integer,
                },

                [
                  "domain",
                  "links",
                ]
              )
            ),

          textExcerpt:
            str,

          textCharactersAvailable:
            integer,

          textTruncated:
            bool,

          retrievedAt:
            str,
        },

        [
          "status",
          "url",
          "domain",
          "contentType",
          "profile",
          "topExternalDomains",
          "textExcerpt",
          "textCharactersAvailable",
          "textTruncated",
          "retrievedAt",
        ]
      ),
  });

// ============================================================================
// SPORTS DISCOVERY
// ============================================================================

const sportsGameSchema =
  objectSchema(
    {
      id: {
        type: [
          "integer",
          "string",
        ],
      },

      league:
        str,

      date:
        str,

      status:
        str,

      homeTeam:
        teamOutputSchema,

      awayTeam:
        teamOutputSchema,

      homeScore:
        nullableNum,

      awayScore:
        nullableNum,

      venue:
        nullableStr,

      period:
        nullableInteger,

      clock:
        nullableStr,

      postseason:
        nullableBool,

      summary:
        str,
    },

    [
      "id",
      "league",
      "date",
      "status",
      "homeTeam",
      "awayTeam",
      "homeScore",
      "awayScore",
      "venue",
      "summary",
    ]
  );

const sportsDiscovery =
  makeDiscovery({
    input: {
      league:
        "NFL",

      date:
        "2026-08-16",

      team:
        "KC",

      limit:
        10,
    },

    inputSchema:
      objectSchema(
        {
          league: {
            type:
              "string",

            enum: [
              "NBA",
              "NFL",
              "MLB",
              "EPL",
            ],

            description:
              "Sports league: NBA basketball, NFL football, MLB baseball, or EPL English Premier League soccer.",
          },

          date: {
            type:
              "string",

            description:
              "Game date in YYYY-MM-DD. Defaults to today's UTC date.",
          },

          team: {
            type:
              "string",

            description:
              "Optional team name or abbreviation filter, such as LAL, Lakers, KC, Chiefs, LAD, Dodgers, Arsenal, or ARS.",
          },

          limit: {
            type:
              "integer",

            minimum:
              1,

            maximum:
              20,

            description:
              "Maximum games returned. Defaults to 10 and cannot exceed 20.",
          },
        },

        [
          "league",
        ]
      ),

    outputExample: {
      status:
        "success",

      payment:
        "verified",

      source:
        "BALLDONTLIE",

      league:
        "NFL",

      date:
        "2026-08-16",

      teamFilter:
        "KC",

      count:
        1,

      cached:
        false,

      stale:
        false,

      retrievedAt:
        "2026-08-16T18:00:00.000Z",

      games: [
        {
          id:
            7001,

          league:
            "NFL",

          date:
            "2026-08-16T00:20:00.000Z",

          status:
            "Final",

          homeTeam: {
            name:
              "Kansas City Chiefs",

            abbreviation:
              "KC",
          },

          awayTeam: {
            name:
              "Baltimore Ravens",

            abbreviation:
              "BAL",
          },

          homeScore:
            27,

          awayScore:
            20,

          venue:
            "GEHA Field at Arrowhead Stadium",

          period:
            4,

          clock:
            null,

          postseason:
            false,

          summary:
            "Baltimore Ravens 20 at Kansas City Chiefs 27 — Final",
        },
      ],
    },

    outputSchema:
      objectSchema(
        {
          status:
            str,

          payment:
            str,

          source:
            str,

          league:
            str,

          date:
            str,

          teamFilter:
            nullableStr,

          count:
            integer,

          cached:
            bool,

          stale:
            bool,

          retrievedAt:
            str,

          games:
            arraySchema(
              sportsGameSchema
            ),
        },

        [
          "status",
          "source",
          "league",
          "date",
          "teamFilter",
          "count",
          "cached",
          "stale",
          "retrievedAt",
          "games",
        ]
      ),
  });

// ============================================================================
// PAID ROUTE CONFIGURATION
// ============================================================================

const routesConfig = {
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
      "Scrape a public webpage and extract clean readable text. Use this web scraping endpoint when an AI agent needs page content for summarization, research, retrieval, content extraction, indexing, or downstream analysis without parsing raw HTML.",

    mimeType:
      "application/json",

    extensions: {
      ...scrapeDiscovery,
    },
  },

  "GET /api/exchange-rate": {
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        payTo: PAY_TO,
        price: "$0.01",
      },
    ],

    description:
      "Convert money between currency codes using current reference exchange-rate data. Use this endpoint for USD, EUR, GBP, JPY, and other supported fiat conversions when an agent needs a rate, converted amount, or currency comparison.",

    mimeType:
      "application/json",

    extensions: {
      ...exchangeDiscovery,
    },
  },

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
      "Get the five newest spaceflight and space-industry news stories with titles, summaries, sources, URLs, images, and publication times. Use this endpoint for current rocket launch, NASA, SpaceX, satellite, mission, or spaceflight news research.",

    mimeType:
      "application/json",

    extensions: {
      ...trendsDiscovery,
    },
  },

  "GET /api/weather": {
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        payTo: PAY_TO,
        price: "$0.02",
      },
    ],

    description:
      "Get a current U.S. weather forecast from NOAA and the National Weather Service by latitude and longitude. Use this weather API when an agent needs forecast temperature, conditions, wind, day/night periods, or detailed local forecast text for U.S. coordinates.",

    mimeType:
      "application/json",

    extensions: {
      ...weatherDiscovery,
    },
  },

  "POST /api/url-analyze": {
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        payTo: PAY_TO,
        price: "$0.03",
      },
    ],

    description:
      "Analyze a public webpage for SEO and research metadata. Use this endpoint when an agent needs the page title, meta description, canonical URL, language, headings, word count, links, external-link count, emails, or detected social profiles.",

    mimeType:
      "application/json",

    extensions: {
      ...urlAnalyzeDiscovery,
    },
  },

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
      "Parse raw receipt text into structured purchase data including line items, subtotal, tax, total, and line count. Use this endpoint after OCR or text extraction when an agent needs machine-readable receipt or expense data. This endpoint does not perform image OCR.",

    mimeType:
      "application/json",

    extensions: {
      ...receiptDiscovery,
    },
  },

  "GET /api/crypto-market": {
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        payTo: PAY_TO,
        price: "$0.05",
      },
    ],

    description:
      "Get live cryptocurrency price and market data from Coinbase Exchange for BTC, ETH, SOL, and other supported trading pairs. Use this crypto market API for last price, best bid and ask, 24-hour open/high/low/volume, and 30-day volume. Defaults to BTC-USD.",

    mimeType:
      "application/json",

    extensions: {
      ...cryptoDiscovery,
    },
  },

  "GET /api/sec-company": {
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        payTo: PAY_TO,
        price: "$0.05",
      },
    ],

    description:
      "Get official U.S. SEC EDGAR company information and recent filings by stock ticker. Use this endpoint for company research, 10-K, 10-Q, 8-K and other filing discovery, CIK lookup, exchange information, fiscal year data, and direct SEC filing URLs.",

    mimeType:
      "application/json",

    extensions: {
      ...secDiscovery,
    },
  },

  "POST /api/website-research": {
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        payTo: PAY_TO,
        price: "$0.10",
      },
    ],

    description:
      "Create a detailed research snapshot of a public website. Use this endpoint when an AI agent needs a fast company or site profile with metadata, headings, readable text, emails, social links, link counts, and the most-linked external domains for due diligence or web research.",

    mimeType:
      "application/json",

    extensions: {
      ...researchDiscovery,
    },
  },

  "GET /api/sports-game-brief": {
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        payTo: PAY_TO,
        price: "$0.05",
      },
    ],

    description:
      "Get normalized sports schedules, live or recent scores, matchup status, teams, venue and a concise game brief for NBA, NFL, MLB and English Premier League (EPL). Filter by league, date and optional team name or abbreviation. Use for NBA scores, NFL games, MLB scores, EPL fixtures, today's games, schedules and AI sports research.",

    mimeType:
      "application/json",

    extensions: {
      ...sportsDiscovery,
    },
  },
};

app.use(
  paymentMiddleware(
    routesConfig,
    resourceServer
  )
);

// ============================================================================
// WEB SAFETY / SSRF PROTECTION
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

  const [
    a,
    b,
  ] =
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
    value.startsWith("fc") ||
    value.startsWith("fd")
  ) {
    return true;
  }

  if (
    /^fe[89ab]/.test(value)
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
    parsed.hostname
      .toLowerCase();

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
        match[1]
          .trim()
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
    )
      .toLowerCase();

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

  const headings =
    unique(
      [
        ...String(
          html
        ).matchAll(
          /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
        ),
      ]

        .map(
          (
            m
          ) =>
            htmlToText(
              m[1]
            )
        )

        .filter(
          Boolean
        )
    )
      .slice(
        0,
        50
      );

  const links =
    unique(
      [
        ...String(
          html
        ).matchAll(
          /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
        ),
      ]

        .map(
          (
            m
          ) =>
            absoluteUrl(
              m[1],
              baseUrl
            )
        )

        .filter(
          Boolean
        )
    )
      .slice(
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
      (
        link
      ) => {
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
        (
          m
        ) =>
          m[1]
      ),

      ...[
        ...text.matchAll(
          /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
        ),
      ].map(
        (
          m
        ) =>
          m[0]
      ),
    ])
      .slice(
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

  const socialLinks =
    {};

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
        (
          link
        ) => {
          try {
            return new URL(
              link
            )
              .hostname
              .toLowerCase()
              .includes(
                domain
              );
          } catch {
            return false;
          }
        }
      );

    if (
      found
    ) {
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
        host !== baseHost
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
      // Ignore malformed links.
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
      (
        a,
        b
      ) =>
        b.links -
        a.links
    )

    .slice(
      0,
      15
    );
}

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
          error.response.status,
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
// TOOL 1 - SCRAPER
// ============================================================================

app.post(
  "/api/scrape",

  async (
    req,
    res
  ) => {
    const {
      url,
    } =
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
// TOOL 2 - EXCHANGE RATE
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

      amount <=
        0 ||

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
          response.data?.date ||
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
        error.response?.data ||
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
// TOOL 3 - SPACE TRENDS
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
          new Date()
            .toISOString(),

        data,
      });
    } catch (
      error
    ) {
      console.error(
        "Trends error:",
        error.response?.data ||
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
// TOOL 4 - WEATHER
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

      lat <
        -90 ||

      lat >
        90 ||

      !Number.isFinite(
        lon
      ) ||

      lon <
        -180 ||

      lon >
        180
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
          new Date()
            .toISOString(),
      });
    } catch (
      error
    ) {
      console.error(
        "Weather error:",
        error.response?.data ||
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
// TOOL 5 - URL ANALYZER
// ============================================================================

app.post(
  "/api/url-analyze",

  async (
    req,
    res
  ) => {
    const {
      url,
    } =
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
          new Date()
            .toISOString(),
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
    ][1]
      .replace(
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

  const items =
    [];

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
// TOOL 6 - RECEIPT PARSER
// ============================================================================

app.post(
  "/api/parse-receipt",

  (
    req,
    res
  ) => {
    try {
      const {
        text,
      } =
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
// TOOL 7 - CRYPTO MARKET
// ============================================================================

const CRYPTO_CACHE_TTL_MS =
  10_000;

const cryptoCache =
  new Map();

function pruneCryptoCache() {
  const now =
    Date.now();

  for (
    const [
      key,
      entry,
    ] of
      cryptoCache.entries()
  ) {
    if (
      entry.expiresAt <=
      now
    ) {
      cryptoCache.delete(
        key
      );
    }
  }
}

app.get(
  "/api/crypto-market",

  async (
    req,
    res
  ) => {
    const pair =
      String(
        req.query.pair ||
        "BTC-USD"
      )
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z0-9]{2,12}-[A-Z0-9]{2,12}$/.test(
        pair
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "pair must be a Coinbase Exchange product such as BTC-USD, ETH-USD, or SOL-USD.",
        });
    }

    pruneCryptoCache();

    const cached =
      cryptoCache.get(
        pair
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      return res.json({
        ...cached.value,

        cached:
          true,
      });
    }

    try {
      const encodedPair =
        encodeURIComponent(
          pair
        );

      const headers = {
        Accept:
          "application/json",

        "User-Agent":
          `x402-agent-data-api/${VERSION}`,
      };

      const [
        tickerResponse,
        statsResponse,
      ] =
        await Promise.all([
          axios.get(
            `https://api.exchange.coinbase.com/products/${encodedPair}/ticker`,

            {
              timeout:
                12000,

              headers,
            }
          ),

          axios.get(
            `https://api.exchange.coinbase.com/products/${encodedPair}/stats`,

            {
              timeout:
                12000,

              headers,
            }
          ),
        ]);

      const ticker =
        tickerResponse.data ||
        {};

      const stats =
        statsResponse.data ||
        {};

      const value = {
        status:
          "success",

        payment:
          "verified",

        source:
          "Coinbase Exchange",

        pair,

        price:
          ticker.price ??
          stats.last ??
          null,

        lastTradeSize:
          ticker.size ??
          null,

        bestBid:
          ticker.bid ??
          null,

        bestAsk:
          ticker.ask ??
          null,

        open24h:
          stats.open ??
          null,

        high24h:
          stats.high ??
          null,

        low24h:
          stats.low ??
          null,

        last24h:
          stats.last ??
          ticker.price ??
          null,

        volume24h:
          stats.volume ??
          ticker.volume ??
          null,

        volume30d:
          stats.volume_30day ??
          null,

        tickerTime:
          ticker.time ??
          null,

        retrievedAt:
          new Date().toISOString(),

        cached:
          false,
      };

      cryptoCache.set(
        pair,

        {
          value,

          expiresAt:
            Date.now() +
            CRYPTO_CACHE_TTL_MS,
        }
      );

      return res.json(
        value
      );
    } catch (
      error
    ) {
      console.error(
        "Crypto market error:",
        error.response?.data ||
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
              `Coinbase Exchange pair ${pair} was not found.`,
          });
      }

      if (
        error.response
          ?.status ===
        429
      ) {
        return res
          .status(503)
          .json({
            error:
              "Coinbase market data is temporarily rate-limited. Please retry shortly.",

            retryAfterSeconds:
              2,
          });
      }

      return res
        .status(502)
        .json({
          error:
            "Failed to retrieve Coinbase crypto market data.",
        });
    }
  }
);

// ============================================================================
// SEC HELPERS
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
    )
      .filter(
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
    )
      .replace(
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
  const result =
    [];

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

    i +=
      1
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
        forms[
          i
        ] ||
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
// TOOL 8 - SEC COMPANY
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
            )
              .toUpperCase() ===
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
        )
          .padStart(
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

          company
            .filings
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
          new Date()
            .toISOString(),
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
        error.response?.data ||
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
// TOOL 9 - WEBSITE RESEARCH
// ============================================================================

app.post(
  "/api/website-research",

  async (
    req,
    res
  ) => {
    const {
      url,
    } =
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
          )
            .hostname,

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
            analysis.headings
              .slice(
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
          analysis.text
            .slice(
              0,
              12000
            ),

        textCharactersAvailable:
          analysis.text
            .length,

        textTruncated:
          analysis.text
            .length >
          12000,

        retrievedAt:
          new Date()
            .toISOString(),
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
// SPORTS HELPERS
// ============================================================================

const SPORTS_SUPPORTED =
  new Set([
    "NBA",
    "NFL",
    "MLB",
    "EPL",
  ]);

const SPORTS_MIN_UPSTREAM_INTERVAL_MS =
  13_000;

const sportsCache =
  new Map();

let sportsLastUpstreamStart =
  0;

let sportsQueue =
  Promise.resolve();

function sleep(
  ms
) {
  return new Promise(
    (
      resolve
    ) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function todayUtc() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10
    );
}

function validIsoDate(
  value
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const date =
    new Date(
      `${value}T00:00:00.000Z`
    );

  return (
    Number.isFinite(
      date.getTime()
    ) &&

    date
      .toISOString()
      .slice(
        0,
        10
      ) ===
      value
  );
}

function sportsCacheTtlMs(
  date
) {
  const today =
    todayUtc();

  if (
    date <
    today
  ) {
    return (
      6 *
      60 *
      60 *
      1000
    );
  }

  if (
    date >
    today
  ) {
    return (
      5 *
      60 *
      1000
    );
  }

  return (
    30 *
    1000
  );
}

function scheduleSportsUpstream(
  task
) {
  const run =
    sportsQueue.then(
      async () => {
        const elapsed =
          Date.now() -
          sportsLastUpstreamStart;

        const waitMs =
          Math.max(
            0,

            SPORTS_MIN_UPSTREAM_INTERVAL_MS -
            elapsed
          );

        if (
          waitMs >
          0
        ) {
          await sleep(
            waitMs
          );
        }

        sportsLastUpstreamStart =
          Date.now();

        return task();
      }
    );

  sportsQueue =
    run.catch(
      () =>
        undefined
    );

  return run;
}

function sportsEndpointForLeague(
  league
) {
  switch (
    league
  ) {
    case "NBA":
      return "https://api.balldontlie.io/v1/games";

    case "NFL":
      return "https://api.balldontlie.io/nfl/v1/games";

    case "MLB":
      return "https://api.balldontlie.io/mlb/v1/games";

    case "EPL":
      return "https://api.balldontlie.io/epl/v2/matches";

    default:
      return null;
  }
}

function cleanStatus(
  value
) {
  const raw =
    String(
      value ||
      "Unknown"
    );

  if (
    raw ===
    "STATUS_FULL_TIME"
  ) {
    return "Full Time";
  }

  if (
    raw ===
    "STATUS_FINAL"
  ) {
    return "Final";
  }

  if (
    raw ===
    "STATUS_SCHEDULED"
  ) {
    return "Scheduled";
  }

  if (
    raw ===
    "STATUS_IN_PROGRESS"
  ) {
    return "In Progress";
  }

  if (
    raw ===
    "STATUS_POSTPONED"
  ) {
    return "Postponed";
  }

  if (
    raw ===
      "STATUS_CANCELED" ||

    raw ===
      "STATUS_CANCELLED"
  ) {
    return "Canceled";
  }

  return raw
    .replace(
      /^STATUS_/,
      ""
    )

    .replace(
      /_/g,
      " "
    )

    .replace(
      /\b\w/g,

      (
        c
      ) =>
        c.toUpperCase()
    );
}

function teamFromStandard(
  team
) {
  return {
    name:
      team?.full_name ||
      team?.display_name ||
      team?.name ||
      "Unknown Team",

    abbreviation:
      team?.abbreviation ||
      null,
  };
}

function buildGameSummary({
  awayTeam,
  homeTeam,
  awayScore,
  homeScore,
  status,
}) {
  const scoreAvailable =
    awayScore !== null &&
    awayScore !== undefined &&
    homeScore !== null &&
    homeScore !== undefined &&
    Number.isFinite(
      Number(
        awayScore
      )
    ) &&
    Number.isFinite(
      Number(
        homeScore
      )
    );

  if (
    scoreAvailable
  ) {
    return (
      `${awayTeam.name} ${awayScore} at ` +
      `${homeTeam.name} ${homeScore} — ${status}`
    );
  }

  return (
    `${awayTeam.name} at ` +
    `${homeTeam.name} — ${status}`
  );
}

function normalizeNbaGame(
  game
) {
  const homeTeam =
    teamFromStandard(
      game.home_team
    );

  const awayTeam =
    teamFromStandard(
      game.visitor_team
    );

  const status =
    cleanStatus(
      game.status
    );

  const homeScore =
    game.home_team_score ??
    null;

  const awayScore =
    game.visitor_team_score ??
    null;

  return {
    id:
      game.id,

    league:
      "NBA",

    date:
      game.datetime ||
      game.date ||
      "",

    status,

    homeTeam,

    awayTeam,

    homeScore,

    awayScore,

    venue:
      null,

    period:
      Number.isFinite(
        Number(
          game.period
        )
      )
        ? Number(
            game.period
          )
        : null,

    clock:
      game.time ||
      null,

    postseason:
      typeof game.postseason ===
        "boolean"
        ? game.postseason
        : null,

    summary:
      buildGameSummary({
        awayTeam,
        homeTeam,
        awayScore,
        homeScore,
        status,
      }),
  };
}

function normalizeNflGame(
  game
) {
  const homeTeam =
    teamFromStandard(
      game.home_team
    );

  const awayTeam =
    teamFromStandard(
      game.visitor_team
    );

  const status =
    cleanStatus(
      game.status
    );

  const homeScore =
    game.home_team_score ??
    null;

  const awayScore =
    game.visitor_team_score ??
    null;

  return {
    id:
      game.id,

    league:
      "NFL",

    date:
      game.date ||
      "",

    status,

    homeTeam,

    awayTeam,

    homeScore,

    awayScore,

    venue:
      game.venue ||
      null,

    period:
      null,

    clock:
      null,

    postseason:
      typeof game.postseason ===
        "boolean"
        ? game.postseason
        : null,

    summary:
      game.summary ||
      buildGameSummary({
        awayTeam,
        homeTeam,
        awayScore,
        homeScore,
        status,
      }),
  };
}

function normalizeMlbGame(
  game
) {
  const homeTeam =
    teamFromStandard(
      game.home_team
    );

  const awayTeam =
    teamFromStandard(
      game.away_team
    );

  const status =
    cleanStatus(
      game.status
    );

  const homeScore =
    game.home_team_data
      ?.runs ??
    null;

  const awayScore =
    game.away_team_data
      ?.runs ??
    null;

  return {
    id:
      game.id,

    league:
      "MLB",

    date:
      game.date ||
      "",

    status,

    homeTeam,

    awayTeam,

    homeScore,

    awayScore,

    venue:
      game.venue ||
      null,

    period:
      Number.isFinite(
        Number(
          game.period
        )
      )
        ? Number(
            game.period
          )
        : null,

    clock:
      game.display_clock ||
      null,

    postseason:
      typeof game.postseason ===
        "boolean"
        ? game.postseason
        : null,

    summary:
      buildGameSummary({
        awayTeam,
        homeTeam,
        awayScore,
        homeScore,
        status,
      }),
  };
}

function normalizeEplMatch(
  match
) {
  const names =
    String(
      match.name ||
      ""
    )
      .split(
        " at "
      );

  const abbreviations =
    String(
      match.short_name ||
      ""
    )
      .split(
        " @ "
      );

  const awayTeam = {
    name:
      names[0] ||
      "Away Team",

    abbreviation:
      abbreviations[0] ||
      null,
  };

  const homeTeam = {
    name:
      names[1] ||
      "Home Team",

    abbreviation:
      abbreviations[1] ||
      null,
  };

  const status =
    cleanStatus(
      match.status_detail ||
      match.status
    );

  const homeScore =
    match.home_score ??
    null;

  const awayScore =
    match.away_score ??
    null;

  return {
    id:
      match.id,

    league:
      "EPL",

    date:
      match.date ||
      "",

    status,

    homeTeam,

    awayTeam,

    homeScore,

    awayScore,

    venue:
      match.venue_name ||
      null,

    period:
      null,

    clock:
      null,

    postseason:
      null,

    summary:
      buildGameSummary({
        awayTeam,
        homeTeam,
        awayScore,
        homeScore,
        status,
      }),
  };
}

function normalizeSportsData(
  league,
  rows
) {
  if (
    league ===
    "NBA"
  ) {
    return rows.map(
      normalizeNbaGame
    );
  }

  if (
    league ===
    "NFL"
  ) {
    return rows.map(
      normalizeNflGame
    );
  }

  if (
    league ===
    "MLB"
  ) {
    return rows.map(
      normalizeMlbGame
    );
  }

  if (
    league ===
    "EPL"
  ) {
    return rows.map(
      normalizeEplMatch
    );
  }

  return [];
}

function gameMatchesTeam(
  game,
  team
) {
  if (
    !team
  ) {
    return true;
  }

  const needle =
    team.toLowerCase();

  const values = [
    game.homeTeam
      ?.name,

    game.homeTeam
      ?.abbreviation,

    game.awayTeam
      ?.name,

    game.awayTeam
      ?.abbreviation,
  ]
    .filter(
      Boolean
    )

    .map(
      (
        value
      ) =>
        String(
          value
        )
          .toLowerCase()
    );

  return values.some(
    (
      value
    ) =>
      value.includes(
        needle
      )
  );
}

function trimSportsCache() {
  if (
    sportsCache.size <=
    200
  ) {
    return;
  }

  const entries =
    [
      ...sportsCache.entries(),
    ]
      .sort(
        (
          a,
          b
        ) =>
          a[1].storedAt -
          b[1].storedAt
      );

  for (
    const [
      key,
    ] of
      entries.slice(
        0,

        sportsCache.size -
        150
      )
  ) {
    sportsCache.delete(
      key
    );
  }
}

async function fetchSportsGames(
  league,
  date
) {
  const cacheKey =
    `${league}|${date}`;

  const cached =
    sportsCache.get(
      cacheKey
    );

  if (
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    return {
      games:
        cached.games,

      cached:
        true,

      stale:
        false,

      retrievedAt:
        cached.retrievedAt,
    };
  }

  const endpoint =
    sportsEndpointForLeague(
      league
    );

  try {
    const response =
      await scheduleSportsUpstream(
        () =>
          axios.get(
            endpoint,

            {
              timeout:
                15000,

              params: {
                "dates[]":
                  date,

                per_page:
                  100,
              },

              headers: {
                Authorization:
                  BALLDONTLIE_API_KEY,

                Accept:
                  "application/json",

                "User-Agent":
                  `x402-agent-data-api/${VERSION}`,
              },
            }
          )
      );

    const rows =
      Array.isArray(
        response.data
          ?.data
      )
        ? response.data
            .data
        : [];

    const games =
      normalizeSportsData(
        league,
        rows
      );

    const retrievedAt =
      new Date()
        .toISOString();

    sportsCache.set(
      cacheKey,

      {
        games,

        retrievedAt,

        storedAt:
          Date.now(),

        expiresAt:
          Date.now() +
          sportsCacheTtlMs(
            date
          ),
      }
    );

    trimSportsCache();

    return {
      games,

      cached:
        false,

      stale:
        false,

      retrievedAt,
    };
  } catch (
    error
  ) {
    if (
      cached
    ) {
      console.warn(
        `Sports upstream failed for ${league} ${date}; serving stale cache.`
      );

      return {
        games:
          cached.games,

        cached:
          true,

        stale:
          true,

        retrievedAt:
          cached.retrievedAt,
      };
    }

    throw error;
  }
}

// ============================================================================
// TOOL 10 - SPORTS GAME BRIEF
// ============================================================================

app.get(
  "/api/sports-game-brief",

  async (
    req,
    res
  ) => {
    const league =
      String(
        req.query.league ||
        ""
      )
        .trim()
        .toUpperCase();

    const date =
      String(
        req.query.date ||
        todayUtc()
      )
        .trim();

    const team =
      String(
        req.query.team ||
        ""
      )
        .trim();

    const limitRaw =
      req.query.limit ===
      undefined
        ? 10
        : Number(
            req.query.limit
          );

    if (
      !SPORTS_SUPPORTED.has(
        league
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "league must be one of NBA, NFL, MLB, or EPL.",

          example:
            "/api/sports-game-brief?league=NFL&date=2026-08-16&team=KC",
        });
    }

    if (
      !validIsoDate(
        date
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "date must be formatted as YYYY-MM-DD.",
        });
    }

    if (
      team.length >
      80
    ) {
      return res
        .status(400)
        .json({
          error:
            "team filter must be 80 characters or fewer.",
        });
    }

    if (
      !Number.isFinite(
        limitRaw
      ) ||

      limitRaw <
        1 ||

      limitRaw >
        20
    ) {
      return res
        .status(400)
        .json({
          error:
            "limit must be a number from 1 to 20.",
        });
    }

    const limit =
      Math.floor(
        limitRaw
      );

    try {
      const result =
        await fetchSportsGames(
          league,
          date
        );

      const games =
        result.games
          .filter(
            (
              game
            ) =>
              gameMatchesTeam(
                game,
                team
              )
          )

          .slice(
            0,
            limit
          );

      return res.json({
        status:
          "success",

        payment:
          "verified",

        source:
          "BALLDONTLIE",

        league,

        date,

        teamFilter:
          team ||
          null,

        count:
          games.length,

        cached:
          result.cached,

        stale:
          result.stale,

        retrievedAt:
          result.retrievedAt,

        games,
      });
    } catch (
      error
    ) {
      const upstreamStatus =
        error.response
          ?.status;

      const upstreamData =
        error.response
          ?.data;

      console.error(
        "Sports game brief error:",
        upstreamData ||
          error.message
      );

      if (
        upstreamStatus ===
        401
      ) {
        return res
          .status(503)
          .json({
            error:
              "Sports data provider authentication failed.",
          });
      }

      if (
        upstreamStatus ===
        403
      ) {
        return res
          .status(503)
          .json({
            error:
              `Sports data for ${league} is not available on the current BALLDONTLIE plan.`,
          });
      }

      if (
        upstreamStatus ===
        429
      ) {
        return res
          .status(503)
          .json({
            error:
              "Sports data provider is temporarily rate-limited. Please retry shortly.",

            retryAfterSeconds:
              15,
          });
      }

      return res
        .status(502)
        .json({
          error:
            "Failed to retrieve sports game data.",
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
          "GET /api/crypto-market",
          "GET /api/sec-company",
          "POST /api/website-research",
          "GET /api/sports-game-brief",
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
      "Bazaar Metadata: ENHANCED"
    );

    console.log(
      "Crypto Market Source: Coinbase Exchange"
    );

    console.log(
      "Sports Source: BALLDONTLIE"
    );

    console.log(
      "Sports Leagues: NBA, NFL, MLB, EPL"
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
      "GET  /api/crypto-market      $0.05"
    );

    console.log(
      "GET  /api/sec-company        $0.05"
    );

    console.log(
      "POST /api/website-research   $0.10"
    );

    console.log(
      "GET  /api/sports-game-brief  $0.05"
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
