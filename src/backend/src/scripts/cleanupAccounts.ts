import "dotenv/config";
import { retryPendingDeletions } from "../services/accountDeletion.js";
import { getPool } from "../config/database.js";

try {
  await retryPendingDeletions();
} finally {
  await getPool().end();
}
