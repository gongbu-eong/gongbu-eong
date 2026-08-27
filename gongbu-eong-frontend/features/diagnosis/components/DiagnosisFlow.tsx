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
import { trackProductEvent } from "@/features/analytics/analytics.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import {
  DIAGNOSIS_SHARE_DESCRIPTION,
  DIAGNOSIS_SHARE_IMAGE_HEIGHT,
  DIAGNOSIS_SHARE_IMAGE_WIDTH,
  DIAGNOSIS_SHARE_TITLE,
  getDiagnosisIntroShareUrl,
  getDiagnosisShareImageUrl,
} from "../diagnosis-share";
import {
  DiagnosisAnswerRequestDto,
  DiagnosisQuestionDto,
  DiagnosisResultResponseDto,
} from "../diagnosis.dto";
import { getAnonymousId } from "@/shared/session/anonymous-id";
import { loadKakaoSdk } from "@/shared/kakao-share";
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
      "정해진 기준과 절차가 명확할 때 집중력이 살아나는 타입입니다.\n해야 할 일이 보이면 무리하게 속도를 내기보다 일정한 리듬으로 끝까지 이어갑니다.\n갑작스러운 변화 앞에서는 신중해질 수 있지만, 한번 방향을 잡으면 안정적인 결과를 꾸준히 쌓아 신뢰를 만드는 사람입니다.",
  },
  challenge: {
    heroSummary: "빠르게 부딪히며 성장하는 타입",
    personTitle: "도전 개척형은 이런 사람이에요",
    personDescription:
      "낯선 방식이나 높은 목표 앞에서 움츠러들기보다 먼저 시도해보는 타입입니다.\n처음부터 정답이 보이지 않아도 직접 부딪히며 정보를 모으고, 경험을 통해 다음 방향을 빠르게 잡습니다.\n실패 가능성이 있어도 성장 가능성이 보이면 움직이는 편이라 변화가 많은 환경에서 에너지가 살아납니다.",
  },
  teamwork: {
    heroSummary: "함께 맞춰가며 성과를 내는 타입",
    personTitle: "협업 조력형은 이런 사람이에요",
    personDescription:
      "혼자 밀어붙이기보다 주변과 방향을 맞추고 역할을 나눌 때 강점이 살아나는 타입입니다.\n서로 다른 의견이 있어도 바로 판단하기보다 각자의 입장을 듣고 공통된 목표를 찾으려 합니다.\n사람과 일의 흐름을 이어주는 힘이 있어 팀 안에서 안정적인 결론과 관계 기반의 성과를 만들어내는 사람입니다.",
  },
  individual: {
    heroSummary: "몰입해서 완성도를 높이는 타입",
    personTitle: "독립 몰입형은 이런 사람이에요",
    personDescription:
      "여러 사람과 계속 맞추기보다 스스로 몰입할 시간이 있을 때 결과가 좋아지는 타입입니다.\n문제를 맡으면 자신의 기준으로 구조를 파악하고, 필요한 자료와 방법을 찾아 끝까지 파고드는 힘이 있습니다.\n조용히 집중할 수 있는 환경에서 완성도를 끌어올리며, 독립적인 책임이 분명할수록 역량이 잘 드러나는 사람입니다.",
  },
  execution: {
    heroSummary: "먼저 움직이며 길을 찾는 타입",
    personTitle: "실행 추진형은 이런 사람이에요",
    personDescription:
      "완벽한 계획을 기다리기보다 작은 행동으로 시작하며 방향을 잡는 타입입니다.\n해야 할 일이 보이면 오래 망설이지 않고 먼저 움직이면서 필요한 정보와 사람을 연결합니다.\n실행 과정에서 문제를 발견하고 바로 조정하는 편이라, 정체된 상황에 속도를 붙이고 결과를 앞으로 밀어내는 사람입니다.",
  },
  planning: {
    heroSummary: "계획으로 합격 가능성을 높이는 타입",
    personTitle: "전략 기획형은 이런 사람이에요",
    personDescription:
      "시작 전 목표와 기준, 순서를 정리해야 힘이 나는 타입입니다.\n여러 정보가 섞여 있어도 중요한 조건을 분리하고, 무엇부터 처리해야 효율적인지 차분히 판단합니다.\n큰 그림과 세부 단계를 함께 보며 복잡한 상황을 실행 가능한 계획으로 바꾸는 데 강한 사람입니다.",
  },
  principle: {
    heroSummary: "정확하게 확인하며 실수를 줄이는 타입",
    personTitle: "정밀 관리형은 이런 사람이에요",
    personDescription:
      "규칙과 원칙, 빠진 조건을 중요하게 보는 타입입니다.\n작은 오류도 결과에 영향을 줄 수 있다고 생각해 다시 확인하고, 기준이 흐려지는 상황에서도 필요한 절차를 지키려 합니다.\n정확성과 신뢰가 중요한 업무에서 안정감을 주며, 세부 사항을 챙겨 전체 결과의 완성도를 높이는 사람입니다.",
  },
  flexibility: {
    heroSummary: "상황에 맞춰 유연하게 돌파하는 타입",
    personTitle: "유연 대응형은 이런 사람이에요",
    personDescription:
      "계획대로 되지 않아도 멈추기보다 그때그때 가능한 방법을 찾는 타입입니다.\n갑작스러운 변경이나 제약이 생겨도 현재 쓸 수 있는 자원과 조건을 빠르게 살피며 대안을 조정합니다.\n고정된 방식보다 실제 상황에 맞는 해결책을 중요하게 생각해, 변화가 잦은 환경에서도 흐름을 이어가는 사람입니다.",
  },
};

