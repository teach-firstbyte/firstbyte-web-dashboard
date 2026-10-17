import { RowList, Section } from "@/components/common/Section";
import { MeetingRow } from "@/components/meetings/MeetingRow";
import { SourceChips } from "@/components/newsletter/StatusBadges";
import { withBasePath } from "@/lib/paths";
import { samplePhotoOptions } from "@/lib/newsletter/photos";
import type { TeamUpdateView, UpcomingEvent } from "@/types/newsletter";

/**
 * An issue as members read it on the dashboard: the same content as the
 * email, plus where each line came from.
 */
export function IssueBody({
  upcoming,
  updates,
  note,
}: {
  upcoming: UpcomingEvent[];
  updates: TeamUpdateView[];
  note: string | null;
}) {
  const photos = new Map(samplePhotoOptions().map((p) => [p.key, p]));
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Section title="What the teams are up to">
        {note && <p className="text-sm">{note}</p>}
        {updates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No team updates in this issue.
          </p>
        ) : (
          <RowList>
            {updates.map((u) => {
              const photo = u.photo ? photos.get(u.photo) : undefined;
              return (
                <li key={u.id} className="flex flex-col gap-2 py-3">
                  <p className="font-semibold">{u.teamName}</p>
                  <ul className="flex flex-col gap-2">
                    {u.lines.map((l, i) => (
                      <li key={i} className="flex flex-col gap-1">
                        <span className="text-[15px]">{l.text}</span>
                        <SourceChips sources={l.sources} />
                      </li>
                    ))}
                  </ul>
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element -- next/image is unoptimized in this app anyway (see next.config.ts)
                    <img
                      src={withBasePath(photo.src)}
                      alt={photo.label}
                      className="mt-1 aspect-[4/3] w-full max-w-md rounded-xl object-cover"
                    />
                  )}
                </li>
              );
            })}
          </RowList>
        )}
      </Section>

      <Section title="Coming up">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing on the calendar for the next two weeks yet.
          </p>
        ) : (
          <RowList>
            {upcoming.map((e) => (
              <li key={e.id}>
                <MeetingRow
                  meeting={{ ...e, team: null }}
                  phase="upcoming"
                  showAudience={false}
                />
              </li>
            ))}
          </RowList>
        )}
      </Section>
    </div>
  );
}
