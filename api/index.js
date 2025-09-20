import app from "../index.js";
import connectDB from "../config/db.js";

export default async function handler(req, res) {
  await connectDB();       // Ensure Mongo connection
  return app(req, res);    // Pass request/response to Express
}
