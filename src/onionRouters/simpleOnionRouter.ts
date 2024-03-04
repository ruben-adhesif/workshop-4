import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import axios from "axios";
import * as crypto from "../crypto";

// Initialisation for the class
type RouterLog = {
  lastReceivedEncryptedMessage : string | null;
  lastReceivedDecryptedMessage : string | null;
  lastMessageDestination : number | null;
  update:(message: string, clearMessage: string, prevNode: number) => void;
}
const LEN_RSA_ENCRYPTED = 344;
const LEN_PREVIOUS_VALUE = 10;

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  // Initialisation of the instance
  let log : RouterLog = {
    lastReceivedEncryptedMessage: null,
    lastReceivedDecryptedMessage: null,
    lastMessageDestination: null,

    update(message: string, clearMessage: string, prevNode: number) {
      this.lastReceivedEncryptedMessage = message;
      this.lastReceivedDecryptedMessage = clearMessage;
      this.lastMessageDestination = prevNode;
    }
  }

  // Check status
  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  // GET routes
  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => { 
    res.json({ result: log.lastReceivedEncryptedMessage });   
  });
  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => { 
    res.json({ result: log.lastReceivedDecryptedMessage }); 
  });
  onionRouter.get("/getLastMessageDestination", (req, res) => { 
    res.json({ result: log.lastMessageDestination }); 
  });

  // Register (automaticaly & on demande)
  await axios.post(`http://localhost:${REGISTRY_PORT}/registerNode`, { nodeId: nodeId});
  onionRouter.post("/registerNode", async (req, res) => {
    const response = await axios.post(`http://localhost:${REGISTRY_PORT}/registerNode`, { nodeId: nodeId});
    res.json(response.data)
  });

  onionRouter.get("/getPrivateKey", async (req, res) => {
    const response = await axios.get(`http://localhost:${REGISTRY_PORT}/getPrivateKey/${nodeId}`);
    const prvKey = response.data.prvKey;
    res.json({ result : prvKey });
  });

  // Message
  onionRouter.post("/message", async (req, res) => {
    // Get data
    const message : string = req.body.message;
    const response = await axios.get(`http://localhost:${REGISTRY_PORT}/getPrivateKey/${nodeId}`);
    const prvKey = await crypto.importPrvKey(response.data.prvKey);

    // Break encryption
    const rsaEncrypted = message.substring(0, LEN_RSA_ENCRYPTED);
    const symEncrypted = message.substring(LEN_RSA_ENCRYPTED);
    const symKey = await crypto.rsaDecrypt(rsaEncrypted, prvKey);
    const clearData = await crypto.symDecrypt(symKey, symEncrypted);

    // Read Data
    const previousValue = clearData.substring(0, LEN_PREVIOUS_VALUE);
    const clearMessage = clearData.substring(LEN_PREVIOUS_VALUE);
    const prevNode = parseInt(previousValue, 10);

    // Send back
    await axios.post(`http://localhost:${prevNode}/message`, { message: clearMessage});
    log.update(message, clearMessage, prevNode);
    res.sendStatus(200)
  });


  // END
  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`
    );
  });

  return server;
}