"use client";

import styles from "./BusinessInfo.module.css";

type BusinessInfoProps = {
  className?: string;
};

export function BusinessInfo({ className }: BusinessInfoProps) {
  return (
    <section className={`${styles.businessInfo} ${className ?? ""}`} aria-label="사업자 정보">
      <h2>(주)커리어넷 사업자 정보</h2>
      <dl>
        <div>
          <dt>대표이사</dt>
          <dd>박윤수</dd>
        </div>
        <div>
          <dt>주소</dt>
          <dd>
            <address>
              (주)커리어넷, (08381)서울특별시 구로구
              <br />
              디지털로 273, 2층(구로동, 에이스트윈타워 2차)
            </address>
          </dd>
        </div>
        <div>
          <dt>문의전화</dt>
          <dd>1577-9577 (평일 09:00~18:00 [주말, 공휴일 휴무])</dd>
        </div>
        <div>
          <dt>이메일</dt>
          <dd>helpdesk@career.co.kr</dd>
        </div>
        <div>
          <dt>사업자등록번호</dt>
          <dd>220-86-73547</dd>
        </div>
        <div>
          <dt>통신판매업 신고번호</dt>
          <dd>2010-서울구로-0401</dd>
        </div>
      </dl>
    </section>
  );
}
