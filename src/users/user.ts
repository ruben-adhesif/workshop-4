import bodyParser from "body-parser";
import express from "express";

import axios from "axios";
import { NodeRegistry, Node } from "../registry/registry"
import * as crypto from "../crypto";
import * as config from "../config";

// Initialisation for the class
export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

type UserLog = {
  lastReceivedMessage : string | null;
  lastSentMessage : string | null;
  lastCircuit : number[];
  update:(message: string, circuit: Node[]) => void;
}

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  // Initialisation for the instance
  let log : UserLog = { 
    lastReceivedMessage : null,
    lastSentMessage: null,
    lastCircuit: [],

    update(message: string, circuit: Node[]) {
      // concerve only the NodeId
      const nodeIds: number[] = circuit.map(circuit => circuit.nodeId);
      
      this.lastSentMessage = message;
      this.lastCircuit = nodeIds;
    }
  };

  _user.get("/status", (req, res) => {
    res.send("live");
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: log.lastReceivedMessage });
  });
  _user.get("/getlastSentMessage", (req, res) => {
    res.json({ result: log.lastSentMessage });
  });
  _user.get("/getLastCircuit", (req, res) => {
    res.json({ result: log.lastCircuit })
  });

  _user.get("/getNodeRegistry", async (req, res) => {
    const registery : NodeRegistry = await axios.get(`http://localhost:${config.REGISTRY_PORT}/getNodeRegistry`);
    res.json(registery.nodes);
  })

  _user.post("/message", async (req, res) => {
    const message : string = req.body.message;
    log.lastReceivedMessage = message;
    res.send("success");
  })

  _user.post("/sendMessage", async (req, res) => {
    // Get & archive the request
    const { message, destinationUserId } : SendMessageBody = req.body;
    
    // Create the circuit & encryption layer
    const circuit = await generateRandomCircuit();
    const encryptMsg = await encryptMessage(message, destinationUserId, circuit);

    // Forward the encrypted message
    const entryNode = config.BASE_ONION_ROUTER_PORT + circuit[0].nodeId;
    await axios.post(`http://localhost:${entryNode}/message`, { message: encryptMsg});

    log.update(message, circuit);
    res.sendStatus(200);
  })

  const server = _user.listen(config.BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${config.BASE_USER_PORT + userId}`
    );
  });

  return server;
}

const generateRandomCircuit = async (): Promise<Node[]> => {
  const registry = await axios.get(`http://localhost:${config.REGISTRY_PORT}/getNodeRegistry`);
  const allNodes : Node[] = registry.data.nodes;
  const circuit: Node[] = [];

  while (circuit.length < 3) {
    // Pick a random Node
    const randomIndex = Math.floor(Math.random() * allNodes.length);
    const randomNode = allNodes[randomIndex];
    
    // If not already taken, add it
    if (!circuit.some((node) => node.nodeId === randomNode.nodeId)) {
      circuit.push(randomNode);
    }
  }

  return circuit;
};


const encryptMessage = async(message: string, destinationUserId: number,  circuit: Node[]): Promise<string> => {
  const destinationUser = config.BASE_USER_PORT + Number(destinationUserId);
  let previousValue = destinationUser.toString().padStart(10, '0');
  let encryptedMessage = message;
  
  for (let i = circuit.length - 1; i >= 0; i--) {
    const currentNode = circuit[i];

    
    // Creation of an unique symmetric key for each node of the circuit
    const symKey = await crypto.createRandomSymmetricKey();
    const symKeyB64 = await crypto.exportSymKey(symKey);

    // Asked encoding (Instruction 6.1)
    const symEncrypted = await crypto.symEncrypt(symKey, previousValue + encryptedMessage);
    const rsaEncrypted = await crypto.rsaEncrypt(symKeyB64, currentNode.pubKey);
    encryptedMessage = rsaEncrypted + symEncrypted;

    // Previous Value update
    previousValue = (config.BASE_ONION_ROUTER_PORT + currentNode.nodeId).toString().padStart(10, '0');
  }
  
  return encryptedMessage;
};