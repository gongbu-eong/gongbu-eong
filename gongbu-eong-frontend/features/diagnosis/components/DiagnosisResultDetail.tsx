"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentUser, getHomeJobs } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { JobFooter, JobHeader } from "@/features/jobs/components/JobChrome";
import {
  getDiagnosisResultDetail,
  getDiagnosisResultHistory,
  selectDiagnosisResult,
} from "../diagnosis.api";
import type {
  DiagnosisResultDetailResponseDto,
  DiagnosisResultHistoryItemDto,
  DiagnosisTypeCode,
} from "../diagnosis.dto";
import styles from "./DiagnosisResultDetail.module.css";

type TypeCopy = {
  color: string;
  heroSummary: string;
  description: string;
  tips: Array<{ title: string; description: string }>;
};

const TYPE_COPY: Record<DiagnosisTypeCode, TypeCopy> = {
  stability: {
    color: "#15489a",
    heroSummary: "묵묵히 준비해 결국 붙는 타입",
    description: "안정적인 환경에서 원칙을 지키며 꾸준히 성과를 내는 타입이에요. 화려하진 않아도 맡은 일을 끝까지 책임지고, 조직 안에서 신뢰를 쌓아가는 데 강해요. 급하게 뛰기보다 차근차근 준비해 결국 합격에 도달하는 스타일이에요.",
    tips: [
      { title: "'꾸준함'을 스토리로 만들기", description: "단발성 성과보다 오래 지속한 경험(장기 프로젝트, 꾸준한 활동)이 강점이에요. 자소서와 면접에서 이 서사를 적극 활용하세요." },
      { title: "책임감·정확성을 근거로 보여주기", description: "'열심히 하겠다'가 아니라, 실제로 끝까지 책임지고 정확하게 해낸 사례를 숫자와 결과로 제시하면 신뢰를 줘요." },
      { title: "'소극적' 인상 주지 않기", description: "안정 지향이 수동적으로 보이지 않도록 스스로 문제를 찾아 주도적으로 해결한 경험을 하나 준비해두세요." },
    ],
  },
  challenge: {
    color: "#f3a427",
    heroSummary: "빠르게 부딪히며 성장하는 타입",
    description: "낯선 방식이나 높은 목표 앞에서 움츠러들기보다 먼저 시도해보는 타입이에요. 실패 가능성이 있어도 성장 가능성이 보이면 빠르게 움직이며 경험으로 방향을 잡습니다.",
    tips: [
      { title: "도전을 성과 서사로 만들기", description: "새로운 시도 자체보다 무엇을 바꾸고 어떤 결과를 냈는지 구체적으로 보여주세요." },
      { title: "빠른 판단의 근거 보여주기", description: "도전 전에 확인한 기준과 실패 비용을 줄인 방법을 함께 설명하면 신뢰가 높아져요." },
      { title: "시작만 빠른 인상 피하기", description: "빠른 시작뿐 아니라 끝까지 완주하고 정리한 사례를 함께 준비하세요." },
    ],
  },
  teamwork: {
    color: "#a154e5",
    heroSummary: "함께 맞춰가며 성과를 내는 타입",
    description: "혼자 밀어붙이기보다 주변과 방향을 맞추고 역할을 나눌 때 강점이 살아나는 타입이에요. 협의와 피드백을 통해 안정적인 결론을 만들고 관계 안에서 성과를 냅니다.",
    tips: [
      { title: "조율의 결과를 수치로 말하기", description: "협업으로 일정, 품질, 만족도가 어떻게 좋아졌는지 구체적으로 보여주세요." },
      { title: "내 책임 범위 분명히 하기", description: "팀 성과 안에서 본인이 맡고 완수한 역할을 명확하게 구분하세요." },
      { title: "갈등을 피한 인상 주지 않기", description: "의견 차이를 듣고 기준을 세워 합의한 경험을 정리해두세요." },
    ],
  },
  individual: {
    color: "#e85759",
    heroSummary: "혼자 집중할 때 최고 능률을 내는 타입",
    description: "스스로 몰입할 시간이 있을 때 결과가 좋아지는 타입이에요. 독립적으로 기준을 세우고 깊게 파고들며, 방해가 적은 환경에서 집중력이 살아납니다.",
    tips: [
      { title: "깊이 있는 결과물 제시하기", description: "혼자 집중해 완성도를 높인 산출물과 개선 전후를 보여주세요." },
      { title: "자기주도 과정을 설명하기", description: "목표를 세우고 진척을 관리한 자신만의 방식을 구체적으로 말해보세요." },
      { title: "소통이 부족한 인상 피하기", description: "독립적으로 일하면서도 중간 공유로 방향을 확인한 경험을 준비하세요." },
    ],
  },
  execution: {
    color: "#5bbf47",
    heroSummary: "일단 움직여 기어코 끝내는 타입",
    description: "완벽한 계획을 기다리기보다 작은 행동으로 시작하며 방향을 잡는 타입이에요. 해야 할 일이 보이면 빠르게 움직이고 실행 과정에서 필요한 정보를 보완해갑니다.",
    tips: [
      { title: "행동 속도를 결과로 증명하기", description: "빠른 착수로 일정이나 고객 반응을 개선한 사례를 준비하세요." },
      { title: "우선순위 기준 말하기", description: "무엇부터 실행했는지 판단 기준을 설명하면 추진력이 더 설득력 있어요." },
      { title: "성급한 인상 줄이기", description: "실행 전 반드시 확인하는 최소 체크리스트를 함께 보여주세요." },
    ],
  },
  planning: {
    color: "#6a7e92",
    heroSummary: "큰 그림을 그리고 방향을 설계하는 타입",
    description: "시작 전 목표와 기준, 순서를 정리해야 힘이 나는 타입이에요. 정보를 비교하고 가능성을 분석해 우선순위를 세우며 복잡한 상황을 구조화하는 데 강합니다.",
    tips: [
      { title: "계획이 실행된 장면 보여주기", description: "분석에서 끝나지 않고 일정과 행동으로 이어진 사례를 선택하세요." },
      { title: "복잡한 정보를 구조화하기", description: "여러 조건을 비교해 우선순위를 정한 과정을 명료하게 설명하세요." },
      { title: "실행이 느린 인상 피하기", description: "완벽한 답을 기다리지 않고 정한 마감 안에 움직인 경험을 준비하세요." },
    ],
  },
  principle: {
    color: "#bd895e",
    heroSummary: "작은 실수도 놓치지 않는 꼼꼼한 타입",
    description: "규칙과 원칙, 빠진 조건을 중요하게 보는 타입이에요. 작은 오류도 그냥 넘기지 않고 다시 확인하며 정확성과 신뢰가 중요한 일에서 강점을 발휘합니다.",
    tips: [
      { title: "정확성을 성과로 연결하기", description: "검토를 통해 오류와 비용을 줄인 구체적인 결과를 보여주세요." },
      { title: "중요 기준부터 점검하기", description: "위험도가 큰 조건을 먼저 확인한 방식으로 효율도 함께 설명하세요." },
      { title: "융통성 없는 인상 피하기", description: "상황에 맞게 절차를 조정하되 핵심 기준을 유지한 경험이 좋아요." },
    ],
  },
  flexibility: {
    color: "#0b778b",
    heroSummary: "어떤 상황에도 부드럽게 적응하는 타입",
    description: "계획대로 되지 않아도 멈추기보다 그때그때 가능한 방법을 찾는 타입이에요. 기존 기준에만 묶이지 않고 상황을 읽으며 현실적인 선택지를 조정합니다.",
    tips: [
      { title: "변화 대응 과정을 구조화하기", description: "상황 파악, 대안 선택, 결과 확인의 순서로 사례를 설명하세요." },
      { title: "현실적인 대안 찾기", description: "제약 안에서 목표를 지키며 방법을 바꾼 경험을 보여주세요." },
      { title: "기준 없는 인상 피하기", description: "유연하게 바꾸더라도 반드시 지킨 품질과 원칙을 함께 말하세요." },
    ],
  },
};

