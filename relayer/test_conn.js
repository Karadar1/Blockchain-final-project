import { SuiClient } from '@mysten/sui/client';
import 'dotenv/config';

async function test() {
    const url = process.env.SUI_RPC_URL;
    console.log(`Testing connection to '${url}'...`);
    try {
        const client = new SuiClient({ url });
        const version = await client.getRpcApiVersion();
        console.log("Success! RPC Version:", version);
    } catch (e) {
        console.error("Connection Failed:", e);
        if (e.cause) console.error("Cause log:", e.cause);
    }
}

test();
