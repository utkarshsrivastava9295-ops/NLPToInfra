import archiver from "archiver";
import type { Response } from "express";
import { z } from "zod";
import { buildStructuredBundle } from "./bundleLayout.js";

const FileEntrySchema = z.object({
  path: z.string().min(1).max(512),
  content: z.string().max(500_000),
});

const ZipBodySchema = z
  .object({
    /** Legacy: single flat list (still supported). */
    files: z.array(FileEntrySchema).optional(),
    terraform_files: z.array(FileEntrySchema).optional(),
    supplemental_files: z.array(FileEntrySchema).optional(),
    /** `structured` (default): terraform/, docker/, SETUP.md, etc. `flat`: use `files` as-is. */
    layout: z.enum(["flat", "structured"]).default("structured"),
  })
  .refine(
    (d) =>
      (d.files?.length ?? 0) +
        (d.terraform_files?.length ?? 0) +
        (d.supplemental_files?.length ?? 0) >
      0,
    { message: "No files to zip" },
  );

export type ParsedZipPayload = { files: { path: string; content: string }[] };

export type ZipParseResult =
  | { success: true; data: ParsedZipPayload }
  | { success: false; error: z.ZodError };

export function parseZipBody(body: unknown): ZipParseResult {
  const parsed = ZipBodySchema.safeParse(body);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }
  const d = parsed.data;

  let files: { path: string; content: string }[];

  if (d.layout === "flat") {
    files = d.files ?? [];
    if (files.length === 0) {
      const merged = [
        ...(d.terraform_files ?? []),
        ...(d.supplemental_files ?? []),
      ];
      files = merged;
    }
  } else {
    const hasSplit =
      (d.terraform_files?.length ?? 0) > 0 ||
      (d.supplemental_files?.length ?? 0) > 0;

    if (hasSplit) {
      files = buildStructuredBundle(
        d.terraform_files ?? [],
        d.supplemental_files ?? [],
      );
    } else if (d.files?.length) {
      const tf: { path: string; content: string }[] = [];
      const sup: { path: string; content: string }[] = [];
      for (const f of d.files) {
        const p = f.path.toLowerCase();
        if (p.endsWith(".tf") || p.includes("tfvars") || p.endsWith(".hcl")) {
          tf.push(f);
        } else {
          sup.push(f);
        }
      }
      files = buildStructuredBundle(tf, sup);
    } else {
      files = [];
    }
  }

  return { success: true, data: { files } };
}

export async function streamTerraformZip(
  res: Response,
  files: { path: string; content: string }[],
): Promise<void> {
  const archive = archiver("zip", { zlib: { level: 9 } });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="nlp-to-infra-bundle.zip"',
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
