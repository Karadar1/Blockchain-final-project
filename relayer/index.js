import { createPublicClient, createWalletClient, http, parseAbiItem, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import 'dotenv/config';

const ETH_RPC_URL = process.env.ETH_RPC_URL || 'http://127.0.0.1:8545';
const ETH_PRIVATE_KEY = process.env.ETH_PRIVATE_KEY;
const ETH_CONTRACT_ADDRESS = process.env.ETH_CONTRACT_ADDRESS;

const SUI_RPC_URL = process.env.SUI_RPC_URL || getFullnodeUrl('devnet');
console.log(`Using Sui RPC URL: '${SUI_RPC_URL}'`); /
const SUI_PRIVATE_KEY = process.env.SUI_PRIVATE_KEY;
const SUI_PACKAGE_ID = process.env.SUI_PACKAGE_ID;
const SUI_TREASURY_CAP_ID = process.env.SUI_TREASURY_CAP_ID;
const SUI_MODULE_NAME = 'ibt';

if (!ETH_PRIVATE_KEY || !SUI_PRIVATE_KEY) {
    console.error("Error: Missing Private Keys in .env");
    process.exit(1);
}

if (ETH_PRIVATE_KEY.includes("YOUR_ETH_PRIVATE_KEY") || SUI_PRIVATE_KEY.includes("YOUR_SUI_PRIVATE_KEY")) {
    console.error("Error: You must update relayer/.env with your ACTUAL private keys.");
    console.error("Edit the file and replace 'YOUR_ETH_PRIVATE_KEY_HERE' etc.");
    process.exit(1);
}

const formattedEthKey = ETH_PRIVATE_KEY.startsWith('0x') ? ETH_PRIVATE_KEY : `0x${ETH_PRIVATE_KEY}`;

const anvil = defineChain({
    id: 31337,
    name: 'Anvil',
    network: 'anvil',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [ETH_RPC_URL] } },
})

const ethAccount = privateKeyToAccount(formattedEthKey);
const ethPublicClient = createPublicClient({ chain: anvil, transport: http() });
const ethWalletClient = createWalletClient({ account: ethAccount, chain: anvil, transport: http() });

let suiKeypair;
try {
    let secret = SUI_PRIVATE_KEY;
    if (secret.startsWith('suiprivkey')) {
        console.warn("Using raw key handling. If using suiprivkey format, ensure decoding logic.");
    }
    const keyBytes = Buffer.from(secret, 'base64');
    if (keyBytes.length === 33) {
        suiKeypair = Ed25519Keypair.fromSecretKey(keyBytes.slice(1));
    } else if (keyBytes.length === 32) {
        suiKeypair = Ed25519Keypair.fromSecretKey(keyBytes);
    } else {
        suiKeypair = Ed25519Keypair.fromSecretKey(Buffer.from(secret, 'hex'));
    }
} catch (e) {
    console.error("Error loading Sui Key:", e.message);
    process.exit(1);
}

const suiClient = new SuiClient({ url: SUI_RPC_URL });

async function bridgeToSui(amount, toAddress) {
    const amountSui = amount / 1_000_000_000n;
    console.log(`Bridging ${amount} (Eth) -> ${amountSui} (Sui) to ${toAddress}...`);
    try {
        const tx = new Transaction();
        tx.moveCall({
            target: `${SUI_PACKAGE_ID}::${SUI_MODULE_NAME}::mint`,
            arguments: [
                tx.object(SUI_TREASURY_CAP_ID),
                tx.pure.u64(amountSui),
                tx.pure.address(toAddress)
            ],
        });

        const result = await suiClient.signAndExecuteTransaction({
            signer: suiKeypair,
            transaction: tx,
        });
        console.log(`Minted on Sui: ${result.digest}`);
    } catch (e) {
        console.error("Error bridging to Sui:", e);
    }
}

async function bridgeToEth(amount, toAddress) {
    const amountEth = BigInt(amount) * 1_000_000_000n;
    console.log(`Bridging ${amount} (Sui) -> ${amountEth} (Eth) to ${toAddress}...`);
    try {
        const { request } = await ethPublicClient.simulateContract({
            address: ETH_CONTRACT_ADDRESS,
            abi: [parseAbiItem(`function mint(address to, uint256 amount) external`)],
            functionName: 'mint',
            args: [toAddress, amountEth],
            account: ethAccount
        });
        const hash = await ethWalletClient.writeContract(request);
        console.log(`Minted on Eth: ${hash}`);
    } catch (e) {
        console.error("Error bridging to Eth:", e);
    }
}

async function start() {
    console.log("Starting Relayer...");
    console.log("Eth Relayer Address:", ethAccount.address);
    console.log("Sui Relayer Address:", suiKeypair.toSuiAddress());
    console.log("Listening for events...");
    setInterval(() => console.log("Relayer Heartbeat: Scan active..."), 10000);

    const ethParams = {
        address: ETH_CONTRACT_ADDRESS,
        abi: [parseAbiItem('event BridgeBurn(address indexed from, uint256 amount, string recipient)')],
        fromBlock: 'earliest'
    };

    const processedLogs = new Set();

    setInterval(async () => {
        try {
            const logs = await ethPublicClient.getContractEvents(ethParams);
            logs.forEach(log => {
                const logId = `${log.blockNumber}-${log.logIndex}`;
                if (!processedLogs.has(logId)) {
                    processedLogs.add(logId);
                    const { from, amount, recipient } = log.args;
                    console.log(`Detected BridgeBurn on Eth: ${amount} from ${from} to ${recipient}`);
                    bridgeToSui(amount, recipient);
                }
            });
        } catch (e) {
            console.error("Error polling Eth events:", e);
        }
    }, 5000);

    let nextCursor = null;
    const interval = setInterval(async () => {
        try {
            const events = await suiClient.queryEvents({
                query: { MoveModule: { package: SUI_PACKAGE_ID, module: SUI_MODULE_NAME } },
                cursor: nextCursor
            });

            if (events.nextCursor) {
                nextCursor = events.nextCursor;
            }

            for (const event of events.data) {
                if (event.type.includes('BridgeBurnEvent')) {
                    const { amount, recipient_eth } = event.parsedJson;
                    console.log(`Detected Sui BridgeBurn: ${amount}, to ${recipient_eth}`);
                    await bridgeToEth(amount, recipient_eth);
                }
            }
        } catch (e) {
            console.error("Error polling Sui events:", e);
        }
    }, 3000);
}

start();
