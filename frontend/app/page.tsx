'use client';

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

const ETH_CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const SUI_PACKAGE_ID = '0x8366bc75935af2a9ee53a0916a9c67a805938beb16231cfed5386514bd5b7d4a';
const SUI_MODULE_NAME = 'ibt';

interface HistoryItem {
  id: string;
  direction: 'ETH_TO_SUI' | 'SUI_TO_ETH';
  amount: string;
  status: 'COMPLETED' | 'PENDING';
  timestamp: string;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function Home() {
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'ETH_TO_SUI' | 'SUI_TO_ETH'>('ETH_TO_SUI');
  const [ethRecipient, setEthRecipient] = useState('');
  const [suiRecipient, setSuiRecipient] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'BURNING' | 'RELAYING' | 'COMPLETED' | 'ERROR'>('IDLE');
  const [txHash, setTxHash] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const { address: ethAddress, isConnected: isEthConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();

  const suiAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [selectedCoin, setSelectedCoin] = useState('');

  const { data: suiCoins } = useSuiClientQuery(
    'getCoins',
    {
      owner: suiAccount?.address || '',
      coinType: `${SUI_PACKAGE_ID}::${SUI_MODULE_NAME}::IBT`
    },
    {
      enabled: !!suiAccount,
      select: (data) => data.data // extract the array of coins
    }
  );

  const addAnvilNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x7A69', // 31337
          chainName: 'Anvil Localnet',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: ['http://127.0.0.1:8545']
        }]
      });
    } catch (e) {
      console.error("Failed to add Anvil", e);
    }
  };

  const simulateRelayer = (dir: 'ETH_TO_SUI' | 'SUI_TO_ETH', amt: string) => {
    setStatus('RELAYING');
    setTimeout(() => {
      setStatus('COMPLETED');
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        direction: dir,
        amount: amt,
        status: 'COMPLETED',
        timestamp: new Date().toLocaleTimeString()
      };
      setHistory(prev => [newItem, ...prev]);
    }, 5000);
  };

  const handleBridge = async () => {
    if (!amount) return;
    setStatus('BURNING');
    setTxHash('');

    try {
      if (direction === 'ETH_TO_SUI') {
        const recipient = suiRecipient || suiAccount?.address;
        if (!recipient) throw new Error("Recipient required");

        console.log("Bridging to Sui:", recipient, amount);
        const hash = await writeContractAsync({
          address: ETH_CONTRACT_ADDRESS,
          abi: [{
            name: 'bridge',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'amount', type: 'uint256' }, { name: 'recipient', type: 'string' }],
            outputs: []
          }],
          functionName: 'bridge',
          args: [parseEther(amount), recipient],
        });
        setTxHash(hash);
        console.log("Eth Tx:", hash);
        simulateRelayer('ETH_TO_SUI', amount);

      } else {
        const recipient = ethRecipient || ethAddress;
        if (!recipient) throw new Error("Recipient required");

        console.log("Bridging to Eth:", recipient, amount);
        const tx = new Transaction();
        // Use user selected coin OR default to the first one found
        const coinToBurn = selectedCoin || (suiCoins && suiCoins.length > 0 ? suiCoins[0].coinObjectId : null);

        if (!coinToBurn) throw new Error("No IBT Coin selected or found!");

        tx.moveCall({
          target: `${SUI_PACKAGE_ID}::${SUI_MODULE_NAME}::bridge_burn`,
          arguments: [
            tx.object(coinToBurn),
            tx.pure.string(recipient)
          ],
        });

        const result = await signAndExecuteTransaction({ transaction: tx });
        setTxHash(result.digest);
        simulateRelayer('SUI_TO_ETH', amount);
      }
    } catch (e) {
      console.error(e);
      setStatus('ERROR');
      alert('Error bridging: ' + (e as Error).message);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-slate-950 text-white">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          Centralized Token Bridge
        </h1>
        <div className="flex gap-4 items-center">
          <button onClick={addAnvilNetwork} className="text-xs text-gray-400 underline hover:text-white">
            Add Anvil
          </button>

          {isEthConnected ? (
            <button onClick={() => disconnect()} className="px-4 py-2 bg-blue-600 rounded">
              Eth: {ethAddress?.slice(0, 6)}...
            </button>
          ) : (
            connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({ connector })}
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                Connect Eth
              </button>
            ))
          )}

          <ConnectButton />
        </div>
      </div>

      <div className="relative flex flex-col items-center bg-gray-900 p-10 rounded-xl border border-gray-800 shadow-2xl">
        <div className="flex flex-col gap-6 w-96">

          <div className="flex justify-center bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setDirection('ETH_TO_SUI')}
              className={`flex-1 py-2 rounded-md transition ${direction === 'ETH_TO_SUI' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            >
              Eth ➡️ Sui
            </button>
            <button
              onClick={() => setDirection('SUI_TO_ETH')}
              className={`flex-1 py-2 rounded-md transition ${direction === 'SUI_TO_ETH' ? 'bg-purple-600' : 'hover:bg-gray-700'}`}
            >
              Sui ➡️ Eth
            </button>
          </div>

          <div className='flex flex-col gap-2'>
            <label className="text-xs text-gray-400">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded p-3 focus:outline-none focus:border-blue-500"
              placeholder="0.0"
            />
          </div>

          {direction === 'ETH_TO_SUI' ? (
            <div className='flex flex-col gap-2'>
              <label className="text-xs text-gray-400">Sui Recipient</label>
              <input
                type="text"
                value={suiRecipient || suiAccount?.address || ''}
                onChange={e => setSuiRecipient(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded p-3 focus:outline-none focus:border-blue-500"
                placeholder="0x..."
              />
            </div>
          ) : (
            <div className='flex flex-col gap-2'>
              <label className="text-xs text-gray-400">Eth Recipient</label>
              <input
                type="text"
                value={ethRecipient || ethAddress || ''}
                onChange={e => setEthRecipient(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded p-3 focus:outline-none focus:border-purple-500"
                placeholder="0x..."
              />
              <label className="text-xs text-gray-400">Select IBT Coin</label>
              {suiCoins && suiCoins.length > 0 ? (
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3"
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  value={selectedCoin || (suiCoins[0]?.coinObjectId || '')}
                >
                  {suiCoins.map((coin) => (
                    <option key={coin.coinObjectId} value={coin.coinObjectId}>
                      Token: {coin.coinObjectId.slice(0, 6)}... (Bal: {parseInt(coin.balance) / 10 ** 9})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-red-400 text-xs p-2 border border-red-900 bg-red-900/20 rounded">
                  No IBT Tokens found. Bridge some ETH first!
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleBridge}
            disabled={!isEthConnected || !suiAccount || status === 'BURNING' || status === 'RELAYING'}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {status === 'IDLE' || status === 'COMPLETED' || status === 'ERROR' ? 'Bridge Tokens' : 'Processing...'}
          </button>

          {status !== 'IDLE' && (
            <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700 animate-fade-in w-full text-center">
              <h3 className="text-sm font-bold mb-2">Transaction Status</h3>
              <div className="flex flex-col gap-2 text-xs">
                <div className={`flex items-center gap-2 ${status === 'BURNING' ? 'text-blue-400 animate-pulse' : 'text-green-500'}`}>
                  <span>1. Burning on Source</span>
                  {status === 'BURNING' && <span>(Confirm in Wallet...)</span>}
                  {status !== 'BURNING' && status !== 'ERROR' && <span>✅</span>}
                </div>
                <div className={`flex items-center gap-2 ${(status === 'RELAYING') ? 'text-purple-400 animate-pulse' : (status === 'COMPLETED' ? 'text-green-500' : 'text-gray-500')}`}>
                  <span>2. Relaying to Destination</span>
                  {status === 'RELAYING' && <span>(Watching events...)</span>}
                  {status === 'COMPLETED' && <span>✅</span>}
                </div>
                {status === 'COMPLETED' && (
                  <div className="text-green-400 font-bold mt-2">
                    Bridge Check Complete! Check your wallet.
                  </div>
                )}
                {status === 'ERROR' && (
                  <div className="text-red-400 font-bold mt-2">
                    Transaction Failed.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-10 w-full max-w-4xl">
          <h2 className="text-xl font-bold mb-4">Bridge History</h2>
          <table className="w-full text-left bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
            <thead className="bg-gray-800 text-gray-400 text-sm">
              <tr>
                <th className="p-4">Time</th>
                <th className="p-4">Direction</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {history.map((item) => (
                <tr key={item.id} className="text-sm hover:bg-gray-800/50">
                  <td className="p-4">{item.timestamp}</td>
                  <td className="p-4 flex items-center gap-2">
                    {item.direction === 'ETH_TO_SUI' ? '🟦 Eth ➡️ 🟪 Sui' : '🟪 Sui ➡️ 🟦 Eth'}
                  </td>
                  <td className="p-4 font-mono">{item.amount}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-900 text-green-400">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-32 grid text-center lg:mb-0 lg:w-full lg:max-w-5xl lg:grid-cols-4 lg:text-left">
      </div>
    </main>
  );
}
