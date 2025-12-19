import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { providers, domains, records } from "@/lib/db/schema";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Globe, RefreshCw, ExternalLink, Server } from "lucide-react";
import Link from "next/link";
import { getDomains } from "@/server/domains";
import { syncProvider } from "@/server/providers";

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <Badge variant="default" className="bg-green-600">
          Active
        </Badge>
      );
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function DomainsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const userDomains = await getDomains();

  // Group domains by provider
  const domainsByProvider = userDomains.reduce(
    (acc, domain) => {
      const key = domain.providerId;
      if (!acc[key]) {
        acc[key] = {
          providerId: domain.providerId,
          providerName: domain.providerName,
          providerLabel: domain.providerLabel,
          domains: [],
        };
      }
      acc[key].domains.push(domain);
      return acc;
    },
    {} as Record<
      string,
      {
        providerId: string;
        providerName: string;
        providerLabel: string;
        domains: typeof userDomains;
      }
    >
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Domains</h1>
          <p className="text-muted-foreground">
            Manage DNS records for your domains
          </p>
        </div>
      </div>

      {/* Content */}
      {userDomains.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No domains yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add a DNS provider and sync your domains to get started.
            </p>
            <Button asChild>
              <Link href="/providers">
                <Server className="mr-2 h-4 w-4" />
                Manage Providers
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.values(domainsByProvider).map((group) => (
            <Card key={group.providerId}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {group.providerLabel}
                  </CardTitle>
                  <CardDescription className="capitalize">
                    {group.providerName} • {group.domains.length} domains
                  </CardDescription>
                </div>
                <form action={async () => { await syncProvider(group.providerId); }}>
                  <Button type="submit" variant="outline" size="sm">
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Sync All
                  </Button>
                </form>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Synced</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.domains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{domain.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(domain.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {domain.syncedAt
                            ? new Date(domain.syncedAt).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/domains/${domain.id}`}>
                              Manage
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
