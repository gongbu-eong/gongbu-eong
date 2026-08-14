"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getDiagnosisQuestions,
  getDiagnosisStats,
  submitDiagnosis,
} from "../diagnosis.api";
import { getCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
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

const RESULT_HERO_POSITION: Record<
  DiagnosisResultResponseDto["typeCode"],
  { x: number; y: number }
> = {
  stability: { x: 80, y: 80 },
  challenge: { x: 497, y: 80 },
  teamwork: { x: 914, y: 80 },
  individual: { x: 1331, y: 80 },
  execution: { x: 80, y: 406 },
  planning: { x: 497, y: 406 },
  principle: { x: 914, y: 406 },
  flexibility: { x: 1331, y: 406 },
};

const RESULT_HERO_CARD = {
  width: 393,
  height: 302,
};

const RESULT_HERO_COLOR: Record<
  DiagnosisResultResponseDto["typeCode"],
  string
> = {
  stability: "#15489a",
  challenge: "#f3a427",
  teamwork: "#a154e5",
  individual: "#e85759",
  execution: "#5bbf47",
  planning: "#6a7e92",
  principle: "#bd895e",
  flexibility: "#0b778b",
};

const QUESTION_OWL_BOUNDS: Array<{ x: number; y: number; width: number }> = [
  { x: 151, y: 372, width: 252 },
  { x: 622, y: 372, width: 256 },
  { x: 1107, y: 372, width: 232 },
  { x: 1582, y: 372, width: 227 },
  { x: 151, y: 1344, width: 251 },
  { x: 641, y: 1344, width: 217 },
  { x: 1106, y: 1344, width: 233 },
  { x: 1575, y: 1344, width: 241 },
  { x: 184, y: 2316, width: 185 },
  { x: 613, y: 2316, width: 273 },
  { x: 1120, y: 2316, width: 205 },
  { x: 1590, y: 2316, width: 211 },
  { x: 170, y: 3288, width: 214 },
  { x: 651, y: 3288, width: 198 },
  { x: 1120, y: 3288, width: 205 },
  { x: 1588, y: 3288, width: 215 },
];

const POINT_CARD_TITLES: Record<
  DiagnosisResultResponseDto["typeCode"],
  [string, string, string, string]
> = {
  stability: ["책임감", "꼼꼼함", "지속력", "새로운 시도"],
  challenge: ["도전성", "추진력", "적응력", "기준 세우기"],
  teamwork: ["협업감", "조율력", "공감력", "결정력"],
  individual: ["몰입력", "자기주도", "분석력", "피드백 활용"],
  execution: ["실행력", "속도감", "현장 대응", "점검 습관"],
  planning: ["전략성", "분석력", "우선순위", "실행 전환"],
  principle: ["정확성", "꼼꼼함", "신뢰성", "유연한 대안"],
  flexibility: ["유연성", "대응력", "조정력", "기준 고정"],
};

export function DiagnosisFlow() {
  const router = useRouter();
  const [state, setState] = useState<FlowState>({ status: "intro" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUserDto | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    let ignore = false;
    const resultHeroImage = new window.Image();
    resultHeroImage.src = "/diagnosis-result-heroes.svg";
    const questionOwlImage = new window.Image();
    questionOwlImage.src = "/diagnosis-question-owls.svg";

    getCurrentUser()
      .then((response) => {
        if (ignore) return;

        if (response.authenticated && response.user) {
          setIsAuthenticated(true);
          setCurrentUser(response.user);
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }

        if (!ignore) {
          setIsCheckingSession(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setIsCheckingSession(false);
        }
      });

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
    isSubmittingRef.current = false;
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
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;

    const payload: DiagnosisAnswerRequestDto[] = questions.map((question) => ({
      questionId: question.id,
      optionId: resolvedAnswers[question.id],
    }));

    setState({ status: "submitting", questions, index: questions.length - 1 });

    try {
      const result = await submitDiagnosis(payload);

      if (isAuthenticated) {
        router.push(
          `/ai-tools/diagnosis/result?resultId=${encodeURIComponent(result.resultId)}`,
        );
        return;
      }

      setState({ status: "result", result });
    } catch (error) {
      isSubmittingRef.current = false;
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

    if (args.index === args.questions.length - 1) {
      void submit(args.questions, nextAnswers);
      return;
    }

    window.setTimeout(() => {
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

  if (isCheckingSession) {
    return null;
  }

  if (state.status === "intro") {
    const intro = (
      <DiagnosisIntro
        isEmbedded={isAuthenticated}
        participantCount={participantCount}
        onStart={startSurvey}
      />
    );

    if (isAuthenticated) {
      return (
        <AuthenticatedIntroShell user={currentUser}>
          {intro}
        </AuthenticatedIntroShell>
      );
    }

    return intro;
  }

  if (state.status === "loading") {
    return (
      <MobileFrame>문항을 불러오는 중입니다...</MobileFrame>
    );
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
        isAuthenticated={isAuthenticated}
      />
    );
  }

  const currentQuestion = state.questions[state.index];

  return (
    <DiagnosisSurvey
      isAuthenticated={isAuthenticated}
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
  isEmbedded = false,
  participantCount,
  onStart,
}: {
  isEmbedded?: boolean;
  participantCount: number | null;
  onStart: () => void;
}) {
  const formattedParticipantCount = participantCount?.toLocaleString("ko-KR");
  const introTypes = [
    {
      label: "안정 추구형",
      icon: "/diagnosis/intro/asset-1-182x198.png",
      className: styles.introTypeStability,
    },
    {
      label: "도전 개척형",
      icon: "/diagnosis/intro/asset-2-142x239.png",
      className: styles.introTypeChallenge,
    },
    {
      label: "협업 조력형",
      icon: "/diagnosis/intro/asset-3-222x143.png",
      className: styles.introTypeTeamwork,
    },
    {
      label: "독립 몰입형",
      icon: "/diagnosis/intro/asset-4-202x198.png",
      className: styles.introTypeIndependent,
    },
    {
      label: "실행 추진형",
      icon: "/diagnosis/intro/asset-5-133x205.png",
      className: styles.introTypeExecution,
    },
    {
      label: "전략 기획형",
      icon: "/diagnosis/intro/asset-6-207x205.png",
      className: styles.introTypePlanning,
    },
    {
      label: "정밀 관리형",
      icon: "/diagnosis/intro/asset-7-193x195.png",
      className: styles.introTypePrinciple,
    },
    {
      label: "유연 대응형",
      icon: "/diagnosis/intro/asset-8-198x189.png",
      className: styles.introTypeFlexible,
    },
  ];

  return (
    <div className={isEmbedded ? styles.embeddedIntro : styles.page}>
      <section className={styles.landing} aria-label="강점·성향 진단 도입부">
        <p className={styles.introBrand}>공부엉이</p>
        <p className={styles.introPill}>3분이면 알 수 있는 나의 취업 강점</p>
        <h1 className={styles.introTitle} aria-label="나의 강점·성향 유형은?">
          <span className={styles.introTitleShadow} aria-hidden="true">
            <span>
              나의 <span>강점</span>·<span>성향</span>
            </span>
            <span>유형은?</span>
          </span>
          <span className={styles.introTitleFront} aria-hidden="true">
            <span>
              나의 <span className={styles.introTitleStrength}>강점</span>·
              <span className={styles.introTitleTendency}>성향</span>
            </span>
            <span>유형은?</span>
          </span>
        </h1>
        <div className={styles.introTypeGrid} aria-label="진단 유형 예시">
          {introTypes.map((type) => (
            <div
              key={type.label}
              className={`${styles.introTypeCard} ${type.className}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={type.icon} alt="" draggable={false} />
              <span>{type.label}</span>
            </div>
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis/intro/asset-13-173x190.png"
          alt=""
          className={`${styles.introDecor} ${styles.introDecorBulb}`}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis/intro/asset-10-192x189.png"
          alt=""
          className={`${styles.introDecor} ${styles.introDecorStarLarge}`}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis/intro/asset-12-87x88.png"
          alt=""
          className={`${styles.introDecor} ${styles.introDecorStarSmall}`}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis/intro/asset-11-191x195.png"
          alt=""
          className={`${styles.introDecor} ${styles.introDecorSparkle}`}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis/intro/asset-9-1727x1300.png"
          alt=""
          className={styles.introOwl}
          draggable={false}
        />
        <button
          className={styles.startButton}
          onClick={onStart}
          aria-label="진단 시작하기"
        >
          <span className={styles.startButtonStrong}>진단 시작하기</span>
          <span className={styles.startButtonSub}>
            {formattedParticipantCount ? (
              <>
                지금까지{" "}
                <span className={styles.participantCount}>
                  {formattedParticipantCount}
                </span>
                명이 참여했어요.
              </>
            ) : (
              "참여 인원을 불러오는 중이에요."
            )}
          </span>
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
        >
          <span aria-hidden="true" className={styles.shareIcon}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13.5 6C14.7426 6 15.75 4.99264 15.75 3.75C15.75 2.50736 14.7426 1.5 13.5 1.5C12.2574 1.5 11.25 2.50736 11.25 3.75C11.25 4.99264 12.2574 6 13.5 6Z"
                fill="currentColor"
              />
              <path
                d="M4.5 11.25C5.74264 11.25 6.75 10.2426 6.75 9C6.75 7.75736 5.74264 6.75 4.5 6.75C3.25736 6.75 2.25 7.75736 2.25 9C2.25 10.2426 3.25736 11.25 4.5 11.25Z"
                fill="currentColor"
              />
              <path
                d="M13.5 16.5C14.7426 16.5 15.75 15.4926 15.75 14.25C15.75 13.0074 14.7426 12 13.5 12C12.2574 12 11.25 13.0074 11.25 14.25C11.25 15.4926 12.2574 16.5 13.5 16.5Z"
                fill="currentColor"
              />
              <path
                d="M6.4425 10.1325L11.565 13.1175M11.5575 4.8825L6.4425 7.8675"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          테스트 공유하기
        </button>
      </section>
    </div>
  );
}

function DiagnosisSurvey({
  isAuthenticated,
  currentQuestion,
  index,
  questionCount,
  selectedOptionId,
  onBack,
  onSelect,
}: {
  isAuthenticated: boolean;
  currentQuestion: DiagnosisQuestionDto;
  index: number;
  questionCount: number;
  selectedOptionId?: string;
  onBack: () => void;
  onSelect: (optionId: string) => void;
}) {
  const progressRatio = questionCount <= 1 ? 0 : index / (questionCount - 1);
  const stepNo = index + 1;
  const owlIndex = Math.max(0, Math.min(stepNo - 1, 15));
  const owlBounds = QUESTION_OWL_BOUNDS[owlIndex];

  return (
    <div className={`${styles.page} ${styles.questionPage}`}>
      <section
        className={`${styles.questionScreen} ${
          isAuthenticated ? styles.questionScreenAuthenticated : ""
        }`}
        aria-label="강점·성향 진단 문항"
      >
        <div
          className={styles.questionOwl}
          aria-hidden="true"
          style={
            {
              "--question-owl-x": `-${owlBounds.x}px`,
              "--question-owl-y": `-${owlBounds.y}px`,
              "--question-owl-width": `${owlBounds.width}px`,
            } as CSSProperties
          }
        />
        <div className={styles.progressOverlay} aria-hidden="true">
          <div className={styles.progressTrack}>
            <div
              className={styles.progressBar}
              style={
                {
                  "--progress-ratio": progressRatio,
                } as CSSProperties
              }
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/diagnosis-progress-owl.png"
              alt=""
              className={styles.progressOwl}
              draggable={false}
              style={
                {
                  "--progress-ratio": progressRatio,
                } as CSSProperties
              }
            />
          </div>
        </div>
        {isAuthenticated ? (
          <Link
            href="/"
            className={styles.surveyHomeButton}
            aria-label="홈으로 이동"
          >
            <SurveyHomeIcon />
          </Link>
        ) : null}
        <button
          className={styles.backButton}
          type="button"
          onClick={onBack}
          disabled={index === 0}
          aria-label="이전 문항으로 이동"
        />
        <div className={styles.questionNo}>{stepNo}</div>
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
        <p className={styles.questionHint}>
          가장 가까운 하나를 선택하면 다음으로 넘어가요
        </p>
      </section>
    </div>
  );
}

function AuthenticatedIntroShell({
  user,
  children,
}: {
  user: CurrentUserDto | null;
  children: ReactNode;
}) {
  const nickname = user?.nickname || user?.displayName || "회원";

  return (
    <main className={styles.authenticatedIntroPage}>
      <section className={styles.authenticatedIntroShell}>
        <AppHeader user={user} nickname={nickname} />
        <div className={styles.authenticatedIntroContent}>{children}</div>
        <AppFooter active="ai" />
      </section>
    </main>
  );
}

function DiagnosisResult({
  result,
  isAuthenticated,
}: {
  result: DiagnosisResultResponseDto;
  isAuthenticated: boolean;
}) {
  const [displayResult] = useState<DiagnosisResultResponseDto>(() => ({
    ...result,
    scores: { ...result.scores },
    percentages: { ...result.percentages },
    axisResults: result.axisResults.map((axis) => ({ ...axis })),
    strengths: [...result.strengths],
    growthPoints: [...result.growthPoints],
    recommendations: [...result.recommendations],
    jobCategories: result.jobCategories.map((job) => ({ ...job })),
  }));
  const anonymousId = getAnonymousId();
  const kakaoLoginUrl = buildLoginUrl(
    process.env.NEXT_PUBLIC_KAKAO_LOGIN_URL,
    displayResult.runId,
    anonymousId,
  );
  const naverLoginUrl = buildLoginUrl(
    process.env.NEXT_PUBLIC_NAVER_LOGIN_URL,
    displayResult.runId,
    anonymousId,
  );
  const typeDetail = RESULT_TYPE_DETAILS[displayResult.typeCode];
  const heroPosition = RESULT_HERO_POSITION[displayResult.typeCode];
  const pointCards = buildPointCards(displayResult);

  return (
    <MobileFrame className={styles.resultFrame} pageClassName={styles.resultPage}>
      <section
        className={styles.resultHero}
        aria-label={`나의 강점·성향 유형은 ${displayResult.typeName}. ${typeDetail.heroSummary}`}
        style={
          {
            "--result-hero-left": `${
              (-heroPosition.x / RESULT_HERO_CARD.width) * 100
            }%`,
            "--result-hero-top": `${
              (-heroPosition.y / RESULT_HERO_CARD.height) * 100
            }%`,
            "--result-hero-color": RESULT_HERO_COLOR[displayResult.typeCode],
          } as CSSProperties
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis-result-heroes.svg"
          alt=""
          className={styles.resultHeroSprite}
          draggable={false}
        />
        <div className={styles.resultHeroText}>
          <p>나의 강점·성향 유형은</p>
          <h1>{displayResult.typeName}</h1>
          <span>{typeDetail.heroSummary}</span>
        </div>
      </section>

      <section className={styles.resultContent}>
        <section className={styles.typeIntro}>
          <h2 className={styles.resultSectionTitle}>
            <ResultTitleIcon type="person" />
            <span>{typeDetail.personTitle}</span>
          </h2>
          <p>{typeDetail.personDescription}</p>
        </section>

        <section className={styles.resultSection}>
          <h2 className={styles.resultSectionTitle}>
            <ResultTitleIcon type="chart" />
            <span>나의 성향 분석</span>
          </h2>
          <div className={styles.scoreList}>
            {displayResult.axisResults.map((axis) => (
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
            <ResultTitleIcon type="growth" />
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
            <ResultTitleIcon type="job" />
            <span>이런 직무 강해요</span>
          </h2>
          <div className={styles.jobChipList}>
            {displayResult.jobCategories.slice(0, 6).map((job) => (
              <span key={job.name} className={styles.jobChip}>
                {job.name}
              </span>
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/diagnosis-result-pass-banner.png"
            alt="합격의 문을 열어드립니다."
            className={styles.passBanner}
            draggable={false}
          />
        </section>

        {!isAuthenticated ? (
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
        ) : null}
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

function SurveyHomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="m4.5 10.5 7.5-6 7.5 6v8a1 1 0 0 1-1 1H15v-5h-6v5H5.5a1 1 0 0 1-1-1v-8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ResultTitleIcon({
  type,
}: {
  type: "person" | "chart" | "growth" | "job";
}) {
  return (
    <span className={styles.titleIcon} aria-hidden="true">
      {type === "person" ? (
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="10" cy="10" r="6.25" fill="#d8efff" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="8.5" cy="8.5" r="2" fill="#ffffff" opacity="0.9" />
          <path d="m14.7 14.7 5.15 5.15" fill="none" stroke="#2f7ff0" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : null}
      {type === "chart" ? (
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M3.5 3.5v17h17" fill="none" stroke="#172033" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="6" y="12" width="3" height="6" rx="0.75" fill="#20b66f" />
          <rect x="10.5" y="8" width="3" height="10" rx="0.75" fill="#f0445b" />
          <rect x="15" y="5" width="3" height="13" rx="0.75" fill="#2f7ff0" />
        </svg>
      ) : null}
      {type === "growth" ? (
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M5.2 20.2c2.2-1.3 3.3-3.1 3.5-5.6l.2-2.4 2.1 1.1 2-4.7c.5-1.2 2.1-1.5 3-.6.5.5.6 1.2.3 1.9l-1.2 2.8 2.1-.9c1.6-.7 3.3.5 3.3 2.2v1.5c0 2.9-2.3 5.2-5.2 5.2H9.1c-1.4 0-2.7-.2-3.9-.5Z" fill="#ffc83d" stroke="#e99018" strokeWidth="1.25" strokeLinejoin="round" />
          <path d="m7.2 13.8-2.6-.7-1.2 5.6 3.2.8" fill="#ffd85f" stroke="#e99018" strokeWidth="1.25" strokeLinejoin="round" />
        </svg>
      ) : null}
      {type === "job" ? (
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="11" cy="13" r="8" fill="#ffffff" stroke="#ef4056" strokeWidth="2" />
          <circle cx="11" cy="13" r="5" fill="#ef4056" />
          <circle cx="11" cy="13" r="2" fill="#ffffff" />
          <path d="m11 13 7.8-7.8" fill="none" stroke="#2f7ff0" strokeWidth="1.7" strokeLinecap="round" />
          <path d="m18.3 5.7.1-3 1.3 1.3 2.8.1-2.2 2.2Z" fill="#59c58a" stroke="#23734f" strokeWidth="0.7" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
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
  const titles = POINT_CARD_TITLES[result.typeCode];

  return [
    ...strengths.map((text, index) => ({
      kind: "strength" as const,
      title: titles[index],
      text,
    })),
    {
      kind: "growth" as const,
      title: titles[3],
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
