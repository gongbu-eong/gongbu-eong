"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styles from "./InterviewCoachingGuidePage.module.css";

const DESIGN_WIDTH = 393;
const DESIGN_HEIGHT = 9338;

const challenges = [
  ["“이 직무에서 뭘 물어볼까?”", "기업마다 직무가 다른데 인터넷 예상 질문만 반복하고 있을 때"],
  ["첫 답변 다음이 막막할 때", "준비한 답변은 말했지만, 꼬리질문이 들어오면 흐름이 끊길 때"],
  ["내 답변이 괜찮은지 확인 받고 싶을 때", "말은 했지만 직무 관점에서 무엇이 부족한지 확인하기 어려울 때"],
] as const;

const steps = [
  ["01", "지원 공고 연결", "공고를 연결하고 지원 직무를 입력합니다."],
  ["02", "면접 자료 입력", "자소서·경험자료가 있다면 파일로 첨부하거나 텍스트로 입력합니다."],
  ["03", "AI 질문에 답변", "직무 기반 질문과 이어지는 꼬리질문에 실제 면접처럼 답합니다."],
  ["04", "코칭 결과 확인", "문항별 피드백과 NCS 직무 역량 분석을 확인합니다."],
] as const;

const people = [
  ["person-question.webp", "예상 질문부터 막막한 취준생", "지원 직무에서 무엇을 물어볼지 감이 안 잡힐 때"],
  ["person-followup.webp", "꼬리질문에 자꾸 답이 짧아지는 분", "외운 답변보다 실제 대화형 면접을 연습하고 싶을 때"],
  ["person-resume.webp", "자소서를 면접까지 연결하고 싶은 분", "내 경험을 면접 답변으로 어떻게 확장할지 연습하고 싶을 때"],
  ["person-role.webp", "직무 중심으로 준비하고 싶은 분", "막연한 공통 질문보다 지원 직무 기반 질문이 필요할 때"],
] as const;

