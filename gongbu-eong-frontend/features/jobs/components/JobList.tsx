"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCurrentUser,
  getHomeJobs,
  getJobPostings,
  setJobBookmark,
} from "@/features/home/home.api";
import type { JobListView, JobPostingDto } from "@/features/home/home.dto";
import { JobFooter, JobHeader } from "./JobChrome";
import styles from "./JobList.module.css";

const NCS_OPTIONS = [
  "건설", "경비.청소", "경영.회계.사무", "교육.자연.사회과학", "금융.보험",
  "기계", "농림어업", "문화.예술.디자인.방송", "법률.경찰.소방.교도.국방",
  "보건.의료", "사업관리", "사회복지.종교", "섬유.의복", "식품가공", "연구",
  "영업판매", "운전.운송", "음식서비스", "이용.숙박.여행.오락.스포츠",
  "인쇄.목재.가구.공예", "재료", "전기.전자", "정보통신", "화학",
  "환경.에너지.안전",
];
const REGIONS = ["서울", "경기", "인천", "강원", "충북", "충남", "대전", "세종", "전북", "전남", "광주", "경북", "경남", "대구", "울산", "부산", "제주"];
const EMPLOYMENTS = ["정규직", "무기계약직", "비정규직", "청년인턴"];
const EDUCATIONS = ["학력무관", "고졸", "대졸(2~3년)", "대졸(4년)", "석사", "박사"];
const CAREERS = ["신입", "경력", "신입+경력"];
const PAGE_SIZE = 20;

type Filters = {
  startDate: string;
  endDate: string;
  ncs: string;
  region: string;
  employmentType: string;
  education: string;
  career: string;
};
const EMPTY_FILTERS: Filters = {
  startDate: "", endDate: "", ncs: "", region: "", employmentType: "",
  education: "", career: "",
};

