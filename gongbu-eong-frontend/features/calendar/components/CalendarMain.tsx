"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  getCalendarJobPostings,
  getCurrentUser,
  setJobBookmark,
} from "@/features/home/home.api";
import type {
  CurrentUserDto,
  JobPostingDto,
} from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import styles from "./CalendarMain.module.css";

type CalendarScope = "all" | "mine";
type CalendarMode = "list" | "month";
type StatusFilter = "all" | "open" | "closed";
type SortFilter = "latest" | "deadline";
type CalendarEventKind = "start" | "end";
type EmptyVariant = "schedule" | "bookmark";

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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24.0014 26.1" aria-hidden="true">
      <path d="M2.4192 17.6963C1.0856 17.6963 0 16.6107 0 15.2771V0h23.699v15.2771c0 1.3336-1.0856 2.4192-2.4192 2.4192H2.4192Z" fill="#FFFFFF" transform="translate(.1542 8.2543)" />
      <path d="M23.699.3024v15.1259c0 1.252-1.0191 2.268-2.268 2.268H2.5734c-1.2519 0-2.268-1.0191-2.268-2.268V.3024H23.699ZM24.0014 0H0v15.4283c0 1.4213 1.1521 2.5704 2.5704 2.5704h18.8575c1.4213 0 2.5704-1.1521 2.5704-2.5704V0h.0031Z" fill="#E3ECE1" transform="translate(0 8.1)" />
      <path d="M2.6278 0h18.7457c1.4515 0 2.6279 1.1763 2.6279 2.6278v3.6379H0V2.6278C0 1.1763 1.1763 0 2.6278 0Z" fill="#2F7FF0" transform="translate(0 2.1439)" />
      <path d="M.8588 0h-.003C.3831 0 0 .3832 0 .8558v2.5734c0 .4726.3831.8558.8558.8558h.003c.4726 0 .8558-.3832.8558-.8558V.8558C1.7146.3832 1.3314 0 .8588 0Z" fill="#155ABC" transform="translate(5.3283)" />
      <path d="M.8588 0h-.003C.3831 0 0 .3832 0 .8558v2.5734c0 .4726.3831.8558.8558.8558h.003c.4726 0 .8558-.3832.8558-.8558V.8558C1.7146.3832 1.3314 0 .8588 0Z" fill="#155ABC" transform="translate(17.3577)" />
      <path d="M3.3415 0H.4294C.1923 0 0 .1923 0 .4294v2.9121c0 .2372.1923.4294.4294.4294h2.9121c.2372 0 .4294-.1922.4294-.4294V.4294C3.7709.1923 3.5787 0 3.3415 0Z" fill="#E6E7E5" transform="translate(4.1126 11.7664)" />
      <path d="M3.3415 0H.4294C.1923 0 0 .1922 0 .4294v2.9121c0 .2371.1923.4294.4294.4294h2.9121c.2372 0 .4294-.1923.4294-.4294V.4294C3.7709.1922 3.5787 0 3.3415 0Z" fill="#E6E7E5" transform="translate(4.1126 17.4241)" />
      <path d="M3.3415 0H.4294C.1923 0 0 .1923 0 .4294v2.9121c0 .2372.1923.4294.4294.4294h2.9121c.2372 0 .4294-.1922.4294-.4294V.4294C3.7709.1923 3.5787 0 3.3415 0Z" fill="#E6E7E5" transform="translate(9.7705 11.7664)" />
      <path d="m5.9757 3.7948-.6956.6804c-.6078.5625-1.2247 1.0977-1.8627 1.633C2.7702 5.5669 2.1473 5.0226 1.5304 4.4541c-.2177-.1996-.4203-.3962-.626-.6079C.5325 3.4592.221 3.0419.0759 2.5278-.0693 2.0137-.0058 1.4452.2633.9704.7895.0451 1.9628-.2875 2.873.284c.2147.1361.3901.3054.5413.511.5323-.7348 1.4636-1.0009 2.2831-.6259.5232.2389.9072.7015 1.0615 1.2549.1149.4083.0967.8316-.0424 1.2308-.1481.4354-.4203.7983-.7408 1.14Z" fill="#FF5C5C" transform="translate(13.9403 17.1038)" />
    </svg>
  );
}
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
  const [bookmarkPendingId, setBookmarkPendingId] = useState<string | null>(null);

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
  const bookmarkedJobEvents = useMemo(() => buildBookmarkedJobEvents(jobs), [jobs]);
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

  const toggleBookmark = async (job: JobPostingDto) => {
    if (bookmarkPendingId) return;
    if (!user) {
      window.alert("찜한 공고를 저장하려면 로그인이 필요합니다.");
      return;
    }

    setBookmarkPendingId(job.id);
    try {
      const response = await setJobBookmark(job.id, !job.isBookmarked);
      setJobs((current) => {
        if (scope === "mine" && !response.isBookmarked) {
          return current.filter((item) => item.id !== job.id);
        }
        return current.map((item) =>
          item.id === job.id
            ? { ...item, isBookmarked: response.isBookmarked }
            : item,
        );
      });
    } catch {
      window.alert("찜 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBookmarkPendingId(null);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.frame}>
        <AppHeader user={user} />

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
            <>
              <MineYearHeader month={month} bounds={bounds} onChange={setMonth} />
              {!user ? (
                <EmptyState
                  title="로그인이 필요합니다."
                  description="찜한 공고는 로그인 후 나만의 캘린더에서 확인할 수 있어요."
                  href="/login"
                  action="로그인하러 가기"
                />
              ) : isLoading ? (
                <p className={styles.loading}>캘린더 공고를 불러오고 있어요.</p>
              ) : (
                <JobList
                  events={bookmarkedJobEvents}
                  emptyLabel="아직 찜한 공고가 없어요."
                  emptyDescription="채용 공고에서 별표를 눌러 나만의 캘린더에 담아보세요."
                  emptyVariant="bookmark"
                  onToggleBookmark={toggleBookmark}
                  pendingBookmarkId={bookmarkPendingId}
                  showEventBadge={false}
                />
              )}
            </>
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
                  mode={mode}
                  selectedDate={selectedDate}
                  eventsByDate={monthEvents}
                  days={selectedWeekDays}
                  canPrev={canPrevWeek}
                  canNext={canNextWeek}
                  onMove={moveWeek}
                  onSelect={selectDate}
                />
              ) : (
                <MonthCalendar
                  days={monthDays}
                  selectedDate={selectedDate}
                  onSelect={selectDate}
                />
              )}
              <SelectedDateHeader
                date={selectedDate}
                count={selectedDateFilteredEvents.length}
              />
              <FilterRow
                filters={filters}
                options={filterOptions}
                onChange={setFilters}
              />
              {isLoading ? (
                <p className={styles.loading}>캘린더 공고를 불러오고 있어요.</p>
              ) : (
                <JobList
                  events={selectedDateFilteredEvents}
                  emptyLabel="앗, 오늘은 예정된 공고가 없어요."
                  emptyDescription="달력에서 다른 날짜를 눌러보세요."
                  emptyVariant="schedule"
                  onToggleBookmark={toggleBookmark}
                  pendingBookmarkId={bookmarkPendingId}
                />
              )}
            </>
          )}
        </section>

        <AppFooter active="calendar" />
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

