import { createServer } from "http";
import { createApp } from "./app";
import { startRealtimeDocumentServer } from "./collab/hocuspocus.server";
import { createRealtimeSocketServer } from "./socket/socket.server";
import { env } from "./shared/config/env";
import { prisma } from "./shared/db/prisma";

const bootstrap = async () => {
  const app = createApp();
  const httpServer = createServer(app);

  const realtimeGateway = createRealtimeSocketServer(httpServer);
  const { io, emitVersionCreated } = realtimeGateway;
  app.set("realtimeGateway", realtimeGateway);
  const hocuspocusServer = await startRealtimeDocumentServer({
    onVersionCreated: emitVersionCreated,
  });

  httpServer.listen(env.PORT, () => {
    console.log(`HTTP API listening on http://localhost:${env.PORT}`);
    console.log(`Socket.IO attached to same server`);
    console.log(`Hocuspocus listening on ws://localhost:${env.HOCUSPOCUS_PORT}`);
  });

  const gracefulShutdown = async () => {
    console.log("Shutting down servers...");

    io.close();
    httpServer.close();
    await hocuspocusServer.destroy();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
};

bootstrap().catch(async (error) => {
  console.error("Failed to bootstrap server", error);
  await prisma.$disconnect();
  process.exit(1);
});
