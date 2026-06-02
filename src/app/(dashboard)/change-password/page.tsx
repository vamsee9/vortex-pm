/**
 * (dashboard)/change-password/page.tsx
 * ------------------------------------
 * Forced password change page — ESS compliance requirement.
 *
 * When the admin creates a new user, they get a temporary password.
 * On first login, the user lands here and MUST set a strong password
 * before they can access any other part of the dashboard.
 *
 * Password requirements:
 * - Minimum 12 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character (!@#$%^&*...)
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { ShieldCheck, Loader2, AlertCircle, Check, X } from "lucide-react";

// Password validation rules — each one the user needs to satisfy
const PASSWORD_RULES = [
  { label: "At least 12 characters", test: (pw: string) => pw.length >= 12 },
  { label: "One uppercase letter (A-Z)", test: (pw: string) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter (a-z)", test: (pw: string) => /[a-z]/.test(pw) },
  { label: "One number (0-9)", test: (pw: string) => /[0-9]/.test(pw) },
  {
    label: "One special character (!@#$%^&*...)",
    test: (pw: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
  },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check which rules pass
  const ruleResults = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(newPassword),
  }));
  const allRulesPassed = ruleResults.every((r) => r.passed);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate before submitting
    if (!allRulesPassed) {
      setError("Please meet all password requirements listed below.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          must_change_password: false, // Remove the forced change flag
        },
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Password changed successfully — redirect to dashboard
      router.push("/board");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md bg-neutral-900/80 border-neutral-800">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-xl text-neutral-100">
              Set Your Password
            </CardTitle>
            <CardDescription className="text-neutral-400 mt-1">
              For security, you must create a strong password before continuing.
              This is a one-time setup.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-neutral-300">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Create a strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
              />
            </div>

            {/* Password strength checklist */}
            <div className="space-y-1.5 p-3 bg-neutral-800/50 rounded-lg">
              <p className="text-xs font-medium text-neutral-400 mb-2">
                Password must have:
              </p>
              {ruleResults.map((rule, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  {rule.passed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-neutral-500" />
                  )}
                  <span
                    className={
                      rule.passed ? "text-emerald-400" : "text-neutral-500"
                    }
                  >
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-neutral-300">
                Confirm Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Type it again to confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-400">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-emerald-400">✓ Passwords match</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading || !allRulesPassed || !passwordsMatch}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Set Password & Continue"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
