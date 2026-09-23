import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./InterviewCoachingGuidePage.module.css";

const scores = [
  ["NCS 역량 표현", "82", 82],
  ["문항 적합성", "88", 98],
  ["구체성·근거", "74", 75],
  ["논리·가독성", "86", 94],
] as const;

const steps = [
  ["01", "공고 선택", "공고를 선택하고 직무를\n입력하면 끝!"],
  ["02", "자소서 문항 입력", ""],
  ["03", "내가 쓴 답변 붙여넣기", "완성본이 아니어도 괜찮아요.\n초안부터 코칭할 수 있어요."],
  ["04", "AI NCS 코칭 확인", ""],
] as const;

const checks = [
  ["NCS 기준 평가", "역량별 강점과 부족한 부분을 확인"],
  ["잘한 점 · 보완점", "답변의 좋은 점과 보완할 점을 안내"],
  ["답변 구조 점검", "STAR · CAR · PAP 구조로 답변 흐름을 확인"],
  ["AI 첨삭 제안", "사실을 추가하지 않는 범위에서 첨삭본을 제안"],
  ["주요 수정 3개", "무엇부터 고쳐야 할지 우선순위를 정리"],
] as const;

const people = [
  ["asset-01.png", "문항 적합성·구체성 확인", "초안 단계에서도 사용 가능"],
  ["asset-02.png", "완성본이 아니어도 괜찮아요.", "행동·근거 중심으로 점검"],
  ["asset-03.png", "역량 표현과 구조 확인", "문항별로 꼼꼼하게 코칭"],
  ["asset-04.png", "자소서가 막막한 분", "무엇부터 고칠지 함께 확인"],
] as const;

export function InterviewCoachingGuidePage() {
  return (
    <main className={styles.page}>
      <div className={styles.canvas}>
        <section className={`${styles.panel} ${styles.hero}`}>
          <span className={styles.eyebrow}>NCS 자소서 코칭이 처음이시라면?</span>
          <h1>자소서를 썼는데,<br /><mark>어디를 고쳐야 할지</mark><br />모르겠다면?</h1>
          <p className={styles.heroCopy}>공부엉이가 문항 의도, NCS 역량, 구체성, 답변 구조를<br />보고 무엇을 먼저 고치면 좋을지 정리해드려요.</p>
          <div className={styles.pills}><span>NCS 기준 평가</span><span>1문항부터 가능</span><span>문항별 첨삭</span><span>비회원 사용가능</span></div>
          <Image className={styles.heroImage} src="/interview-coaching/figma/asset-08.png" alt="자소서 코칭을 확인하는 공부엉이" width={367} height={384} priority />
        </section>

        <section className={`${styles.panel} ${styles.resultPanel}`}>
          <SectionTitle number="1" title={<>코칭을 받으면<br />이런 결과를<br />확인할 수 있어요</>} />
          <p className={styles.panelLead}>단순히 “잘 썼다 / 못 썼다”로 끝내지 않고,<br />이유와 수정 방향까지 보여줍니다.</p>
          <div className={styles.analysisCard}>
            <span className={styles.blueButton}>AI 종합 분석</span>
            <div className={styles.total}><b>82</b><span>/100</span></div>
            <h3>직무 적합성은 좋고,<br />근거의 구체성을 더 보완해보세요.</h3>
            <p>NCS 역량과 작성 구조를 분석한 뒤,<br />사실을 추가하지 않는 범위에서 첨삭본을 제안했습니다.</p>
            <div className={styles.miniCards}><div><b>가장 강한 문항</b><span>3번 · 문제해결</span></div><div><b>우선 보완</b><span>2번 · 경험 근거</span></div></div>
            <div className={styles.scoreRows}>
              {scores.map(([label, score, width]) => <div key={label}><b>{label}</b><strong>{score}점</strong><i><em style={{ width: `${width}%` }} /></i></div>)}
            </div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.resultScreenPanel}`}>
          <SectionTitle number="2" title={<>실제 결과 화면은<br />이렇게 보여요</>} dark />
          <p className={styles.panelLead}>아래 화면은 실제 공부엉이 코칭 결과 화면<br />일부입니다.</p>
          <div className={styles.screenCard}>
            <div className={styles.screenHeader}><b>Q1</b><strong>지원 동기와 단기·장기 목표</strong><div><span>핵심 NCS · 경력개발능력</span><span>보조 · 직장공동체의식</span><span>추천 · PAP</span></div></div>
            <div className={styles.screenSection}><div className={styles.screenScore}><b>NCS 기준 평가</b><strong>86<small>점</small></strong></div><h3>경력개발능력</h3><p>지원 동기와 단기·장기 목표가 연결되어 있습니다.</p><div className={styles.greenTag}>잘한 점</div><p>지원 직무와 목표가 자연스럽게 연결돼요.</p><div className={styles.yellowTag}>코칭 포인트</div><p>경험의 근거와 구체적인 행동을 더 보완해보세요.</p></div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.stepPanel}`}>
          <SectionTitle number="3" title={<>처음 써도<br /><mark>4단계</mark>면 끝이에요</>} />
          <div className={styles.stepCards}>{steps.map(([number, title, description]) => <article key={number}><b>{number}</b><div><h3>{title}</h3>{description && <p>{description.split("\n").map((line) => <span key={line}>{line}<br /></span>)}</p>}</div></article>)}</div>
        </section>

        <section className={`${styles.panel} ${styles.checkPanel}`}>
          <SectionTitle number="4" title={<>문항 하나도<br />이렇게 꼼꼼하고<br />자세히 봐드려요</>} dark />
          <div className={styles.checkList}>{checks.map(([title, description]) => <article key={title}><Image src="/interview-coaching/figma/check.svg" alt="" width={48} height={48} /><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
        </section>

        <section className={`${styles.panel} ${styles.peoplePanel}`}>
          <SectionTitle number="5" title={<>이런 분에게<br /><mark>특히 좋아요!</mark></>} />
          <div className={styles.peopleList}>{people.map(([image, title, description]) => <article key={title}><Image src={`/interview-coaching/figma/${image}`} alt="" width={104} height={110} /><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
        </section>

        <section className={`${styles.panel} ${styles.finalPanel}`}>
          <SectionTitle number="6" title={<>점수만 보고<br /><mark>판단하지 마세요</mark></>} />
          <div className={styles.finalCopy}><h3>공부엉이의 AI NCS 자소서 코칭은</h3><p>문항 의도와 NCS 역량을 기준으로<br />무엇을 먼저 고치면 좋을지 알려드려요.</p></div>
          <Image className={styles.finalImage} src="/interview-coaching/figma/asset-09.png" alt="자소서를 코칭하는 공부엉이" width={369} height={305} />
        </section>
        <div className={styles.finalCta}><p>초안부터 완성본까지<br />공부엉이와 함께 시작해보세요.</p><Link href="/ai-tools/coaching">AI NCS 자소서 코칭 시작하기 <span aria-hidden="true">→</span></Link></div>
      </div>
    </main>
  );
}

function SectionTitle({ number, title, dark = false }: { number: string; title: ReactNode; dark?: boolean }) {
  return <div className={`${styles.sectionTitle} ${dark ? styles.darkTitle : ""}`}><span><b>{number}</b></span><h2>{title}</h2></div>;
}
