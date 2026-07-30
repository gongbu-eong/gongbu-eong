"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getDiagnosisResultDetail,
  getDiagnosisResultHistory,
} from "../diagnosis.api";
import type {
  DiagnosisResultDetailResponseDto,
  DiagnosisResultHistoryItemDto,
  DiagnosisTypeCode,
} from "../diagnosis.dto";
import { getCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import {
  AiIcon,
  CalendarIcon,
  CommunityIcon,
  HomeIcon,
  MyIcon,
} from "@/features/home/components/HomeMain";
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
    description:
      "정해진 기준과 절차가 명확할 때 집중력이 살아나는 타입이에요. 계획을 꾸준히 지키고, 갑작스러운 변화보다 검증된 방식으로 안정적인 결과를 만드는 데 강합니다.",
    tips: [
      { title: "'꾸준함'을 스토리로 만들기", description: "장기간 목표를 지키며 성과를 만든 과정을 기간과 결과로 보여주세요." },
      { title: "책임감·정확성을 근거로 보여주기", description: "실수를 줄이고 신뢰를 만든 구체적인 확인 습관을 사례로 준비하세요." },
      { title: "'소극적' 인상 주지 않기", description: "안정적인 실행 속에서도 먼저 제안하거나 개선한 경험을 함께 설명하세요." },
    ],
  },
  challenge: {
    color: "#f3a427",
    heroSummary: "빠르게 부딪히며 성장하는 타입",
    description:
      "낯선 방식이나 높은 목표 앞에서 움츠러들기보다 먼저 시도해보는 타입이에요. 실패 가능성이 있어도 성장 가능성이 보이면 빠르게 움직이며 경험으로 방향을 잡습니다.",
    tips: [
      { title: "시도를 성과로 연결하기", description: "새로운 도전 자체보다 무엇을 바꾸고 어떤 결과를 냈는지 말해보세요." },
      { title: "위험 관리 과정 보여주기", description: "도전 전에 확인한 기준과 실패 비용을 줄인 방법을 함께 설명하세요." },
      { title: "완주 경험 강조하기", description: "빠른 시작뿐 아니라 끝까지 마무리한 사례로 실행의 신뢰를 더하세요." },
    ],
  },
  teamwork: {
    color: "#a154e5",
    heroSummary: "함께 맞춰가며 성과를 내는 타입",
    description:
      "혼자 밀어붙이기보다 주변과 방향을 맞추고 역할을 나눌 때 강점이 살아나는 타입이에요. 협의와 피드백을 통해 안정적인 결론을 만들고 관계 안에서 성과를 냅니다.",
    tips: [
      { title: "조율의 결과를 수치로 말하기", description: "협업으로 일정, 품질, 만족도가 어떻게 좋아졌는지 보여주세요." },
      { title: "내 책임 범위 분명히 하기", description: "팀 성과 안에서 본인이 맡고 완수한 역할을 구체적으로 구분하세요." },
      { title: "갈등 해결 사례 준비하기", description: "의견 차이를 듣고 기준을 세워 합의한 경험을 정리해두세요." },
    ],
  },
  individual: {
    color: "#e85759",
    heroSummary: "몰입해서 완성도를 높이는 타입",
    description:
      "스스로 몰입할 시간이 있을 때 결과가 좋아지는 타입이에요. 독립적으로 기준을 세우고 깊게 파고들며, 방해가 적은 환경에서 집중력이 살아납니다.",
    tips: [
      { title: "깊이 있는 결과물 제시하기", description: "혼자 집중해 완성도를 높인 산출물과 개선 전후를 보여주세요." },
      { title: "소통 체크포인트 만들기", description: "독립적으로 일하되 중간 공유로 방향을 확인한 방식을 설명하세요." },
      { title: "도움 요청 시점 정하기", description: "막힘을 오래 끌지 않고 필요한 정보를 요청한 경험을 준비하세요." },
    ],
  },
  execution: {
    color: "#5bbf47",
    heroSummary: "먼저 움직이며 길을 찾는 타입",
    description:
      "완벽한 계획을 기다리기보다 작은 행동으로 시작하며 방향을 잡는 타입이에요. 해야 할 일이 보이면 빠르게 움직이고 실행 과정에서 필요한 정보를 보완해갑니다.",
    tips: [
      { title: "행동 속도를 결과로 증명하기", description: "빠른 착수로 일정이나 고객 반응을 개선한 사례를 준비하세요." },
      { title: "우선순위 기준 말하기", description: "무엇부터 실행했는지 판단 기준을 설명하면 추진력이 더 설득력 있어요." },
      { title: "성급한 실수 예방하기", description: "실행 전 반드시 확인하는 최소 체크리스트를 함께 보여주세요." },
    ],
  },
  planning: {
    color: "#6a7e92",
    heroSummary: "계획으로 합격 가능성을 높이는 타입",
    description:
      "시작 전 목표와 기준, 순서를 정리해야 힘이 나는 타입이에요. 정보를 비교하고 가능성을 분석해 우선순위를 세우며 복잡한 상황을 구조화하는 데 강합니다.",
    tips: [
      { title: "계획이 실행된 장면 보여주기", description: "분석에서 끝나지 않고 일정과 행동으로 이어진 사례를 선택하세요." },
      { title: "마감 기준 먼저 정하기", description: "충분한 검토와 적시 실행을 함께 지킨 방법을 설명하세요." },
      { title: "핵심을 짧게 전달하기", description: "복잡한 정보를 의사결정자가 이해하기 쉽게 요약한 경험을 준비하세요." },
    ],
  },
  principle: {
    color: "#bd895e",
    heroSummary: "정확하게 확인하며 실수를 줄이는 타입",
    description:
      "규칙과 원칙, 빠진 조건을 중요하게 보는 타입이에요. 작은 오류도 그냥 넘기지 않고 다시 확인하며 정확성과 신뢰가 중요한 일에서 강점을 발휘합니다.",
    tips: [
      { title: "정확성과 효율을 함께 보여주기", description: "검토 품질을 유지하면서 시간을 줄인 개선 사례를 준비하세요." },
      { title: "중요 기준부터 점검하기", description: "모든 항목이 아니라 위험도가 큰 조건을 우선 확인한 방식을 말해보세요." },
      { title: "변화 속 원칙 설명하기", description: "상황에 맞게 절차를 조정하되 지켜야 할 기준을 유지한 경험이 좋아요." },
    ],
  },
  flexibility: {
    color: "#0b778b",
    heroSummary: "상황에 맞춰 유연하게 돌파하는 타입",
    description:
      "계획대로 되지 않아도 멈추기보다 그때그때 가능한 방법을 찾는 타입이에요. 기존 기준에만 묶이지 않고 상황을 읽으며 현실적인 선택지를 조정합니다.",
    tips: [
      { title: "변화 대응 과정을 구조화하기", description: "상황 파악, 대안 선택, 결과 확인의 순서로 사례를 설명하세요." },
      { title: "최소 기준 세우기", description: "유연하게 바꾸더라도 반드시 지킨 품질과 원칙을 함께 보여주세요." },
      { title: "결정 근거 기록하기", description: "빠르게 조정한 이유와 결과를 남겨 다음 판단에 활용한 경험이 좋아요." },
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
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getCurrentUser(), getDiagnosisResultDetail(selectedResultId)])
      .then(([userResponse, resultResponse]) => {
        if (!active) return;
        setUser(userResponse.user);
        setDetail(resultResponse);
        setError(null);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "진단 결과를 불러오지 못했습니다.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [selectedResultId]);

  const loadHistory = useCallback(async (cursor?: string) => {
    setHistoryLoading(true);
    try {
      const response = await getDiagnosisResultHistory(cursor);
      setHistory((current) =>
        cursor
          ? [...current, ...response.items.filter((item) => !current.some((saved) => saved.resultId === item.resultId))]
          : response.items,
      );
      setHistoryCursor(response.nextCursor);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!historyOpen || !sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && historyCursor && !historyLoading) {
        void loadHistory(historyCursor);
      }
    }, { rootMargin: "160px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historyCursor, historyLoading, historyOpen, loadHistory]);

  const nickname = user?.nickname || user?.displayName || "회원";
  const openHistory = () => {
    setHistoryOpen(true);
    if (!history.length && !historyLoading) {
      void loadHistory();
    }
  };
  const points = useMemo(() => {
    if (!detail) return [];
    const titles = POINT_TITLES[detail.result.typeCode];
    return [
      ...detail.result.strengths.slice(0, 3).map((text, index) => ({
        title: titles[index],
        text,
        growth: false,
      })),
      {
        title: titles[3],
        text: detail.result.growthPoints[0] || "강점을 유지하면서 보완할 기준을 하나 정해보세요.",
        growth: true,
      },
    ];
  }, [detail]);

  if (loading) {
    return <ResultState message="진단 결과를 불러오고 있어요." />;
  }

  if (!detail || error) {
    return <ResultState message={error || "진단 결과가 없습니다."} />;
  }

  const { result } = detail;
  const copy = TYPE_COPY[result.typeCode];
  const maxHiringCount = Math.max(1, ...detail.monthlyHiring.categories.map((item) => item.count));
  const recommendedJobsHref = `/jobs?view=recommended&resultId=${encodeURIComponent(result.resultId)}`;

  return (
    <main className={styles.page}>
      <article className={styles.frame}>
        <header className={styles.header}>
          <button type="button" onClick={() => router.back()} aria-label="뒤로 가기">‹</button>
          <h1>강점·성향 진단 결과</h1>
          <span aria-hidden="true" />
        </header>

        <section className={styles.hero} style={{ backgroundColor: copy.color }}>
          <p>{nickname}님의 강점·성향 유형은</p>
          <h2>{result.typeName}</h2>
          <span>{copy.heroSummary}</span>
          <Image
            src={`/home/result-types/${result.typeCode}.png`}
            alt=""
            width={260}
            height={260}
            priority
            className={styles.heroImage}
          />
        </section>

        <div className={styles.content}>
          <section className={styles.personSection}>
            <h2>🔎 {nickname}님은 이런 사람이에요</h2>
            <p>{copy.description}</p>
          </section>

          <section className={styles.section}>
            <h2>📊 나의 성향 분석</h2>
            <p className={styles.sectionCaption}>4가지 축으로 본 {nickname}님의 성향이에요.</p>
            <div className={styles.axisList}>
              {result.axisResults.map((axis) => (
                <div className={styles.axisItem} key={axis.code}>
                  <div>
                    <strong>{axis.leftLabel} <i>↔ {axis.rightLabel}</i></strong>
                    <b>{axis.percent}%</b>
                  </div>
                  <span><i style={{ width: `${axis.percent}%` }} /></span>
                </div>
              ))}
            </div>
            <div className={styles.percentile}>
              <span>{nickname}님의 {detail.percentile.traitLabel}은</span>
              <strong>상위 {detail.percentile.topPercent}%</strong>
            </div>
          </section>

          <section className={styles.section}>
            <h2>💪 강점과 성장 포인트</h2>
            <p className={styles.sectionCaption}>강점은 살리고, 성장 포인트는 하나씩 보완해보세요.</p>
            <div className={styles.pointList}>
              {points.map((point) => (
                <article className={point.growth ? styles.growthCard : styles.pointCard} key={point.title}>
                  <span>{point.growth ? "🌱" : "☘️"}</span>
                  <div><strong>{point.title}</strong><p>{point.text}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2>🎓 {result.typeName} 취업 팁</h2>
            <p className={styles.sectionCaption}>{nickname}님 유형의 강점은 살리고, 약점은 보완하는 법이에요.</p>
            <div className={styles.tipList}>
              {copy.tips.map((tip, index) => (
                <article key={tip.title}>
                  <span>{index + 1}</span>
                  <div><strong>{tip.title}</strong><p>{tip.description}</p></div>
                </article>
              ))}
            </div>
            <button type="button" className={styles.coachingButton} disabled>
              내 유형 + 지원회사로 자소서 코칭 받기 →
            </button>
          </section>

          <section className={styles.section}>
            <h2>🎯 이런 직무·기업에 강해요</h2>
            <p className={styles.sectionCaption}>{result.typeName}과 잘 맞는 직무와 공기업이에요.</p>
            <h3>{nickname}님에게 어울리는 직무</h3>
            <div className={styles.jobChips}>
              {result.jobCategories.map((category) => <span key={category.name}>{category.name}</span>)}
            </div>
            <h3>{nickname}님에게 어울리는 기업</h3>
            <div className={styles.companyList}>
              {detail.companies.map((company) => (
                <article key={company.id}><strong>{company.name}</strong></article>
              ))}
              {!detail.companies.length ? <p className={styles.empty}>현재 모집 중인 추천 기업이 없어요.</p> : null}
            </div>
          </section>

          <section className={styles.section}>
            <h2>📈 {result.typeName} 맞춤 채용 현황</h2>
            <p className={styles.sectionCaption}>이번 달 {nickname}님 유형에 맞는 채용을 모았어요.</p>
            <div className={styles.hiringTotal}>
              <span>이번 달 맞춤 채용</span>
              <strong>{detail.monthlyHiring.totalCount.toLocaleString("ko-KR")}건</strong>
              <small>{detail.monthlyHiring.month}월 기준 · {detail.monthlyHiring.primaryCategory} 계열 중심</small>
            </div>
            <div className={styles.hiringBars}>
              {detail.monthlyHiring.categories.map((category) => (
                <div key={category.name}>
                  <span><strong>{category.name}</strong><b>{category.count}건</b></span>
                  <i><b style={{ width: `${(category.count / maxHiringCount) * 100}%` }} /></i>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.actions}>
            <Link href={recommendedJobsHref}>{result.typeName} 맞춤 공고 보러가기 →</Link>
            <button type="button" onClick={openHistory}>이전 결과로 맞춤 공고 받기 →</button>
          </div>
        </div>

        <ResultFooter />
      </article>

      {historyOpen ? (
        <div className={styles.historyOverlay} role="dialog" aria-modal="true" aria-label="이전 진단 결과">
          <button className={styles.historyBackdrop} type="button" onClick={() => setHistoryOpen(false)} aria-label="닫기" />
          <section className={styles.historySheet}>
            <header>
              <h2>강점·성향 진단 결과</h2>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="닫기">×</button>
            </header>
            <div className={styles.historyList}>
              {history.map((item) => (
                <button
                  type="button"
                  key={item.resultId}
                  className={item.resultId === result.resultId ? styles.selectedHistory : ""}
                  onClick={() => {
                    setHistoryOpen(false);
                    router.replace(`/ai-tools/diagnosis/result?resultId=${encodeURIComponent(item.resultId)}`);
                  }}
                >
                  <span><strong>{item.typeName}</strong><time>{formatDate(item.completedAt)}</time></span>
                  <i aria-hidden="true" />
                </button>
              ))}
              <div ref={sentinelRef} className={styles.sentinel}>
                {historyLoading ? "이전 결과를 불러오는 중..." : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ResultFooter() {
  return (
    <footer className={styles.footer}>
      <Link href="/"><HomeIcon /><span>홈</span></Link>
      <Link href="#"><CalendarIcon /><span>캘린더</span></Link>
      <Link href="/ai-tools/diagnosis" className={styles.active}><AiIcon /><span>AI 도구</span></Link>
      <Link href="#"><CommunityIcon /><span>커뮤니티</span></Link>
      <Link href="#"><MyIcon /><span>MY</span></Link>
    </footer>
  );
}

function ResultState({ message }: { message: string }) {
  return (
    <main className={styles.page}>
      <section className={styles.state}>
        <p>{message}</p>
        <Link href="/ai-tools/diagnosis">진단 화면으로 이동</Link>
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
