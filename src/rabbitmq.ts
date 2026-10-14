import amqp, { Channel, ChannelModel } from "amqplib";

// This URL is different depending on where the Node process runs:
// - inside Docker Compose: amqp://app:app@rabbitmq:5672
// - directly on your computer: amqp://app:app@localhost:5672
const rabbitmqUrl = process.env.RABBITMQ_URL ?? "amqp://localhost:5672";

// RabbitMQ uses these names to decide where messages should go.
export const exchangeName = process.env.RABBITMQ_EXCHANGE ?? "practice.events";
export const queueName = process.env.RABBITMQ_QUEUE ?? "practice.messages";
export const routingKey = process.env.RABBITMQ_ROUTING_KEY ?? "message.created";

export async function connectToRabbitMq(): Promise<{
  connection: ChannelModel;
  channel: Channel;
}> {
  // A connection is the network connection to the RabbitMQ server.
  const connection = await amqp.connect(rabbitmqUrl);

  // A channel is a lightweight communication path inside that connection.
  // We use the channel to declare RabbitMQ resources and publish/consume messages.
  const channel = await connection.createChannel();

  // An exchange receives published messages and routes them to queues.
  // "direct" means the routing key must match exactly.
  await channel.assertExchange(exchangeName, "direct", { durable: true });

  // A queue stores messages until a consumer is ready to process them.
  // "durable" asks RabbitMQ to keep the queue after a broker restart.
  await channel.assertQueue(queueName, { durable: true });

  // This connects the queue to the exchange. Only messages with this routing
  // key will be delivered from this exchange to this queue.
  await channel.bindQueue(queueName, exchangeName, routingKey);

  return { connection, channel };
}




export async function connectWithRetry(): Promise<{
  connection: ChannelModel;
  channel: Channel;
}> {
  const maxAttempts = 30;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      // Docker may start the API/worker before RabbitMQ has finished starting.
      // Try the connection and return as soon as RabbitMQ is available.
      return await connectToRabbitMq();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      console.log(
        `RabbitMQ is not ready yet (attempt ${attempt}/${maxAttempts}). Retrying in 2 seconds...`,
      );

      // Pause before trying again so we do not repeatedly hit a starting broker.
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Unable to connect to RabbitMQ");
}
