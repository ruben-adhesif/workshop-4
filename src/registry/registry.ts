import bodyParser from "body-parser";
import express from "express";
import { REGISTRY_PORT } from "../config";
import * as crypto from "../crypto";

// Differente classes
export type Node =    { nodeId: number; pubKey: string };
export type NodePri = { nodeId: number; prvKey: string | null };
export type NodeRegistry = { nodes: Node[]; prvkey : NodePri[] };

// Useless (only for __test__/tests/onionRouting.test.ts )
export type RegisterNodeBody = { nodeId: number; pubKey: string; };
export type GetNodeRegistryBody = { nodes: Node[]; };


export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  // Initialisation for the instance
  let registry : NodeRegistry = { nodes: [], prvkey: [] };
  
  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  _registry.post("/registerNode", async (req, res) => {
    const nodeId : number = parseInt(req.body.nodeId, 10);

    // Generate RSA key
    const keyPair = await crypto.generateRsaKeyPair();
    const publicKey : string = await crypto.exportPubKey(keyPair.publicKey);
    const privateKey : string | null = await crypto.exportPrvKey(keyPair.privateKey);

    // Register it
    registry.nodes.push({ nodeId: nodeId, pubKey: publicKey });
    registry.prvkey.push({ nodeId: nodeId, prvKey: privateKey });

    // Ping lauchOnionRouters.ts that it's ended
    res.status(200).json({ nodeId: nodeId, pubKey: publicKey });
  });

  _registry.get('/getPrivateKey/:nodeId', (req, res) => {
    const ReqNodeId = parseInt(req.params.nodeId);
    const nodePrvList = registry.prvkey;
    
    const ReqNode: NodePri | undefined = nodePrvList.find(node => node.nodeId === ReqNodeId);
    const prvKey = ReqNode?.prvKey || null;
    res.json({ nodeId : ReqNodeId, prvKey: prvKey });
  });

  _registry.get('/getNodeRegistry', (req, res) => {
    res.json(registry)
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
