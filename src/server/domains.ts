"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { providers, domains, records } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createProvider } from "@/lib/providers";
import { decryptCredentials } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

export async function getDomains() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userDomains = await db
    .select({
      id: domains.id,
      name: domains.name,
      status: domains.status,
      syncedAt: domains.syncedAt,
      createdAt: domains.createdAt,
      providerId: domains.providerId,
      providerName: providers.name,
      providerLabel: providers.label,
    })
    .from(domains)
    .innerJoin(providers, eq(domains.providerId, providers.id))
    .where(eq(providers.userId, session.user.id))
    .orderBy(domains.name);

  return userDomains;
}

export async function getDomainWithRecords(domainId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Get domain with provider info
  const [domain] = await db
    .select({
      id: domains.id,
      name: domains.name,
      status: domains.status,
      remoteId: domains.remoteId,
      syncedAt: domains.syncedAt,
      providerId: domains.providerId,
      providerName: providers.name,
      providerLabel: providers.label,
      providerCredentials: providers.credentials,
    })
    .from(domains)
    .innerJoin(providers, eq(domains.providerId, providers.id))
    .where(
      and(eq(domains.id, domainId), eq(providers.userId, session.user.id))
    );

  if (!domain) {
    return null;
  }

  // Get records from database
  const domainRecords = await db
    .select()
    .from(records)
    .where(eq(records.domainId, domainId))
    .orderBy(records.type, records.name);

  return {
    ...domain,
    providerCredentials: undefined, // Don't expose
    records: domainRecords,
  };
}

export async function syncDomainRecords(domainId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Get domain with provider
  const [domain] = await db
    .select({
      id: domains.id,
      remoteId: domains.remoteId,
      providerId: domains.providerId,
      providerName: providers.name,
      providerCredentials: providers.credentials,
    })
    .from(domains)
    .innerJoin(providers, eq(domains.providerId, providers.id))
    .where(
      and(eq(domains.id, domainId), eq(providers.userId, session.user.id))
    );

  if (!domain) {
    return { success: false, error: "Domain not found" };
  }

  try {
    const credentials = decryptCredentials(domain.providerCredentials);
    const provider = createProvider(domain.providerName, credentials);

    // Fetch records from provider
    const remoteRecords = await provider.listRecords(domain.remoteId);

    // Delete existing records for this domain
    await db.delete(records).where(eq(records.domainId, domainId));

    // Insert new records
    for (const record of remoteRecords) {
      await db.insert(records).values({
        id: nanoid(),
        domainId,
        remoteId: record.id,
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl,
        priority: record.priority ?? null,
        proxied: record.proxied ?? false,
        extra: record.extra ? JSON.stringify(record.extra) : null,
        syncedAt: new Date(),
      });
    }

    // Update domain sync time
    await db
      .update(domains)
      .set({
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(domains.id, domainId));

    revalidatePath(`/domains/${domainId}`);
    revalidatePath("/domains");
    return { success: true, recordsCount: remoteRecords.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}
