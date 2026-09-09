import "dotenv/config";
import { createApp } from "./app.js";

const app = createApp();

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

export default app;

// Retry durable account-deletion requests after temporary provider failures.
// Tests importing createApp do not start this worker.
import { retryPendingDeletions } from "./services/accountDeletion.js";

if (process.env.DATABASE_URL) {
  let cleanupRunning = false;
  const cleanup = async () => {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      await retryPendingDeletions();
    } catch {
      console.error("Account cleanup unavailable; check the database configuration.");
    } finally {
      cleanupRunning = false;
    }
  };
  void cleanup();
  setInterval(() => { void cleanup(); }, 60000).unref();
}
