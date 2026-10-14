import "dotenv/config";

import { connectWithRetry, exchangeName, queueName } from "./rabbitmq";

async function startWorker(): Promise<void> {
  // Connect to RabbitMQ and make sure the exchange, queue, and binding exist.
  const { channel } = await connectWithRetry();

  // Process one message at a time. RabbitMQ will not send another unacknowledged
  // message to this worker while it is busy with the current one.
  channel.prefetch(1);
  console.log(
    `Worker is listening on queue "${queueName}" via exchange "${exchangeName}"`,
  );

  // Start consuming messages from the queue.
  // noAck: false means the worker must explicitly acknowledge each message.
  channel.consume(queueName, async (message) => {
    if (!message) {
      return;
    }

    try {
      // RabbitMQ gives us a Buffer. Convert it back to text, then parse the JSON.
      const payload = JSON.parse(message.content.toString()) as {
        id: string;
        text: string;
        createdAt: string;
      };

      console.log("Received message", payload);

      // Simulate work performed by a background consumer.
      await new Promise((resolve) => setTimeout(resolve, 500));

      // ack tells RabbitMQ that processing succeeded. The message can be removed
      // from the queue after this call.
      channel.ack(message);
      console.log(`Acknowledged ${payload.id}`);
    } catch (error) {
      console.error("Message processing failed; rejecting message", error);

      // nack tells RabbitMQ that processing failed. The final false means do not
      // put this bad message back into the queue; discard it instead.
      channel.nack(message, false, false);
    }
  }, { noAck: false });
}

startWorker().catch((error) => {
  console.error("Worker failed to start", error);
  process.exitCode = 1;
});
