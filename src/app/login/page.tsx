import { handleGitHubSignIn } from "@/server/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Github } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">DNS Manager</CardTitle>
          <CardDescription>
            Sign in to manage your DNS records across multiple providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleGitHubSignIn}>
            <Button type="submit" className="w-full" size="lg">
              <Github className="mr-2 h-5 w-5" />
              Sign in with GitHub
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
