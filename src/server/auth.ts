"use server";

import { signIn, signOut } from "@/lib/auth";

/**
 * Handle GitHub OAuth sign in
 */
export async function handleGitHubSignIn() {
  await signIn("github", { redirectTo: "/" });
}

/**
 * Handle user sign out
 */
export async function handleSignOut() {
  await signOut({ redirectTo: "/login" });
}
