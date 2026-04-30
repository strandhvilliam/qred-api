import * as path from "node:path"
import { config } from "dotenv"

/** Directory containing `cdk.json` (works when running from `lib/` or compiled `dist/lib/`). */
function infraPackageDir(): string {
  const here = __dirname
  const parent = path.dirname(here)
  return path.basename(parent) === "dist" ? path.dirname(parent) : parent
}

const infraDir = infraPackageDir()
const repoRoot = path.join(infraDir, "..")

// Infra-specific overrides first (e.g. CDK account/region); repo root `.env` fills JWT / DSQL used by the app.
config({ path: path.join(infraDir, ".env") })
config({ path: path.join(repoRoot, ".env") })
