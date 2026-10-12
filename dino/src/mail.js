// E-mail versturen via Resend (https://resend.com), gratis tot 3.000 mails per maand.
// Zonder RESEND_API_KEY wordt er niets verstuurd; de link verschijnt dan alleen in de serverlogs.
export function createMailer(apiKey, from, fetchImpl = fetch) {
  if (!apiKey) {
    return {
      configured: false,
      async send({ to, subject, text }) {
        console.warn(`[mail niet ingesteld] Aan ${to}: ${subject}\n${text}`);
      },
    };
  }
  return {
    configured: true,
    async send({ to, subject, text, html }) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, text, html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    },
  };
}
