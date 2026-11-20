import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PageQuery {
  /** Page size, 1 to 100. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  /** Pass `nextCursor` from the previous page. */
  @IsOptional()
  @IsString()
  cursor?: string;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

/** Fetch limit + 1 rows ordered by (createdAt desc, id desc); the extra row tells us there is a next page. */
export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

export function cursorArgs(query: PageQuery) {
  const limit = query.limit ?? 25;
  return {
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  };
}
