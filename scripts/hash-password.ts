#!/usr/bin/env tsx

import { hashPassword } from "../src/lib/crypto";
import * as readline from "readline";

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Prompt for password
  const password = await new Promise<string>((resolve) => {
    rl.question("Enter password to hash: ", (answer) => {
      resolve(answer);
    });
  });

  rl.close();

  if (!password) {
    console.error("Error: Password cannot be empty");
    process.exit(1);
  }

  try {
    console.log("\nHashing password...\n");
    const hash = await hashPassword(password);
    console.log("Hashed password:");
    console.log(hash);
  } catch (error) {
    console.error("Failed to hash password:", error);
    process.exit(1);
  }
}

main();
