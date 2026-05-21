import { IXCBackendService } from './src/ixcService';
import { IXCParams } from './src/ixcTypes';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const host = "https://coopertecisp.com.br";
  const ixc = new IXCBackendService(host, process.env.IXC_TOKEN || "");
  console.log("Fetching fn_areceber keys...");
  
  const data: Partial<IXCParams> = {
    qtype: 'fn_areceber.status',
    query: 'A',
    oper: '=',
    page: '1',
    rp: '1',
  };
  
  try {
    const response = await ixc['makeRequest']('/webservice/v1/fn_areceber', data) as any;
    if (response && response.registros && response.registros.length > 0) {
      console.log(Object.keys(response.registros[0]));
    }
  } catch(e) {
    console.error("Error", e);
  }
}

run().catch(console.error);
