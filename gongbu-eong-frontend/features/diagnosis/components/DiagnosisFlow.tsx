"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import {
  getDiagnosisQuestions,
  getDiagnosisStats,
  submitDiagnosis,
} from "../diagnosis.api";
import {
  DiagnosisAnswerRequestDto,
  DiagnosisQuestionDto,
  DiagnosisResultResponseDto,
} from "../diagnosis.dto";
import { getAnonymousId } from "@/shared/session/anonymous-id";
import styles from "./DiagnosisFlow.module.css";

type FlowState =
  | { status: "intro" }
  | { status: "loading" }
  | { status: "survey"; questions: DiagnosisQuestionDto[]; index: number }
  | { status: "submitting"; questions: DiagnosisQuestionDto[]; index: number }
  | { status: "result"; result: DiagnosisResultResponseDto }
  | { status: "error"; message: string };

const RESULT_TYPE_DETAILS: Record<
  DiagnosisResultResponseDto["typeCode"],
  {
    heroSummary: string;
    personTitle: string;
    personDescription: string;
  }
> = {
  stability: {
    heroSummary: "묵묵히 준비해 결국 붙는 타입",
    personTitle: "안정 추구형은 이런 사람이에요",
    personDescription:
      "정해진 기준과 절차가 명확할 때 집중력이 살아나는 타입이에요. 계획을 꾸준히 지키고, 갑작스러운 변화보다 검증된 방식으로 안정적인 결과를 만드는 데 강합니다.",
  },
  challenge: {
    heroSummary: "빠르게 부딪히며 성장하는 타입",
    personTitle: "도전 개척형은 이런 사람이에요",
    personDescription:
      "낯선 방식이나 높은 목표 앞에서 움츠러들기보다 먼저 시도해보는 타입이에요. 실패 가능성이 있어도 성장 가능성이 보이면 빠르게 움직이며 경험으로 방향을 잡습니다.",
  },
  teamwork: {
    heroSummary: "함께 맞춰가며 성과를 내는 타입",
    personTitle: "협업 조력형은 이런 사람이에요",
    personDescription:
      "혼자 밀어붙이기보다 주변과 방향을 맞추고 역할을 나눌 때 강점이 살아나는 타입이에요. 협의와 피드백을 통해 안정적인 결론을 만들고 관계 안에서 성과를 냅니다.",
  },
  individual: {
    heroSummary: "몰입해서 완성도를 높이는 타입",
    personTitle: "독립 몰입형은 이런 사람이에요",
    personDescription:
      "여러 사람과 계속 맞추기보다 스스로 몰입할 시간이 있을 때 결과가 좋아지는 타입이에요. 독립적으로 기준을 세우고 깊게 파고들며, 방해가 적은 환경에서 집중력이 살아납니다.",
  },
  execution: {
    heroSummary: "먼저 움직이며 길을 찾는 타입",
    personTitle: "실행 추진형은 이런 사람이에요",
    personDescription:
      "완벽한 계획을 기다리기보다 작은 행동으로 시작하며 방향을 잡는 타입이에요. 해야 할 일이 보이면 빠르게 움직이고, 실행 과정에서 필요한 정보를 보완해갑니다.",
  },
  planning: {
    heroSummary: "계획으로 합격 가능성을 높이는 타입",
    personTitle: "전략 기획형은 이런 사람이에요",
    personDescription:
      "시작 전 목표와 기준, 순서를 정리해야 힘이 나는 타입이에요. 정보를 비교하고 가능성을 분석해 우선순위를 세우며, 복잡한 상황을 구조화하는 데 강합니다.",
  },
  principle: {
    heroSummary: "정확하게 확인하며 실수를 줄이는 타입",
    personTitle: "정밀 관리형은 이런 사람이에요",
    personDescription:
      "규칙과 원칙, 빠진 조건을 중요하게 보는 타입이에요. 작은 오류도 그냥 넘기지 않고 다시 확인하며, 정확성과 신뢰가 중요한 일에서 강점을 발휘합니다.",
  },
  flexibility: {
    heroSummary: "상황에 맞춰 유연하게 돌파하는 타입",
    personTitle: "유연 대응형은 이런 사람이에요",
    personDescription:
      "계획대로 되지 않아도 멈추기보다 그때그때 가능한 방법을 찾는 타입이에요. 기존 기준에만 묶이지 않고 상황을 읽으며 현실적인 선택지를 조정합니다.",
  },
};

