import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import crypto from "node:crypto";
import os from "node:os";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import type { RemoteAudioState, RemoteDeckState } from "./src/runtime/remote-types";

type RemoteClientRole = "controller" | "presenter";

type RemoteClient = {
  deckSlug: string;
  role: RemoteClientRole;
};

function readRequestBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function isLoopbackRequest(req: IncomingMessage) {
  const address = req.socket.remoteAddress ?? "";

  return address === "::1" || address === "127.0.0.1" || address === "::ffff:127.0.0.1";
}

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

function controlUrlsForRequest(req: IncomingMessage, deckSlug: string) {
  const hostHeader = req.headers.host ?? "localhost:5173";
  const port = hostHeader.includes(":") ? hostHeader.split(":").at(-1) : "5173";
  const lanUrls = getLanAddresses().map((address) => `http://${address}:${port}/${deckSlug}/control`);

  return lanUrls.length > 0 ? lanUrls : [`http://${hostHeader}/${deckSlug}/control`];
}

function prezzoRemoteControlPlugin() {
  const pin = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const tokens = new Set<string>();
  const clients = new Map<WebSocket, RemoteClient>();
  const clientTokens = new Map<WebSocket, string>();
  const deckStates = new Map<string, RemoteDeckState>();
  const audioStates = new Map<string, RemoteAudioState | null>();
  const wss = new WebSocketServer({ noServer: true });

  const broadcast = (deckSlug: string, payload: unknown, roles?: RemoteClientRole[]) => {
    const message = JSON.stringify(payload);

    for (const [client, meta] of clients) {
      if (meta.deckSlug !== deckSlug) continue;
      if (roles && !roles.includes(meta.role)) continue;
      if (client.readyState !== client.OPEN) continue;

      client.send(message);
    }
  };
  const presenterCount = (deckSlug: string) =>
    [...clients.values()].filter((client) => client.deckSlug === deckSlug && client.role === "presenter").length;
  const controllerCount = (deckSlug: string) =>
    [...clients.values()].filter((client) => client.deckSlug === deckSlug && client.role === "controller").length;
  const broadcastConnections = (deckSlug: string) =>
    broadcast(deckSlug, {
      controllers: controllerCount(deckSlug),
      presenters: presenterCount(deckSlug),
      type: "connections",
    });

  return {
    name: "prezzo-remote-control",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

        if (requestUrl.pathname === "/__prezzo_remote/status" && req.method === "GET") {
          sendJson(res, 200, { available: true });
          return;
        }

        if (requestUrl.pathname === "/__prezzo_remote/pin" && req.method === "GET") {
          if (!isLoopbackRequest(req)) {
            sendJson(res, 403, { error: "PIN is only available from the presenting machine." });
            return;
          }

          sendJson(res, 200, { pin });
          return;
        }

        if (requestUrl.pathname === "/__prezzo_remote/access" && req.method === "GET") {
          if (!isLoopbackRequest(req)) {
            sendJson(res, 403, { error: "Remote access details are only available from the presenting machine." });
            return;
          }

          const deckSlug = requestUrl.searchParams.get("deck") ?? process.env.VITE_PREZZO_DECK ?? "prezzo-demo";
          const controlUrls = controlUrlsForRequest(req, deckSlug);
          const remoteUrl = new URL(controlUrls[0]);
          remoteUrl.searchParams.set("pin", pin);

          sendJson(res, 200, {
            controlUrls,
            pin,
            remoteUrl: remoteUrl.toString(),
          });
          return;
        }

        if (requestUrl.pathname === "/__prezzo_remote/connect" && req.method === "POST") {
          try {
            const payload = JSON.parse((await readRequestBody(req)) || "{}") as {
              deckSlug?: string;
              pin?: string;
            };

            if (!payload.deckSlug || payload.pin !== pin) {
              sendJson(res, 401, { error: "Invalid PIN." });
              return;
            }

            const token = crypto.randomUUID();
            tokens.add(token);

            sendJson(res, 200, {
              state: deckStates.get(payload.deckSlug) ?? null,
              token,
            });
          } catch {
            sendJson(res, 400, { error: "Invalid request body." });
          }

          return;
        }

        next();
      });

      server.httpServer?.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

        if (requestUrl.pathname !== "/__prezzo_remote/ws") return;

        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      });

      wss.on("connection", (ws, req) => {
        const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        const deckSlug = requestUrl.searchParams.get("deck") ?? "";
        const role = requestUrl.searchParams.get("role") as RemoteClientRole | null;
        const token = requestUrl.searchParams.get("token");

        if (!deckSlug || (role !== "controller" && role !== "presenter")) {
          ws.close(1008, "Missing remote role or deck.");
          return;
        }

        if (role === "controller" && (!token || !tokens.has(token))) {
          ws.close(1008, "Invalid remote token.");
          return;
        }

        if (role === "controller" && token) {
          clientTokens.set(ws, token);
        }

        clients.set(ws, { deckSlug, role });
        ws.send(
          JSON.stringify({
            state: deckStates.get(deckSlug) ?? null,
            type: "hello",
          }),
        );

        broadcastConnections(deckSlug);

        if (role === "controller") {
          ws.send(JSON.stringify({ audio: audioStates.get(deckSlug) ?? null, type: "audio-state" }));
        }

        ws.on("message", (raw) => {
          const meta = clients.get(ws);
          if (!meta) return;

          let message: {
            audio?: RemoteAudioState | null;
            command?: string;
            notes?: string;
            slideCount?: number;
            slideIndex?: number;
            stepIndex?: number;
            type?: string;
            value?: number;
          };

          try {
            message = JSON.parse(String(raw));
          } catch {
            return;
          }

          if (meta.role === "presenter" && message.type === "presenter-state") {
            const nextState = {
              slideCount: Math.max(1, Number(message.slideCount) || 1),
              slideIndex: Math.max(0, Number(message.slideIndex) || 0),
              stepIndex: Math.max(0, Number(message.stepIndex) || 0),
              notes: typeof message.notes === "string" ? message.notes : undefined,
              updatedAt: Date.now(),
            };

            deckStates.set(meta.deckSlug, nextState);
            broadcast(meta.deckSlug, { state: nextState, type: "state" }, ["controller"]);
            return;
          }

          if (meta.role === "presenter" && message.type === "audio-state") {
            const audio = message.audio ?? null;
            audioStates.set(meta.deckSlug, audio);
            broadcast(meta.deckSlug, { audio, type: "audio-state" }, ["controller"]);
            return;
          }

          if (meta.role === "controller" && message.type === "control") {
            broadcast(
              meta.deckSlug,
              {
                command: message.command,
                slideIndex: message.slideIndex,
                stepIndex: message.stepIndex,
                type: "control",
              },
              ["presenter"],
            );
            return;
          }

          if (meta.role === "controller" && message.type === "audio-control") {
            broadcast(
              meta.deckSlug,
              {
                command: message.command,
                type: "audio-control",
                value: message.value,
              },
              ["presenter"],
            );
          }
        });

        ws.on("close", () => {
          const meta = clients.get(ws);
          clients.delete(ws);
          const usedToken = clientTokens.get(ws);

          if (usedToken) {
            tokens.delete(usedToken);
            clientTokens.delete(ws);
          }

          if (meta) {
            broadcastConnections(meta.deckSlug);
          }
        });
      });

      server.httpServer?.once("listening", () => {
        const address = server.httpServer?.address();
        const port = typeof address === "object" && address ? address.port : server.config.server.port;
        const deck = process.env.VITE_PREZZO_DECK ?? "prezzo-demo";
        const lanUrls = getLanAddresses().map((address) => `http://${address}:${port}/${deck}/control`);

        console.info(`\nPrezzo remote PIN: ${pin}`);
        console.info("Use the in-deck terminal command `pin` on the presenting machine to show it again.");
        if (lanUrls.length > 0) {
          console.info(`Phone control URL: ${lanUrls[0]}`);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), prezzoRemoteControlPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
});
