import YAML from 'yaml';
import z from 'zod';
import { CalInfo } from './inventory';

const chooseALicenseSchema = z.object({
  conditions: z.string().array(),
  limitations: z.string().array(),
  permissions: z.string().array(),
});

export type ChooseALicenseData = z.infer<typeof chooseALicenseSchema>;

function extractPreamble(text: string): string {
  const lines = text.split('\n'); // Split into lines
  const result: string[] = [];
  let insideBlock = false;

  for (const line of lines) {
    const trimmed = line.trim(); // Remove extra spaces

    if (trimmed === '---') {
      if (insideBlock) break; // Stop at the second `---`
      insideBlock = true; // Start capturing after first `---`
      continue;
    }

    if (insideBlock) {
      result.push(line); // Collect valid lines
    }
  }

  return result.join('\n').trim(); // Join and clean up
}

export const getCALData = async (spdxID: string): Promise<CalInfo | undefined> => {
  // TODO: add path customization

  const req = await fetch(
    `https://raw.githubusercontent.com/github/choosealicense.com/refs/heads/gh-pages/_licenses/${spdxID}.txt`,
  );
  const data = await req.text();
  const preamble = extractPreamble(data);

  const parsedPreamble = YAML.parse(preamble);

  const { data: calData, error } = chooseALicenseSchema.safeParse(parsedPreamble);
  if (error) {
    throw new Error("couldn't process data", { cause: error });
  }

  // TODO: define the keys and children we recognise, raise issues if new ones are added, automatically format test to object keys + booleans
  const processedData: CalInfo = {
    ...(calData.permissions.length > 0 && {
      permissions: {
        ...(calData.permissions.includes('commercial-use') && { commercialUse: true }),
        ...(calData.permissions.includes('modifications') && { modifications: true }),
        ...(calData.permissions.includes('distribution') && { distribution: true }),
        ...(calData.permissions.includes('private-use') && { privateUse: true }),
        ...(calData.permissions.includes('patent-use') && { patentUse: true }),
      },
    }),
    ...(calData.conditions.length > 0 && {
      conditions: {
        ...(calData.conditions.includes('include-copyright') && { includeCopyright: true }),
        ...(calData.conditions.includes('include-copyright--source') && {
          includeCopyrightSource: true,
        }),
        ...(calData.conditions.includes('document-changes') && { documentChanges: true }),
        ...(calData.conditions.includes('disclose-source') && { discloseSource: true }),
        ...(calData.conditions.includes('network-use-disclose') && { networkUseDisclose: true }),
        ...(calData.conditions.includes('same-license') && { sameLicense: true }),
        ...(calData.conditions.includes('same-license--file') && { sameLicenseFile: true }),
        ...(calData.conditions.includes('same-license--library') && { sameLicenseLibrary: true }),
      },
    }),
    ...(calData.limitations.length > 0 && {
      limitations: {
        ...(calData.limitations.includes('trademark-use') && { trademarkUse: true }),
        ...(calData.limitations.includes('liability') && { liability: true }),
        ...(calData.limitations.includes('patent-use') && { patentUse: true }),
        ...(calData.limitations.includes('warranty') && { warranty: true }),
      },
    }),
  };
  return Object.keys(processedData).length > 0 ? processedData : undefined;
};