export function DiagnosisFlow() {
  const [state, setState] = useState<FlowState>({ status: "intro" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [participantCount, setParticipantCount] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;

    getDiagnosisStats()
      .then((stats) => {
        if (!ignore) {
          setParticipantCount(stats.participantCount);
        }
      })
      .catch(() => {
        if (!ignore) {
          setParticipantCount(0);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  async function startSurvey() {
    setAnswers({});
    setState({ status: "loading" });

    try {
      const response = await getDiagnosisQuestions();
      setState({ status: "survey", questions: response.questions, index: 0 });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "진단 문항을 불러오지 못했어요.",
      });
    }
  }

  async function submit(
    questions: DiagnosisQuestionDto[],
    resolvedAnswers = answers,
  ) {
    const payload: DiagnosisAnswerRequestDto[] = questions.map((question) => ({
      questionId: question.id,
      optionId: resolvedAnswers[question.id],
    }));

    setState({ status: "submitting", questions, index: questions.length - 1 });

    try {
      setState({ status: "result", result: await submitDiagnosis(payload) });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "진단 결과를 저장하지 못했어요.",
      });
    }
  }

  function selectOption(args: {
    questions: DiagnosisQuestionDto[];
    question: DiagnosisQuestionDto;
    optionId: string;
    index: number;
  }) {
    const preservedQuestionIds = new Set(
      args.questions.slice(0, args.index).map((question) => question.id),
    );
    const nextAnswers = {
      ...Object.fromEntries(
        Object.entries(answers).filter(([questionId]) =>
          preservedQuestionIds.has(questionId),
        ),
      ),
      [args.question.id]: args.optionId,
    };

    setAnswers(nextAnswers);

    window.setTimeout(() => {
      if (args.index === args.questions.length - 1) {
        submit(args.questions, nextAnswers);
        return;
      }

      setState({
        status: "survey",
        questions: args.questions,
        index: args.index + 1,
      });
    }, 240);
  }

  function goBack(questions: DiagnosisQuestionDto[], index: number) {
    if (index === 0) {
      return;
    }

    const nextIndex = index - 1;

    setState({
      status: "survey",
      questions,
      index: nextIndex,
    });
  }

  if (state.status === "intro") {
    return (
      <DiagnosisIntro
        participantCount={participantCount}
        onStart={startSurvey}
      />
    );
  }

  if (state.status === "loading") {
    return <MobileFrame>문항을 불러오는 중입니다...</MobileFrame>;
  }

  if (state.status === "error") {
    return (
      <MobileFrame>
        <p className="text-lg font-semibold text-red-700">진행할 수 없어요</p>
        <p className="mt-2 text-sm text-zinc-600">{state.message}</p>
        <button
          className="mt-6 w-full rounded bg-blue-600 px-4 py-3 font-semibold text-white"
          onClick={startSurvey}
        >
          다시 시도하기
        </button>
      </MobileFrame>
    );
  }

  if (state.status === "result") {
    return (
      <DiagnosisResult
        result={state.result}
      />
    );
  }

  const currentQuestion = state.questions[state.index];

  return (
    <DiagnosisSurvey
      currentQuestion={currentQuestion}
      index={state.index}
      questionCount={state.questions.length}
      selectedOptionId={answers[currentQuestion.id]}
      onBack={() => goBack(state.questions, state.index)}
      onSelect={(optionId) =>
        selectOption({
          questions: state.questions,
          question: currentQuestion,
          optionId,
          index: state.index,
        })
      }
    />
  );
}

function DiagnosisIntro({
  participantCount,
  onStart,
}: {
  participantCount: number | null;
  onStart: () => void;
}) {
  const participantText =
    participantCount === null
      ? "참여 인원을 불러오는 중이에요."
      : `지금까지 ${participantCount.toLocaleString("ko-KR")}명이 참여했어요.`;

  return (
    <div className={styles.page}>
      <section className={styles.landing} aria-label="강점·성향 진단 도입부">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis-landing-v2.svg"
          alt="공부엉이 강점·성향 진단 도입 화면"
          className={styles.landingImage}
          draggable={false}
        />
        <button
          className={styles.startButton}
          onClick={onStart}
          aria-label="진단 시작하기"
        >
          <span className={styles.startButtonStrong}>진단 시작하기</span>
          <span className={styles.startButtonSub}>{participantText}</span>
        </button>
        <button
          className={styles.shareButton}
          type="button"
          onClick={() => {
            navigator.share?.({
              title: "공부엉이 강점·성향 진단",
              url: window.location.href,
            });
          }}
          aria-label="테스트 공유하기"
        />
      </section>
    </div>
  );
}

function DiagnosisSurvey({
  currentQuestion,
  index,
  questionCount,
  selectedOptionId,
  onBack,
  onSelect,
}: {
  currentQuestion: DiagnosisQuestionDto;
  index: number;
  questionCount: number;
  selectedOptionId?: string;
  onBack: () => void;
  onSelect: (optionId: string) => void;
}) {
  const progressPercent =
    questionCount <= 1 ? 0 : (index / (questionCount - 1)) * 100;

  return (
    <div className={styles.page}>
      <section className={styles.questionScreen} aria-label="강점·성향 진단 문항">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis-question.svg"
          alt=""
          className={styles.questionImage}
          draggable={false}
        />
        <div className={styles.progressOverlay} aria-hidden="true">
          <div className={styles.progressTrack}>
            <div
              className={styles.progressBar}
              style={{ width: `${progressPercent}%` }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/diagnosis-progress-owl.png"
              alt=""
              className={styles.progressOwl}
              draggable={false}
              style={
                {
                  "--progress": `${progressPercent}%`,
                } as CSSProperties
              }
            />
          </div>
        </div>
        <button
          className={styles.backButton}
          type="button"
          onClick={onBack}
          disabled={index === 0}
          aria-label="이전 문항으로 이동"
        />
        <div className={styles.questionNo}>{currentQuestion.questionNo}</div>
        <h1 className={styles.questionTitle}>{currentQuestion.questionText}</h1>
        <div className={styles.optionList}>
          {currentQuestion.options.slice(0, 5).map((option) => (
            <button
              key={option.id}
              className={`${styles.optionButton} ${
                selectedOptionId === option.id ? styles.optionButtonSelected : ""
              }`}
              type="button"
              onClick={() => onSelect(option.id)}
            >
              <span className={styles.optionRadio} aria-hidden="true" />
              <span className={styles.optionText}>{option.optionText}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function DiagnosisResult({
  result,
}: {
  result: DiagnosisResultResponseDto;
}) {
  const anonymousId = getAnonymousId();
  const kakaoLoginUrl = buildLoginUrl(
    process.env.NEXT_PUBLIC_KAKAO_LOGIN_URL,
    result.runId,
    anonymousId,
  );
  const naverLoginUrl = buildLoginUrl(
    process.env.NEXT_PUBLIC_NAVER_LOGIN_URL,
    result.runId,
    anonymousId,
  );
  const typeDetail = RESULT_TYPE_DETAILS[result.typeCode];
  const pointCards = buildPointCards(result);

  return (
    <MobileFrame className={styles.resultFrame} pageClassName={styles.resultPage}>
      <section className={styles.resultHero} aria-label="강점·성향 진단 결과">
        <p className={styles.resultEyebrow}>나의 강점·성향 유형은</p>
        <h1 className={styles.resultTitle}>
          <span>{result.typeName}</span>
        </h1>
        <p className={styles.resultSummary}>{typeDetail.heroSummary}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis-result-owl.png"
          alt=""
          className={styles.resultHeroOwl}
          draggable={false}
        />
      </section>

      <section className={styles.resultContent}>
        <section className={styles.typeIntro}>
          <h2>
            <MagnifierIcon />
            <span>{typeDetail.personTitle}</span>
          </h2>
          <p>{typeDetail.personDescription}</p>
        </section>

        <section className={styles.resultSection}>
          <h2 className={styles.resultSectionTitle}>
            <ChartIcon />
            <span>나의 성향 분석</span>
          </h2>
          <div className={styles.scoreList}>
            {result.axisResults.map((axis) => (
              <div key={axis.code} className={styles.scoreItem}>
                <div className={styles.scoreHeader}>
                  <AxisLabel left={axis.leftLabel} right={axis.rightLabel} />
                  <strong>{axis.percent}%</strong>
                </div>
                <div className={styles.scoreTrack}>
                  <div
                    className={styles.scoreBar}
                    style={{ width: `${axis.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.resultSection}>
          <h2 className={styles.resultSectionTitle}>
            <GrowthIcon />
            <span>강점과 성장 포인트</span>
          </h2>
          <div className={styles.pointList}>
            {pointCards.map((card, index) => (
              <article
                key={`${card.title}-${index}`}
                className={`${styles.pointCard} ${
                  card.kind === "growth" ? styles.pointCardGrowth : ""
                }`}
              >
                <PointIcon kind={card.kind} />
                <div>
                  <strong>{card.title}</strong>
                  <p>{card.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.resultSection}>
          <h2 className={styles.resultSectionTitle}>
            <BriefcaseIcon />
            <span>이런 직무 강해요</span>
          </h2>
          <div className={styles.jobChipList}>
            {result.jobCategories.slice(0, 4).map((job) => (
              <span key={job.name} className={styles.jobChip}>
                {shortenJobName(job.name)}
              </span>
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/diagnosis-result-pass-banner.svg"
            alt="합격의 문을 열어드립니다."
            className={styles.passBanner}
            draggable={false}
          />
        </section>

        <section className={styles.loginBox} aria-label="소셜 로그인">
          <p>
            가입하면 <strong>전체 결과 + 맞춤 공고</strong>를 볼 수 있어요
          </p>
          <div className={styles.loginActions}>
            <a className={styles.kakaoButton} href={kakaoLoginUrl}>
              <span className={styles.quickBadge}>3초 컷!</span>
              카카오로 시작하기
            </a>
            <a className={styles.naverButton} href={naverLoginUrl}>
              네이버로 시작하기
            </a>
          </div>
        </section>
      </section>
    </MobileFrame>
  );
}

function AxisLabel({ left, right }: { left: string; right: string }) {
  return (
    <span className={styles.axisLabel}>
      <span>{left}</span>
      <span className={styles.axisArrow}>↔</span>
      <span className={styles.axisRight}>{right}</span>
    </span>
  );
}

function shortenJobName(name: string) {
  const aliases: Record<string, string> = {
    "경영·기획·전략": "기획·전략",
    "인사·노무·교육": "사무·행정",
    "재무·회계·세무": "회계·재무",
    "법무·감사·윤리": "감사·법무",
    "총무·자산관리": "총무·자산",
    "홍보·대외협력": "홍보·협력",
    "구매·조달·계약": "조달·계약",
    "고객·민원·사업운영": "민원·운영",
    "IT·정보화·데이터": "IT·데이터",
    "토목·건축·시설": "시설·건축",
    "기계·전기·전자": "기계·전기",
    "화학·환경·에너지": "환경·에너지",
    "안전·품질·보건": "품질관리",
    "연구·기술개발(R&D)": "연구개발",
    "의료·보건": "의료·보건",
  };

  return aliases[name] ?? name;
}

function MagnifierIcon() {
  return (
    <svg className={styles.titleIcon} viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.2" fill="#F7FBFF" stroke="#1A2233" strokeWidth="1.4" />
      <path d="M11.2 11.2L15.2 15.2" stroke="#1A2233" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.7 7.3C5 5.9 6.1 4.9 7.5 4.8" stroke="#9EC8FF" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className={styles.titleIcon} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2" y="8" width="3" height="8" rx="0.8" fill="#2F7FF0" />
      <rect x="7.5" y="4" width="3" height="12" rx="0.8" fill="#17B26A" />
      <rect x="13" y="6.5" width="3" height="9.5" rx="0.8" fill="#F59E0B" />
    </svg>
  );
}

function GrowthIcon() {
  return (
    <svg className={styles.titleIcon} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 15V9.5" stroke="#23734F" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.8 9.2C5.4 9.2 3.6 7.2 3.2 3.7C6.9 3.7 8.8 5.6 8.8 9.2Z" fill="#8FD3A1" />
      <path d="M9.2 10.2C12.5 10 14.3 8.1 14.7 4.7C11.1 4.7 9.3 6.5 9.2 10.2Z" fill="#66C08C" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg className={styles.titleIcon} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2.2" y="6" width="13.6" height="9" rx="1.7" fill="#F7FBFF" stroke="#1A2233" strokeWidth="1.3" />
      <path d="M6.5 6V4.5C6.5 3.7 7.1 3.1 7.9 3.1H10.1C10.9 3.1 11.5 3.7 11.5 4.5V6" stroke="#1A2233" strokeWidth="1.3" />
      <path d="M2.7 9.1H15.3" stroke="#2F7FF0" strokeWidth="1.3" />
    </svg>
  );
}

function PointIcon({ kind }: { kind: "strength" | "growth" }) {
  if (kind === "growth") {
    return (
      <span className={styles.pointIcon} aria-hidden="true">
        <svg viewBox="32 1069 48 48" focusable="false">
          <path
            d="M55.5803 1090.58L55.1935 1090.16C55.1935 1090.16 55.5803 1083.2 49.7261 1080.44C49.7261 1080.44 44.2146 1078.89 42.0061 1080.87C42.0061 1080.87 41.5556 1088.19 48.3745 1091.16C48.3745 1091.16 51.6995 1092.4 54.0574 1091.59C54.0574 1091.59 54.7234 1092.5 54.787 1093.59V1099.56H56.6748V1092.81C56.6748 1092.81 57.189 1090.02 58.0043 1089.52C58.0043 1089.52 62.8081 1090.93 66.8603 1086.79C66.8603 1086.79 70.1853 1083.1 69.9919 1078.06C69.9919 1078.06 68.2559 1075.83 62.3136 1077.85C62.3136 1077.85 56.3957 1080.65 56.7801 1088.41L55.5803 1090.58V1090.58Z"
            fill="#BCDB8B"
          />
          <path
            d="M68.584 1106.61C69.3332 1107.52 68.8851 1108.99 67.7882 1109.2C65.2223 1109.71 60.8102 1109.2 55.7957 1109.2C50.7813 1109.2 46.3692 1109.71 43.8033 1109.2C42.7064 1108.99 42.2583 1107.52 43.0075 1106.61C45.3801 1103.72 50.2157 1098.84 55.7957 1098.84C61.3758 1098.84 66.2114 1103.72 68.584 1106.61Z"
            fill="#BF9567"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className={styles.pointIcon} aria-hidden="true">
      <svg viewBox="32 796 48 48" focusable="false">
        <path
          d="M54.4247 816.648C54.4247 816.648 54.5185 828.09 47.7336 834.257C47.7336 834.257 44.4349 837.55 47.9694 839.116C51.5039 840.682 54.4247 831.749 54.4247 831.749C54.4247 831.749 56.9677 822.604 56.7319 817.798L54.422 816.648H54.4247Z"
          fill="#66C08C"
        />
        <path
          d="M55.2824 808.543L55.6039 811.203C55.9335 813.456 56.3194 815.67 56.7481 817.914C58.8436 817.84 60.9016 817.715 62.9784 817.531C63.7099 817.465 64.4093 817.385 65.1382 817.272C66.4565 817.061 67.7133 816.687 68.7771 815.816C69.8409 814.945 70.5993 813.605 70.7976 812.119C71.1808 809.215 69.4015 806.496 66.7406 806.19C66.1136 806.118 65.5079 806.19 64.8943 806.38C64.9747 803.877 63.5652 801.72 61.384 801.143C59.9932 800.778 58.5328 801.122 57.3832 802.061C56.5338 802.754 55.9201 803.708 55.5771 804.808C55.202 806.005 55.1752 807.254 55.2797 808.546L55.2824 808.543Z"
          fill="#8FD3A1"
        />
        <path
          d="M65.3149 818.232L62.9032 818.009C60.8479 817.884 58.8167 817.828 56.748 817.81C56.3621 820.096 56.0325 822.351 55.7485 824.643C55.6493 825.448 55.5689 826.224 55.5127 827.035C55.4135 828.509 55.4752 829.951 56.0138 831.291C56.5631 832.658 57.5706 833.74 58.8381 834.272C61.3114 835.309 64.0902 833.966 64.929 831.148C65.1273 830.483 65.1943 829.814 65.1594 829.107C67.346 829.731 69.5487 828.667 70.5241 826.429C71.1458 825.002 71.1538 823.347 70.575 821.899C70.1463 820.833 69.4388 819.962 68.5465 819.353C67.5711 818.69 66.4778 818.393 65.3175 818.229L65.3149 818.232Z"
          fill="#66C08C"
        />
        <path
          d="M54.4408 808.65L55.1804 811.206C55.7565 813.399 56.2656 815.581 56.748 817.81C54.8267 818.743 52.9214 819.611 50.9733 820.434C50.2873 820.725 49.6228 820.987 48.9234 821.231C47.6505 821.67 46.3723 821.932 45.0727 821.653C43.749 821.367 42.5699 820.526 41.8169 819.278C40.3458 816.841 40.8978 813.533 43.1809 811.991C43.7195 811.625 44.2929 811.402 44.9226 811.28C43.8803 809.06 44.3144 806.439 46.0615 804.879C47.1736 803.886 48.6259 803.5 50.0274 803.8C51.0617 804.02 51.9862 804.588 52.7231 805.417C53.5243 806.32 54.0362 807.435 54.4408 808.65Z"
          fill="#66C08C"
        />
        <path
          d="M56.5551 827.359L56.7266 824.681C56.815 822.401 56.8445 820.146 56.8338 817.851C54.7678 817.45 52.7312 817.111 50.6625 816.823C49.9337 816.722 49.2343 816.642 48.5027 816.588C47.1736 816.496 45.874 816.579 44.6708 817.194C43.4435 817.819 42.4815 818.948 42.0153 820.36C41.1069 823.115 42.3529 826.182 44.9013 827.079C45.5015 827.29 46.1071 827.359 46.7449 827.311C46.2063 829.742 47.1924 832.173 49.2209 833.228C50.5152 833.9 52.0077 833.891 53.3047 833.231C54.2613 832.744 55.0384 831.95 55.577 830.952C56.1639 829.864 56.4184 828.645 56.5524 827.359H56.5551Z"
          fill="#8FD3A1"
        />
      </svg>
    </span>
  );
}

function buildPointCards(result: DiagnosisResultResponseDto) {
  const strengths = result.strengths.slice(0, 3);
  const growthPoint = result.growthPoints[0];

  return [
    ...strengths.map((text) => ({
      kind: "strength" as const,
      title: "강점",
      text,
    })),
    {
      kind: "growth" as const,
      title: "성장 포인트",
      text: growthPoint ?? "지금 강점을 유지하면서 보완할 기준을 하나 정해보세요.",
    },
  ];
}

function buildLoginUrl(
  baseUrl: string | undefined,
  diagnosisRunId: string,
  anonymousId: string,
) {
  if (!baseUrl) {
    return "#";
  }

  const url = new URL(baseUrl);
  url.searchParams.set("diagnosisRunId", diagnosisRunId);
  url.searchParams.set("anonymousId", anonymousId);

  return url.toString();
}

function MobileFrame({
  children,
  className = "bg-white",
  pageClassName = "",
}: {
  children: React.ReactNode;
  className?: string;
  pageClassName?: string;
}) {
  return (
    <div className={`${styles.page} ${pageClassName}`}>
      <div className={`${styles.mobileFrame} ${className}`}>
        {children}
      </div>
    </div>
  );
}
