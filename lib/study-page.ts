export type StudyRow = { seq: number; event: string; candidates: number };

// Count one lookahead row, but fetch bodies only for the current page.
// Large imported images have their own byte budget.
export function studyPageQuery(db: D1Database, owner: string, cursor: number) {
  return db
    .prepare(
      `WITH page AS (
    SELECT seq, length(CAST(event AS BLOB)) AS bytes FROM study_events
    WHERE owner=? AND seq>? ORDER BY seq LIMIT 129
  ), sizes AS (
    SELECT seq, count(*) OVER () AS candidates,
      sum(bytes) OVER (ORDER BY seq)-bytes AS prior FROM page
  ) SELECT s.seq, s.event, sizes.candidates FROM sizes
    JOIN study_events s ON s.seq=sizes.seq
    WHERE prior < 1500000 ORDER BY s.seq LIMIT 128`,
    )
    .bind(owner, cursor);
}
export function studyPage(rows: StudyRow[], cursor: number) {
  return {
    events: rows.map((row) => JSON.parse(row.event)),
    cursor: rows.at(-1)?.seq ?? cursor,
    more: (rows[0]?.candidates ?? 0) > rows.length,
  };
}
