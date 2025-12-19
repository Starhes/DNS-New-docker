"use server";

import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { headers } from "next/headers";
import {
  checkRateLimit,
  resetRateLimit,
  getClientIdentifier,
  RATE_LIMIT_CONFIGS,
} from "@/lib/rate-limit";

// Registration result type
export type RegisterResult = {
  success: boolean;
  error?: string;
};

// Login result type
export type LoginResult = {
  success: boolean;
  error?: string;
};

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

/**
 * Register a new user with credentials
 */
export async function handleRegister(formData: FormData): Promise<RegisterResult> {
  // Rate limiting
  const headersList = await headers();
  const clientIp = getClientIdentifier(headersList);
  const rateLimit = checkRateLimit("register", clientIp, RATE_LIMIT_CONFIGS.register);

  if (!rateLimit.success) {
    const retryMinutes = Math.ceil((rateLimit.retryAfterMs || 0) / 60000);
    return {
      success: false,
      error: `Too many registration attempts. Please try again in ${retryMinutes} minutes.`,
    };
  }

  const email = formData.get("email") as string;
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validate required fields
  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Invalid email format" };
  }

  // Validate password strength
  // Require: 8+ chars, at least 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&_\-#^()]{8,}$/;
  if (!passwordRegex.test(password)) {
    return {
      success: false,
      error: "Password must be at least 8 characters with uppercase, lowercase, and number",
    };
  }

  // Validate password confirmation
  if (password !== confirmPassword) {
    return { success: false, error: "Passwords do not match" };
  }

  // Validate username if provided
  if (username) {
    if (username.length < 3) {
      return { success: false, error: "Username must be at least 3 characters" };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return { success: false, error: "Username can only contain letters, numbers, underscores, and hyphens" };
    }
  }

  try {
    // Check if email already exists
    const existingEmail = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existingEmail) {
      return { success: false, error: "Email already registered" };
    }

    // Check if username already exists (if provided)
    if (username) {
      const existingUsername = await db.query.users.findFirst({
        where: eq(users.username, username),
      });
      if (existingUsername) {
        return { success: false, error: "Username already taken" };
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    await db.insert(users).values({
      email,
      username: username || null,
      password: hashedPassword,
      name: username || email.split("@")[0],
    });

    return { success: true };
  } catch (error) {
    // Log with error ID only - no sensitive details in production
    const errorId = crypto.randomUUID();
    console.error(`[Registration Error ${errorId}]`, process.env.NODE_ENV === "development" ? error : "");
    return { success: false, error: "An error occurred during registration" };
  }
}

/**
 * Handle credentials sign in
 */
export async function handleCredentialsSignIn(formData: FormData): Promise<LoginResult> {
  const identifier = formData.get("identifier") as string;
  const password = formData.get("password") as string;

  if (!identifier || !password) {
    return { success: false, error: "Email/username and password are required" };
  }

  // Rate limiting - use identifier (email/username) for more precise limiting
  const headersList = await headers();
  const clientIp = getClientIdentifier(headersList);
  const rateLimitKey = `${clientIp}:${identifier}`;
  const rateLimit = checkRateLimit("login", rateLimitKey, RATE_LIMIT_CONFIGS.login);

  if (!rateLimit.success) {
    const retryMinutes = Math.ceil((rateLimit.retryAfterMs || 0) / 60000);
    return {
      success: false,
      error: `Too many login attempts. Please try again in ${retryMinutes} minutes.`,
    };
  }

  try {
    await signIn("credentials", {
      identifier,
      password,
      redirectTo: "/",
    });
    // Reset rate limit on successful login
    resetRateLimit("login", rateLimitKey);
    return { success: true };
  } catch (error: unknown) {
    // NextAuth throws an error on failed login
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      // This is actually a successful redirect, reset rate limit and re-throw
      resetRateLimit("login", rateLimitKey);
      throw error;
    }
    return { success: false, error: "Invalid credentials" };
  }
}
