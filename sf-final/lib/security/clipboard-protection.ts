/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLIPBOARD ATTACK PROTECTION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Protects against clipboard-based attacks by:
 * 1. Intercepting paste events on sensitive form fields
 * 2. Sanitizing clipboard content before processing
 * 3. Validating data format and integrity
 * 4. Preventing malicious payloads (scripts, large data)
 * 5. Providing user feedback for clipboard operations
 * 
 * THREAT MODELS:
 * - Attacker copies malicious HTML/JavaScript and user pastes into form
 * - Attacker pastes extremely large payloads to cause DoS
 * - Attacker pastes content with special characters/formatting
 * - Malicious scripts disguised as normal data
 * 
 * Common attack scenarios:
 * - Clipboard contains HTML with embedded scripts
 * - Clipboard contains SQL injection payloads
 * - Clipboard contains huge strings to exhaust memory
 * - Clipboard contains control characters or null bytes
 * - Clipboard contains rich text formatting
 */

/**
 * Clipboard sanitization configuration
 */
export const CLIPBOARD_CONFIG = {
  // Maximum allowed clipboard content size (bytes)
  MAX_SIZE_BYTES: 50_000,

  // Timeout for clipboard read operations (ms)
  READ_TIMEOUT_MS: 5000,

  // Maximum number of paste events per second (for rate limiting)
  MAX_PASTES_PER_SECOND: 10,

  // Fields that require extra clipboard protection
  PROTECTED_FIELDS: [
    'password',
    'email',
    'creditCard',
    'apiKey',
    'secret',
    'token',
    'code',
  ],
} as const;

/**
 * Paste event tracking for rate limiting
 */
class ClipboardRateLimiter {
  private pasteTimestamps = new Map<string, number[]>();

  recordPaste(fieldId: string): boolean {
    const now = Date.now();
    const timestamps = this.pasteTimestamps.get(fieldId) ?? [];

    // Remove timestamps older than 1 second
    const recent = timestamps.filter(ts => now - ts < 1000);

    // Check if limit exceeded
    if (recent.length >= CLIPBOARD_CONFIG.MAX_PASTES_PER_SECOND) {
      return false;
    }

    recent.push(now);
    this.pasteTimestamps.set(fieldId, recent);
    return true;
  }
}

const rateLimiter = new ClipboardRateLimiter();

/**
 * Backend: Sanitize clipboard content after receipt
 * 
 * Should be called on the server when clipboard data is received from client.
 * This provides defense-in-depth sanitization.
 * 
 * @example
 * const sanitized = sanitizeClipboardContent(pastedText);
 * const cleaned = await sanitizeClipboardContent(pastedData);
 */
export async function sanitizeClipboardContent(
  data: string | null | undefined,
  options: { maxSize?: number } = {}
): Promise<{
  clean: string;
  valid: boolean;
  warnings: string[];
  originalSize: number;
  cleanSize: number;
}> {
  const { maxSize = CLIPBOARD_CONFIG.MAX_SIZE_BYTES } = options;
  const warnings: string[] = [];
  const original = data ?? '';
  const originalSize = new TextEncoder().encode(original).byteLength;

  // Check size
  if (originalSize > maxSize) {
    warnings.push(`Clipboard content exceeds maximum size (${originalSize} > ${maxSize} bytes)`);
    return {
      clean: '',
      valid: false,
      warnings,
      originalSize,
      cleanSize: 0,
    };
  }

  // Remove control characters (except newline, tab)
  let clean = original.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Remove null bytes
  clean = clean.replace(/\x00/g, '');

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /javascript:/i,           // JavaScript protocol
    /on\w+\s*=/i,             // Event handlers (onclick, onload, etc.)
    /<script/i,               // Script tags
    /<iframe/i,               // IFrame tags
    /<object/i,               // Object tags
    /<embed/i,                // Embed tags
    /<applet/i,               // Applet tags
    /(<|&lt;)img.*?src/i,     // Image tags with src
    /data:[^,]*,/,            // Data URLs
    /vbscript:/i,             // VBScript protocol
    /about:/i,                // about: protocol
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(clean)) {
      warnings.push(`Suspicious pattern detected: ${pattern.source}`);
      // Remove the suspicious content
      clean = clean.replace(pattern, '');
    }
  }

  // Remove HTML tags completely if clipboard is likely rich text
  if (/<[a-z][\s\S]*>/i.test(original)) {
    warnings.push('Clipboard contained HTML markup (removed)');
    // Strip all HTML tags
    clean = clean.replace(/<[^>]*>/g, '');
  }

  // Remove double encoding attempts
  if (/%[0-9A-Fa-f]{2}/.test(clean)) {
    warnings.push('Clipboard contained URL-encoded content');
  }

  const cleanSize = new TextEncoder().encode(clean).byteLength;

  // Validate result is reasonable
  const valid = clean.length > 0 && cleanSize <= maxSize;

  return {
    clean: clean.trim(),
    valid,
    warnings,
    originalSize,
    cleanSize,
  };
}

/**
 * FRONTEND: Hook for safe paste event handling
 * 
 * Use this in React components to intercept and sanitize paste events.
 * Returns a paste handler function.
 * 
 * @example
 * import { useClipboardPasteHandler } from '@/lib/security/clipboard-protection';
 * 
 * export function PasswordInput() {
 *   const handlePaste = useClipboardPasteHandler();
 *   return <input type="password" onPaste={handlePaste} />;
 * }
 */
export function createClipboardPasteHandler(options: {
  onPasteSuccessful?: (data: string) => void;
  onPasteFailed?: (reason: string) => void;
  maxSize?: number;
  allowMultiline?: boolean;
} = {}) {
  const {
    onPasteSuccessful,
    onPasteFailed,
    maxSize = CLIPBOARD_CONFIG.MAX_SIZE_BYTES,
    allowMultiline = false,
  } = options;

  return async (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();

    const fieldId = (event.currentTarget as HTMLInputElement).id || 'unknown';

    // Rate limit
    if (!rateLimiter.recordPaste(fieldId)) {
      const reason = 'Too many paste events (rate limited)';
      onPasteFailed?.(reason);
      console.warn(`[SECURITY] ${reason}`);
      return;
    }

    try {
      // Get clipboard data
      const clipboardData = event.clipboardData || (window as any).clipboardData;
      if (!clipboardData) {
        throw new Error('Clipboard access not available');
      }

      let content = clipboardData.getData('text/plain');

      // For sensitive fields, check HTML content too (might contain hidden scripts)
      const htmlContent = clipboardData.getData('text/html');
      if (htmlContent && htmlContent.length > 0) {
        console.warn('[SECURITY] Clipboard contained HTML content (using plain text instead)');
      }

      // Check size before processing
      const size = new TextEncoder().encode(content).byteLength;
      if (size > maxSize) {
        throw new Error(`Pasted content too large (${size} > ${maxSize} bytes)`);
      }

      // Basic sanitization (client-side)
      // Remove control characters
      content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

      // Optionally restrict to single line for certain fields
      if (!allowMultiline) {
        content = content.split('\n')[0].trim();
      } else {
        content = content.trim();
      }

      // Remove leading/trailing spaces
      content = content.trim();

      // Check for empty result
      if (content.length === 0) {
        throw new Error('Clipboard content was empty after sanitization');
      }

      // Insert sanitized content into field
      const input = event.currentTarget as HTMLInputElement;
      input.value = content;

      // Trigger change event for form library detection
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));

      onPasteSuccessful?.(content);
      console.log(`[INFO] Successfully pasted ${content.length} characters`);

    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error';
      onPasteFailed?.(reason);
      console.warn(`[SECURITY] Paste blocked: ${reason}`);
    }
  };
}

/**
 * FRONTEND: React Hook for clipboard security
 * 
 * Attaches safe paste handlers to form fields with optional visual feedback.
 * 
 * @example
 * export function SensitiveForm() {
 *   const setupClipboardSecurity = useClipboardSecurity();
 *   
 *   useEffect(() => {
 *     setupClipboardSecurity({
 *       passwordField: { allowMultiline: false },
 *       apiKeyField: { maxSize: 1000 },
 *     });
 *   }, [setupClipboardSecurity]);
 * 
 *   return (
 *     <>
 *       <input id="passwordField" type="password" />
 *       <input id="apiKeyField" type="text" />
 *     </>
 *   );
 * }
 */
