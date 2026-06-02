# Jira Sprint Metrics Dashboard

An elite, lightweight Next.js (App Router) dashboard tailored for coordinate managers to track contract deliverables without needing direct client Jira access. Built with a robust translation layer utilizing Supabase PostgreSQL and Row-Level Security (RLS).

## 🚀 Features

- **Direct Data Translation Layer**: Securely ingests payloads from Jira webhooks and translates them into actionable metrics.
- **ESS-Compliant Authentication**: Built-in admin-only user creation with forced temporary password updates on first login.
- **Per-User Worksheet Security**: Enforced via Supabase Row-Level Security (RLS). Users can only interact with rows they explicitly own.
- **"Duplicate to My Sheet" Engine**: Clone rows from other users into your secure worksheet seamlessly.
- **Automated QBR Dashboards**: Beautiful, dynamic Recharts visualizations (Absorption & Velocity) aggregating across all sprints.
- **One-Click Excel Export**: Instantly download your current board view (respecting all active filters and sorts) to `.xlsx` format.
- **Dynamic Board**: Real-time filtering by Sprint, Work Type, Priority, Status, and Search keywords, powered by Shadcn/ui and Tailwind CSS.

## 🛠 Tech Stack

- **Framework**: Next.js (App Router, TypeScript)
- **Styling**: Tailwind CSS v4, Shadcn/ui (Lucide React Icons)
- **Database/Auth**: Supabase (PostgreSQL with native RLS)
- **Charts**: Recharts
- **Export**: `xlsx` library

## 📋 Prerequisites

- **Node.js**: v18.17+
- **Package Manager**: `pnpm` (recommended) or `npm`/`yarn`
- **Supabase Account**: You'll need a free Supabase project.

## ⚙️ Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd jira-metrics-dashboard-system
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Database Setup (Supabase):**
   - Go to your Supabase project dashboard -> SQL Editor.
   - Copy the contents of `supabase_migration.sql` from the root of this project.
   - Run the script. This creates the required tables (`jira_tasks_snapshot`, `task_comments`), configures native RLS, sets up indexes, and initializes an `admin` user.

4. **Environment Variables:**
   - Copy `.env.local` to a new file named `.env`.
   ```bash
   cp .env.local .env
   ```
   - Open `.env` and fill in your actual Supabase URL, Anon Key, Service Role Key, and your chosen Jira Webhook secret. 
   *(Note: `.env` is ignored by git to keep your secrets secure).*

5. **Start the Development Server:**
   ```bash
   pnpm dev
   ```
   - Access the dashboard at `http://localhost:3000`.

## 🛡 Security & Authentication Workflow

- **Admin Account**: During the SQL migration, an initial admin user is created (`admin@company.com` / `TempPass123!`). Use this to log in first, and you will be forced to change the password.
- **Adding Team Members**: Go to the "Team Management" section (admin only). Create a user. A secure, random temporary password will be shown *once*. Share this securely with the team member.
- **First Login (ESS Compliance)**: When the new team member logs in, they are forcibly redirected to the `/change-password` page and must set a strong password (12+ chars, uppercase, lowercase, number, special char) before they can access the board.

## 🔗 Jira Webhook Configuration

Configure your client's Jira instance to send webhooks to your production URL:
- **URL**: `https://<your-domain>/api/webhooks/jira`
- **Headers**: Add a custom header `x-webhook-secret` matching your `JIRA_WEBHOOK_SECRET` in `.env`.
- **Events**: Subscribe to Issue Updated (`jira:issue_updated`) and Sprint Closed (`sprint_closed`).

## 🧱 Project Architecture

The architecture uses a strict "Per-User Worksheet" pattern:
1. Webhooks hit `/api/webhooks/jira` using the Service Role Key (bypassing RLS) and upsert data globally.
2. Users log in, and their `user.id` dictates what rows they can edit or delete on `/board`.
3. If a user wants to track a task they don't own, they click **"Duplicate to My Sheet"**. This clones the row, assigns it to them, and resets the tracking metrics so they can maintain an independent view without altering global or other users' data.

## 🤝 Contribution

This project follows strict TypeScript typing and modular component design (Shadcn/ui). 
- All Database models are synchronized with TypeScript interfaces in `src/lib/types.ts`.
- Server Actions (`src/lib/actions/*`) are solely responsible for database mutations.
- Pure metric computation logic lives in `src/lib/metrics.ts` to ensure it is stateless and testable.
