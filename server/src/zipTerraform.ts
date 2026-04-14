import archiver from "archiver";
import type { Response } from "express";
import { z } from "zod";

const BodySchema = z.object({
  files: z.array(
    z.object({
      path: z.string().min(1).max(512),
      content: z.string().max(500_000),
    }),
  ),
});

export function parseZipBody(body: unknown) {
  return BodySchema.safeParse(body);
}

export async function streamTerraformZip(
  res: Response,
  files: { path: string; content: string }[],
): Promise<void> {
  const archive = archiver("zip", { zlib: { level: 9 } });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="nlp-to-infra-terraform.zip"',
  );

  archive.on("error", (err: Error) => {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });

  archive.pipe(res);

  for (const f of files) {
    const safe = f.path.replace(/^\/+/, "").replace(/\.\./g, "");
    if (!safe) continue;
    archive.append(f.content, { name: safe });
  }

  await archive.finalize();
}
