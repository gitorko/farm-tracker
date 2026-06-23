import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  if (req.method === "PUT") {
    const item = req.body;
    await sql`UPDATE logs SET data = ${JSON.stringify(item)} WHERE id = ${id}`;
    return res.json(item);
  }

  if (req.method === "DELETE") {
    await sql`DELETE FROM logs WHERE id = ${id}`;
    return res.status(204).end();
  }

  res.status(405).end();
}
