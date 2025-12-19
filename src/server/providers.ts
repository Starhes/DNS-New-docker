"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { providers, domains, records } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createProvider, getAvailableProviders } from "@/lib/providers";
import { encryptCredentials, decryptCredentials } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

export async function getProviders() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userProviders = await db
    .select()
    .from(providers)
    .where(eq(providers.userId, session.user.id));

  return userProviders.map((p) => ({
    ...p,
    credentials: undefined, // Don't expose credentials
  }));
}

export async function getAvailableProviderTypes() {
  return getAvailableProviders();
}

export async function addProvider(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const providerName = formData.get("provider") as string;
  const label = formData.get("label") as string;

  // Collect credentials based on provider type
  const availableProviders = getAvailableProviders();
  const providerMeta = availableProviders.find((p) => p.name === providerName);

  if (!providerMeta) {
    return { success: false, error: "Invalid provider type" };
  }

  const credentials: Record<string, string> = {};
  for (const field of providerMeta.credentialFields) {
    const value = formData.get(field.name) as string;
    if (field.required && !value) {
      return { success: false, error: `${field.label} is required` };
    }
    if (value) {
      credentials[field.name] = value;
    }
  }

  // Validate credentials
  try {
    const provider = createProvider(providerName, credentials);
    const isValid = await provider.validateCredentials();
    if (!isValid) {
      return { success: false, error: "Invalid credentials" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }

  // Save provider
  const id = nanoid();
  await db.insert(providers).values({
    id,
    userId: session.user.id,
    name: providerName,
    label: label || providerMeta.displayName,
    credentials: encryptCredentials(credentials),
    status: "active",
  });

  revalidatePath("/providers");
  return { success: true, id };
}

export async function deleteProvider(providerId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Verify ownership
  const [provider] = await db
    .select()
    .from(providers)
    .where(
      and(eq(providers.id, providerId), eq(providers.userId, session.user.id))
    );

  if (!provider) {
    return { success: false, error: "Provider not found" };
  }

  // Delete provider (cascades to domains and records)
  await db.delete(providers).where(eq(providers.id, providerId));

  revalidatePath("/providers");
  revalidatePath("/domains");
  return { success: true };
}

export async function syncProvider(providerId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Get provider
  const [providerData] = await db
    .select()
    .from(providers)
    .where(
      and(eq(providers.id, providerId), eq(providers.userId, session.user.id))
    );

  if (!providerData) {
    return { success: false, error: "Provider not found" };
  }

  try {
    const credentials = decryptCredentials(providerData.credentials);
    const provider = createProvider(providerData.name, credentials);

    // Fetch domains from provider
    const remoteDomains = await provider.listDomains();

    // Sync domains
    for (const remoteDomain of remoteDomains) {
      // Check if domain already exists
      const [existingDomain] = await db
        .select()
        .from(domains)
        .where(
          and(
            eq(domains.providerId, providerId),
            eq(domains.remoteId, remoteDomain.id)
          )
        );

      if (existingDomain) {
        // Update existing domain
        await db
          .update(domains)
          .set({
            name: remoteDomain.name,
            status: remoteDomain.status,
            syncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(domains.id, existingDomain.id));
      } else {
        // Create new domain
        const domainId = nanoid();
        await db.insert(domains).values({
          id: domainId,
          providerId,
          name: remoteDomain.name,
          remoteId: remoteDomain.id,
          status: remoteDomain.status,
          syncedAt: new Date(),
        });
      }
    }

    // Update provider last sync time
    await db
      .update(providers)
      .set({
        lastSyncAt: new Date(),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(providers.id, providerId));

    revalidatePath("/providers");
    revalidatePath("/domains");
    return { success: true, domainsCount: remoteDomains.length };
  } catch (error) {
    // Update provider status to error
    await db
      .update(providers)
      .set({
        status: "error",
        updatedAt: new Date(),
      })
      .where(eq(providers.id, providerId));

    return {
      success: false,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}

// Install nanoid
// npm install nanoid
