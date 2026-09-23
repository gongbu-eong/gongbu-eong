import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./InterviewCoachingGuidePage.module.css";

const scores = [
  ["NCS 역량 표현", "답변에서 직무 역량이 드러나는 정도", "82"],
  ["질문 적합성", "질문 의도에 맞게 답했는지", "88"],
  ["구체성·근거", "경험과 결과가 구체적인지", "74"],
  ["논리·가독성", "답변 흐름이 자연스러운지", "86"],
];

const setupSteps = [
  ["01", "지원 공고 연결", "지원하려는 공고를 연결하면 직무 정보가 자동으로 반영돼요."],
  ["02", "면접 자료 입력", "자소서나 경력, 예상 답변을 파일로 올리거나 직접 입력해요."],
  ["03", "질문에 답하기", "AI가 만든 질문에 답하면서 실제 면접처럼 연습해요."],
  ["04", "결과 확인", "NCS 역량별 피드백과 다음 연습 방향을 확인해요."],
];

const checkItems = [
  "지원 직무에 맞는 NCS 역량을 확인하고 싶을 때",
  "내 답변의 강점과 보완점을 구체적으로 알고 싶을 때",
  "면접 질문에 답하는 연습이 막막할 때",
  "꼬리질문까지 이어지는 모의면접을 해보고 싶을 때",
];

export function InterviewCoachingGuidePage() {
  return (
    <main className={styles.page}>
      <div className={styles.guide}>
        <section className={`${styles.section} ${styles.hero}`}>
          <span className={styles.eyebrow}>NCS 면접 코칭이 처음이시라면?</span>
          <h1>
            면접을 준비했는데,
            <br />
            <mark>어디서부터 고쳐야 할지</mark>
            <br />
            모르겠다면?
          </h1>
          <p>
            공부엉이가 질문 의도, NCS 역량, 구체성, 답변 구조를
            <br />
            보고 무엇을 먼저 고치면 좋을지 정리해드려요.
          </p>
          <div className={styles.pillRow}>
            <span>NCS 기준 평가</span>
            <span>1문항부터 가능</span>
            <span>문항별 피드백</span>
            <span>비회원 사용 가능</span>
          </div>
          <div className={styles.heroArt}>
            <Image
              src="/jobs/detail/coaching-banner-owl.png"
              alt="면접 코칭 결과를 살펴보는 공부엉이"
              width={420}
              height={420}
              priority
            />
          </div>
        </section>

        <section className={`${styles.section} ${styles.resultSection}`}>
          <SectionHeading number="1" title={<>코칭을 받으면<br />이런 결과를 확인할 수 있어요</>} />
          <p className={styles.sectionLead}>
            점수 하나만 보여주는 것이 아니라, 왜 그런 평가를 받았는지와
            <br />무엇부터 보완할지 함께 안내해요.
          </p>
          <div className={styles.scoreCard}>
            <div className={styles.scoreHeader}>
              <div>
                <span className={styles.cardKicker}>AI 종합 분석</span>
                <strong>현재 답변의 강점과 보완점을 한눈에 확인해요</strong>
              </div>
              <div className={styles.totalScore}><b>82</b><span>/100</span></div>
            </div>
            <p className={styles.scoreSummary}>
              지원 직무와 연결되는 경험이 잘 드러나요. 답변의 근거와 결과를 조금 더 구체화하면 좋아요.
            </p>
            <div className={styles.scoreList}>
              {scores.map(([label, description, score]) => (
                <div className={styles.scoreItem} key={label}>
                  <div className={styles.scoreItemTop}><b>{label}</b><strong>{score}</strong></div>
                  <span>{description}</span>
                  <i><em style={{ width: `${score}%` }} /></i>
                </div>
              ))}
            </div>
            <div className={styles.insightGrid}>
              <div><span>가장 잘한 점</span><b>직무 경험과 역량의 연결</b></div>
              <div><span>먼저 보완할 점</span><b>행동 이후의 결과를 구체화</b></div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.detailSection}`}>
          <SectionHeading number="2" title={<>실제 결과 화면은<br />이렇게 보여요</>} dark />
          <p className={styles.sectionLead}>아래 화면은 실제 공부엉이 면접 코칭 결과 화면의 일부입니다.</p>
          <div className={styles.questionCard}>
            <div className={styles.questionTop}>
              <div className={styles.badges}><span>핵심 NCS · 경력개발능력</span><span>보조 · 직장공동체의식</span><span>추천 · STAR</span></div>
              <b>Q1</b>
            </div>
            <h3>지원 직무에 필요한 역량을 보여준 경험과, 그 경험을 통해 배운 점을 말해주세요.</h3>
            <div className={styles.evaluationHeader}><span>NCS 기준 평가</span><strong>86<small>점</small></strong></div>
            <div className={styles.evaluationBar}><i /></div>
            <div className={styles.evaluationGrid}>
              <div><b>잘한 점</b><p>문제 상황과 본인의 역할이 자연스럽게 드러나요.</p></div>
              <div><b>보완할 점</b><p>행동 이후 어떤 결과를 만들었는지 더 구체적으로 적어보세요.</p></div>
            </div>
            <div className={styles.guideNote}><span>답변 가이드</span><p>상황·행동·결과 순서로 정리하면 답변의 설득력이 더 높아져요.</p></div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.stepsSection}`}>
          <SectionHeading number="3" title={<>처음 써도<br />4단계면 끝이에요</>} />
          <div className={styles.stepList}>
            {setupSteps.map(([number, title, description]) => (
              <article key={number}><b>{number}</b><div><h3>{title}</h3><p>{description}</p></div></article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.checkSection}`}>
          <SectionHeading number="4" title={<>이런 순간에<br /><strong>시작해보세요</strong></>} />
          <ul>{checkItems.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>

        <section className={`${styles.section} ${styles.finalSection}`}>
          <span className={styles.finalMark}>AI NCS INTERVIEW COACHING</span>
          <h2>점수만 보고<br />판단하지 마세요</h2>
          <p>공부엉이의 코칭은 답변을 더 나은 방향으로 고칠 수 있도록 이유와 방법을 함께 알려드려요.</p>
          <Link className={styles.finalButton} href="/ai-tools/interview-coaching">AI NCS 면접 코칭 시작하기 <span aria-hidden="true">→</span></Link>
        </section>

        <div className={styles.mobileCta}><Link href="/ai-tools/interview-coaching">AI NCS 면접 코칭 시작하기 <span aria-hidden="true">→</span></Link></div>
      </div>
    </main>
  );
}

function SectionHeading({ number, title, dark = false }: { number: string; title: ReactNode; dark?: boolean }) {
  return (
    <div className={`${styles.sectionHeading} ${dark ? styles.darkHeading : ""}`}>
      <span className={styles.step}><b>{number}</b></span>
      <h2>{title}</h2>
    </div>
  );
}
