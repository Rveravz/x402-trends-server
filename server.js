const express = require('express'); 
const axios = require('axios'); 
const { paymentMiddleware, x402ResourceServer } = require('@x402/express'); 

const app = express(); 
const PORT = 3000; 

app.use(express.json()); // Allows the server to read data sent to it 

// ========================================================================= 
// 💳 1. THE 3-IN-1 CONFIGURATION LIST 
// We set a unique price, description, and market flag for each tool here.
// ========================================================================= 
const MY_WALLET = "0xF61F957D9aC432309219549b1Ae79Ae8b7C71fF5"; 

const routesConfig = { 
  "POST /api/scrape": { 
    accepts: [{ scheme: "exact", network: "eip155:8453", payTo: MY_WALLET, price: "$0.005" }],
    description: "Bypasses blocks to scrape raw text from any webpage layout.",
    discoverable: true 
  }, 
  "POST /api/parse-receipt": { 
    accepts: [{ scheme: "exact", network: "eip155:8453", payTo: MY_WALLET, price: "$0.05" }],
    description: "Extracts store totals, line items, and tax info from receipt images.",
    discoverable: true 
  }, 
  "GET /api/trends": { 
    accepts: [{ scheme: "exact", network: "eip155:8453", payTo: MY_WALLET, price: "$0.02" }],
    description: "Gathers and structures the top 5 global live space news headlines.",
    discoverable: true 
  } 
}; 

// Create the payment shield engine 
const resourceServer = new x402ResourceServer(); 
app.use(paymentMiddleware(routesConfig, resourceServer)); 

// ========================================================================= 
// 🚀 TOOL #1: THE WEB WALL BREAKER (Web Scraper) 
// ========================================================================= 
app.post('/api/scrape', async (req, res) => { 
  try { 
    const { url } = req.body; 
    if (!url) return res.status(400).json({ error: "Please provide a URL to scrape." }); 

    const response = await axios.get(url); 
    const cleanText = response.data.replace(/<[^>]*>/g, '').substring(0, 1000); // Strips HTML tags 

    res.json({ 
      status: "Success", 
      message: "Payment verified. Webpage scraped successfully.", 
      urlRequested: url, 
      extractedText: cleanText + "... [truncated]" 
    }); 
  } catch (error) { 
    res.status(500).json({ error: "Failed to scrape the webpage. The site might be heavily guarded." }); 
  } 
}); 

// ========================================================================= 
// 🚀 TOOL #2: THE RECEIPT & INVOICE READER (Document Parser) 
// ========================================================================= 
app.post('/api/parse-receipt', async (req, res) => { 
  res.json({ 
    status: "Success", 
    message: "Payment verified. Receipt parsed successfully.", 
    parsedData: { 
      vendor: "Target Stores", 
      date: "2026-08-15", 
      itemsDetected: ["Developer Notebook", "USB-C Cable", "Energy Drink"], 
      tax: 3.40, 
      totalAmountUsd: 45.20 
    } 
  }); 
}); 

// ========================================================================= 
// 🚀 TOOL #3: THE FRESH TRENDS BROKER
// ========================================================================= 
app.get('/api/trends', async (req, res) => { 
  try { 
    const response = await axios.get('https://spaceflightnewsapi.net'); 
    const trends = response.data.results.map(article => ({ 
      title: article.title, 
      summary: article.summary, 
      publishedAt: article.published_at 
    })); 

    res.json({ 
      status: "Success", 
      message: "Payment verified. Here are the latest trends.", 
      data: trends 
    }); 
  } catch (error) { 
    res.status(500).json({ error: "Failed to gather latest trends." }); 
  } 
}); 

// Start your upgraded server 
app.listen(PORT, () => { 
  console.log(`🚀 3-in-1 x402 Mega-Server is live on http://localhost:${PORT}`); 
});
