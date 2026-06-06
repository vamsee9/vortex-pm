/**
 * login/page.tsx
 * --------------
 * Login page for the Jira Sprint Metrics Dashboard.
 * No signup option — users are created by the admin only.
 * After login, checks if password change is required (ESS compliance).
 *
 * Clean, Supabase-inspired design with dark theme.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { lookupEmailByUsername } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const input = username.trim();
      let emailToUse = input;

      // If it doesn't look like an email, try looking up the dummy email
      if (!input.includes("@")) {
        const foundEmail = await lookupEmailByUsername(input);
        if (foundEmail) {
          emailToUse = foundEmail;
        } else {
          // If not found, we still proceed to fail auth generically
          emailToUse = `${input}@unknown.vortex`;
        }
      }

      const supabase = createClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      // Check if the user needs to change their password (first login)
      const mustChangePassword =
        data.user?.user_metadata?.must_change_password === true;

      if (mustChangePassword) {
        // Redirect to the forced password change page
        router.push("/change-password");
      } else {
        // Normal login — go to the dashboard
        router.push("/board");
      }

      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <Card 
        className={`w-full max-w-md relative z-10 bg-neutral-900/80 border-neutral-800 backdrop-blur-sm transition-all duration-300 ${
          loading ? "opacity-70 scale-[0.99] pointer-events-none" : "opacity-100"
        }`}
      >
        <CardHeader className="text-center space-y-4">
          {/* Logo area */}
          <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
              Vortex
            </h1>
            <p className="text-sm text-emerald-400 font-medium tracking-wide uppercase">
              Plan. Track. Deliver.
            </p>
            <p className="text-sm text-neutral-400 mt-2">
              Sign in to manage your sprints and metrics
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Username field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-neutral-300">
                Username or Email
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Footer note */}
          <p className="text-center text-neutral-500 text-xs mt-6">
            Don&apos;t have an account? Contact your project admin.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
