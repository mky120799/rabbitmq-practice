import "dotenv/config";

import express from "express";
import { Channel } from "amqplib";
import { connectWithRetry, exchangeName, routingKey } from "./rabbitmq";

const app = express();
const port = Number(process.env.PORT ?? 3000);

// The API keeps one channel open and reuses it for publishing messages.
// It is assigned when startApi connects to RabbitMQ below.
let publisherChannel: Channel;

// This middleware parses incoming JSON request bodies so request.body works.
app.use(express.json());

// A small endpoint we can use to check whether the API container is alive.
app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.post("/messages", async (request, response) => {
  // Read the text sent by Postman/curl from the JSON request body.
  const { text } = request.body as { text?: unknown };

  // Reject invalid input before trying to publish anything to RabbitMQ.
  if (typeof text !== "string" || text.trim().length === 0) {
    response.status(400).json({ error: "text must be a non-empty string" });
    return;
  }

  // This is the application message that will travel through RabbitMQ.
  const message = {
    id: crypto.randomUUID(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  try {
    // Publish to the exchange, not directly to the queue.
    // RabbitMQ uses routingKey to decide which bound queue receives it.
    const published = publisherChannel.publish(
      exchangeName,
      routingKey,

      // RabbitMQ messages are bytes, so convert the JSON object to a Buffer.
      Buffer.from(JSON.stringify(message)),

      // persistent asks RabbitMQ to write the message to disk when possible.
      { contentType: "application/json", persistent: true },
    );

    // publish() returns false when its internal write buffer is full.
    if (!published) {
      response.status(503).json({ error: "RabbitMQ write buffer is full" });
      return;
    }

    console.log("Published message", message);
    response.status(202).json({ message });
  } catch (error) {
    console.error("Failed to publish message", error);
    response.status(503).json({ error: "Could not publish message" });
  }
});

async function startApi(): Promise<void> {
  // Wait for RabbitMQ, create the exchange/queue binding, and get a channel.
  const connection = await connectWithRetry();
  publisherChannel = connection.channel;

  // Only start accepting HTTP requests after RabbitMQ is ready.
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

startApi().catch((error) => {
  console.error("API failed to start", error);
  process.exitCode = 1;
});
