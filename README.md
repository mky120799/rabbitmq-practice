# RabbitMQ Practice

A small TypeScript project for learning how an Express API publishes messages to RabbitMQ and how a worker consumes them.

## Run with Docker

```bash
docker compose up --build
```

The services are then available at:

- API: http://localhost:3000
- RabbitMQ management UI: http://localhost:15672
- RabbitMQ UI login: `app` / `app`

Send a message to the API:

```bash
curl -X POST http://localhost:3000/messages \
  -H 'content-type: application/json' \
  -d '{"text":"Hello from RabbitMQ"}'
```

You should see the API publish the message and the worker receive and acknowledge it in the Compose logs.

Stop the project with:

```bash
docker compose down
```

## Run the Node processes locally

Start RabbitMQ only:

```bash
docker compose up rabbitmq
```

In two other terminals:

```bash
npm install
npm run dev
npm run dev:worker
```

For local Node processes, use this connection string:

```bash
RABBITMQ_URL=amqp://app:app@localhost:5672
```

## Message flow

`POST /messages` → `practice.events` exchange → `message.created` routing key → `practice.messages` queue → worker.
