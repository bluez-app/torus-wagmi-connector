import "@rainbow-me/rainbowkit/styles.css";

import {
  ConnectButton,
  connectorsForWallets,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import {
  rainbowWallet,
  metaMaskWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createClient, WagmiConfig, configureChains } from "wagmi";
import { mainnet, polygon, optimism, arbitrum } from '@wagmi/core/chains'
import { rainbowTorusConnector } from "./RainbowTorusConnector";

import { publicProvider } from 'wagmi/providers/public'
const { chains, provider } = configureChains(
  [mainnet, polygon, optimism, arbitrum],
  [publicProvider()],
);

const projectId = "acd532ccb5b241a06e27ffc22bcd4a3b"
const connectors = connectorsForWallets([
  {
    groupName: "Recommended",
    wallets: [
      rainbowWallet({ chains, projectId }),
      walletConnectWallet({ chains, projectId }),
      metaMaskWallet({ chains, projectId }),
      rainbowTorusConnector({ chains }),
    ],
  },
]);
const wagmiClient = createClient({
  connectors,
  provider,
});

export default function App() {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider chains={chains}>
        <div
          style={{
            position: "fixed",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "sans-serif",
          }}
        >
          <ConnectButton />
        </div>
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
