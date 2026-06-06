/**
 * lib/utils/credentials.ts
 * -------------------------
 * Client-side utility for generating credential file content and downloading.
 * Separated from server actions because it's a pure function.
 */

/**
 * Generate credential file content for download.
 */
export function generateCredentialFileContent(
  username: string,
  email: string,
  password: string
): string {
  return [
    "═══════════════════════════════════════",
    "  Vortex PM — Temporary Credentials",
    "═══════════════════════════════════════",
    "",
    `  Username: ${username}`,
    `  Email:    ${email}`,
    `  Password: ${password}`,
    "",
    "  ⚠ You must change your password on",
    "    first login.",
    "",
    "═══════════════════════════════════════",
  ].join("\n");
}

/**
 * Trigger a browser download of credential content as a .txt file.
 */
export function downloadCredentialFile(
  username: string,
  email: string,
  password: string
) {
  const content = generateCredentialFileContent(username, email, password);
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${username}_credentials.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