export function InterviewCoachingGuidePage({ startHref }: { startHref: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateScale = () => setScale(frame.clientWidth / DESIGN_WIDTH);
    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const frameStyle = { height: DESIGN_HEIGHT * scale } satisfies CSSProperties;
  const canvasStyle = { transform: `scale(${scale})` } satisfies CSSProperties;
  return (
    <main className={styles.page}>
      <div ref={frameRef} className={styles.canvasFrame} style={frameStyle}>
        <div className={styles.guide} style={canvasStyle}>
        <section className={styles.hero}>
          <Image className={styles.heroSwoosh} src="/interview-coaching/guide/hero-swoosh.svg" alt="" width={139} height={118} />
          <span className={styles.heroBadge}>NCS 직무 기반 AI 면접 연습</span>
          <h1><strong>면접질문</strong><mark>혼자 예상하지 마세요.</mark></h1>
          <p>지원 공고와 직무를 바탕으로 AI가 질문을 만들고,<br />답변 뒤에는 꼬리질문까지 이어서 연습합니다.</p>
          <div className={styles.heroTags}><span>공고 연결</span><span>NCS 직무 분석</span><span>AI 면접 질문</span><span>꼬리질문</span><span>문항별 코칭</span></div>
          <Image className={styles.heroImage} src="/interview-coaching/guide/hero.webp" alt="면접 질문을 분석하는 공부엉이" width={951} height={682} priority />
        </section>

        <section className={styles.challengeSection}>
          <span className={styles.sectionBadge}>면접 준비, 이런 순간이 어렵죠</span>
          <Image className={styles.challengeArrow} src="/interview-coaching/guide/challenge-arrow.svg" alt="" width={21} height={18} />
          <h2>예상 질문은 만들었는데<br /><mark>실전처럼 준비가<br />안 된다면?</mark></h2>
          <div className={styles.challengeList}>{challenges.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </section>

        <section className={styles.resolveSection}>
          <h2>공부엉이<br />NCS 직무 기반<br />AI 면접을 쓰면</h2>
          <strong>해결</strong>
          <Image src="/interview-coaching/guide/resolve.webp" alt="면접 준비를 마친 공부엉이" width={926} height={921} />
        </section>

        <section className={styles.connectSection}>
          <GuideTitle number="1">공고를 연결하면<br />질문부터 달라집니다</GuideTitle>
          <div className={styles.connectRows}>
            <InfoRow title="면접 기업 정보">면접을 보는 공고를 검색해서 연결 후<br />지원 직무를 입력합니다.</InfoRow>
            <InfoRow title="면접 자료 or 자소서">면접에 필요한 자료나 자소서가 있다면<br />등록하여 시작합니다.</InfoRow>
          </div>
          <div className={styles.inputPreview}>
            <h3>실제 면접 공부엉이 페이지 화면</h3>
            <div className={styles.previewSurface}>
              <strong>면접 기업 정보</strong><button type="button" tabIndex={-1}>+ 지원 공고 연결하기</button>
              <strong>면접 자료</strong>
              <div className={styles.previewTabs}><span>파일 첨부</span><span>직접 입력하기</span></div>
              <div className={styles.previewDrop}><b>파일로 면접 자료 업로드</b><span>파일을 선택하거나 여기에 끌어다 놓으세요</span><small>HWP · HWPX · PDF · DOCX · PPT · PPTX</small></div>
            </div>
          </div>
        </section>

        <section className={styles.analysisSection}>
          <GuideTitle number="2" inverted>질문을 만들기 전에<br /><mark>직무부터 분석합니다</mark></GuideTitle>
          <p className={styles.sectionLead}>연결한 공고의 직무를 NCS 역량과 이어서<br />실제 업무와 필요한 지식·경험을 먼저 정리합니다.</p>
          <div className={styles.analysisCards}>
            <BulletCard title="주요 업무" items={["직무에서 실제로 수행하는 핵심 업무", "업무 중 발생할 수 있는 상황과 문제", "조직에서 기대하는 역할과 행동"]} />
            <BulletCard title="필요 지식·경험" items={["직무 수행에 필요한 기본 지식", "관련 규정·절차·업무 이해", "문제 해결에 필요한 사고 과정"]} />
          </div>
        </section>

        <section className={styles.questionSection}>
          <GuideTitle number="3">질문 하나에<br />꼬리질문 <mark>3개!</mark></GuideTitle>
          <p className={styles.sectionLead}>첫 질문에 답하면, 같은 답변을 더 깊게 확인하는<br />꼬리질문으로 실제 면접 흐름을 연습합니다.</p>
          <article className={styles.mainQuestion}><strong>질문 1 · 심화 · 경험면접</strong><p>전기 설비에 이상이 발생했는데, 처음에는 원인을 잘 알 수 없었던 상황이 있었나요? 당시 어떤 순서와 기준으로 문제를 정의하고, 가능한 원인들을 좁혀 가며 최종 해결에 이르렀는지 과정을 단계별로 설명해 주세요.</p></article>
          <article className={styles.followQuestion}><strong>면접관 꼬리질문 1/3</strong><p>“그 판단 기준을 선택한 이유는 무엇이었나요?”</p></article>
          <article className={styles.followQuestion}><strong>면접관 꼬리질문 2/3</strong><p>“다시 같은 상황이 온다면 어떤 부분을 다르게 하시겠습니까?”</p></article>
        </section>

        <section className={styles.feedbackSection}>
          <GuideTitle number="4" inverted>연습이 끝나면<br /><mark>답변을 그냥<br />끝내지 않습니다</mark></GuideTitle>
          <p className={styles.sectionLead}>문항별 답변과 꼬리질문을 기준으로<br />잘한 점과 보완할 점을 구체적으로 확인합니다.</p>
          <div className={styles.feedbackScores}><Score label="문항별 피드백" width="82%">질문의 의도에 맞게 답했는지, 설명이 구체적인지 확인합니다.</Score><Score label="꼬리질문 코칭" width="73%">추가 질문에서 답변이 흔들린 지점과 보완 방향을 확인합니다.</Score><Score label="NCS 직무 역량 분석" width="91%">직무 이해, 의사소통, 문제해결 항목을 함께 살펴봅니다.</Score></div>
          <h3 className={styles.feedbackPreviewTitle}>실제 면접 공부엉이 페이지 화면</h3>
          <div className={styles.feedbackCards}>
            <FeedbackCard label="평가 요약">질문 의도를 전혀 반영하지 못한 단답으로, 실제 전기 설비 이상 사례와 5단계 설명이 전혀 제시되지 않았습니다.</FeedbackCard>
            <FeedbackCard label="보완점">방금 답변은 질문에 전혀 답이 되지 않습니다. 실제 전기 설비 이상 사례 하나를 정해서, 아래 구조에 맞춰 다시 말씀해 주세요.<br />1) 언제, 어디서, 어떤 설비에서 어떤 이상 증상이 있었는지 (예: 특정 층 조명 일부 소등, 분전반 트립 등)<br /><br />2) 처음에 무엇을 의심했지만 왜 확신할 수 없었는지 (정보 부족, 증상 모호 등)</FeedbackCard>
            <FeedbackCard label="질문 의도">지금 단계에서는 ‘아무 사례도 없는 상태’에서 떠올리려다 보니 막힌 것 같습니다. 우선 전기 설비 교육·실습이나 인턴, 아르바이트, 학교 실험 등에서 겪었던 아주 사소한 이상이라도 하나를 먼저 정해 주세요.</FeedbackCard>
          </div>
        </section>

        <section className={styles.stepsSection}>
          <GuideTitle number="5">4단계면<br /><mark>면접 연습</mark>이 끝납니다.</GuideTitle>
          <div className={styles.stepList}>{steps.map(([number, title, copy]) => <article key={number}><b>{number}</b><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div>
        </section>

        <section className={styles.peopleSection}>
          <GuideTitle number="5" inverted>이런 분에게<br />특히 필요합니다!</GuideTitle>
          <div className={styles.peopleList}>{people.map(([image, title, copy]) => <article key={title}><div className={styles.personImage}><Image src={`/interview-coaching/guide/${image}`} alt="" width={333} height={333} /></div><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div>
        </section>

        <section className={styles.noticeSection}>
          <span>사용 전 확인</span><h2>AI 코칭은 <mark>연습을<br />위한 참고자료입니다</mark></h2><p>결과를 그대로 외우기보다 내 경험과 상황에 맞게<br />검토하고 활용해 주세요.</p>
          <div><article><h3>공고 연결 시</h3><p>실제 채용공고의 직무·자격요건·우대사항·전형정보를 반영해 질문을 생성합니다.</p></article><article><h3>AI 결과 안내</h3><p>AI가 생성한 질문과 피드백에는 오류나 부정확한 내용이 포함될 수 있으며 실제 면접 결과를 보장하지 않습니다.</p></article></div>
        </section>

        <section className={styles.closingSection}>
          <span>AI NCS 면접 코칭</span><h2>면접 전날 처음 보는<br />질문보다 <mark>오늘<br />한 번 더 답해보세요</mark></h2><p>지원 직무에 맞는 질문부터 꼬리질문,<br />답변 코칭까지 한 번에 연습해보세요.</p>
          <Image src="/interview-coaching/guide/closing.webp" alt="책을 읽으며 면접을 준비하는 공부엉이" width={819} height={765} />
        </section>
        </div>
      </div>

      <div className={styles.finalCtaFrame}>
        <div className={styles.finalCta}>
          <h2>연습은 많을수록 좋아요.</h2><p>지원 직무에 맞는 질문부터 꼬리질문,<br />답변 코칭까지 한 번에 연습해보세요.</p>
          <Link href={startHref} prefetch={false}>AI NCS 면접 코칭 시작하기 <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </main>
  );
}

function GuideTitle({ number, inverted = false, children }: { number: string; inverted?: boolean; children: ReactNode }) {
  const iconByNumber: Record<string, string> = {
    "1": "step-1.svg",
    "2": "step-3.svg",
    "3": "step-4.svg",
    "4": "step-5.svg",
    "5": "step-4.svg",
  };
  const icon = number === "5" && inverted ? "step-6.svg" : iconByNumber[number];
  return <div className={`${styles.guideTitle} ${inverted ? styles.guideTitleInverted : ""}`}><span><Image src={`/interview-coaching/guide/${icon ?? "step-6.svg"}`} alt="" width={56} height={56} /><b>{number}</b></span><h2>{children}</h2></div>;
}

function InfoRow({ title, children }: { title: string; children: ReactNode }) {
  return <article><Image src="/interview-coaching/guide/check.svg" alt="" width={48} height={48} /><div><h3>{title}</h3><p>{children}</p></div></article>;
}

function BulletCard({ title, items }: { title: string; items: readonly string[] }) {
  return <article><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></article>;
}

function Score({ label, width, children }: { label: string; width: string; children: ReactNode }) {
  return <article><strong>{label}</strong><i><b style={{ width }} /></i><p>{children}</p></article>;
}

function FeedbackCard({ label, children }: { label: string; children: ReactNode }) {
  return <article><span>{label}</span><p>{children}</p></article>;
}
