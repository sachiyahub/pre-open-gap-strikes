const { getStore } = require("@netlify/blobs");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let cookieJar = "";

async function nseFetch(path, referer = "https://www.nseindia.in/") {
  if (!cookieJar) {
    const home = await fetch("https://www.nseindia.in/", {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" }
    });
    const setCookie = home.headers.get("set-cookie");
    if (setCookie) cookieJar = setCookie.split(",").map(c => c.split(";")[0]).join("; ");
  }
  const res = await fetch(`https://www.nseindia.in${path}`, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": referer,
      "Cookie": cookieJar
    }
  });
  if (!res.ok) throw new Error(`NSE ${res.status}`);
  return res.json();
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const qs = event.queryStringParameters || {};

    if (qs.preopen) {
      const cat = qs.category || "FUTIDX";
      const data = await nseFetch(`/api/NextApi/apiClient/cmPreOpenApi?functionName=getPreOpenDataFNO&category=${cat}&symbol=`, "https://www.nseindia.in/market-data/pre-open-market-fno");
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (qs.optionchain) {
      const symbol = qs.symbol;
      const type = qs.type || (["NIFTY","BANKNIFTY","FINNIFTY","MIDCPNIFTY"].includes(symbol) ? "Indices" : "Equity");
      const expiry = qs.expiry;
      let url = `/api/option-chain-v3?type=${type}&symbol=${symbol}`;
      if (expiry) url += `&expiry=${expiry}`;
      const data = await nseFetch(url, "https://www.nseindia.in/option-chain");
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (qs.expiries) {
      const symbol = qs.symbol;
      const data = await nseFetch(`/api/option-chain-contract-info?symbol=${symbol}`, "https://www.nseindia.in/option-chain");
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (qs.snapshot && event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const store = getStore("snapshots");
      const date = body.date || new Date().toISOString().slice(0,10);
      await store.setJSON(date, body.data);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, date }) };
    }

    if (qs.snapshot && event.httpMethod === "GET") {
      const store = getStore("snapshots");
      const date = qs.date;
      if (date) {
        const data = await store.get(date, { type: "json" });
        return { statusCode: 200, headers, body: JSON.stringify(data || null) };
      }
      const list = await store.list();
      return { statusCode: 200, headers, body: JSON.stringify(list.blobs.map(b => b.key).sort().reverse()) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: "not found" }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
