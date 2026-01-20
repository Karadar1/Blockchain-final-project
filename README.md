# Centralized Token Bridge (Eth <-> Sui)

A fully functional cross-chain bridge using a **Burn-and-Mint** architecture.

## 🚀 Quick Start in 3 Terminals

### 1. Start Ethereum (Anvil)
This runs a local Ethereum blockchain.
```bash
anvil
```

### 2. Start the Relayer
This Node.js service listens to both chains and processes transfers.
```bash
cd relayer
node index.js
```
*Wait for the log: "Relayer Heartbeat: Scan active..."*

### 3. Start the Frontend
This is the user interface.
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 🏗 Architecture
-   **Ethereum:** `IBT.sol` (ERC-20 with `bridge` and `mint` functions).
-   **Sui:** `ibt.move` (Coin with TreasuryCap logic).
-   **Relayer:** Automatic handling of 18<->9 decimal conversion and rigorous event polling.
-   **Frontend:** Auto-discovery of Sui coins and dual-wallet connection.

## 🧪 Testing

### Bridge Eth -> Sui
1.  Connect MetaMask (use "Add Anvil" button).
2.  Switch to **Eth ➡️ Sui**.
3.  Send tokens.
4.  Watch the Relayer terminal for `Detected BridgeBurn`.

### Bridge Sui -> Eth
1.  Refresh the page.
2.  Switch to **Sui ➡️ Eth**.
3.  Use the **Dropdown** to select your IBT coins (automatically found).
4.  Send tokens back.