export function JobList({
  view: initialView,
  resultId,
  scope,
}: {
  view: JobListView;
  resultId?: string;
  scope?: "monthly-regular";
}) {
  const [view, setView] = useState<JobListView>(initialView);
  const [jobs, setJobs] = useState<JobPostingDto[]>([]);
  const [total, setTotal] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"closing" | "latest" | "views">("closing");
  const scopedFilters = scope === "monthly-regular"
    ? { ...EMPTY_FILTERS, employmentType: "정규직" }
    : EMPTY_FILTERS;
  const [filters, setFilters] = useState<Filters>(scopedFilters);
  const [draftFilters, setDraftFilters] = useState<Filters>(scopedFilters);
  const [monthlyRegularOnly, setMonthlyRegularOnly] = useState(scope === "monthly-regular");
  const [filterOpen, setFilterOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrentUser()
      .then((r) => {
        setAuthenticated(r.authenticated);
        if (r.authenticated) {
          return getHomeJobs().then((home) => setBookmarkCount(home.bookmarkCount));
        }
      })
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    let mounted = true;
    getJobPostings({
      view,
      query,
      sort,
      resultId,
      scope: monthlyRegularOnly ? "monthly-regular" : undefined,
      limit: PAGE_SIZE,
      offset: 0,
      ...filters,
    })
      .then((response) => {
        if (!mounted) return;
        setJobs(response.items);
        setTotal(response.total);
        if (view === "bookmarked") setBookmarkCount(response.total);
        setMessage(
          view === "recommended" && !response.recommendationTypeName
            ? "최근 강점·성향 진단 결과가 있어야 맞춤 공고를 볼 수 있어요."
            : null,
        );
      })
      .catch((error) => mounted && setMessage(error instanceof Error ? error.message : "공고를 불러오지 못했습니다."))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [filters, monthlyRegularOnly, query, resultId, sort, view]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || jobs.length >= total) return;

    setLoadingMore(true);
    try {
      const response = await getJobPostings({
        view,
        query,
        sort,
        resultId,
        scope: monthlyRegularOnly ? "monthly-regular" : undefined,
        limit: PAGE_SIZE,
        offset: jobs.length,
        ...filters,
      });
      setJobs((current) => [
        ...current,
        ...response.items.filter((item) => !current.some((saved) => saved.id === item.id)),
      ]);
      setTotal(response.total);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공고를 더 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  }, [filters, jobs.length, loading, loadingMore, monthlyRegularOnly, query, resultId, sort, total, view]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || jobs.length >= total) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: "240px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [jobs.length, loadMore, loading, total]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(queryInput.trim());
  };

  const toggleBookmark = async (job: JobPostingDto) => {
    if (!authenticated) {
      setMessage("찜한 공고를 저장하려면 로그인이 필요합니다.");
      return;
    }
    if (pendingJobId) return;
    const next = !job.isBookmarked;
    setPendingJobId(job.id);
    try {
      const response = await setJobBookmark(job.id, next);
      setBookmarkCount(response.bookmarkCount);
      setJobs((items) =>
        view === "bookmarked" && !next
          ? items.filter((item) => item.id !== job.id)
          : items.map((item) => item.id === job.id ? { ...item, isBookmarked: next } : item),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "찜 상태를 바꾸지 못했습니다.");
    } finally {
      setPendingJobId(null);
    }
  };

  const changeView = (next: JobListView) => {
    setView(next);
    if (next !== "recommended") setMonthlyRegularOnly(false);
    window.history.replaceState(null, "", next === "all" ? "/jobs" : `/jobs?view=${next}`);
  };

  return (
    <main className={styles.page}>
      <section className={styles.frame}>
        <JobHeader />
        <section className={styles.searchSection}>
          <h1>채용 공고</h1>
          <form onSubmit={submitSearch} className={styles.searchRow}>
            <label className={styles.searchBox}>
              <input value={queryInput} onChange={(e) => setQueryInput(e.target.value)} placeholder="공공·기관 검색" />
              <button type="submit" aria-label="검색"><SearchIcon /></button>
            </label>
            <button type="button" className={styles.filterButton} onClick={() => { setDraftFilters(filters); setDatePickerOpen(false); setFilterOpen(true); }}>
              <FilterIcon /> 필터{activeFilterCount ? ` ${activeFilterCount}` : ""}
            </button>
          </form>
        </section>

        <nav className={styles.tabs} aria-label="공고 보기">
          <button className={view === "all" || view === "closing" ? styles.selectedTab : ""} onClick={() => changeView("all")}>전체</button>
          <button className={view === "recommended" ? styles.selectedTab : ""} onClick={() => changeView("recommended")}>맞춤 추천</button>
          <button className={view === "bookmarked" ? styles.selectedTab : ""} onClick={() => changeView("bookmarked")}>
            찜 <span>{bookmarkCount}</span>
          </button>
        </nav>

        <div className={styles.resultBar}>
          <span>
            총 {total.toLocaleString("ko-KR")}건
            {monthlyRegularOnly ? <em>이번 달 · 정규직</em> : null}
          </span>
            <label className={styles.sortSelect}>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="closing">{view === "recommended" ? "추천순" : "마감순"}</option>
                <option value="latest">등록순</option>
                <option value="views">조회순</option>
              </select>
              <ChevronIcon />
            </label>
        </div>

        {message ? <p className={styles.message}>{message}</p> : null}
        <div className={styles.list}>
          {jobs.map((job) => (
            <article key={job.id} className={styles.card}>
              <Link href={`/jobs/${job.id}`} className={styles.cardLink}>
                <small className={styles.company}>{job.institutionName}</small>
                <strong>{job.title}</strong>
                <span className={styles.tags}>
                  {job.employmentType ? <em>{job.employmentType}</em> : null}
                  {job.region ? <em>{job.region}</em> : null}
                  {job.careerRequirement ? <em>{job.careerRequirement}</em> : null}
                </span>
                <span className={styles.cardBottom}>
                  <time>{toEndDate(job.applicationEndAt)}</time>
                  <b className={getDdayClass(job)}>{job.isClosed ? "마감" : job.dday}</b>
                </span>
              </Link>
              <button
                type="button"
                className={`${styles.star} ${job.isBookmarked ? styles.starActive : ""}`}
                aria-label={job.isBookmarked ? "찜 해제" : "찜하기"}
                disabled={pendingJobId === job.id}
                onClick={() => void toggleBookmark(job)}
              >
                <StarIcon filled={job.isBookmarked} />
              </button>
            </article>
          ))}
          {!loading && jobs.length === 0 ? <p className={styles.empty}>조건에 맞는 공고가 없습니다.</p> : null}
          <div ref={loadMoreRef} className={styles.loadMore} aria-live="polite">
            {loadingMore ? "공고를 더 불러오는 중..." : null}
          </div>
        </div>
        <JobFooter />
      </section>

      {filterOpen ? (
        <div className={styles.filterOverlay} role="dialog" aria-modal="true" aria-label="상세 필터">
          <button className={styles.dim} aria-label="필터 닫기" onClick={() => setFilterOpen(false)} />
          <section className={styles.filterSheet}>
            <div className={styles.sheetHandle} />
            <header><h2>상세 필터</h2><button onClick={() => setDraftFilters(EMPTY_FILTERS)}>초기화</button></header>
            <FilterField label="등록일">
              <DateRangeField
                open={datePickerOpen}
                value={draftFilters}
                onToggle={() => setDatePickerOpen((current) => !current)}
                onChange={(next) => setDraftFilters({ ...draftFilters, ...next })}
              />
            </FilterField>
            <SelectField label="채용분야(표준직무 NCS)" value={draftFilters.ncs} options={NCS_OPTIONS} onChange={(ncs) => setDraftFilters({ ...draftFilters, ncs })} />
            <SelectField label="근무지" value={draftFilters.region} options={REGIONS} onChange={(region) => setDraftFilters({ ...draftFilters, region })} />
            <SelectField label="고용형태" value={draftFilters.employmentType} options={EMPLOYMENTS} onChange={(employmentType) => setDraftFilters({ ...draftFilters, employmentType })} />
            <SelectField label="학력정보" value={draftFilters.education} options={EDUCATIONS} onChange={(education) => setDraftFilters({ ...draftFilters, education })} />
            <SelectField label="경력사항" value={draftFilters.career} options={CAREERS} onChange={(career) => setDraftFilters({ ...draftFilters, career })} />
            <button className={styles.applyFilter} onClick={() => {
              setFilters(draftFilters);
              if (draftFilters.employmentType !== "정규직") setMonthlyRegularOnly(false);
              setDatePickerOpen(false);
              setFilterOpen(false);
            }}>공고 보기</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <label className={styles.filterField}><span>{label}</span>{children}</label>;
}
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <FilterField label={label}>
      <span className={styles.filterSelect}>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">전체</option>
          {options.map((option) => <option key={option}>{option}</option>)}
        </select>
        <ChevronIcon />
      </span>
    </FilterField>
  );
}
function DateRangeField({
  open,
  value,
  onToggle,
  onChange,
}: {
  open: boolean;
  value: Pick<Filters, "startDate" | "endDate">;
  onToggle: () => void;
  onChange: (value: Partial<Pick<Filters, "startDate" | "endDate">>) => void;
}) {
  const displayValue = value.startDate || value.endDate
    ? `${value.startDate || "YYYY-MM-DD"} ~ ${value.endDate || "YYYY-MM-DD"}`
    : "YYYY-MM-DD ~ YYYY-MM-DD";

  return (
    <div className={styles.datePickerWrap}>
      <button type="button" className={styles.dateRangeButton} onClick={onToggle}>
        <span>{displayValue}</span>
        <CalendarFilterIcon />
      </button>
      {open ? (
        <div className={styles.datePickerPanel}>
          <label>
            <span>시작일</span>
            <input type="date" value={value.startDate} onChange={(event) => onChange({ startDate: event.target.value })} />
          </label>
          <label>
            <span>종료일</span>
            <input type="date" value={value.endDate} onChange={(event) => onChange({ endDate: event.target.value })} />
          </label>
        </div>
      ) : null}
    </div>
  );
}
function toEndDate(value: string | null) {
  if (!value) return "상시 채용";
  return `~ ${new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).format(new Date(value))}`;
}
function getDdayClass(job: JobPostingDto) {
  if (job.isClosed || job.dday === "D-Day" || job.dday === "D-1") return styles.urgent;
  return styles.dday;
}
function SearchIcon() { return <svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>; }
function FilterIcon() { return <svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10m-7 6h4" /></svg>; }
function ChevronIcon() { return <svg viewBox="0 0 12 8"><path d="m1 1 5 5 5-5" /></svg>; }
function CalendarFilterIcon() { return <svg viewBox="0 0 24 24"><path d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 8h3m2 0h3m-8 4h3" /></svg>; }
function StarIcon({ filled }: { filled: boolean }) { return <svg viewBox="0 0 24 24"><path d="m12 2.8 2.85 5.77 6.37.93-4.61 4.49 1.09 6.34L12 17.34l-5.7 2.99 1.09-6.34L2.78 9.5l6.37-.93L12 2.8Z" fill={filled ? "currentColor" : "white"} /></svg>; }
