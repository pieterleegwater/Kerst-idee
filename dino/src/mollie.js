// Minimale Mollie-client (API v2) op basis van fetch, zodat hij in Cloudflare Workers draait.
export function createMollie(apiKey, fetchImpl = fetch) {
  async function call(path, init = {}) {
    const res = await fetchImpl(`https://api.mollie.com/v2${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Mollie ${res.status}: ${json.detail || json.title}`);
    return json;
  }
  return {
    createPayment: (body) => call("/payments", { method: "POST", body: JSON.stringify(body) }),
    getPayment: (id) => call(`/payments/${encodeURIComponent(id)}`),
  };
}

export const centsToMollie = (cents) => (cents / 100).toFixed(2);
