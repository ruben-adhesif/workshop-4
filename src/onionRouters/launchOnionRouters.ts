import axios from "axios";
import { simpleOnionRouter } from "./simpleOnionRouter";
import { REGISTRY_PORT } from "../config";

export async function launchOnionRouters(n: number) {
  const promises = [];

  // launch a n onion routers
  for (let index = 0; index < n; index++) {
    // create the node
    const newPromise = simpleOnionRouter(index);
    promises.push(newPromise);
  }

  const servers = await Promise.all(promises);

  return servers;
}
