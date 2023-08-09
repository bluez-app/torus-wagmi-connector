// @ts-nocheck
import Torus, { TorusInpageProvider } from "@toruslabs/torus-embed";
import {
  Chain,
  Connector,
  ConnectorData,
  normalizeChainId,
  UserRejectedRequestError,
} from "@wagmi/core";
import { ethers, Signer } from "ethers";
import { getAddress } from "ethers/lib/utils";
import log from "loglevel";

import { Options } from "./interfaces";

const IS_SERVER = typeof window === "undefined";

export class TorusConnector extends Connector {
  ready = !IS_SERVER;

  readonly id = "torus";

  readonly name = "torus";

  provider: TorusInpageProvider;

  torusInstance?: Torus;

  torusOptions: Options;

  network = {
    host: "mainnet",
    chainId: 1,
    networkName: "Ethereum Mainnet",
    blockExplorer: "https://etherscan.io",
    ticker: "ETH",
    tickerName: "Ethereum",
  };

  constructor(config: { chains?: Chain[]; options: Options }) {
    super(config);
    this.torusOptions = config.options;
    const chainId = config.options.chainId ? config.options.chainId : 1;
    const host = config.options.host ? config.options.host : "mainnet";
    this.torusInstance = new Torus({
      buttonPosition: config.options.buttonPosition || "bottom-left",
    });

    // set network according to chain details provided
    const chain = this.chains.find((x) => x.id === chainId);

    if (chain) {
      this.network = {
        host,
        chainId,
        networkName: chain.name,
        tickerName: chain.nativeCurrency?.name,
        ticker: chain.nativeCurrency?.symbol,
        blockExplorer: chain.blockExplorers.default?.url,
      };
    } else {
      log.warn(`ChainId ${chainId} not found in chain list`);
      this.emit("disconnect");
    }
  }

  async connect(): Promise<Required<ConnectorData>> {
    try {
      this.emit("message", {
        type: "connecting",
      });

      if (!this.provider) {
        // initialize torus embed
        if (!this.torusInstance.isInitialized) {
          await this.torusInstance.init({
            ...this.torusOptions.TorusParams,
            network: this.network,
          });
        } else if (this.torusOptions.TorusParams?.showTorusButton !== false) {
          this.torusInstance.showTorusButton();
        }

        document.getElementById("torusIframe").style.zIndex =
          "999999999999999999";
        await this.torusInstance.login();
      }

      const isLoggedIn = await this.isAuthorized();

      // if there is a user logged in, return the user
      if (isLoggedIn) {
        const provider = await this.getProvider();

        if (provider.on) {
          provider.on("accountsChanged", this.onAccountsChanged);
          provider.on("chainChanged", this.onChainChanged);
        }

        const chainId = await this.getChainId();

        return {
          provider,
          chain: {
            id: chainId,
            unsupported: this.isChainUnsupported(chainId),
          },
          account: await this.getAccount(),
        };
      }
      throw new Error("Failed to login, Please try again");
    } catch (error) {
      if (this.torusInstance.isInitialized) {
        this.torusInstance.hideTorusButton();
      }
      log.error("error while connecting", error);
      throw new UserRejectedRequestError("Something went wrong");
    }
  }

  async getAccount(): Promise<string> {
    try {
      const provider = new ethers.providers.Web3Provider(
        await this.getProvider()
      );
      const signer = provider.getSigner();
      const account = await signer.getAddress();
      return account;
    } catch (error) {
      log.error("Error: Cannot get account:", error);
      throw error;
    }
  }

  async getProvider() {
    if (this.provider) {
      return this.provider;
    }
    this.provider = this.torusInstance.provider;
    return this.provider;
  }

  async getSigner(): Promise<Signer> {
    try {
      const provider = new ethers.providers.Web3Provider(
        await this.getProvider()
      );
      const signer = provider.getSigner();
      return signer;
    } catch (error) {
      log.error("Error: Cannot get signer:", error);
      throw error;
    }
  }

  async isAuthorized() {
    try {
      const account = await this.getAccount();
      return !!(account && this.provider);
    } catch {
      return false;
    }
  }

  async getChainId(): Promise<number> {
    try {
      const provider = await this.getProvider();
      if (!provider && this.network.chainId) {
        return normalizeChainId(this.network.chainId);
      } else if (provider) {
        const chainId = await provider.request({ method: "eth_chainId" });
        if (chainId) {
          return normalizeChainId(chainId as string);
        }
      }

      throw new Error("Chain ID is not defined");
    } catch (error) {
      log.error("Error: Cannot get Chain Id from the network.", error);
      throw error;
    }
  }

  async switchChain(chainId: number) {
    try {
      const chain = this.chains.find((x) => x.id === chainId);
      if (!chain) throw new Error(`Unsupported chainId: ${chainId}`);
      if (!this.isAuthorized()) throw new Error("Please login first");
      await this.torusInstance.setProvider({
        host: chain.rpcUrls.default.http[0],
        chainId,
        networkName: chain.name,
      });
      return chain;
    } catch (error) {
      log.error("Error: Cannot change chain", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.torusInstance.logout();
    this.torusInstance.hideTorusButton();
    this.provider = null;
  }

  protected isChainUnsupported(chainId: number): boolean {
    return !this.chains.some((x) => x.id === chainId);
  }

  protected onAccountsChanged = (accounts: string[]): void => {
    if (accounts.length === 0) {
      this.emit("disconnect");
    } else this.emit("change", { account: getAddress(accounts[0]) });
  };

  protected onChainChanged = (chainId: string | number): void => {
    const id = normalizeChainId(chainId);
    const unsupported = this.isChainUnsupported(id);
    this.emit("change", { chain: { id, unsupported } });
  };

  protected onDisconnect = (): void => {
    this.emit("disconnect");
  };
}
