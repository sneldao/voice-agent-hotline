import { ethers, network, run } from "hardhat";

async function main() {
  console.log("Deploying DelegationRegistry contract...");

  // Get the contract factory
  const DelegationRegistry = await ethers.getContractFactory("DelegationRegistry");
  
  // Deploy the contract
  const delegationRegistry = await DelegationRegistry.deploy();
  
  // Wait for deployment to complete
  await delegationRegistry.waitForDeployment();
  
  const address = await delegationRegistry.getAddress();
  
  console.log(`DelegationRegistry deployed to: ${address}`);
  console.log(`Network: ${network.name} (chainId: ${network.config.chainId})`);
  
  // Verify the contract on block explorer if not on hardhat network
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    // Wait for 6 block confirmations
    const deploymentTx = delegationRegistry.deploymentTransaction();
    if (deploymentTx) {
      await deploymentTx.wait(6);
    }
    
    console.log("Verifying contract on block explorer...");
    try {
      await run("verify:verify", {
        address: address,
        constructorArguments: [],
      });
      console.log("Contract verified successfully!");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("Contract is already verified.");
      } else {
        console.error("Verification failed:", error.message);
      }
    }
  }
  
  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log(`Network: ${network.name}`);
  console.log(`Contract Address: ${address}`);
  console.log(`\nAdd this to your .env.local file:`);
  console.log(`NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=${address}`);
  
  return address;
}

main()
  .then((address) => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });