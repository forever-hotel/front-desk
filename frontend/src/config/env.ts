import { z } from "zod";

const publicUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => {
      if (value.startsWith("/")) {
        return true;
      }

      try {
        const url = new URL(value);

        return ["http:", "https:", "ws:", "wss:"].includes(url.protocol);
      } catch {
        return false;
      }
    },
    {
      message: "Must be a relative path or a valid HTTP/WS URL.",
    },
  );

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z
    .string()
    .trim()
    .min(1)
    .default("Forever Hotel Front Desk"),

  /*
   * Target architecture:
   * Frontend -> API Gateway -> FDS backend
   *
   * The shared gateway currently exposes the FDS route under /fds.
   * A local .env.local may temporarily override this while the
   * gateway/backend rewrite mismatch is resolved.
   */
  NEXT_PUBLIC_API_BASE_URL: publicUrlSchema.default("/fds"),

  /*
   * Kept separately from the REST base URL because the current
   * shared API Gateway does not yet proxy WebSocket upgrades.
   */
  NEXT_PUBLIC_WS_URL: publicUrlSchema.default("/"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(
  values: Partial<Record<keyof PublicEnv, string | undefined>>,
): PublicEnv {
  return publicEnvSchema.parse(values);
}

export const env = parsePublicEnv({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
});
