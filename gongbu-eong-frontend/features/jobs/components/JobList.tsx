"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getDiagnosisResultDetail,
  getDiagnosisResultHistory,
} from "@/features/diagnosis/diagnosis.api";
import type {
  DiagnosisResultDetailResponseDto,
  DiagnosisResultHistoryItemDto,
} from "@/features/diagnosis/diagnosis.dto";
import {
  getCurrentUser,
  getJobPostings,
  setJobBookmark,
} from "@/features/home/home.api";
import type { JobListView, JobPostingDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import styles from "./JobList.module.css";

const NCS_OPTIONS = [
  "건설", "경비·청소", "경영·회계·사무", "교육·자연·사회과학", "금융·보험",
  "기계", "농림어업", "문화·예술·디자인·방송", "법률·경찰·소방·교도·국방",
  "보건·의료", "사업관리", "사회복지·종교", "섬유·의복", "식품가공", "연구",
  "영업·판매", "운전·운송", "음식서비스", "이용·숙박·여행·오락·스포츠",
  "인쇄·목재·가구·공예", "재료", "전기·전자", "정보통신", "화학",
  "환경·에너지·안전",
];
const REGIONS = ["서울", "경기", "인천", "강원", "충북", "충남", "대전", "세종", "전북", "전남", "광주", "경북", "경남", "대구", "울산", "부산", "제주"];
const EMPLOYMENTS = ["정규직", "무기계약직", "비정규직", "청년인턴"];
const EDUCATIONS = ["학력무관", "고졸", "대졸(2~3년)", "대졸(4년)", "석사", "박사"];
const CAREERS = ["신입", "경력", "신입+경력"];
const PAGE_SIZE = 20;

type Filters = {
  startDate: string;
  endDate: string;
  ncs: string[];
  region: string[];
  employmentType: string[];
  education: string[];
  career: string[];
};
type FilterOptionKey = Exclude<keyof Filters, "startDate" | "endDate">;

const FILTER_OPTION_CONFIG: Record<FilterOptionKey, { label: string; options: string[] }> = {
  ncs: { label: "채용분야(표준직무 NCS)", options: NCS_OPTIONS },
  region: { label: "근무지", options: REGIONS },
  employmentType: { label: "고용형태", options: EMPLOYMENTS },
  education: { label: "학력정보", options: EDUCATIONS },
  career: { label: "경력사항", options: CAREERS },
};
const EMPTY_FILTERS: Filters = {
  startDate: "", endDate: "", ncs: [], region: [], employmentType: [],
  education: [], career: [],
};

export function JobList({
  view: initialView,
  resultId,
  scope,
  initialNcs = [],
}: {
  view: JobListView;
  resultId?: string;
  scope?: "monthly-regular";
  initialNcs?: string[];
}) {
  const router = useRouter();
  const view = initialView;
  const [jobs, setJobs] = useState<JobPostingDto[]>([]);
  const [total, setTotal] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState(resultId || "");
  const [diagnosisResults, setDiagnosisResults] = useState<DiagnosisResultHistoryItemDto[]>([]);
  const [diagnosisHistoryLoading, setDiagnosisHistoryLoading] = useState(view === "recommended");
  const [recommendationCriteriaLoading, setRecommendationCriteriaLoading] = useState(view === "recommended" && Boolean(resultId));
  const [recommendationTypeName, setRecommendationTypeName] = useState<string | null>(null);
  const [recommendationSetupOpen, setRecommendationSetupOpen] = useState(false);
  const [resultPickerOpen, setResultPickerOpen] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"closing" | "latest" | "views">("closing");
  const scopedFilters: Filters = {
    ...EMPTY_FILTERS,
    ncs: normalizeFilterOptions(initialNcs, NCS_OPTIONS),
    employmentType: scope === "monthly-regular" ? ["정규직"] : [],
  };
  const [filters, setFilters] = useState<Filters>(scopedFilters);
  const [draftFilters, setDraftFilters] = useState<Filters>(scopedFilters);
  const [monthlyRegularOnly, setMonthlyRegularOnly] = useState(scope === "monthly-regular");
  const [filterOpen, setFilterOpen] = useState(false);
  const [optionPicker, setOptionPicker] = useState<FilterOptionKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const replaceRecommendedResultParam = useCallback((
    nextResultId: string,
    criteria?: { monthlyRegularOnly?: boolean; ncs?: string[] },
  ) => {
    const params = new URLSearchParams(window.location.search);
    params.set("view", "recommended");
    params.set("resultId", nextResultId);
    if (criteria?.monthlyRegularOnly) params.set("scope", "monthly-regular");
    else if (criteria) params.delete("scope");
    if (criteria?.ncs?.length) params.set("ncs", criteria.ncs.join("|"));
    else if (criteria) params.delete("ncs");

    const nextHref = `/jobs?${params.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== nextHref) {
      router.replace(nextHref, { scroll: false });
    }
  }, [router]);

  useEffect(() => {
    getCurrentUser()
      .then((r) => {
        setAuthenticated(r.authenticated);
      })
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (view !== "recommended") return;

    let mounted = true;

    const loadDiagnosisResults = async () => {
      setDiagnosisHistoryLoading(true);
      try {
        const response = await getDiagnosisResultHistory(undefined, 20);
        if (!mounted) return;
        setDiagnosisResults(response.items);
        if (!selectedResultId && response.selectedResultId) {
          setSelectedResultId(response.selectedResultId);
        }
      } catch {
        if (mounted) setDiagnosisResults([]);
      } finally {
        if (mounted) setDiagnosisHistoryLoading(false);
      }
    };

    void loadDiagnosisResults();
    return () => { mounted = false; };
  }, [selectedResultId, view]);

  useEffect(() => {
    if (view !== "recommended" || !selectedResultId) return;

    let mounted = true;

    const loadResultScreenCriteria = async () => {
      setRecommendationCriteriaLoading(true);
      try {
        const detail = await getDiagnosisResultDetail(selectedResultId);
        if (!mounted) return;
        const nextFilters = toResultScreenRecommendationFilters(detail);
        setFilters(nextFilters);
        setDraftFilters(nextFilters);
        setMonthlyRegularOnly(true);
        replaceRecommendedResultParam(selectedResultId, {
          monthlyRegularOnly: true,
          ncs: nextFilters.ncs,
        });
      } catch {
        // If detail loading fails, keep the result-id based recommendation list available.
      } finally {
        if (mounted) setRecommendationCriteriaLoading(false);
      }
    };

    void loadResultScreenCriteria();
    return () => { mounted = false; };
  }, [replaceRecommendedResultParam, selectedResultId, view]);

  useEffect(() => {
    let mounted = true;

    const loadJobs = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const response = await getJobPostings({
          view,
          query,
          sort,
          resultId: selectedResultId || undefined,
          scope: monthlyRegularOnly ? "monthly-regular" : undefined,
          limit: PAGE_SIZE,
          offset: 0,
          ...toQueryFilters(filters),
        });
        if (!mounted) return;
        setJobs(response.items);
        setTotal(response.total);
        setRecommendationTypeName(response.recommendationTypeName || null);
        setMessage(null);
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : "공고를 불러오지 못했습니다.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadJobs();
    return () => { mounted = false; };
  }, [filters, monthlyRegularOnly, query, selectedResultId, sort, view]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || jobs.length >= total) return;

    setLoadingMore(true);
    try {
      const response = await getJobPostings({
        view,
        query,
        sort,
        resultId: selectedResultId || undefined,
        scope: monthlyRegularOnly ? "monthly-regular" : undefined,
        limit: PAGE_SIZE,
        offset: jobs.length,
        ...toQueryFilters(filters),
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
  }, [filters, jobs.length, loading, loadingMore, monthlyRegularOnly, query, selectedResultId, sort, total, view]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || jobs.length >= total) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: "240px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [jobs.length, loadMore, loading, total]);

  useEffect(() => {
    if (!filterOpen) return;

    const scrollY = window.scrollY;
    const bodyPosition = document.body.style.position;
    const bodyTop = document.body.style.top;
    const bodyWidth = document.body.style.width;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.position = bodyPosition;
      document.body.style.top = bodyTop;
      document.body.style.width = bodyWidth;
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [filterOpen]);

  useEffect(() => {
    if (!resultPickerOpen) return;

    const scrollY = window.scrollY;
    const bodyPosition = document.body.style.position;
    const bodyTop = document.body.style.top;
    const bodyWidth = document.body.style.width;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.position = bodyPosition;
      document.body.style.top = bodyTop;
      document.body.style.width = bodyWidth;
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [resultPickerOpen]);

  const activeFilterCount = useMemo(
    () =>
      (filters.startDate || filters.endDate ? 1 : 0) +
      ([filters.ncs, filters.region, filters.employmentType, filters.education, filters.career]
        .filter((value) => value.length > 0).length),
    [filters],
  );
  const showSearchControls = view === "all" || view === "closing";
  const showResultFilterButton = view === "recommended";
  const selectedDiagnosisResult = useMemo(
    () =>
      diagnosisResults.find((item) => item.resultId === selectedResultId) ||
      diagnosisResults.find((item) => item.isSelected) ||
      diagnosisResults[0] ||
      null,
    [diagnosisResults, selectedResultId],
  );
  const hasRecommendedDiagnosis = Boolean(recommendationTypeName) || diagnosisResults.length > 0;
  const showNoDiagnosisRecommendation =
    view === "recommended" &&
    !loading &&
    !diagnosisHistoryLoading &&
    !recommendationCriteriaLoading &&
    !hasRecommendedDiagnosis;
  const showRecommendationSetup =
    view === "recommended" &&
    recommendationSetupOpen &&
    Boolean(selectedDiagnosisResult);
  const showRecommendationList =
    !showNoDiagnosisRecommendation &&
    !showRecommendationSetup;
  const showRecommendationAgainButton =
    view === "recommended" &&
    !loading &&
    !diagnosisHistoryLoading &&
    !recommendationCriteriaLoading &&
    diagnosisResults.length >= 2 &&
    !recommendationSetupOpen;
  const pageTitle =
    view === "recommended"
      ? "진단결과 추천공고"
      : view === "bookmarked"
        ? "찜한공고"
        : "채용공고";

  const openFilterSheet = () => {
    setDraftFilters(filters);
    setOptionPicker(null);
    setFilterOpen(true);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(queryInput.trim());
  };

  const handleSelectDiagnosisResult = (item: DiagnosisResultHistoryItemDto) => {
    setSelectedResultId(item.resultId);
    setDiagnosisResults((current) =>
      current.map((result) => ({ ...result, isSelected: result.resultId === item.resultId })),
    );
    setRecommendationTypeName(item.typeName);
    setRecommendationCriteriaLoading(true);
    setResultPickerOpen(false);
    setRecommendationSetupOpen(false);
    replaceRecommendedResultParam(item.resultId);
  };

  const showRecommendedJobsForResult = (item: DiagnosisResultHistoryItemDto) => {
    setSelectedResultId(item.resultId);
    setRecommendationTypeName(item.typeName);
    setRecommendationCriteriaLoading(true);
    setRecommendationSetupOpen(false);
    replaceRecommendedResultParam(item.resultId);
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
      await setJobBookmark(job.id, next);
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

  return (
    <main className={styles.page}>
      <section className={styles.frame}>
        <AppHeader />
        <section className={`${styles.searchSection} ${showSearchControls ? "" : styles.titleOnlySection}`}>
          <h1>{pageTitle}</h1>
          {showSearchControls ? (
            <form onSubmit={submitSearch} className={styles.searchRow}>
              <label className={styles.searchBox}>
                <input value={queryInput} onChange={(e) => setQueryInput(e.target.value)} placeholder="공고명, 기업명을 검색하세요." />
                <button type="submit" aria-label="검색">
                  <Image src="/jobs/search.svg" alt="" width={25} height={25} />
                </button>
              </label>
              <button type="button" className={styles.filterButton} onClick={openFilterSheet}>
                <Image src="/jobs/filter-circle.svg" alt="" width={48} height={48} />
              </button>
            </form>
          ) : null}
        </section>

        {showNoDiagnosisRecommendation ? (
          <NoDiagnosisRecommendation />
        ) : null}

        {showRecommendationSetup && selectedDiagnosisResult ? (
          <RecommendationSetup
            selectedResult={selectedDiagnosisResult}
            onOpenPicker={() => setResultPickerOpen(true)}
            onRecommend={() => showRecommendedJobsForResult(selectedDiagnosisResult)}
          />
        ) : null}

        {showRecommendationList ? (
          <>
            <div className={styles.resultBar}>
              <span>
                총 {total.toLocaleString("ko-KR")}건
              </span>
              <div className={styles.resultControls}>
                {activeFilterCount ? (
                  <button
                    type="button"
                    className={styles.appliedFilterPill}
                    onClick={openFilterSheet}
                  >
                    필터 적용 {activeFilterCount}
                  </button>
                ) : null}
                <label className={styles.sortSelect}>
                  <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                    <option value="closing">{view === "recommended" ? "추천순" : "마감순"}</option>
                    <option value="latest">등록순</option>
                    <option value="views">조회순</option>
                  </select>
                  <ChevronIcon />
                </label>
                {showResultFilterButton ? (
                  <button type="button" className={styles.resultFilterButton} onClick={openFilterSheet} aria-label="상세 필터">
                    <Image src="/jobs/filter-circle.svg" alt="" width={36} height={36} />
                  </button>
                ) : null}
              </div>
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
                      {job.region ? <em>{formatRegionLabel(job.region)}</em> : null}
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
              {!loading && jobs.length === 0 ? <EmptyState view={view} query={query} /> : null}
              {showRecommendationAgainButton ? (
                <button
                  type="button"
                  className={styles.recommendAgainButton}
                  onClick={() => {
                    setRecommendationSetupOpen(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  맞춤 추천 다시 받기
                </button>
              ) : null}
              <div ref={loadMoreRef} className={styles.loadMore} aria-live="polite">
                {loadingMore ? "공고를 더 불러오는 중..." : null}
              </div>
            </div>
          </>
        ) : null}
        <AppFooter />
      </section>

      {loading || diagnosisHistoryLoading || recommendationCriteriaLoading ? <JobLoadingOverlay /> : null}

      {filterOpen ? (
        <div className={styles.filterOverlay} role="dialog" aria-modal="true" aria-label="상세 필터">
          <button className={styles.dim} aria-label="필터 닫기" onClick={() => setFilterOpen(false)} />
          <section className={styles.filterSheet}>
            <div className={styles.sheetHandle} />
            <header>
              {optionPicker ? (
                <button
                  type="button"
                  className={styles.sheetBack}
                  aria-label="상세 필터로 돌아가기"
                  onClick={() => setOptionPicker(null)}
                >
                  <Image src="/jobs/arrow-right.svg" alt="" width={10} height={20} />
                </button>
              ) : null}
              <h2>{optionPicker ? FILTER_OPTION_CONFIG[optionPicker].label : "상세 필터"}</h2>
              <button
                type="button"
                className={styles.sheetClose}
                aria-label="필터 닫기"
                onClick={() => {
                  setOptionPicker(null);
                  setFilterOpen(false);
                }}
              >
                <Image src="/jobs/close.svg" alt="" width={24} height={24} />
              </button>
            </header>
            {optionPicker ? (
              <OptionPickerContent
                field={optionPicker}
                value={draftFilters[optionPicker]}
                onSelect={(nextValue) => {
                  setDraftFilters({ ...draftFilters, [optionPicker]: nextValue });
                  setOptionPicker(null);
                }}
                onReset={() => {
                  setDraftFilters({ ...draftFilters, [optionPicker]: [] });
                  setOptionPicker(null);
                }}
              />
            ) : (
              <div className={styles.filterForm}>
                <FilterField label="등록일">
                  <DateRangeField
                    value={draftFilters}
                    onChange={(next) => setDraftFilters({ ...draftFilters, ...next })}
                  />
                </FilterField>
                <SelectField label="채용분야(표준직무 NCS)" value={draftFilters.ncs} onOpen={() => setOptionPicker("ncs")} />
                <SelectField label="근무지" value={draftFilters.region} onOpen={() => setOptionPicker("region")} />
                <SelectField label="고용형태" value={draftFilters.employmentType} onOpen={() => setOptionPicker("employmentType")} />
                <SelectField label="학력정보" value={draftFilters.education} onOpen={() => setOptionPicker("education")} />
                <SelectField label="경력사항" value={draftFilters.career} onOpen={() => setOptionPicker("career")} />
                <div className={styles.filterActions}>
                  <button
                    type="button"
                    className={styles.resetFilter}
                    onClick={() => {
                      setDraftFilters(scopedFilters);
                      setOptionPicker(null);
                    }}
                  >
                    초기화
                  </button>
                  <button type="button" className={styles.applyFilter} onClick={() => {
                    setFilters(draftFilters);
                    if (draftFilters.employmentType.length !== 1 || draftFilters.employmentType[0] !== "정규직") setMonthlyRegularOnly(false);
                    setOptionPicker(null);
                    setFilterOpen(false);
                  }}>필터 저장</button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {resultPickerOpen && typeof document !== "undefined" ? createPortal(
        <DiagnosisResultPicker
          results={diagnosisResults}
          selectedResultId={selectedDiagnosisResult?.resultId || selectedResultId}
          onClose={() => setResultPickerOpen(false)}
          onSelect={handleSelectDiagnosisResult}
        />,
        document.body,
      ) : null}
    </main>
  );
}

function NoDiagnosisRecommendation() {
  return (
    <section className={styles.noDiagnosisContent}>
      <div className={styles.diagnosisEmptyCard}>
        <Image src="/jobs/diagnosis-empty-owl.png" alt="" width={125} height={134} />
        <p>
          현재 검사한 결과가 없습니다.
          <br />
          검사를 진행하세요.
        </p>
      </div>
      <Link href="/ai-tools/diagnosis" className={styles.outlineCta}>
        강점·성향 진단 검사하러 가기 →
      </Link>
    </section>
  );
}

function RecommendationSetup({
  selectedResult,
  onOpenPicker,
  onRecommend,
}: {
  selectedResult: DiagnosisResultHistoryItemDto;
  onOpenPicker: () => void;
  onRecommend: () => void;
}) {
  return (
    <section className={styles.recommendationSetup}>
      <h2>강점·성향 진단 결과</h2>
      <div className={styles.selectedDiagnosisCard}>
        <strong>{selectedResult.typeName}</strong>
        <button type="button" onClick={onOpenPicker}>변경</button>
      </div>
      <button type="button" className={styles.primaryOutlineCta} onClick={onRecommend}>
        맞춤 추천 받기
      </button>
    </section>
  );
}

function DiagnosisResultPicker({
  results,
  selectedResultId,
  onClose,
  onSelect,
}: {
  results: DiagnosisResultHistoryItemDto[];
  selectedResultId: string;
  onClose: () => void;
  onSelect: (item: DiagnosisResultHistoryItemDto) => void;
}) {
  return (
    <div className={styles.diagnosisPickerOverlay} role="dialog" aria-modal="true" aria-label="진단 결과 선택">
      <button type="button" className={styles.diagnosisPickerDim} aria-label="닫기" onClick={onClose} />
      <section className={styles.diagnosisPickerSheet}>
        <span className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.diagnosisPickerList}>
          {results.map((item) => (
            <button
              type="button"
              key={item.resultId}
              className={`${styles.diagnosisChoiceCard} ${item.resultId === selectedResultId ? styles.diagnosisChoiceSelected : ""}`}
              onClick={() => onSelect(item)}
            >
              <strong>{item.typeName}</strong>
              <time>{formatHistoryDate(item.completedAt)}</time>
            </button>
          ))}
        </div>
        <Link href="/ai-tools/diagnosis" className={styles.primaryOutlineCta}>
          강점·성향 진단 다시 테스트하기
        </Link>
      </section>
    </div>
  );
}

function JobLoadingOverlay() {
  return (
    <div className={styles.jobLoadingOverlay} role="status" aria-live="polite">
      <span className={styles.jobLoadingSpinner} aria-hidden="true" />
      <p className={styles.jobLoadingText}>공고를 불러오는 중이에요…</p>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.filterField}><span>{label}</span>{children}</div>;
}
function SelectField({ label, value, onOpen }: { label: string; value: string[]; onOpen: () => void }) {
  return (
    <FilterField label={label}>
      <button type="button" className={styles.filterSelectButton} onClick={onOpen}>
        <span>{formatSelectedFilter(value)}</span>
        <ChevronIcon />
      </button>
    </FilterField>
  );
}

function OptionPickerContent({
  field,
  value,
  onSelect,
  onReset,
}: {
  field: FilterOptionKey;
  value: string[];
  onSelect: (value: string[]) => void;
  onReset: () => void;
}) {
  const config = FILTER_OPTION_CONFIG[field];
  const [selected, setSelected] = useState<string[]>(value);

  const toggleOption = (option: string) => {
    setSelected((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option],
    );
  };

  return (
    <>
      <div className={styles.optionList}>
        {config.options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label key={option} className={styles.optionItem}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOption(option)}
              />
              <span aria-hidden="true" />
              <em>{option}</em>
            </label>
          );
        })}
      </div>
      <div className={styles.filterActions}>
        <button type="button" className={styles.resetFilter} onClick={onReset}>초기화</button>
        <button type="button" className={styles.applyFilter} onClick={() => onSelect(selected)}>선택 완료</button>
      </div>
    </>
  );
}

function EmptyState({ view, query }: { view: JobListView; query: string }) {
  if (view === "bookmarked") {
    return (
      <div className={`${styles.empty} ${styles.visualEmpty}`}>
        <Image src="/jobs/bookmark-empty-owl.png" alt="" width={141} height={150} />
        <p>
          아직 찜한 공고가 없어요.
          <br />
          채용 공고에서 별표를 눌러 찜 하세요.
        </p>
      </div>
    );
  }

  if (query) {
    return (
      <p className={styles.empty}>
        <u>‘{query}’</u>에 대한 검색 결과가 없어요.
        <br />
        검색어를 다시 확인하거나 다른 키워드로 찾아보세요.
      </p>
    );
  }

  if (view === "recommended") {
    return (
      <p className={styles.empty}>
        아직 추천 공고가 없어요.
        <br />
        강점·성향 진단 결과를 선택해 맞춤 추천을 받아보세요.
      </p>
    );
  }

  return <p className={styles.empty}>조건에 맞는 공고가 없습니다.</p>;
}
function DateRangeField({
  value,
  onChange,
}: {
  value: Pick<Filters, "startDate" | "endDate">;
  onChange: (value: Partial<Pick<Filters, "startDate" | "endDate">>) => void;
}) {
  return (
    <div className={styles.datePickerWrap}>
      <div className={styles.dateRangeFields}>
        <DateButton value={value.startDate} onChange={(startDate) => onChange({ startDate })} />
        <span aria-hidden="true">~</span>
        <DateButton value={value.endDate} onChange={(endDate) => onChange({ endDate })} />
      </div>
    </div>
  );
}

function DateButton({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value) || new Date();

  return (
    <>
      <button type="button" className={styles.dateRangeButton} onClick={() => setOpen(true)}>
        <span>{value || "YYYY-MM-DD"}</span>
        <Image src="/jobs/calendar.svg" alt="" width={24} height={24} />
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <JobDatePicker
          initialDate={selectedDate}
          onClose={() => setOpen(false)}
          onConfirm={(date) => {
            onChange(formatDateValue(date));
            setOpen(false);
          }}
          onReset={() => {
            onChange("");
            setOpen(false);
          }}
        />,
        document.body,
      ) : null}
    </>
  );
}

function JobDatePicker({
  initialDate,
  onClose,
  onConfirm,
  onReset,
}: {
  initialDate: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  onReset: () => void;
}) {
  const [draftDate, setDraftDate] = useState(initialDate);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.dateSheetBackdrop} role="dialog" aria-modal="true" aria-label="날짜선택">
      <button type="button" className={styles.dateSheetScrim} aria-label="닫기" onClick={onClose} />
      <div className={styles.dateSheet}>
        <span className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.dateSheetHeader}>
          <h2>날짜선택</h2>
          <button type="button" className={styles.dateSheetClose} aria-label="닫기" onClick={onClose}>×</button>
        </div>
        <DayPicker date={draftDate} onChange={setDraftDate} />
        <div className={styles.dateSheetActions}>
          <button type="button" className={styles.resetFilter} onClick={onReset}>초기화</button>
          <button type="button" className={styles.applyFilter} onClick={() => onConfirm(draftDate)}>확인</button>
        </div>
      </div>
    </div>
  );
}

function DayPicker({ date, onChange }: { date: Date; onChange: (date: Date) => void }) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const next = new Date(calendarStart);
    next.setDate(calendarStart.getDate() + index);
    return next;
  });

  const moveMonth = (offset: number) => {
    onChange(clampDayToMonth(date.getFullYear(), date.getMonth() + offset, date.getDate()));
  };

  return (
    <div className={styles.dayPicker}>
      <div className={styles.dateSheetMonthNav}>
        <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button>
        <strong>{date.getFullYear()}.{String(date.getMonth() + 1).padStart(2, "0")}</strong>
        <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button>
      </div>
      <div className={styles.dayPickerWeekdays}>
        {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className={styles.dayPickerGrid}>
        {days.map((day) => {
          const selected = isSameDate(day, date);
          const muted = day.getMonth() !== date.getMonth();
          return (
            <button
              type="button"
              key={day.toISOString()}
              className={`${styles.dayPickerDay} ${selected ? styles.dayPickerDaySelected : ""} ${muted ? styles.dayPickerDayMuted : ""}`}
              onClick={() => onChange(day)}
            >
              <span>{day.getDate()}</span>
              {selected ? <i aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function toQueryFilters(filters: Filters) {
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    ncs: filters.ncs.join("|"),
    region: filters.region.join("|"),
    employmentType: filters.employmentType.join("|"),
    education: filters.education.join("|"),
    career: filters.career.join("|"),
  };
}

function toResultScreenRecommendationFilters(detail: DiagnosisResultDetailResponseDto): Filters {
  const currentMonth = getCurrentMonthDateRange();

  return {
    ...EMPTY_FILTERS,
    startDate: currentMonth.startDate,
    endDate: currentMonth.endDate,
    ncs: normalizeFilterOptions(
      detail.monthlyHiring.categories.map((category) => category.name).filter(Boolean),
      NCS_OPTIONS,
    ),
    employmentType: ["정규직"],
  };
}

function getCurrentMonthDateRange() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: formatDateValue(firstDay),
    endDate: formatDateValue(lastDay),
  };
}

function normalizeFilterOptions(values: string[], options: string[]) {
  const optionMap = new Map(options.map((option) => [normalizeOptionKey(option), option]));

  return Array.from(
    new Set(
      values
        .map((value) => optionMap.get(normalizeOptionKey(value)) || value)
        .filter(Boolean),
    ),
  );
}

function normalizeOptionKey(value: string) {
  return value.replace(/[.\s·]/g, "");
}

function formatSelectedFilter(values: string[]) {
  if (!values.length) return "전체";
  if (values.length <= 2) return values.join(", ");
  return `${values.slice(0, 2).join(", ")} 외 ${values.length - 2}개`;
}

function parseDateValue(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function clampDayToMonth(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "진단 완료";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}. ${month}. ${day} 진단 완료`;
}

function toEndDate(value: string | null) {
  if (!value) return "상시 채용";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "상시 채용";

  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `~ ${year}. ${month}. ${day}(${weekday})`;
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
function getDdayClass(job: JobPostingDto) {
  if (job.isClosed || job.dday === "D-Day" || job.dday === "D-1") return styles.urgent;
  return styles.dday;
}
function ChevronIcon() { return <svg viewBox="0 0 12 8"><path d="m1 1 5 5 5-5" /></svg>; }
function StarIcon({ filled }: { filled: boolean }) {
  if (!filled) return <Image src="/jobs/star-outline.svg" alt="" width={25} height={25} />;
  return <svg viewBox="0 0 24 24"><path d="m12 2.8 2.85 5.77 6.37.93-4.61 4.49 1.09 6.34L12 17.34l-5.7 2.99 1.09-6.34L2.78 9.5l6.37-.93L12 2.8Z" fill="currentColor" /></svg>;
}
