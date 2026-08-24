type ValidateResult =
  | {
      ok: true;
      data: {
        teamIds: number[];
        preferredName: string | null;
        pronouns: string | null;
        gradYear: number | null;
        major: string | null;
      };
    }
  | { ok: false; error: string };

// Free-text fields go straight into the officer review queue, so they get a
// ceiling rather than being an unbounded dumping ground.
const MAX_TEXT = 100;

const GRAD_YEAR_SLACK = 10;

// Takes FormData rather than a plain object because the team checkboxes are a
// repeated field and only getAll can read them.
export function validateOnboardingInput(formData: FormData): ValidateResult {
  const rawTeams = formData.getAll("teams");
  const teamIds: number[] = [];
  for (const raw of rawTeams) {
    const id = Number(raw);
    if (!Number.isInteger(id)) {
      return { ok: false, error: "Invalid team selection." };
    }
    if (!teamIds.includes(id)) teamIds.push(id);
  }

  const text = (key: string): string | null | { error: string } => {
    const raw = formData.get(key);
    if (raw === null) return null;
    const trimmed = String(raw).trim();
    if (trimmed === "") return null;
    if (trimmed.length > MAX_TEXT) {
      return {
        error: `That ${key === "preferredName" ? "name" : key} is too long (max ${MAX_TEXT} characters).`,
      };
    }
    return trimmed;
  };

  const fields: Record<string, string | null> = {};
  for (const key of ["preferredName", "pronouns", "major"]) {
    const value = text(key);
    if (value !== null && typeof value === "object") {
      return { ok: false, error: value.error };
    }
    fields[key] = value;
  }

  let gradYear: number | null = null;
  const rawGradYear = formData.get("gradYear");
  if (rawGradYear !== null && String(rawGradYear).trim() !== "") {
    gradYear = Number(rawGradYear);
    const thisYear = new Date().getFullYear();
    if (
      !Number.isInteger(gradYear) ||
      gradYear < thisYear - GRAD_YEAR_SLACK ||
      gradYear > thisYear + GRAD_YEAR_SLACK
    ) {
      return { ok: false, error: "Enter a graduation year close to this one." };
    }
  }

  return {
    ok: true,
    data: {
      teamIds,
      preferredName: fields.preferredName,
      pronouns: fields.pronouns,
      gradYear,
      major: fields.major,
    },
  };
}
