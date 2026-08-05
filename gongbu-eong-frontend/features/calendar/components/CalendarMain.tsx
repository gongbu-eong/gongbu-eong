"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getCalendarJobPostings,
  getCurrentUser,
} from "@/features/home/home.api";
import {
  CalendarIcon,
} from "@/features/home/components/HomeMain";
import type {
  CurrentUserDto,
  JobPostingDto,
} from "@/features/home/home.dto";
import { JobFooter, JobHeader } from "@/features/jobs/components/JobChrome";
import styles from "./CalendarMain.module.css";

type CalendarScope = "all" | "mine";
type CalendarMode = "list" | "month";
type StatusFilter = "all" | "open" | "closed";
type SortFilter = "latest" | "deadline";
type CalendarEventKind = "start" | "end";

type CalendarFilters = {
  status: StatusFilter;
  sort: SortFilter;
  region: string;
  employmentType: string;
};

type CalendarJobEvent = {
  id: string;
  kind: CalendarEventKind;
  dateKey: string;
  job: JobPostingDto;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const STANDARD_REGIONS = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
];
const EMPLOYMENT_TYPE_ORDER = [
  "정규직",
  "비정규직",
  "무기계약직",
  "청년인턴(체험형)",
  "청년인턴(채용형)",
];
const DEFAULT_FILTERS: CalendarFilters = {
  status: "all",
  sort: "latest",
  region: "all",
  employmentType: "all",
};