function MineYearHeader({
  month,
  bounds,
  onChange,
}: {
  month: Date;
  bounds: { min: Date; max: Date };
  onChange: (month: Date) => void;
}) {
  const years = Array.from(
    { length: bounds.max.getFullYear() - bounds.min.getFullYear() + 1 },
    (_, index) => bounds.max.getFullYear() - index,
  );

  return (
    <div className={styles.mineYearHeader}>
      <strong>{month.getFullYear()}</strong>
      <label>
        <select
          value={month.getFullYear()}
          onChange={(event) => {
            onChange(new Date(Number(event.target.value), month.getMonth(), 1));
          }}
        >
          {years.map((year) => (
            <option value={year} key={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function DateStrip({
  mode,
  selectedDate,
  eventsByDate,
  days,
  canPrev,
  canNext,
  onMove,
  onSelect,
}: {
  mode: CalendarMode;
  selectedDate: Date;
  eventsByDate: Record<string, CalendarJobEvent[]>;
  days: Date[];
  canPrev: boolean;
  canNext: boolean;
  onMove: (amount: number) => void;
  onSelect: (date: Date) => void;
}) {
  const selectedKey = toDateKey(selectedDate);
  return (
    <div className={`${styles.dateStrip} ${mode === "list" ? styles.weekDateStrip : styles.monthDateStrip}`}>
      <button type="button" onClick={() => onMove(-1)} disabled={!canPrev}>
        &lt;
      </button>
      {days.map((day) => {
        const dateKey = toDateKey(day);
        const isSelected = dateKey === selectedKey;
        const hasEvents = Boolean(eventsByDate[dateKey]?.length);
        return (
          <button
            type="button"
            key={dateKey}
            className={`${styles.dateButton} ${getWeekendClass(day)} ${
              isSelected ? styles.selectedDate : ""
            }`}
            onClick={() => onSelect(day)}
          >
            <span>{WEEKDAYS[day.getDay()]}</span>
            <strong>{day.getDate()}</strong>
            {hasEvents ? <i /> : null}
          </button>
        );
      })}
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

function JobList({
  events,
  emptyLabel,
  emptyDescription,
  emptyVariant = "schedule",
  onToggleBookmark,
  pendingBookmarkId,
  showEventBadge = true,
}: {
  events: CalendarJobEvent[];
  emptyLabel: string;
  emptyDescription: string;
  emptyVariant?: EmptyVariant;
  onToggleBookmark: (job: JobPostingDto) => void;
  pendingBookmarkId: string | null;
  showEventBadge?: boolean;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        title={emptyLabel}
        description={emptyDescription}
        variant={emptyVariant}
      />
    );
  }

  return (
    <div className={styles.jobCards}>
      {events.map((event) => (
        <CalendarJobCard
          key={event.id}
          event={event}
          onToggleBookmark={onToggleBookmark}
          isBookmarkPending={pendingBookmarkId === event.job.id}
          showEventBadge={showEventBadge}
        />
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
  const todayKey = toDateKey(new Date());
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
          const isToday = day.date && toDateKey(day.date) === todayKey;
          const hasEvents = day.events.length > 0;
          return (
            <button
              type="button"
              key={day.key}
              className={`${styles.monthDay} ${!day.inMonth ? styles.otherMonthDay : ""} ${
                isToday && !isSelected ? styles.todayMonthDay : ""
              } ${isSelected ? styles.selectedMonthDay : ""} ${
                day.date ? getWeekendClass(day.date) : ""
              }`}
              onClick={() => day.date && onSelect(day.date)}
            >
              {day.date ? (
                <>
                  <span>{day.date.getDate()}</span>
                  {hasEvents ? <i /> : null}
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarJobCard({
  event,
  onToggleBookmark,
  isBookmarkPending,
  showEventBadge,
}: {
  event: CalendarJobEvent;
  onToggleBookmark: (job: JobPostingDto) => void;
  isBookmarkPending: boolean;
  showEventBadge: boolean;
}) {
  const { job } = event;

  return (
    <Link href={`/jobs/${job.id}`} className={`${styles.jobCard} ${!showEventBadge ? styles.jobCardWithoutBadge : ""}`}>
      {showEventBadge ? (
        <span className={getEventBadgeClass(event.kind)}>
          {event.kind === "start" ? "시작" : "마감"}
        </span>
      ) : null}
      <span className={styles.jobCopy}>
        <small className={styles.company}>{job.institutionName}</small>
        <strong>{job.title}</strong>
        <span className={styles.tags}>
          {job.employmentType ? <small>{job.employmentType}</small> : null}
          {job.region ? <small>{formatRegionLabel(job.region)}</small> : null}
          {job.careerRequirement ? <small>{job.careerRequirement}</small> : null}
          {job.matchScore != null ? <em>유형추천</em> : null}
        </span>
      </span>
      <button
        type="button"
        className={styles.starIcon}
        aria-label={job.isBookmarked ? "찜 해제" : "찜하기"}
        disabled={isBookmarkPending}
        onClick={(clickEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
          onToggleBookmark(job);
        }}
      >
        <Image
          src={job.isBookmarked ? "/calendar/star-filled.svg" : "/calendar/star-outline.svg"}
          alt=""
          width={25}
          height={25}
        />
      </button>
    </Link>
  );
}

function EmptyState({
  title,
  description,
  variant = "schedule",
  href,
  action,
}: {
  title: string;
  description: string;
  variant?: EmptyVariant;
  href?: string;
  action?: string;
}) {
  const image =
    variant === "bookmark"
      ? { src: "/calendar/empty-bookmark.png", width: 141, height: 150 }
      : { src: "/calendar/empty-schedule.png", width: 140, height: 150 };

  return (
    <section className={styles.emptyState}>
      <span className={styles.emptyIllustration} aria-hidden="true">
        <Image src={image.src} alt="" width={image.width} height={image.height} />
      </span>
      <p>
        <span>{title}</span>
        <span>{description}</span>
      </p>
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

function buildBookmarkedJobEvents(jobs: JobPostingDto[]) {
  const seen = new Set<string>();
  return jobs
    .filter((job) => {
      if (seen.has(job.id)) return false;
      seen.add(job.id);
      return true;
    })
    .map((job) => ({
      id: `${job.id}-bookmarked`,
      kind: "end" as CalendarEventKind,
      dateKey: job.applicationEndAt
        ? toDateKey(new Date(job.applicationEndAt))
        : job.applicationStartAt
          ? toDateKey(new Date(job.applicationStartAt))
          : toDateKey(new Date()),
      job,
    }))
    .sort((a, b) => toTime(b.dateKey) - toTime(a.dateKey));
}

function groupEventsByDate(events: CalendarJobEvent[]) {
  return events.reduce<Record<string, CalendarJobEvent[]>>((acc, event) => {
    acc[event.dateKey] = [...(acc[event.dateKey] || []), event];
    return acc;
  }, {});
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

function formatRegionLabel(value: string | null | undefined) {
  const regions = splitDelimitedOption(value);
  if (regions.length <= 3) return regions.join(" · ") || "";
  return `${regions.slice(0, 3).join(" · ")} 외 ${regions.length - 3}개`;
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

function formatDateTitle(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

function getEventBadgeClass(kind: CalendarEventKind) {
  return `${styles.dday} ${kind === "start" ? styles.eventStart : styles.eventEnd}`;
}
