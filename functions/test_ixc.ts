import { IXCBackendService } from './src/ixcService';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const host = "https://coopertecisp.com.br";
  // Create an instance using the true host
  const ixc = new IXCBackendService(host, process.env.IXC_TOKEN || "");
  
  // Override the endpoint temporarily to see if we can find the user using the proper IXC endpoint
  // Wait, makeRequest is private. We can just test getClienteByPhone by modifying makeRequest in ixcService.ts
}
run().catch(console.error);
