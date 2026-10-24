// Read-only production discovery check. No payment headers, credentials, or POSTs.
// Run: node scripts/audit-public-x402-discovery.mjs
// Offline: node scripts/audit-public-x402-discovery.mjs --self-test
const base = "https://x402-trends-server.onrender.com";
const expectedMethods = {
  "/api/scrape":"post", "/api/exchange-rate":"get", "/api/trends":"get",
  "/api/weather":"get", "/api/url-analyze":"post", "/api/parse-receipt":"post",
  "/api/crypto-market":"get", "/api/sec-company":"get",
  "/api/website-research":"post", "/api/sports-game-brief":"get",
  "/api/base-wallet-balance":"get", "/api/base-tx-status":"get"
};
const paths = Object.keys(expectedMethods);
const probes = [
  "/api/base-wallet-balance?address=0x0000000000000000000000000000000000000001",
  "/api/base-tx-status?hash=0x" + "0".repeat(64)
];
async function audit(fetcher) {
  const checks = [];
  async function get(path, json = false) {
    try {
      const r = await fetcher(base + path, {method:"GET",redirect:"manual",headers:{accept:"application/json"},signal:AbortSignal.timeout(8000)});
      let body;
      if (json && r.status === 200) { try { body = await r.json(); } catch {} }
      return {status:r.status,body};
    } catch { return {status:null}; }
  }
  const health = await get("/health",true);
  checks.push({name:"health",status:health.status,ok:health.status===200 && health.body?.status==="ok"});
  const card = await get("/.well-known/agent-card.json",true);
  const cardPaths = new Set(card.body?.endpoints?.map(x=>x.path) || []);
  checks.push({name:"agent_card",status:card.status,ok:card.status===200 && paths.every(p=>cardPaths.has(p))});
  const spec = await get("/openapi.json",true);
  checks.push({name:"openapi",status:spec.status,ok:spec.status===200 && paths.every(p=>Boolean(spec.body?.paths?.[p]?.[expectedMethods[p]]))});
  const catalog = await get("/.well-known/api-catalog",true);
  checks.push({name:"api_catalog",status:catalog.status,ok:catalog.status===200 && !!catalog.body});
  for (const path of probes) {
    const r = await get(path);
    checks.push({name:path.split("?")[0]+"_unpaid",status:r.status,ok:r.status===402});
  }
  return {checkedAt:new Date().toISOString(),pass:checks.every(x=>x.ok),checks,note:"No payment sent; 402 is not evidence of paid settlement or Bazaar indexing."};
}
if (process.argv.includes("--self-test")) {
  const fake = async url => {
    const path = new URL(url).pathname;
    const body = path==="/health"?{status:"ok"}:path==="/openapi.json"?{paths:Object.fromEntries(paths.map(p=>[p,{[expectedMethods[p]]:{}}]))}:path==="/.well-known/agent-card.json"?{endpoints:paths.map(path=>({path}))}:{resources:[]};
    return {status:path.startsWith("/api/base-")?402:200,json:async()=>body};
  };
  const good = await audit(fake);
  if (!good.pass || good.checks.length!==6) throw Error("positive test failed");
  const bad = await audit(async url => {
    const r = await fake(url);
    return new URL(url).pathname==="/api/base-tx-status"?{...r,status:200}:r;
  });
  if (bad.pass) throw Error("negative 402 test failed");
  // A resource advertised with the wrong HTTP method is not discoverable to agents.
  const wrongMethod = await audit(async url => {
    const r = await fake(url);
    if (new URL(url).pathname !== "/openapi.json") return r;
    return {...r,json:async()=>({paths:Object.fromEntries(paths.map(p=>[p,{[expectedMethods[p]==="get"?"post":"get"]:{}}]))})};
  });
  if (wrongMethod.pass) throw Error("negative method test failed");
  const missingCardPath = await audit(async url => {
    const r = await fake(url);
    if (new URL(url).pathname !== "/.well-known/agent-card.json") return r;
    return {...r,json:async()=>({endpoints:paths.filter(p=>p!=="/api/base-wallet-balance").map(path=>({path}))})};
  });
  if (missingCardPath.pass) throw Error("negative AgentCard test failed");
  console.log("PASS: offline checks; no network or payments");
} else {
  const result = await audit(fetch);
  console.log(JSON.stringify(result,null,2));
  if (!result.pass) process.exitCode=1;
}
