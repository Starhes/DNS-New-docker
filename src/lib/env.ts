/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 */

interface EnvConfig {
  name: string;
  required: boolean;
  description: string;
}

const ENV_CONFIGS: EnvConfig[] = [
  {
    name: "AUTH_SECRET",
    required: true,
    description: "NextAuth.js secret for session encryption",
  },
  {
    name: "CREDENTIALS_ENCRYPTION_KEY",
    required: true,
    description: "AES-256 encryption key for provider credentials",
  },
  {
    name: "DATABASE_URL",
    required: false, // Has default value
    description: "SQLite database file path",
  },
  {
    name: "GITHUB_CLIENT_ID",
    required: false, // OAuth is optional
    description: "GitHub OAuth client ID",
  },
  {
    name: "GITHUB_CLIENT_SECRET",
    required: false, // OAuth is optional
    description: "GitHub OAuth client secret",
  },
];

/**
 * Validate all required environment variables
 * Call this at application startup
 */
export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const config of ENV_CONFIGS) {
    const value = process.env[config.name];

    if (config.required && !value) {
      missing.push(`${config.name}: ${config.description}`);
    }

    // Check for placeholder values that should be changed
    if (value && isPlaceholderValue(value)) {
      warnings.push(
        `${config.name} appears to be a placeholder value. Please set a proper value.`
      );
    }
  }

  // Check GitHub OAuth pair
  const hasGitHubId = !!process.env.GITHUB_CLIENT_ID;
  const hasGitHubSecret = !!process.env.GITHUB_CLIENT_SECRET;
  if (hasGitHubId !== hasGitHubSecret) {
    warnings.push(
      "GitHub OAuth: Both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set together"
    );
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn("\n⚠️  Environment Configuration Warnings:");
    warnings.forEach((w) => console.warn(`   - ${w}`));
  }

  // Throw error for missing required variables
  if (missing.length > 0) {
    const message = [
      "\n❌ Missing required environment variables:",
      ...missing.map((m) => `   - ${m}`),
      "\nPlease check your .env file and ensure all required variables are set.",
      "See .env.example for reference.\n",
    ].join("\n");

    throw new Error(message);
  }
}

/**
 * Check if a value looks like a placeholder
 */
function isPlaceholderValue(value: string): boolean {
  const placeholderPatterns = [
    /^your[-_]?/i,
    /^change[-_]?me/i,
    /^replace[-_]?/i,
    /^xxx+$/i,
    /^placeholder/i,
    /^example/i,
    /^todo/i,
  ];

  return placeholderPatterns.some((pattern) => pattern.test(value));
}

/**
 * Get environment variable with type safety
 */
export function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value || defaultValue || "";
}

/**
 * Get optional environment variable
 */
export function getEnvOptional(name: string): string | undefined {
  return process.env[name];
}
