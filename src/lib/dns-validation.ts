/**
 * DNS Record Validation Utilities
 * Validates DNS record inputs before sending to providers
 */

// IPv4 address validation
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// IPv6 address validation (simplified)
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/;

// Hostname validation (for CNAME, MX, NS records)
const HOSTNAME_REGEX = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(?:\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*\.?$/;

// DNS record name validation (can include @ for root, * for wildcard)
const DNS_NAME_REGEX = /^(?:@|\*|(?:\*\.)?(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)$/;

// TXT record content - allow most printable ASCII
const TXT_CONTENT_REGEX = /^[\x20-\x7E]+$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate DNS record name
 */
export function validateRecordName(name: string): ValidationResult {
  if (!name || name.trim() === "") {
    return { valid: false, error: "Record name is required" };
  }

  const trimmedName = name.trim();

  if (trimmedName.length > 253) {
    return { valid: false, error: "Record name is too long (max 253 characters)" };
  }

  if (!DNS_NAME_REGEX.test(trimmedName) && trimmedName !== "@") {
    return { valid: false, error: "Invalid record name format" };
  }

  return { valid: true };
}

/**
 * Validate record content based on record type
 */
export function validateRecordContent(
  type: string,
  content: string
): ValidationResult {
  if (!content || content.trim() === "") {
    return { valid: false, error: "Record content is required" };
  }

  const trimmedContent = content.trim();

  switch (type.toUpperCase()) {
    case "A":
      if (!IPV4_REGEX.test(trimmedContent)) {
        return { valid: false, error: "Invalid IPv4 address format" };
      }
      break;

    case "AAAA":
      if (!IPV6_REGEX.test(trimmedContent)) {
        return { valid: false, error: "Invalid IPv6 address format" };
      }
      break;

    case "CNAME":
    case "NS":
      if (!HOSTNAME_REGEX.test(trimmedContent)) {
        return { valid: false, error: `Invalid hostname for ${type} record` };
      }
      break;

    case "MX":
      // MX content should be a hostname
      if (!HOSTNAME_REGEX.test(trimmedContent)) {
        return { valid: false, error: "Invalid mail server hostname" };
      }
      break;

    case "TXT":
      if (trimmedContent.length > 4096) {
        return { valid: false, error: "TXT record content is too long (max 4096 characters)" };
      }
      if (!TXT_CONTENT_REGEX.test(trimmedContent.replace(/"/g, ""))) {
        return { valid: false, error: "TXT record contains invalid characters" };
      }
      break;

    case "SRV":
      // SRV format: priority weight port target
      // Content should be: weight port target (priority is separate)
      const srvParts = trimmedContent.split(/\s+/);
      if (srvParts.length < 3) {
        return { valid: false, error: "SRV record format: weight port target" };
      }
      const [weight, port, target] = srvParts;
      if (isNaN(Number(weight)) || Number(weight) < 0 || Number(weight) > 65535) {
        return { valid: false, error: "Invalid SRV weight (0-65535)" };
      }
      if (isNaN(Number(port)) || Number(port) < 0 || Number(port) > 65535) {
        return { valid: false, error: "Invalid SRV port (0-65535)" };
      }
      if (!HOSTNAME_REGEX.test(target) && target !== ".") {
        return { valid: false, error: "Invalid SRV target hostname" };
      }
      break;

    case "CAA":
      // CAA format: flag tag value (e.g., "0 issue letsencrypt.org")
      const caaParts = trimmedContent.match(/^(\d+)\s+(issue|issuewild|iodef)\s+(.+)$/i);
      if (!caaParts) {
        return { valid: false, error: "Invalid CAA record format: flag tag value" };
      }
      break;

    default:
      // For unknown types, just ensure content is not empty and reasonable length
      if (trimmedContent.length > 4096) {
        return { valid: false, error: "Record content is too long" };
      }
  }

  return { valid: true };
}

/**
 * Validate TTL value
 */
export function validateTTL(ttl: number): ValidationResult {
  if (isNaN(ttl)) {
    return { valid: false, error: "TTL must be a number" };
  }

  if (ttl < 60) {
    return { valid: false, error: "TTL must be at least 60 seconds" };
  }

  if (ttl > 86400 * 7) {
    return { valid: false, error: "TTL cannot exceed 7 days (604800 seconds)" };
  }

  return { valid: true };
}

/**
 * Validate priority (for MX, SRV records)
 */
export function validatePriority(priority: number): ValidationResult {
  if (isNaN(priority)) {
    return { valid: false, error: "Priority must be a number" };
  }

  if (priority < 0 || priority > 65535) {
    return { valid: false, error: "Priority must be between 0 and 65535" };
  }

  return { valid: true };
}

/**
 * Validate a complete DNS record input
 */
export function validateDNSRecord(input: {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
}): ValidationResult {
  // Validate name
  const nameResult = validateRecordName(input.name);
  if (!nameResult.valid) {
    return nameResult;
  }

  // Validate content based on type
  const contentResult = validateRecordContent(input.type, input.content);
  if (!contentResult.valid) {
    return contentResult;
  }

  // Validate TTL if provided
  if (input.ttl !== undefined) {
    const ttlResult = validateTTL(input.ttl);
    if (!ttlResult.valid) {
      return ttlResult;
    }
  }

  // Validate priority for MX and SRV records
  if (["MX", "SRV"].includes(input.type.toUpperCase())) {
    if (input.priority === undefined) {
      return { valid: false, error: `Priority is required for ${input.type} records` };
    }
    const priorityResult = validatePriority(input.priority);
    if (!priorityResult.valid) {
      return priorityResult;
    }
  }

  return { valid: true };
}
