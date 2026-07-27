import { query } from "@/lib/db";
import { TestRowDto } from "./test.dto";

export function findTestRows() {
  return query<TestRowDto>("SELECT tno FROM test ORDER BY tno ASC");
}
