import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `;

  if (req.method === "GET") {
    const rows = await sql`SELECT data FROM logs ORDER BY (data->>'date') DESC, (data->>'createdAt') DESC`;
    return res.json(rows.map((r) => r.data));
  }

  if (req.method === "POST") {
    const item = req.body;
    await sql`INSERT INTO logs (id, data) VALUES (${item.id}, ${JSON.stringify(item)})`;
    return res.status(201).json(item);
  }

  res.status(405).end();
}