export function CalendarMain({
  initialScope = "all",
}: {
  initialScope?: CalendarScope;
}) {
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [scope, setScope] = useState<CalendarScope>(initialScope);
  const [mode, setMode] = useState<CalendarMode>("list");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
    startOfWeek(new Date()),
  );
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS);
  const [jobs, setJobs] = useState<JobPostingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const bounds = useMemo(() => {
    const current = startOfMonth(new Date());
    const max = addMonths(current, 12);
    const min = addMonths(current, -12);
    return { min, max };
  }, []);
  const range = useMemo(() => getMonthRange(month), [month]);

  useEffect(() => {
    let ignore = false;
    getCurrentUser()
      .then((response) => {
        if (!ignore) setUser(response.authenticated ? response.user : null);
      })
      .catch(() => {
        if (!ignore) setUser(null);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (!ignore) setIsLoading(true);
    });
    getCalendarJobPostings({
      startDate: range.startDate,
      endDate: range.endDate,
      view: scope === "mine" ? "bookmarked" : "all",
    })
      .then((response) => {
        if (!ignore) setJobs(response.items);
      })
      .catch(() => {
        if (!ignore) setJobs([]);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [range.endDate, range.startDate, scope]);

  const jobEvents = useMemo(() => buildJobEvents(jobs), [jobs]);
  const monthEvents = useMemo(() => groupEventsByDate(jobEvents), [jobEvents]);
  const monthDays = useMemo(
    () => buildMonthDays(month, monthEvents),
    [month, monthEvents],
  );
  const selectedDateKey = toDateKey(selectedDate);
  const selectedDateEvents = useMemo(
    () => monthEvents[selectedDateKey] || [],
    [monthEvents, selectedDateKey],
  );
  const selectedDateFilteredEvents = useMemo(
    () => applyEventFilters(selectedDateEvents, filters),
    [filters, selectedDateEvents],
  );
  const selectedWeekDays = useMemo(
    () => buildWeekDays(selectedWeekStart),
    [selectedWeekStart],
  );
  const selectedWeekEvents = useMemo(() => {
    const start = stripTime(selectedWeekStart).getTime();
    const end = addDays(selectedWeekStart, 6).getTime();
    return jobEvents.filter((event) => {
      const time = stripTime(new Date(event.dateKey)).getTime();
      return time >= start && time <= end;
    });
  }, [jobEvents, selectedWeekStart]);
  const selectedWeekFilteredEvents = useMemo(
    () => applyEventFilters(selectedWeekEvents, filters),
    [filters, selectedWeekEvents],
  );
  const selectedWeekJobSections = useMemo(
    () => groupEventsByWeekDays(selectedWeekDays, selectedWeekFilteredEvents),
    [selectedWeekDays, selectedWeekFilteredEvents],
  );
  const filterOptions = useMemo(
    () => ({
      regions: getAvailableRegions(jobs),
      employmentTypes: getAvailableEmploymentTypes(jobs),
    }),
    [jobs],
  );

  const canPrevMonth = month.getTime() > bounds.min.getTime();
  const canNextMonth = month.getTime() < bounds.max.getTime();
  const canPrevWeek =
    startOfMonth(selectedWeekStart).getTime() > bounds.min.getTime();
  const canNextWeek =
    startOfMonth(selectedWeekStart).getTime() < bounds.max.getTime();

  const resetToToday = () => {
    const today = stripTime(new Date());
    const todayMonth = clampMonth(startOfMonth(today), bounds.min, bounds.max);
    const nextSelected = keepDayInMonth(today, todayMonth);
    setMonth(todayMonth);
    setSelectedDate(nextSelected);
    setSelectedWeekStart(startOfWeek(nextSelected));
  };

  const moveMonth = (amount: number) => {
    const next = clampMonth(addMonths(month, amount), bounds.min, bounds.max);
    const nextSelected = keepDayInMonth(selectedDate, next);
    setMonth(next);
    setSelectedDate(nextSelected);
    setSelectedWeekStart(startOfWeek(nextSelected));
  };

  const moveWeek = (amount: number) => {
    const next = addDays(selectedWeekStart, amount * 7);
    const nextMonth = clampMonth(startOfMonth(next), bounds.min, bounds.max);
    setMonth(nextMonth);
    setSelectedDate(next);
    setSelectedWeekStart(next);
  };

  const selectScope = (next: CalendarScope) => {
    setScope(next);
    setMode("list");
    setFilters(DEFAULT_FILTERS);
    resetToToday();
  };

  const selectMode = (next: CalendarMode) => {
    setMode(next);
    setFilters(DEFAULT_FILTERS);
    resetToToday();
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedWeekStart(startOfWeek(date));
    setMonth(startOfMonth(date));
  };

  return (
    <main className={styles.page}>
      <section className={styles.frame}>
        <JobHeader user={user} />

        <section className={styles.content}>
          <h1 className={styles.pageTitle}>
            <CalendarIcon />
            채용 캘린더
          </h1>

          <div className={styles.scopeTabs} role="tablist" aria-label="캘린더 범위">
            <button
              type="button"
              className={scope === "all" ? styles.activeTab : undefined}
              onClick={() => selectScope("all")}
            >
              전체 공고
            </button>
            <button
              type="button"
              className={scope === "mine" ? styles.activeTab : undefined}
              onClick={() => selectScope("mine")}
            >
              나만의 캘린더
            </button>
          </div>

          {scope === "mine" ? (
            <MineWeekSelector
              days={selectedWeekDays}
              canPrev={canPrevWeek}
              canNext={canNextWeek}
              onMove={moveWeek}
              onSelect={selectDate}
            />
          ) : (
            <>
              <div className={styles.monthModeRow}>
                <MonthNavigator
                  month={month}
                  canPrev={canPrevMonth}
                  canNext={canNextMonth}
                  onMove={moveMonth}
                />
                <ModeTabs mode={mode} onChange={selectMode} />
              </div>
              {mode === "list" ? (
                <DateStrip
                  selectedDate={selectedDate}
                  selectedDateEvents={selectedDateEvents}
                  days={selectedWeekDays}
                  canPrev={canPrevWeek}
                  canNext={canNextWeek}
                  onMove={moveWeek}
                  onSelect={selectDate}
                />
              ) : null}
            </>
          )}

          {scope === "mine" && !user ? (
            <EmptyState
              title="로그인이 필요합니다."
              description="찜한 공고는 로그인 후 나만의 캘린더에서 확인할 수 있어요."
              href="/login"
              action="로그인하러 가기"
            />
          ) : isLoading ? (
            <p className={styles.loading}>캘린더 공고를 불러오고 있어요.</p>
          ) : scope === "mine" ? (
            <>
              <SelectedWeekHeader
                days={selectedWeekDays}
                count={selectedWeekFilteredEvents.length}
              />
              <GroupedJobList
                sections={selectedWeekJobSections}
                emptyLabel="선택한 주차에 찜한 공고가 없어요."
              />
            </>
          ) : mode === "month" ? (
            <>
              <MonthCalendar
                days={monthDays}
                selectedDate={selectedDate}
                onSelect={selectDate}
              />
              <SelectedDateHeader
                date={selectedDate}
                count={selectedDateFilteredEvents.length}
              />
              <FilterRow
                filters={filters}
                options={filterOptions}
                onChange={setFilters}
              />
              <JobList
                events={selectedDateFilteredEvents}
                emptyLabel="선택한 날짜의 시작/마감 공고가 없어요."
              />
            </>
          ) : (
            <>
              <SelectedDateHeader
                date={selectedDate}
                count={selectedDateFilteredEvents.length}
              />
              <FilterRow
                filters={filters}
                options={filterOptions}
                onChange={setFilters}
              />
              <JobList
                events={selectedDateFilteredEvents}
                emptyLabel="선택한 날짜의 시작/마감 공고가 없어요."
              />
            </>
          )}
        </section>

        <JobFooter active="calendar" />
      </section>
    </main>
  );
}

function MonthNavigator({
  month,
  canPrev,
  canNext,
  onMove,
}: {
  month: Date;
  canPrev: boolean;
  canNext: boolean;
  onMove: (amount: number) => void;
}) {
  return (
    <div className={styles.monthNavigator}>
      <button type="button" onClick={() => onMove(-1)} disabled={!canPrev}>
        &lt;
      </button>
      <strong>{formatMonth(month)}</strong>
      <button type="button" onClick={() => onMove(1)} disabled={!canNext}>
        &gt;
      </button>
    </div>
  );
}

function ModeTabs({
  mode,
  onChange,
}: {
  mode: CalendarMode;
  onChange: (mode: CalendarMode) => void;
}) {
  return (
    <div className={styles.modeTabs} role="tablist" aria-label="캘린더 보기 방식">
      <button
        type="button"
        className={mode === "list" ? styles.activeMode : undefined}
        onClick={() => onChange("list")}
      >
        리스트형
      </button>
      <button
        type="button"
        className={mode === "month" ? styles.activeMode : undefined}
        onClick={() => onChange("month")}
      >
        월간
      </button>
    </div>
  );
}

function DateStrip({
  selectedDate,
  selectedDateEvents,
  days,
  canPrev,
  canNext,
  onMove,
  onSelect,
}: {
  selectedDate: Date;
  selectedDateEvents: CalendarJobEvent[];
  days: Date[];
  canPrev: boolean;
  canNext: boolean;
  onMove: (amount: number) => void;
  onSelect: (date: Date) => void;
}) {
  const selectedKey = toDateKey(selectedDate);
  return (
    <div className={styles.dateStrip}>
      <button type="button" onClick={() => onMove(-1)} disabled={!canPrev}>
        &lt;
      </button>
      {days.map((day) => {
        const isSelected = toDateKey(day) === selectedKey;
        return (
          <button
            type="button"
            key={toDateKey(day)}
            className={`${styles.dateButton} ${getWeekendClass(day)} ${
              isSelected ? styles.selectedDate : ""
            }`}
            onClick={() => onSelect(day)}
          >
            <span>{WEEKDAYS[day.getDay()]}</span>
            <strong>{day.getDate()}</strong>
            {isSelected && selectedDateEvents.length > 0 ? <i /> : null}
          </button>
        );
      })}
      <button type="button" onClick={() => onMove(1)} disabled={!canNext}>
        &gt;
      </button>
    </div>
  );
}

function MineWeekSelector({
  days,
  canPrev,
  canNext,
  onMove,
  onSelect,
}: {
  days: Date[];
  canPrev: boolean;
  canNext: boolean;
  onMove: (amount: number) => void;
  onSelect: (date: Date) => void;
}) {
  const centerWeekStart = days[0];
  const weeks = [-3, -2, -1, 0, 1, 2, 3].map((offset) =>
    startOfWeek(addDays(centerWeekStart, offset * 7)),
  );

  return (
    <div className={styles.weekSelector}>
      <button type="button" onClick={() => onMove(-1)} disabled={!canPrev}>
        &lt;
      </button>
      <div>
        {weeks.map((week) => {
          const isSelected = toDateKey(week) === toDateKey(centerWeekStart);
          return (
            <button
              type="button"
              key={toDateKey(week)}
              className={isSelected ? styles.selectedWeek : undefined}
              onClick={() => onSelect(week)}
            >
              {formatWeekLabel(week)}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => onMove(1)} disabled={!canNext}>
        &gt;
      </button>
    </div>
  );
}

function SelectedDateHeader({ date, count }: { date: Date; count: number }) {
  return (
    <h2 className={styles.scheduleTitle}>
      {formatDateTitle(date)}
      <span>일정 {count}건</span>
    </h2>
  );
}

function SelectedWeekHeader({ days, count }: { days: Date[]; count: number }) {
  return (
    <>
      <h2 className={styles.weekRangeTitle}>
        {formatDateRange(days[0], days[6])}
      </h2>
      <h3 className={styles.todayTitle}>
        <span>오늘</span>
        {formatDateTitle(days[0])}
        <small>일정 {count}건</small>
      </h3>
    </>
  );
}

function FilterRow({
  filters,
  options,
  onChange,
}: {
  filters: CalendarFilters;
  options: { regions: string[]; employmentTypes: string[] };
  onChange: (filters: CalendarFilters) => void;
}) {
  const regions = options.regions.length > 0 ? options.regions : STANDARD_REGIONS;

  return (
    <div className={styles.filterWrap}>
      <div className={styles.filterRow}>
        <label className={styles.filterControl}>
          <select
            value={filters.status}
            onChange={(event) => {
              onChange({ ...filters, status: event.target.value as StatusFilter });
            }}
          >
            <option value="all">공고 전체</option>
            <option value="open">진행 공고</option>
            <option value="closed">마감 공고</option>
          </select>
        </label>
        <label className={styles.filterControl}>
          <select
            value={filters.sort}
            onChange={(event) => {
              onChange({ ...filters, sort: event.target.value as SortFilter });
            }}
          >
            <option value="latest">최신순</option>
            <option value="deadline">마감순</option>
          </select>
        </label>
        <label
          className={`${styles.filterControl} ${
            filters.region !== "all" ? styles.activeFilterControl : ""
          }`}
        >
          <select
            value={filters.region}
            onChange={(event) => {
              onChange({ ...filters, region: event.target.value });
            }}
          >
            <option value="all">지역</option>
            {regions.map((region) => (
              <option value={region} key={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterControl}>
          <select
            value={filters.employmentType}
            onChange={(event) => {
              onChange({ ...filters, employmentType: event.target.value });
            }}
          >
            <option value="all">고용형태</option>
            {options.employmentTypes.map((employmentType) => (
              <option value={employmentType} key={employmentType}>
                {employmentType}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function GroupedJobList({
  sections,
  emptyLabel,
}: {
  sections: Array<{ date: Date; events: CalendarJobEvent[] }>;
  emptyLabel: string;
}) {
  const visibleSections = sections.filter((section) => section.events.length > 0);

  if (visibleSections.length === 0) {
    return (
      <EmptyState
        title={emptyLabel}
        description="채용 공고에서 별표를 눌러 나만의 캘린더에 담아보세요."
      />
    );
  }

  return (
    <div className={styles.groupedJobs}>
      {visibleSections.map((section, index) => (
        <section className={styles.dayJobSection} key={toDateKey(section.date)}>
          {index > 0 ? (
            <SelectedDateHeader date={section.date} count={section.events.length} />
          ) : null}
          <JobList events={section.events} emptyLabel={emptyLabel} />
        </section>
      ))}
    </div>
  );
}

function JobList({
  events,
  emptyLabel,
}: {
  events: CalendarJobEvent[];
  emptyLabel: string;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        title={emptyLabel}
        description="다른 날짜나 월을 선택해서 일정을 확인해보세요."
      />
    );
  }

  return (
    <div className={styles.jobCards}>
      {events.map((event) => (
        <CalendarJobCard key={event.id} event={event} />
      ))}
    </div>
  );
}

function MonthCalendar({
  days,
  selectedDate,
  onSelect,
}: {
  days: Array<{
    key: string;
    date: Date | null;
    inMonth: boolean;
    events: CalendarJobEvent[];
  }>;
  selectedDate: Date;
  onSelect: (date: Date) => void;
}) {
  const selectedKey = toDateKey(selectedDate);
  return (
    <div className={styles.monthCalendar}>
      <div className={styles.monthWeekdays}>
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {days.map((day) => {
          const isSelected = day.date && toDateKey(day.date) === selectedKey;
          return (
            <button
              type="button"
              key={day.key}
              className={`${styles.monthDay} ${!day.inMonth ? styles.otherMonthDay : ""} ${
                isSelected ? styles.selectedMonthDay : ""
              } ${day.date ? getWeekendClass(day.date) : ""}`}
              onClick={() => day.date && onSelect(day.date)}
            >
              {day.date ? (
                <>
                  <span>{day.date.getDate()}</span>
                  {day.events.length > 0 ? <i /> : null}
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarJobCard({ event }: { event: CalendarJobEvent }) {
  const { job } = event;

  return (
    <Link href={`/jobs/${job.id}`} className={styles.jobCard}>
      <span className={getEventBadgeClass(event.kind)}>
        {event.kind === "start" ? "시작" : "마감"}
      </span>
      <span className={styles.jobCopy}>
        <small className={styles.company}>{job.institutionName}</small>
        <strong>{job.title}</strong>
        <span className={styles.tags}>
          {job.region ? <small>{job.region}</small> : null}
          {(job.region && job.employmentType) || (job.region && job.careerRequirement) ? (
            <i aria-hidden="true" />
          ) : null}
          {job.employmentType ? <small>{job.employmentType}</small> : null}
          {job.careerRequirement ? <small>{job.careerRequirement}</small> : null}
          {job.matchScore ? <em>유형추천</em> : null}
        </span>
      </span>
      <span
        className={`${styles.starIcon} ${job.isBookmarked ? styles.starActive : ""}`}
        aria-hidden="true"
      >
        ★
      </span>
    </Link>
  );
}

function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <section className={styles.emptyState}>
      <strong>{title}</strong>
      <p>{description}</p>
      {href && action ? <Link href={href}>{action}</Link> : null}
    </section>
  );
}

function getMonthRange(month: Date) {
  const start = startOfMonth(month);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return {
    startDate: toDateKey(start),
    endDate: toDateKey(end),
  };
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const next = stripTime(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function clampMonth(date: Date, min: Date, max: Date) {
  if (date.getTime() < min.getTime()) return min;
  if (date.getTime() > max.getTime()) return max;
  return date;
}

function keepDayInMonth(date: Date, month: Date) {
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return new Date(
    month.getFullYear(),
    month.getMonth(),
    Math.min(date.getDate(), lastDay),
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildJobEvents(jobs: JobPostingDto[]) {
  const events: CalendarJobEvent[] = [];

  jobs.forEach((job) => {
    if (job.applicationStartAt) {
      const dateKey = toDateKey(new Date(job.applicationStartAt));
      events.push({
        id: `${job.id}-start-${dateKey}`,
        kind: "start",
        dateKey,
        job,
      });
    }

    if (job.applicationEndAt) {
      const dateKey = toDateKey(new Date(job.applicationEndAt));
      events.push({
        id: `${job.id}-end-${dateKey}`,
        kind: "end",
        dateKey,
        job,
      });
    }
  });

  return events;
}

function groupEventsByDate(events: CalendarJobEvent[]) {
  return events.reduce<Record<string, CalendarJobEvent[]>>((acc, event) => {
    acc[event.dateKey] = [...(acc[event.dateKey] || []), event];
    return acc;
  }, {});
}

function groupEventsByWeekDays(days: Date[], events: CalendarJobEvent[]) {
  const grouped = groupEventsByDate(events);
  return days.map((date) => ({
    date,
    events: grouped[toDateKey(date)] || [],
  }));
}

function applyEventFilters(events: CalendarJobEvent[], filters: CalendarFilters) {
  return events
    .filter(({ job }) => {
      if (filters.status === "open" && job.isClosed) return false;
      if (filters.status === "closed" && !job.isClosed) return false;
      if (filters.region !== "all" && !matchesRegion(job.region, filters.region)) {
        return false;
      }
      if (
        filters.employmentType !== "all" &&
        !matchesDelimitedOption(job.employmentType, filters.employmentType)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "deadline") {
        return toTime(a.job.applicationEndAt) - toTime(b.job.applicationEndAt);
      }
      return toTime(b.job.applicationStartAt || b.job.applicationEndAt) -
        toTime(a.job.applicationStartAt || a.job.applicationEndAt);
    });
}

function getAvailableEmploymentTypes(jobs: JobPostingDto[]) {
  const values = jobs.flatMap((job) => splitDelimitedOption(job.employmentType));
  const uniqueValues = [...new Set(values)];
  const orderedValues = EMPLOYMENT_TYPE_ORDER.filter((type) =>
    uniqueValues.includes(type),
  );
  const extraValues = uniqueValues
    .filter((type) => !EMPLOYMENT_TYPE_ORDER.includes(type))
    .sort((a, b) => a.localeCompare(b, "ko-KR"));
  return [...orderedValues, ...extraValues];
}

function getAvailableRegions(jobs: JobPostingDto[]) {
  return STANDARD_REGIONS.filter((region) =>
    jobs.some((job) => matchesRegion(job.region, region)),
  );
}

function matchesRegion(rawRegion: string | null | undefined, selectedRegion: string) {
  if (selectedRegion === "all") return true;
  if (!rawRegion) return false;

  const normalized = rawRegion.replace(/\s+/g, "");
  if (normalized.includes("전국") || normalized.includes("해외")) return true;

  return normalized
    .split(/[,.\/·|]+/)
    .some((region) => region === selectedRegion || region.includes(selectedRegion));
}

function matchesDelimitedOption(rawValue: string | null | undefined, selectedValue: string) {
  return splitDelimitedOption(rawValue).includes(selectedValue);
}

function splitDelimitedOption(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/[,.\/·|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getWeekendClass(date: Date) {
  if (date.getDay() === 0) return styles.sunday;
  if (date.getDay() === 6) return styles.saturday;
  return "";
}

function toTime(value: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  return new Date(value).getTime();
}

function buildWeekDays(start: Date) {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function buildMonthDays(
  month: Date,
  monthEvents: Record<string, CalendarJobEvent[]>,
) {
  const first = startOfMonth(month);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const days: Array<{
    key: string;
    date: Date;
    inMonth: boolean;
    events: CalendarJobEvent[];
  }> = [];

  for (let index = first.getDay(); index > 0; index -= 1) {
    const date = addDays(first, -index);
    const key = toDateKey(date);
    days.push({ key, date, inMonth: false, events: monthEvents[key] || [] });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const key = toDateKey(date);
    days.push({ key, date, inMonth: true, events: monthEvents[key] || [] });
  }

  while (days.length % 7 !== 0) {
    const date = addDays(last, days.length - first.getDay() - last.getDate() + 1);
    const key = toDateKey(date);
    days.push({ key, date, inMonth: false, events: monthEvents[key] || [] });
  }

  return days;
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function formatWeekLabel(date: Date) {
  return `${date.getMonth() + 1}월 ${getWeekOfMonth(date)}주차`;
}

function getWeekOfMonth(date: Date) {
  return Math.floor((date.getDate() + startOfMonth(date).getDay() - 1) / 7) + 1;
}

function formatDateTitle(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

function formatDateRange(start: Date, end: Date) {
  const startLabel = `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일`;
  const endLabel =
    start.getMonth() === end.getMonth()
      ? `${end.getDate()}일`
      : `${end.getMonth() + 1}월 ${end.getDate()}일`;
  return `${startLabel} ~ ${endLabel}`;
}

function getEventBadgeClass(kind: CalendarEventKind) {
  return `${styles.dday} ${kind === "start" ? styles.eventStart : styles.eventEnd}`;
}
