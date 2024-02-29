import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";
import * as crypto from "../crypto";

// Registery Initialisation
export type Node =    { nodeId: number; pubKey: string };
export type NodePri = { nodeId: number; prvKey: string | null };
export type GetNodeRegistryBody = { pub: Node[]; prv : NodePri[] };

let register : GetNodeRegistryBody = { pub: [], prv: [] };


export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  _registry.post("/registerNode", async (req, res) => {
    const nodeId : number = parseInt(req.body.nodeId, 10);

    // Create a RSA key pair
    const keyPair = await crypto.generateRsaKeyPair();
    const publicKey : string = await crypto.exportPubKey(keyPair.publicKey);
    const privateKey : string | null = await crypto.exportPrvKey(keyPair.privateKey);
    
    // Create the Node
    const newNode: Node = { nodeId: nodeId, pubKey: publicKey };
    const newPrvKey: NodePri = { nodeId: nodeId, prvKey: privateKey };

    // Register the Node
    register.pub.push(newNode);
    register.prv.push(newPrvKey);

    //res.status(200); // Ping lauchOnionRouters.ts that it's ended
    res.status(200).json({ nodeId: nodeId, pubKey: publicKey });
  });

  _registry.get('/getPrivateKey/:nodeId', (req, res) => {
    const ReqNodeId = parseInt(req.params.nodeId);
    const nodePrvList = register.prv;
    
    const ReqNode: NodePri | undefined = nodePrvList.find(node => node.nodeId === ReqNodeId);
    const prvKey = ReqNode?.prvKey || null;
    res.json({ nodeId : ReqNodeId, prvKey: prvKey });
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
