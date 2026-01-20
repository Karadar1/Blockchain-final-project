import { createPublicClient, createWalletClient, http, parseAbiItem, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import 'dotenv/config';

const ETH_RPC_URL = process.env.ETH_RPC_URL || 'http://127.0.0.1:8545';
const ETH_PRIVATE_KEY = process.env.ETH_PRIVATE_KEY;
const ETH_CONTRACT_ADDRESS = process.env.ETH_CONTRACT_ADDRESS;

if (!ETH_PRIVATE_KEY) { console.error("Missing Key"); process.exit(1); }

const formattedEthKey = ETH_PRIVATE_KEY.startsWith('0x') ? ETH_PRIVATE_KEY : `0x${ETH_PRIVATE_KEY}`;

const anvil = defineChain({
    id: 31337,
    name: 'Anvil',
    network: 'anvil',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [ETH_RPC_URL] } },
});

const account = privateKeyToAccount(formattedEthKey);
const client = createWalletClient({ account, chain: anvil, transport: http() });
const publicClient = createPublicClient({ chain: anvil, transport: http() });

async function mint() {
    // Address likely being used by user (Account #0)
    const recipient = account.address;
    console.log(`Minting 1000 IBT to ${recipient}...`);

    try {
        const { request } = await publicClient.simulateContract({
            address: ETH_CONTRACT_ADDRESS,
            abi: [parseAbiItem('function mint(address to, uint256 amount) external')],
            functionName: 'mint',
            args: [recipient, BigInt('1000000000000000000000')], // 1000 tokens
            account
        });
        const hash = await client.writeContract(request);
        console.log(`Mint Success! Tx: ${hash}`);
    } catch (e) {
        console.error("Mint Failed:", e);
    }
}

mint();
