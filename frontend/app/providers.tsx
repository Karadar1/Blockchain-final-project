'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { anvil } from 'wagmi/chains';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import '@mysten/dapp-kit/dist/index.css';

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
    chains: [anvil],
    transports: {
        [anvil.id]: http(),
    },
});

const { networkConfig } = createNetworkConfig({
    localnet: { url: getFullnodeUrl('localnet') },
    devnet: { url: getFullnodeUrl('devnet') },
});

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <SuiClientProvider networks={networkConfig} defaultNetwork="devnet">
                    <WalletProvider>
                        {children}
                    </WalletProvider>
                </SuiClientProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