const RESULT_HERO_IMAGE_SRC: Record<
  DiagnosisResultResponseDto["typeCode"],
  string
> = {
  stability: "/home/result-types/stability.webp",
  challenge: "/home/result-types/challenge.webp",
  teamwork: "/home/result-types/teamwork.webp",
  individual: "/home/result-types/individual.webp",
  execution: "/home/result-types/execution.webp",
  planning: "/home/result-types/planning.webp",
  principle: "/home/result-types/principle.webp",
  flexibility: "/home/result-types/flexibility.webp",
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

const QUESTION_OWLS: Array<{ src: string; width: number }> = [
  { src: "/diagnosis/question-owls/question-owl-01.webp", width: 252 },
  { src: "/diagnosis/question-owls/question-owl-02.webp", width: 256 },
  { src: "/diagnosis/question-owls/question-owl-03.webp", width: 232 },
  { src: "/diagnosis/question-owls/question-owl-04.webp", width: 227 },
  { src: "/diagnosis/question-owls/question-owl-05.webp", width: 251 },
  { src: "/diagnosis/question-owls/question-owl-06.webp", width: 217 },
  { src: "/diagnosis/question-owls/question-owl-07.webp", width: 233 },
  { src: "/diagnosis/question-owls/question-owl-08.webp", width: 241 },
  { src: "/diagnosis/question-owls/question-owl-09.webp", width: 185 },
  { src: "/diagnosis/question-owls/question-owl-10.webp", width: 273 },
  { src: "/diagnosis/question-owls/question-owl-11.webp", width: 205 },
  { src: "/diagnosis/question-owls/question-owl-12.webp", width: 211 },
  { src: "/diagnosis/question-owls/question-owl-13.webp", width: 214 },
  { src: "/diagnosis/question-owls/question-owl-14.webp", width: 198 },
  { src: "/diagnosis/question-owls/question-owl-15.webp", width: 205 },
  { src: "/diagnosis/question-owls/question-owl-16.webp", width: 215 },
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

    getCurrentUser()
      .then((response) => {
        if (ignore) return;

        if (response.authenticated && response.user) {
          setIsAuthenticated(true);
          setCurrentUser(response.user);
          setIsCheckingSession(false);
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setIsCheckingSession(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setIsAuthenticated(false);
          setCurrentUser(null);
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
      trackDiagnosisComplete(result);

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

  function trackDiagnosisComplete(result: DiagnosisResultResponseDto) {
    window.gtag?.("event", "diagnosis_complete", {
      event_category: "diagnosis",
      diagnosis_type: result.typeCode,
      diagnosis_type_name: result.typeName,
      diagnosis_run_id: result.runId,
      diagnosis_result_id: result.resultId,
      attempt_no: result.attemptNo ?? undefined,
    });
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
      icon: "/diagnosis/intro/type-stability.png",
      className: styles.introTypeStability,
    },
    {
      label: "도전 개척형",
      icon: "/diagnosis/intro/type-challenge.png",
      className: styles.introTypeChallenge,
    },
    {
      label: "협업 조력형",
      icon: "/diagnosis/intro/type-teamwork.png",
      className: styles.introTypeTeamwork,
    },
    {
      label: "독립 몰입형",
      icon: "/diagnosis/intro/type-independent.png",
      className: styles.introTypeIndependent,
    },
    {
      label: "실행 추진형",
      icon: "/diagnosis/intro/type-execution.png",
      className: styles.introTypeExecution,
    },
    {
      label: "전략 기획형",
      icon: "/diagnosis/intro/type-planning.png",
      className: styles.introTypePlanning,
    },
    {
      label: "정밀 관리형",
      icon: "/diagnosis/intro/type-principle.png",
      className: styles.introTypePrinciple,
    },
    {
      label: "유연 대응형",
      icon: "/diagnosis/intro/type-flexible.png",
      className: styles.introTypeFlexible,
    },
  ];
  const shareDiagnosisIntro = async () => {
    const publicOrigin = window.location.origin;
    const shareUrl = getDiagnosisIntroShareUrl(publicOrigin);
    const shareImageUrl = getDiagnosisShareImageUrl(publicOrigin);
    const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY?.trim();

    try {
      if (kakaoKey) {
        const kakao = await loadKakaoSdk();
        if (!kakao.isInitialized()) kakao.init(kakaoKey);
        if (kakao.Share?.sendDefault) {
          kakao.Share.sendDefault({
            objectType: "feed",
            content: {
              title: DIAGNOSIS_SHARE_TITLE,
              description: DIAGNOSIS_SHARE_DESCRIPTION,
              imageUrl: shareImageUrl,
              imageWidth: DIAGNOSIS_SHARE_IMAGE_WIDTH,
              imageHeight: DIAGNOSIS_SHARE_IMAGE_HEIGHT,
              link: {
                mobileWebUrl: shareUrl,
                webUrl: shareUrl,
              },
            },
            buttonTitle: "테스트 하러가기",
            buttons: [
              {
                title: "테스트 하러가기",
                link: {
                  mobileWebUrl: shareUrl,
                  webUrl: shareUrl,
                },
              },
            ],
          });
          return;
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: DIAGNOSIS_SHARE_TITLE,
          text: DIAGNOSIS_SHARE_DESCRIPTION,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard?.writeText(shareUrl);
    } catch {
      await navigator.clipboard?.writeText(shareUrl);
    }
  };

  return (
    <div className={isEmbedded ? styles.embeddedIntro : styles.page}>
      <section className={styles.landing} aria-label="강점·성향 진단 도입부">
        <Link href="/" className={styles.introBrand} aria-label="공부엉이 메인으로 이동">
          공부엉이
        </Link>
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
          src="/diagnosis/intro/decor-bulb.png"
          alt=""
          className={`${styles.introDecor} ${styles.introDecorBulb}`}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis/intro/decor-star-large.png"
          alt=""
          className={`${styles.introDecor} ${styles.introDecorStarLarge}`}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis/intro/decor-star-small.png"
          alt=""
          className={`${styles.introDecor} ${styles.introDecorStarSmall}`}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis/intro/decor-sparkle.png"
          alt=""
          className={`${styles.introDecor} ${styles.introDecorSparkle}`}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/diagnosis/intro/intro-owl-desk.png"
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
          onClick={() => void shareDiagnosisIntro()}
          aria-label="테스트 공유하기"
        >
          <span aria-hidden="true" className={styles.shareIcon}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/diagnosis/intro/share.svg" alt="" draggable={false} />
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
  const owl = QUESTION_OWLS[owlIndex];

  return (
    <div className={`${styles.page} ${styles.questionPage}`}>
      <section
        className={`${styles.questionScreen} ${
          isAuthenticated ? styles.questionScreenAuthenticated : ""
        }`}
        aria-label="강점·성향 진단 문항"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={owl.src}
          alt=""
          className={styles.questionOwl}
          aria-hidden="true"
          draggable={false}
          style={
            {
              "--question-owl-width": `${owl.width}px`,
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
  const pointCards = buildPointCards(displayResult);

  return (
    <MobileFrame className={styles.resultFrame} pageClassName={styles.resultPage}>
      <section
        className={styles.resultHero}
        aria-label={`나의 강점·성향 유형은 ${displayResult.typeName}. ${typeDetail.heroSummary}`}
        style={
          {
            "--result-hero-color": RESULT_HERO_COLOR[displayResult.typeCode],
          } as CSSProperties
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={RESULT_HERO_IMAGE_SRC[displayResult.typeCode]}
          alt=""
          className={`${styles.resultHeroSprite} ${styles[`resultHeroSprite_${displayResult.typeCode}`]}`}
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
                <div className={styles.pointCardHeader}>
                  <PointIcon kind={card.kind} index={index} />
                  <strong>{card.title}</strong>
                </div>
                <p>{card.text}</p>
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
              <a
                className={styles.kakaoButton}
                href={kakaoLoginUrl}
                onClick={() =>
                  trackDiagnosisSignupClick("kakao", displayResult)
                }
              >
                <span className={styles.quickBadge}>3초 컷!</span>
                카카오로 시작하기
              </a>
              <a
                className={styles.naverButton}
                href={naverLoginUrl}
                onClick={() =>
                  trackDiagnosisSignupClick("naver", displayResult)
                }
              >
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

function ResultTitleIcon({ type }: { type: "person" | "chart" | "growth" | "job" }) {
  const iconClassName =
    type === "person"
      ? styles.resultSectionIcon_person
      : type === "chart"
        ? styles.resultSectionIcon_analysis
        : type === "growth"
          ? styles.resultSectionIcon_strength
          : styles.resultSectionIcon_jobs;

  return (
    <span className={`${styles.resultSectionIcon} ${iconClassName}`} aria-hidden="true" />
  );
}

function PointIcon({ kind, index }: { kind: "strength" | "growth"; index: number }) {
  return (
    <span className={styles.pointIcon} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          kind === "growth"
            ? "/diagnosis/result-detail/growth.svg"
            : `/diagnosis/result-detail/strength-${Math.min(index + 1, 3)}.svg`
        }
        alt=""
        draggable={false}
      />
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
  url.searchParams.set("entrySource", "diagnosis");
  url.searchParams.set("diagnosisRunId", diagnosisRunId);
  url.searchParams.set("anonymousId", anonymousId);

  return url.toString();
}

function trackDiagnosisSignupClick(
  provider: "kakao" | "naver",
  result: DiagnosisResultResponseDto,
) {
  trackProductEvent({
    eventType: "diagnosis_result_signup_click",
    diagnosisRunId: result.runId,
    diagnosisResultId: result.resultId,
    properties: {
      provider,
      diagnosis_type: result.typeCode,
      diagnosis_type_name: result.typeName,
    },
  });
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
