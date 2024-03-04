import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import axios from "axios";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  // Define explicit types for all variables
  let lastEncryptedMessage : string | null = null;
  let lastDecryptedMessage : string | null = null;
  let lastMessageDestination : string | null = null;
  let lastReceivedMessage: string | null = null;
  let lastSentMessage: string | null = null;

  // Check status
  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  // Nodes' GET routes
  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });

  // Users' GET routes
  onionRouter.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  onionRouter.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });

  // Register
  onionRouter.post("/registerNode", async (req, res) => {
    const response = await axios.post(`http://localhost:${REGISTRY_PORT}/registerNode`, { nodeId: nodeId});
    res.json( response.data)
  });

  onionRouter.get("/getPrivateKey", async (req, res) => {
    const response = await axios.get(`http://localhost:${REGISTRY_PORT}/getPrivateKey/${nodeId}`);
    const prvKey = response.data.prvKey;
    res.json({ result : prvKey });
  });


  // END
  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`
    );
  });

  return server;
}