const POINT_TITLES: Record<DiagnosisTypeCode, [string, string, string, string]> = {
  stability: ["책임감", "꼼꼼함", "지속력", "새로운 시도에 신중한 편"],
  challenge: ["도전성", "추진력", "적응력", "기준 세우기"],
  teamwork: ["협업력", "조율력", "공감력", "독립 판단 연습"],
  individual: ["몰입력", "자기주도", "분석력", "중간 공유 늘리기"],
  execution: ["실행력", "속도감", "문제 해결", "확인 습관 만들기"],
  planning: ["기획력", "구조화", "판단력", "빠른 실행 연습"],
  principle: ["정확성", "신뢰성", "관리력", "유연한 대안 찾기"],
  flexibility: ["유연성", "대응력", "적응력", "일관된 기준 세우기"],
};

export function DiagnosisResultDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedResultId = searchParams.get("resultId") || undefined;
  const [detail, setDetail] = useState<DiagnosisResultDetailResponseDto | null>(null);
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<DiagnosisResultHistoryItemDto[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState("공유하고 코칭 받기 →");
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getCurrentUser(),
      getDiagnosisResultDetail(selectedResultId),
      getHomeJobs().catch(() => null),
    ])
      .then(([userResponse, resultResponse, homeResponse]) => {
        if (!active) return;
        setUser(userResponse.user);
        setDetail(resultResponse);
        setBookmarkCount(homeResponse?.bookmarkCount ?? 0);
        setError(null);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "진단 결과를 불러오지 못했습니다."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [selectedResultId]);

  const loadHistory = useCallback(async (cursor?: string) => {
    setHistoryLoading(true);
    try {
      const response = await getDiagnosisResultHistory(cursor);
      const currentItem = detail
        ? {
            resultId: detail.result.resultId,
            runId: detail.result.runId,
            typeCode: detail.result.typeCode,
            typeName: detail.result.typeName,
            completedAt: detail.completedAt,
          }
        : null;
      const responseItems = currentItem && !cursor
        ? response.items.filter((item) => item.resultId !== currentItem.resultId)
        : response.items;
      const nextItems = !cursor && currentItem
        ? [currentItem, ...responseItems]
        : responseItems;
      setHistory((current) => cursor
        ? [...current, ...nextItems.filter((item) => !current.some((saved) => saved.resultId === item.resultId))]
        : nextItems);
      setHistoryCursor(response.nextCursor);
    } finally {
      setHistoryLoading(false);
    }
  }, [detail]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!historyOpen || !sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && historyCursor && !historyLoading) void loadHistory(historyCursor);
    }, { rootMargin: "160px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historyCursor, historyLoading, historyOpen, loadHistory]);

  const nickname = user?.nickname || user?.displayName || "회원";
  const points = useMemo(() => {
    if (!detail) return [];
    const titles = POINT_TITLES[detail.result.typeCode];
    return [
      ...detail.result.strengths.slice(0, 3).map((text, index) => ({ title: titles[index], text, growth: false })),
      { title: titles[3], text: detail.result.growthPoints[0] || "강점을 유지하면서 보완할 기준을 하나 정해보세요.", growth: true },
    ];
  }, [detail]);

  if (loading) return <ResultState message="진단 결과를 불러오고 있어요." />;
  if (!detail || error) return <ResultState message={error || "진단 결과가 없습니다."} />;

  const { result } = detail;
  const copy = TYPE_COPY[result.typeCode];
  const maxHiringCount = Math.max(1, ...detail.monthlyHiring.categories.map((item) => item.count));
  const recommendedJobsHref = `/jobs?view=recommended&scope=monthly-regular&resultId=${encodeURIComponent(result.resultId)}`;

  const openHistory = () => {
    setHistoryOpen(true);
    if (!history.length && !historyLoading) void loadHistory();
  };

  const shareResult = async () => {
    const shareData = { title: `${nickname}님의 공부엉이 진단 결과`, text: `나의 강점·성향 유형은 ${result.typeName}이에요.`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(window.location.href);
      setShareMessage("공유 완료!");
      window.setTimeout(() => setShareMessage("공유하고 코칭 받기 →"), 1600);
    } catch {
      setShareMessage("다시 시도해 주세요");
    }
  };

  return (
    <main className={styles.page}>
      <article className={styles.frame}>
        <JobHeader user={user} nickname={nickname} bookmarkCount={bookmarkCount} />

        <div className={styles.resultBody}>
          <h1 className={styles.pageTitle}>
            <Image src="/diagnosis/result-detail/title-icon.png" alt="" width={29} height={26} />
            강점·성향 진단 결과
          </h1>

          <section className={styles.hero} style={{ backgroundColor: copy.color }}>
            <p>{nickname}님의 강점·성향 유형은</p>
            <h2>{result.typeName}</h2>
            <span>{copy.heroSummary}</span>
            <Image
              src={`/home/result-types/${result.typeCode}.png`}
              alt=""
              width={190}
              height={132}
              priority
              className={`${styles.heroImage} ${styles[`heroImage_${result.typeCode}`]}`}
            />
          </section>

          <section className={styles.personSection}>
            <h2><FigmaSectionIcon kind="person" />{nickname}님은 이런 사람이에요</h2>
            <p>{copy.description}</p>
          </section>

          <section className={styles.section}>
            <h2><FigmaSectionIcon kind="analysis" />나의 성향 분석</h2>
            <p className={styles.sectionCaption}>4가지 축으로 본 {nickname}님의 성향이에요.</p>
            <div className={styles.axisList}>
              {result.axisResults.map((axis) => (
                <div className={styles.axisItem} key={axis.code}>
                  <div><strong>{axis.leftLabel} <i>↔ {axis.rightLabel}</i></strong><b>{axis.percent}%</b></div>
                  <span><i style={{ width: `${axis.percent}%` }} /></span>
                </div>
              ))}
            </div>
            {detail.percentile.topPercent == null ? (
              <div className={styles.percentilePending}>
                가입 사용자 데이터가 쌓이면 성향 순위를 알려드려요.
              </div>
            ) : (
              <div className={styles.percentile}>
                <span>{nickname}님의 {detail.percentile.traitLabel} 은(는)</span>
                <strong>상위 <b>{detail.percentile.topPercent}</b>%</strong>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2><FigmaSectionIcon kind="strength" />강점과 성장 포인트</h2>
            <p className={styles.sectionCaption}>{nickname}님이 잘하는 것과, 조금만 신경 쓰면 좋을 것</p>
            <div className={styles.pointList}>
              {points.map((point, index) => (
                <article className={point.growth ? styles.growthCard : styles.pointCard} key={point.title}>
                  <span aria-hidden="true">
                    <Image
                      src={point.growth ? "/diagnosis/result-detail/growth.svg" : `/diagnosis/result-detail/strength-${index + 1}.svg`}
                      alt=""
                      width={30}
                      height={39}
                    />
                  </span>
                  <div><strong>{point.title}</strong><p>{point.text}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.shareTicket}>
            <Image src="/diagnosis/result-detail/gift.png" alt="" width={84} height={89} />
            <div><strong>결과를 공유하고 <em>AI 자소서 코칭</em><br />무료 티켓을 받으세요.</strong><button type="button" onClick={shareResult}>{shareMessage}</button></div>
          </section>

          <section className={styles.section}>
            <h2><FigmaSectionIcon kind="tips" />{result.typeName} 취업 팁</h2>
            <p className={styles.sectionCaption}>{nickname}님 유형의 강점은 살리고, 약점은 보완하는 법이에요.</p>
            <div className={styles.tipList}>
              {copy.tips.map((tip, index) => (
                <article key={tip.title}>
                  <span>{index < 2 ? "강점 살리기" : "약점 보완하기"}</span>
                  <strong>{tip.title}</strong>
                  <p>{tip.description}</p>
                </article>
              ))}
            </div>
            <div className={styles.tipNotice}><span aria-hidden="true">💬</span><p><strong>이 팁은 {nickname}님 유형에 대한 조언이에요.</strong><br />지원할 회사·직무별 맞춤 전략은 자소서 코칭에서 내 유형과 함께 분석해드려요.</p></div>
            <button type="button" className={styles.coachingButton}>내 유형 + 지원 회사로 자소서 코칭 받기 →</button>
          </section>

          <section className={styles.section}>
            <h2><FigmaSectionIcon kind="jobs" />이런 직무·기업에 강해요</h2>
            <p className={styles.sectionCaption}>{result.typeName}과 잘 맞는 직무와 공기업이에요.</p>
            <h3>{nickname}님에게 어울리는 직무</h3>
            <div className={styles.jobChips}>{result.jobCategories.slice(0, 6).map((category) => <span key={category.name}>{category.name}</span>)}</div>
            <h3>{nickname}님에게 어울리는 공고</h3>
            <div className={styles.postingList}>
              {detail.recommendedPostings.map((posting) => <RecommendedPosting key={posting.id} posting={posting} />)}
              {!detail.recommendedPostings.length && detail.companies.map((company) => <article className={styles.companyFallback} key={company.id}><strong>{company.name}</strong></article>)}
              {!detail.recommendedPostings.length && !detail.companies.length ? <p className={styles.empty}>현재 모집 중인 추천 공고가 없어요.</p> : null}
            </div>
          </section>

          <section className={styles.section}>
            <h2><FigmaSectionIcon kind="hiring" />{result.typeName} 맞춤 채용 현황</h2>
            <p className={styles.sectionCaption}>이번 달 {nickname}님 유형에 맞는 정규직 채용을 모았어요.</p>
            <div className={styles.hiringTotal}>
              <div><span>이번 달 맞춤 정규직 채용</span><small>{detail.monthlyHiring.month}월 기준 · {detail.monthlyHiring.primaryCategory} 계열 중심</small></div>
              <strong>{detail.monthlyHiring.totalCount.toLocaleString("ko-KR")}<small>건</small></strong>
            </div>
            <div className={styles.hiringBars}>
              {detail.monthlyHiring.categories.map((category) => (
                <div key={category.name}><strong>{category.name}</strong><i><b style={{ width: `${(category.count / maxHiringCount) * 100}%` }} /></i><span>{category.count}</span></div>
              ))}
            </div>
          </section>

          <div className={styles.actions}>
            <Link className={styles.recommendedJobsButton} href={recommendedJobsHref}>{result.typeName} 맞춤 공고 보러가기 →</Link>
            {detail.previousResultCount > 0 ? (
              <button type="button" className={styles.historyButton} onClick={openHistory}>이전 결과로 맞춤 공고 받기 →</button>
            ) : null}
            <button type="button" className={styles.shareButton} onClick={shareResult}>공유하고 자소서 코칭 티켓 받기!</button>
          </div>
        </div>

        <JobFooter active="ai" />
      </article>

      {historyOpen ? (
        <div className={styles.historyOverlay} role="dialog" aria-modal="true" aria-label="이전 진단 결과">
          <button className={styles.historyBackdrop} type="button" onClick={() => setHistoryOpen(false)} aria-label="닫기" />
          <section className={styles.historySheet}>
            <header><h2>강점·성향 진단 결과</h2><button type="button" onClick={() => setHistoryOpen(false)} aria-label="닫기">×</button></header>
            <div className={styles.historyList}>
              {history.map((item) => (
                <button type="button" key={item.resultId} className={item.resultId === result.resultId ? styles.selectedHistory : ""} onClick={async () => {
                  setHistoryOpen(false);
                  await selectDiagnosisResult(item.resultId);
                  router.replace(`/ai-tools/diagnosis/result?resultId=${encodeURIComponent(item.resultId)}`);
                }}>
                  <span><strong>{item.typeName}</strong><time>{formatDate(item.completedAt)}</time></span><i aria-hidden="true" />
                </button>
              ))}
              <div ref={sentinelRef} className={styles.sentinel}>{historyLoading ? "이전 결과를 불러오는 중..." : null}</div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

type FigmaSectionIconKind = "person" | "analysis" | "strength" | "tips" | "jobs" | "hiring";

function FigmaSectionIcon({ kind }: { kind: FigmaSectionIconKind }) {
  return <span className={`${styles.figmaSectionIcon} ${styles[`figmaSectionIcon_${kind}`]}`} aria-hidden="true" />;
}

function RecommendedPosting({ posting }: { posting: DiagnosisResultDetailResponseDto["recommendedPostings"][number] }) {
  const ddayClass = posting.dday === "D-1" || posting.dday === "D-Day" ? styles.ddayUrgent : posting.dday === "D-2" ? styles.ddaySoon : styles.ddayNormal;
  return (
    <Link href={`/jobs/${posting.id}`} className={styles.postingCard}>
      <small>{posting.institutionName}</small>
      <strong>{posting.title}</strong>
      <div className={styles.postingBadges}>
        {[posting.employmentType, posting.region, posting.careerRequirement].filter(Boolean).map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className={styles.postingMeta}><time>{posting.applicationEndAt ? `~ ${formatPostingDate(posting.applicationEndAt)}` : "상시 채용"}</time><b className={ddayClass}>{posting.dday}</b><i aria-hidden="true"><Image src="/diagnosis/result-detail/bookmark.svg" alt="" width={25} height={25} /></i></div>
    </Link>
  );
}

function ResultState({ message }: { message: string }) {
  return <main className={styles.page}><section className={styles.state}><p>{message}</p><Link href="/ai-tools/diagnosis">진단 화면으로 이동</Link></section></main>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatPostingDate(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return `${valueOf("year")}. ${valueOf("month")}. ${valueOf("day")}(${valueOf("weekday")})`;
}
