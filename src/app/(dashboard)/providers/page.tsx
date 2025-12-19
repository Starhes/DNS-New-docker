import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { providers, domains } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Trash2, Cloud, Server } from "lucide-react";
import Link from "next/link";
import { syncProvider, deleteProvider } from "@/server/providers";

async function getUserProviders(userId: string) {
  const userProviders = await db
    .select({
      id: providers.id,
      name: providers.name,
      label: providers.label,
      status: providers.status,
      lastSyncAt: providers.lastSyncAt,
      createdAt: providers.createdAt,
    })
    .from(providers)
    .where(eq(providers.userId, userId));

  // Get domain counts for each provider
  const providersWithCounts = await Promise.all(
    userProviders.map(async (provider) => {
      const [domainCount] = await db
        .select({ count: count() })
        .from(domains)
        .where(eq(domains.providerId, provider.id));

      return {
        ...provider,
        domainsCount: domainCount.count,
      };
    })
  );

  return providersWithCounts;
}

function getProviderIcon(name: string) {
  switch (name) {
    case "cloudflare":
      return <Cloud className="h-5 w-5 text-orange-500" />;
    case "alidns":
      return (
        <svg className="h-5 w-5 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.261 3.004c-.282-.006-.564.09-.79.29L3.5 10.39c-.49.43-.49 1.19 0 1.62l7.97 7.096c.45.4 1.13.4 1.58 0l7.97-7.096c.49-.43.49-1.19 0-1.62l-7.97-7.096 a1.07 1.07 0 0 0-.79-.29zm-.26 2.086 6.39 5.69-6.39 5.69-6.39-5.69 6.39-5.69z" />
        </svg>
      );
    case "dnspod":
      return (
        <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
      );
    default:
      return <Server className="h-5 w-5" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge variant="default">Active</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default async function ProvidersPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const userProviders = await getUserProviders(userId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">DNS Providers</h1>
          <p className="text-muted-foreground">
            Manage your connected DNS providers
          </p>
        </div>
        <Button asChild>
          <Link href="/providers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Link>
        </Button>
      </div>

      {/* Provider Cards */}
      {userProviders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No providers yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Connect your first DNS provider to start managing your domains.
            </p>
            <Button asChild>
              <Link href="/providers/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Provider
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {userProviders.map((provider) => (
            <Card key={provider.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  {getProviderIcon(provider.name)}
                  <CardTitle className="text-lg">{provider.label}</CardTitle>
                </div>
                {getStatusBadge(provider.status)}
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  <span className="capitalize">{provider.name}</span>
                  <span className="mx-2">•</span>
                  {provider.domainsCount} domains
                </CardDescription>

                <div className="text-xs text-muted-foreground mb-4">
                  {provider.lastSyncAt ? (
                    <>
                      Last synced:{" "}
                      {new Date(provider.lastSyncAt).toLocaleString()}
                    </>
                  ) : (
                    "Never synced"
                  )}
                </div>

                <div className="flex gap-2">
                  {/* 使用包装函数以符合 React 19 Action 类型要求 */}
                  <form action={async () => { "use server"; await syncProvider(provider.id); }}>
                    <Button type="submit" variant="outline" size="sm">
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Sync
                    </Button>
                  </form>

                  <form action={async () => { "use server"; await deleteProvider(provider.id); }}>
                    <Button type="submit" variant="destructive" size="sm">
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