export function useClipboardSecurity() {
  return (fieldConfigs: Record<string, { allowMultiline?: boolean; maxSize?: number }>) => {
    Object.entries(fieldConfigs).forEach(([fieldId, config]) => {
      const element = document.getElementById(fieldId);
      if (!element) return;

      const handler = createClipboardPasteHandler({
        maxSize: config.maxSize,
        allowMultiline: config.allowMultiline,
        onPasteFailed: (reason) => {
          // Show error toast/notification
          const event = new CustomEvent('clipboardSecurityError', {
            detail: { field: fieldId, reason },
          });
          window.dispatchEvent(event);
        },
        onPasteSuccessful: () => {
          // Optional: show success feedback
          const event = new CustomEvent('clipboardSecuritySuccess', {
            detail: { field: fieldId },
          });
          window.dispatchEvent(event);
        },
      });

      element.addEventListener('paste', handler as any);

      // Cleanup function
      return () => {
        element.removeEventListener('paste', handler as any);
      };
    });
  };
}

/**
 * VALIDATION: Verify clipboard content matches expected format
 * 
 * After sanitization, validate that content is in expected format
 * (email, URL, code snippet, etc.)
 * 
 * @example
 * const email = sanitized.clean;
 * if (!validateClipboardAsEmail(email)) {
 *   showError('Pasted content does not appear to be an email address');
 * }
 */
export function validateClipboardAsEmail(content: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.trim());
}

export function validateClipboardAsURL(content: string): boolean {
  try {
    new URL(content.trim());
    return true;
  } catch {
    return false;
  }
}

export function validateClipboardAsJSON(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

export function validateClipboardAsCode(content: string): boolean {
  // Allow alphanumeric, common code characters, whitespace
  return /^[a-zA-Z0-9\s\-_.,;:(){}[\]<>@#$%^&*=+/"'\\|`!?]+$/.test(content);
}

/**
 * FRONTEND COMPONENT: Example secure clipboard input
 * 
 * React component that demonstrates all clipboard security features:
 * - Paste interception and sanitization
 * - Size limits
 * - Rate limiting
 * - Visual feedback
 * - Error handling
 * 
 * Usage:
 * <SecureClipboardInput
 *   fieldName="apiKey"
 *   placeholder="Paste API key here"
 *   maxSize={1000}
 *   allowMultiline={false}
 *   onValueChange={(value) => console.log('New value:', value)}
 * />
 */
export const SecureClipboardInputComponent = `
'use client';

import React, { useState, useRef } from 'react';
import { createClipboardPasteHandler } from '@/lib/security/clipboard-protection';

interface SecureClipboardInputProps {
  fieldName: string;
  placeholder?: string;
  maxSize?: number;
  allowMultiline?: boolean;
  onValueChange?: (value: string) => void;
}

export function SecureClipboardInput({
  fieldName,
  placeholder = 'Paste content here',
  maxSize = 50000,
  allowMultiline = false,
  onValueChange,
}: SecureClipboardInputProps) {
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePaste = createClipboardPasteHandler({
    maxSize,
    allowMultiline,
    onPasteSuccessful: (data) => {
      setValue(data);
      onValueChange?.(data);
      setFeedback({ type: 'success', message: 'Clipboard content pasted securely' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onPasteFailed: (reason) => {
      setFeedback({ type: 'error', message: \`Paste blocked: \${reason}\` });
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          ref={inputRef}
          id={fieldName}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onValueChange?.(e.target.value);
          }}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {feedback && (
        <div className={\`text-sm \${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}\`}>
          {feedback.message}
        </div>
      )}
      
      <div className="text-xs text-gray-500">
        Paste (Ctrl+V or Cmd+V) to securely insert content from clipboard
      </div>
    </div>
  );
}
`;

/**
 * BACKEND: Example API route with clipboard content handling
 * 
 * Shows how to process clipboard content received from frontend.
 */
export const BackendClipboardHandlerExample = `
// app/api/clipboard-process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeClipboardContent } from '@/lib/security/clipboard-protection';

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();

    // Sanitize on backend (defense-in-depth)
    const result = await sanitizeClipboardContent(content);

    if (!result.valid) {
      return NextResponse.json(
        { error: 'Invalid clipboard content', warnings: result.warnings },
        { status: 400 }
      );
    }

    // Process the sanitized content
    // ... your business logic ...

    return NextResponse.json({
      success: true,
      processedSize: result.cleanSize,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('[SECURITY] Clipboard processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process clipboard content' },
      { status: 500 }
    );
  }
}
`;

export default {
  CLIPBOARD_CONFIG,
  sanitizeClipboardContent,
  createClipboardPasteHandler,
  useClipboardSecurity,
  validateClipboardAsEmail,
  validateClipboardAsURL,
  validateClipboardAsJSON,
  validateClipboardAsCode,
  SecureClipboardInputComponent,
  BackendClipboardHandlerExample,
};
